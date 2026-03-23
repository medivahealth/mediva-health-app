import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatSession, ChatSessionSchema } from './chat.schema';
import { OpenRouterService, ModelTier } from '../common/openrouter.service';

export interface LearningCase {
  originalQuery: string;
  originalResponse: string;
  doctorCorrection: string;
  severity: string;
  medicalCategory: string;
  symptoms: string[];
  learnedAt: Date;
  qualityScore: number;
}

@Injectable()
export class ContinuousLearningService {
  private readonly logger = new Logger(ContinuousLearningService.name);
  private learningCases: LearningCase[] = [];
  private readonly MAX_CASES = 50; // Keep last 50 high-quality cases

  constructor(
    @InjectModel(ChatSession.name) private chatModel: Model<ChatSession>,
    private openRouter: OpenRouterService,
  ) {}

  /**
   * Extract learning from doctor corrections
   */
  async learnFromDoctorCorrection(
    sessionId: string,
    doctorMessage: string,
    approved: boolean,
  ): Promise<void> {
    try {
      const session = await this.chatModel.findById(sessionId).lean();
      if (!session) return;

      // Find the AI response that doctor reviewed
      const aiMessageIndex = session.messages.findIndex(
        (m: any) => m.role === 'assistant' && m.severity,
      );
      
      if (aiMessageIndex === -1) return;

      const aiMessage = session.messages[aiMessageIndex];
      const userMessage = session.messages.find((m: any) => m.role === 'user');
      
      if (!userMessage) return;

      // Categorize the case
      const category = await this.categorizeCase(userMessage.content, aiMessage.content);
      
      // Extract symptoms from query
      const symptoms = await this.extractSymptoms(userMessage.content);

      // Calculate quality score based on doctor's action
      let qualityScore = 70;
      if (approved) {
        qualityScore = 90; // AI was correct
      } else {
        // Doctor corrected - evaluate how different the correction was
        const differenceScore = await this.evaluateCorrectionDifference(
          aiMessage.content,
          doctorMessage,
        );
        qualityScore = Math.max(60, 90 - differenceScore); // Higher difference = more learning needed
      }

      const learningCase: LearningCase = {
        originalQuery: userMessage.content,
        originalResponse: aiMessage.content,
        doctorCorrection: doctorMessage,
        severity: aiMessage.severity || 'LOW',
        medicalCategory: category,
        symptoms,
        learnedAt: new Date(),
        qualityScore,
      };

      // Add to learning database
      this.learningCases.push(learningCase);

      // Keep only recent high-quality cases
      if (this.learningCases.length > this.MAX_CASES) {
        // Sort by quality and recency, keep top cases
        this.learningCases.sort((a, b) => {
          const scoreDiff = b.qualityScore - a.qualityScore;
          if (scoreDiff !== 0) return scoreDiff;
          return new Date(b.learnedAt).getTime() - new Date(a.learnedAt).getTime();
        });
        this.learningCases = this.learningCases.slice(0, this.MAX_CASES);
      }

      this.logger.log(
        `Learned from doctor correction - Case ${sessionId} (Quality: ${qualityScore}, Category: ${category})`,
      );
    } catch (err) {
      this.logger.error('Failed to learn from doctor correction:', err);
    }
  }

  /**
   * Get few-shot examples for similar cases
   */
  async getFewShotExamples(
    currentQuery: string,
    currentSymptoms: string[],
    limit: number = 3,
  ): Promise<LearningCase[]> {
    if (this.learningCases.length === 0) return [];

    // Find similar cases based on symptoms and category
    const scoredCases = this.learningCases.map((caseItem) => {
      const symptomOverlap = currentSymptoms.filter((s) =>
        caseItem.symptoms.some((cs) => cs.toLowerCase().includes(s.toLowerCase())),
      ).length;
      
      const recencyScore = Math.max(
        0,
        1 - (Date.now() - new Date(caseItem.learnedAt).getTime()) / (30 * 24 * 60 * 60 * 1000), // Last 30 days
      );

      const totalScore = 
        (symptomOverlap * 10) + 
        (caseItem.qualityScore * 0.5) + 
        (recencyScore * 20);

      return { case: caseItem, score: totalScore };
    });

    // Sort by score and return top examples
    scoredCases.sort((a, b) => b.score - a.score);
    return scoredCases.slice(0, limit).map((item) => item.case);
  }

  /**
   * Build few-shot prompt for AI
   */
  async buildFewShotPrompt(
    currentQuery: string,
    symptoms: string[],
  ): Promise<string> {
    const examples = await this.getFewShotExamples(currentQuery, symptoms);
    
    if (examples.length === 0) return '';

    let fewShotText = '\n\nLEARNED FROM DOCTOR CORRECTIONS (Similar Cases):\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    for (let i = 0; i < examples.length; i++) {
      const example = examples[i];
      const keyLearning = await this.extractKeyLearning(example);
      fewShotText += `\nExample ${i + 1} (${example.medicalCategory}, Severity: ${example.severity}):\n`;
      fewShotText += `Patient Query: "${example.originalQuery}"\n`;
      fewShotText += `AI Response: [Provided]\n`;
      fewShotText += `Doctor Correction/Enhancement: ${example.doctorCorrection}\n`;
      fewShotText += `Key Learning: ${keyLearning}\n`;
    }

    fewShotText += '\nUse these learnings to improve your response.\n';
    
    return fewShotText;
  }

  /**
   * Categorize medical case using AI
   */
  private async categorizeCase(query: string, response: string): Promise<string> {
    try {
      const categorizationPrompt = `Categorize this medical case into ONE category:
Query: "${query}"
Response: "${response.substring(0, 200)}..."

Categories: cardiology, neurology, respiratory, gastroenterology, endocrinology, 
orthopedics, dermatology, mental_health, women_health, pediatric, general_medicine, emergency

Respond with ONLY the category name.`;

      const category = await this.openRouter.chat(
        [{ role: 'user', content: categorizationPrompt }],
        ModelTier.FAST,
        { temperature: 0.1, maxTokens: 20 },
      );

      return category.trim().toLowerCase() || 'general_medicine';
    } catch {
      return 'general_medicine';
    }
  }

  /**
   * Extract symptoms from query using AI
   */
  private async extractSymptoms(query: string): Promise<string[]> {
    try {
      const extractionPrompt = `Extract all symptoms mentioned in this patient query. Return as JSON array.

Query: "${query}"

Example format: ["chest pain", "shortness of breath", "dizziness"]

Respond with ONLY a JSON array of strings.`;

      const response = await this.openRouter.chat(
        [{ role: 'user', content: extractionPrompt }],
        ModelTier.FAST,
        { temperature: 0.2, maxTokens: 100 },
      );

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fallback: simple keyword extraction
      const symptomKeywords = ['pain', 'ache', 'hurt', 'discomfort', 'pressure', 'burning'];
      return symptomKeywords.filter((k) => query.toLowerCase().includes(k));
    }
    
    return [];
  }

  /**
   * Evaluate how different doctor correction is from AI response
   */
  private async evaluateCorrectionDifference(
    aiResponse: string,
    doctorCorrection: string,
  ): Promise<number> {
    try {
      const diffPrompt = `Compare these two medical responses and rate their difference (0-100):

AI RESPONSE: "${aiResponse.substring(0, 300)}..."
DOCTOR CORRECTION: "${doctorCorrection.substring(0, 300)}..."

Rate 0-100 where:
0 = Identical meaning
50 = Some differences in recommendations
100 = Completely different advice or critical additions

Respond with ONLY a number.`;

      const response = await this.openRouter.chat(
        [{ role: 'user', content: diffPrompt }],
        ModelTier.FAST,
        { temperature: 0.1, maxTokens: 10 },
      );

      const num = parseInt(response.match(/\d+/)?.[0] || '50');
      return Math.min(100, Math.max(0, num));
    } catch {
      return 50;
    }
  }

  /**
   * Extract key learning from a case
   */
  private async extractKeyLearning(example: LearningCase): Promise<string> {
    try {
      const extractionPrompt = `What is the KEY LEARNING from this doctor correction?

Original Query: "${example.originalQuery}"
AI Response Summary: "${example.originalResponse.substring(0, 150)}..."
Doctor Correction: "${example.doctorCorrection.substring(0, 150)}..."

Summarize the key learning in ONE sentence. What should AI do differently next time?

Respond with ONE concise sentence.`;

      const learning = await this.openRouter.chat(
        [{ role: 'user', content: extractionPrompt }],
        ModelTier.FAST,
        { temperature: 0.2, maxTokens: 50 },
      );

      return learning.trim();
    } catch {
      return 'Follow doctor guidance for similar cases';
    }
  }

  /**
   * Get learning statistics
   */
  getLearningStats() {
    const byCategory = this.learningCases.reduce((acc, item) => {
      acc[item.medicalCategory] = (acc[item.medicalCategory] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgQuality = 
      this.learningCases.reduce((sum, item) => sum + item.qualityScore, 0) / 
      (this.learningCases.length || 1);

    return {
      totalCases: this.learningCases.length,
      averageQualityScore: Math.round(avgQuality),
      casesByCategory: byCategory,
      lastUpdated: this.learningCases.length > 0 
        ? this.learningCases[this.learningCases.length - 1].learnedAt 
        : null,
    };
  }
}
