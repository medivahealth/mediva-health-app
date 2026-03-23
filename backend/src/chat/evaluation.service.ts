import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatSession } from './chat.schema';
import { OpenRouterService, ModelTier } from '../common/openrouter.service';

export interface EvaluationMetrics {
  accuracy: number; // 0-100: How accurate is the medical information?
  completeness: number; // 0-100: Does it fully address the question?
  empathy: number; // 0-100: Is the tone appropriate and empathetic?
  evidenceQuality: number; // 0-100: Quality of citations and sources
  safety: number; // 0-100: Safety of recommendations (higher = safer)
  overallScore: number; // Weighted average
  issues: string[]; // List of identified issues
  strengths: string[]; // List of strengths
}

export interface EvaluationResult {
  sessionId: string;
  messageIndex: number;
  metrics: EvaluationMetrics;
  evaluatedAt: Date;
  evaluatorType: 'auto' | 'doctor' | 'user_feedback';
}

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);

  constructor(
    @InjectModel(ChatSession.name) private chatModel: Model<ChatSession>,
    private openRouter: OpenRouterService,
  ) {}

  /**
   * Automatically evaluate an AI response for quality
   */
  async evaluateResponse(
    sessionId: string,
    userQuery: string,
    aiResponse: string,
    citations: string[],
    severity: string,
  ): Promise<EvaluationMetrics> {
    try {
      const evaluationPrompt = `You are a medical AI response evaluator. Evaluate the following AI medical response for quality.

USER QUERY: "${userQuery}"

AI RESPONSE:
${aiResponse}

CITATIONS PROVIDED: ${citations.length}
SEVERITY DETECTED: ${severity}

Evaluate the response on these dimensions (0-100 scale each):

1. ACCURACY: Is the medical information accurate and evidence-based? Does it align with current medical knowledge?
2. COMPLETENESS: Does the response fully address the user's question? Are important aspects covered?
3. EMPATHY: Is the tone appropriate, empathetic, and reassuring? Does it show concern for the patient?
4. EVIDENCE QUALITY: Are citations relevant and high-quality? Are sources properly referenced?
5. SAFETY: Are recommendations safe? Are appropriate disclaimers included? Is severity properly assessed?

Respond with ONLY a JSON object in this exact format:
{
  "accuracy": 85,
  "completeness": 90,
  "empathy": 88,
  "evidenceQuality": 82,
  "safety": 95,
  "issues": ["Minor issue 1", "Minor issue 2"],
  "strengths": ["Strength 1", "Strength 2"]
}

Be strict but fair. Issues should be specific problems. Strengths should be specific positive aspects.`;

      const response = await this.openRouter.chat(
        [{ role: 'user', content: evaluationPrompt }],
        ModelTier.REASONING,
        { temperature: 0.2, maxTokens: 500 },
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Calculate weighted overall score
        const overallScore = Math.round(
          parsed.accuracy * 0.3 +
          parsed.completeness * 0.25 +
          parsed.empathy * 0.15 +
          parsed.evidenceQuality * 0.15 +
          parsed.safety * 0.15
        );

        return {
          accuracy: Math.min(100, Math.max(0, parsed.accuracy || 70)),
          completeness: Math.min(100, Math.max(0, parsed.completeness || 70)),
          empathy: Math.min(100, Math.max(0, parsed.empathy || 70)),
          evidenceQuality: Math.min(100, Math.max(0, parsed.evidenceQuality || 70)),
          safety: Math.min(100, Math.max(0, parsed.safety || 70)),
          overallScore,
          issues: parsed.issues || [],
          strengths: parsed.strengths || [],
        };
      }
    } catch (err) {
      this.logger.warn('Auto-evaluation failed:', err);
    }

    // Fallback: Basic heuristic evaluation
    return this.heuristicEvaluation(userQuery, aiResponse, citations, severity);
  }

  /**
   * Heuristic-based fallback evaluation
   */
  private heuristicEvaluation(
    userQuery: string,
    aiResponse: string,
    citations: string[],
    severity: string,
  ): EvaluationMetrics {
    let accuracy = 70;
    let completeness = 70;
    let empathy = 70;
    let evidenceQuality = 50;
    let safety = 80;
    const issues: string[] = [];
    const strengths: string[] = [];

    // Accuracy: Check for medical terms and evidence
    if (aiResponse.includes('[1]') || aiResponse.includes('[2]')) {
      accuracy += 10;
      strengths.push('Uses citations');
    } else {
      issues.push('Missing citations');
    }

    // Completeness: Check response length and structure
    if (aiResponse.length >= 200 && aiResponse.length <= 2000) {
      completeness += 10;
      strengths.push('Appropriate length');
    } else if (aiResponse.length < 200) {
      issues.push('Response too short');
      completeness -= 10;
    }

    // Empathy: Check for empathetic language
    const empatheticWords = ['understand', 'concern', 'support', 'help', 'care', 'feel'];
    if (empatheticWords.some(word => aiResponse.toLowerCase().includes(word))) {
      empathy += 10;
      strengths.push('Empathetic tone');
    }

    // Evidence Quality: Based on citation count
    if (citations.length >= 2) {
      evidenceQuality += 20;
      strengths.push('Multiple citations');
    } else if (citations.length === 0) {
      issues.push('No citations provided');
      evidenceQuality -= 20;
    }

    // Safety: Check for disclaimers and severity handling
    if (aiResponse.includes('consult') || aiResponse.includes('doctor') || aiResponse.includes('medical attention')) {
      safety += 10;
      strengths.push('Includes safety disclaimers');
    }
    if (severity === 'HIGH' || severity === 'EMERGENCY') {
      if (aiResponse.includes('108') || aiResponse.includes('emergency')) {
        safety += 10;
        strengths.push('Proper emergency guidance');
      } else {
        issues.push('Missing emergency guidance for high severity');
        safety -= 15;
      }
    }

    const overallScore = Math.round(
      accuracy * 0.3 +
      completeness * 0.25 +
      empathy * 0.15 +
      evidenceQuality * 0.15 +
      safety * 0.15
    );

    return {
      accuracy: Math.min(100, Math.max(0, accuracy)),
      completeness: Math.min(100, Math.max(0, completeness)),
      empathy: Math.min(100, Math.max(0, empathy)),
      evidenceQuality: Math.min(100, Math.max(0, evidenceQuality)),
      safety: Math.min(100, Math.max(0, safety)),
      overallScore,
      issues,
      strengths,
    };
  }

  /**
   * Store evaluation results in session
   */
  async storeEvaluation(
    sessionId: string,
    messageIndex: number,
    metrics: EvaluationMetrics,
    evaluatorType: 'auto' | 'doctor' | 'user_feedback' = 'auto',
  ): Promise<void> {
    try {
      const session = await this.chatModel.findById(sessionId);
      if (!session) return;

      // Store evaluation in qualityMetrics or create new field
      if (!session.qualityMetrics) {
        session.qualityMetrics = {} as any;
      }

      // Store detailed evaluation
      (session.qualityMetrics as any).evaluation = {
        accuracy: metrics.accuracy,
        completeness: metrics.completeness,
        empathy: metrics.empathy,
        evidenceQuality: metrics.evidenceQuality,
        safety: metrics.safety,
        overallScore: metrics.overallScore,
        issues: metrics.issues,
        strengths: metrics.strengths,
        evaluatedAt: new Date(),
        evaluatorType,
      };

      // Update overall quality score if evaluation is better
      if (metrics.overallScore > (session.qualityMetrics.qualityScore || 0)) {
        session.qualityMetrics.qualityScore = metrics.overallScore;
      }

      await session.save();
    } catch (err) {
      this.logger.error('Failed to store evaluation:', err);
    }
  }

  /**
   * Get evaluation statistics for a user or globally
   */
  async getEvaluationStats(userId?: string): Promise<{
    averageAccuracy: number;
    averageCompleteness: number;
    averageEmpathy: number;
    averageEvidenceQuality: number;
    averageSafety: number;
    averageOverallScore: number;
    totalEvaluations: number;
  }> {
    const query: any = {
      'qualityMetrics.evaluation': { $exists: true },
      deletedByUser: { $ne: true },
    };

    if (userId) {
      query.userId = userId;
    }

    const sessions = await this.chatModel
      .find(query)
      .select('qualityMetrics')
      .lean();

    if (sessions.length === 0) {
      return {
        averageAccuracy: 0,
        averageCompleteness: 0,
        averageEmpathy: 0,
        averageEvidenceQuality: 0,
        averageSafety: 0,
        averageOverallScore: 0,
        totalEvaluations: 0,
      };
    }

    const evaluations = sessions
      .map((s: any) => s.qualityMetrics?.evaluation)
      .filter((e: any) => e);

    const totals = evaluations.reduce(
      (acc: any, e: any) => ({
        accuracy: acc.accuracy + (e.accuracy || 0),
        completeness: acc.completeness + (e.completeness || 0),
        empathy: acc.empathy + (e.empathy || 0),
        evidenceQuality: acc.evidenceQuality + (e.evidenceQuality || 0),
        safety: acc.safety + (e.safety || 0),
        overallScore: acc.overallScore + (e.overallScore || 0),
      }),
      { accuracy: 0, completeness: 0, empathy: 0, evidenceQuality: 0, safety: 0, overallScore: 0 },
    );

    const count = evaluations.length;

    return {
      averageAccuracy: Math.round((totals.accuracy / count) * 100) / 100,
      averageCompleteness: Math.round((totals.completeness / count) * 100) / 100,
      averageEmpathy: Math.round((totals.empathy / count) * 100) / 100,
      averageEvidenceQuality: Math.round((totals.evidenceQuality / count) * 100) / 100,
      averageSafety: Math.round((totals.safety / count) * 100) / 100,
      averageOverallScore: Math.round((totals.overallScore / count) * 100) / 100,
      totalEvaluations: count,
    };
  }
}
