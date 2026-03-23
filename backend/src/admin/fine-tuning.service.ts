import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatSession } from '../chat/chat.schema';
import { S3Service } from '../common/s3.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class FineTuningService {
  private readonly logger = new Logger(FineTuningService.name);

  constructor(
    @InjectModel(ChatSession.name) private chatModel: Model<ChatSession>,
    private s3Service: S3Service,
  ) {}

  async collectHighQualityPairs(userId?: string, sessionId?: string): Promise<{ collected: number }> {
    // This method marks high-quality conversations for fine-tuning dataset
    // In a real implementation, you would store these in a separate collection
    // For now, we'll just return a count of eligible sessions

    const query: any = {
      'qualityMetrics.qualityScore': { $gte: 70 }, // Only high-quality responses
      'qualityMetrics.citationCount': { $gte: 2 }, // Must have citations
      'qualityMetrics.responseLength': { $gte: 200, $lte: 2000 }, // Appropriate length
      deletedByUser: { $ne: true },
    };

    if (userId) {
      query.userId = userId;
    }
    if (sessionId) {
      query._id = sessionId;
    }

    const eligibleSessions = await this.chatModel.find(query).select('messages qualityMetrics').lean();

    // Filter for sessions with positive feedback or high quality
    const highQualitySessions = eligibleSessions.filter((session: any) => {
      const hasPositiveFeedback = session.messages?.some(
        (msg: any) => msg.role === 'assistant' && msg.feedback === 'like',
      );
      return hasPositiveFeedback || (session.qualityMetrics?.qualityScore || 0) >= 80;
    });

    return { collected: highQualitySessions.length };
  }

  async exportDataset(format: 'jsonl' | 'csv'): Promise<string> {
    const query = {
      'qualityMetrics.qualityScore': { $gte: 70 },
      'qualityMetrics.citationCount': { $gte: 2 },
      deletedByUser: { $ne: true },
    };

    const sessions = await this.chatModel.find(query).select('messages qualityMetrics').lean();

    const pairs: Array<{ prompt: string; completion: string; metadata: any }> = [];

    for (const session of sessions) {
      const messages = (session as any).messages || [];
      for (let i = 0; i < messages.length - 1; i++) {
        if (messages[i].role === 'user' && messages[i + 1].role === 'assistant') {
          const assistantMsg = messages[i + 1];
          // Only include if assistant message has good quality indicators
          if (
            assistantMsg.content &&
            assistantMsg.content.length >= 200 &&
            assistantMsg.citations &&
            assistantMsg.citations.length >= 2
          ) {
            const evaluation = (session as any).qualityMetrics?.evaluation;
            
            // Calculate advanced metrics
            const medicalAccuracy = this.calculateMedicalAccuracy(assistantMsg.content, assistantMsg.citations);
            const semanticRelevance = this.calculateSemanticRelevance(messages[i].content, assistantMsg.content);

            pairs.push({
              prompt: messages[i].content,
              completion: assistantMsg.content,
              metadata: {
                sessionId: (session as any)._id.toString(),
                qualityScore: (session as any).qualityMetrics?.qualityScore || 0,
                citationCount: assistantMsg.citations?.length || 0,
                severity: assistantMsg.severity || '',
                feedback: assistantMsg.feedback || '',
                // Advanced metrics
                medicalAccuracy,
                semanticRelevance,
                evaluationScore: evaluation?.overallScore || 0,
                accuracy: evaluation?.accuracy || 0,
                completeness: evaluation?.completeness || 0,
                empathy: evaluation?.empathy || 0,
                evidenceQuality: evaluation?.evidenceQuality || 0,
                safety: evaluation?.safety || 0,
              },
            });
          }
        }
      }
    }

    if (format === 'jsonl') {
      return pairs.map((p) => JSON.stringify(p)).join('\n');
    } else {
      // CSV format with advanced metrics
      const headers = 'prompt,completion,qualityScore,citationCount,severity,feedback,medicalAccuracy,semanticRelevance,evaluationScore,accuracy,completeness,empathy,evidenceQuality,safety\n';
      const rows = pairs
        .map(
          (p) =>
            `"${p.prompt.replace(/"/g, '""')}","${p.completion.replace(/"/g, '""')}",${p.metadata.qualityScore},${p.metadata.citationCount},${p.metadata.severity},${p.metadata.feedback},${p.metadata.medicalAccuracy},${p.metadata.semanticRelevance},${p.metadata.evaluationScore},${p.metadata.accuracy},${p.metadata.completeness},${p.metadata.empathy},${p.metadata.evidenceQuality},${p.metadata.safety}`,
        )
        .join('\n');
      return headers + rows;
    }
  }

  /**
   * Calculate medical accuracy score based on medical terminology and evidence
   */
  private calculateMedicalAccuracy(response: string, citations: string[]): number {
    let score = 50; // Base score

    // Medical terminology presence
    const medicalTerms = [
      'diagnosis', 'symptom', 'treatment', 'medication', 'condition', 'disease',
      'syndrome', 'disorder', 'therapy', 'clinical', 'medical', 'health',
      'patient', 'doctor', 'physician', 'hospital', 'care', 'wellness',
    ];
    const termCount = medicalTerms.filter(term => 
      response.toLowerCase().includes(term)
    ).length;
    score += Math.min(20, termCount * 2);

    // Evidence-based language
    if (response.includes('research') || response.includes('study') || response.includes('evidence')) {
      score += 10;
    }

    // Citations boost
    score += Math.min(20, citations.length * 5);

    // Safety disclaimers
    if (response.includes('consult') || response.includes('doctor') || response.includes('medical professional')) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculate semantic relevance between query and response
   * Simple keyword overlap + length appropriateness
   */
  private calculateSemanticRelevance(query: string, response: string): number {
    let score = 60; // Base score

    // Extract key terms from query
    const queryWords = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3);

    // Check if response addresses query terms
    const responseLower = response.toLowerCase();
    const matchingTerms = queryWords.filter(word => responseLower.includes(word));
    const relevanceRatio = queryWords.length > 0 ? matchingTerms.length / queryWords.length : 0;
    score += Math.round(relevanceRatio * 30);

    // Length appropriateness (response should be substantial but not excessive)
    const lengthScore = response.length >= 200 && response.length <= 2000 ? 10 : 0;
    score += lengthScore;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Automatically export dataset to S3 and return the S3 URL
   */
  async exportToS3(format: 'jsonl' | 'csv' = 'jsonl'): Promise<{ url: string; key: string; count: number }> {
    const dataset = await this.exportDataset(format);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `fine-tuning-dataset-${timestamp}.${format}`;
    
    const { key, url } = await this.s3Service.upload(
      Buffer.from(dataset, 'utf-8'),
      fileName,
      format === 'jsonl' ? 'application/jsonl' : 'text/csv',
      'fine-tuning',
    );

    const count = dataset.split('\n').filter((line) => line.trim().length > 0).length;
    
    this.logger.log(`Exported ${count} training pairs to S3: ${url}`);
    
    return { url, key, count };
  }

  /**
   * Scheduled job: Automatically export fine-tuning dataset daily at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledExport(): Promise<void> {
    try {
      this.logger.log('Starting scheduled fine-tuning dataset export...');
      const result = await this.exportToS3('jsonl');
      this.logger.log(`Scheduled export completed: ${result.count} pairs exported to ${result.url}`);
    } catch (error) {
      this.logger.error('Scheduled fine-tuning export failed:', error);
    }
  }

  async getStats(): Promise<{
    totalSessions: number;
    highQualitySessions: number;
    totalPairs: number;
    averageQualityScore: number;
  }> {
    const [totalSessions, highQualitySessions, allSessions] = await Promise.all([
      this.chatModel.countDocuments({ deletedByUser: { $ne: true } }),
      this.chatModel.countDocuments({
        'qualityMetrics.qualityScore': { $gte: 70 },
        deletedByUser: { $ne: true },
      }),
      this.chatModel
        .find({ 'qualityMetrics.qualityScore': { $exists: true }, deletedByUser: { $ne: true } })
        .select('qualityMetrics')
        .lean(),
    ]);

    const totalPairs = allSessions.reduce((sum, session: any) => {
      const messages = (session as any).messages || [];
      return sum + messages.filter((m: any) => m.role === 'assistant').length;
    }, 0);

    const avgScore =
      allSessions.length > 0
        ? allSessions.reduce((sum, s: any) => sum + ((s.qualityMetrics?.qualityScore || 0) as number), 0) /
          allSessions.length
        : 0;

    return {
      totalSessions,
      highQualitySessions,
      totalPairs,
      averageQualityScore: Math.round(avgScore * 100) / 100,
    };
  }
}
