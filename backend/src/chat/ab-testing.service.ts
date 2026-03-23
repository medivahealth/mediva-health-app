import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatSession } from './chat.schema';
import { AgentType } from './multi-agent.service';

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  agentStrategy: AgentType[];
  systemPromptModifier?: string;
  modelTier?: string;
}

export interface ABTestResult {
  variantId: string;
  sessionId: string;
  userQuery: string;
  response: string;
  qualityScore: number;
  userFeedback?: 'like' | 'dislike';
  responseTime: number;
  timestamp: Date;
}

@Injectable()
export class ABTestingService {
  private readonly logger = new Logger(ABTestingService.name);

  // Define test variants
  private readonly variants: ABTestVariant[] = [
    {
      id: 'baseline',
      name: 'Baseline (Single General Agent)',
      description: 'Standard single general medical agent',
      agentStrategy: ['general_medical'],
    },
    {
      id: 'multi_agent',
      name: 'Multi-Agent (Specialized)',
      description: 'Uses specialized agent based on query type',
      agentStrategy: [], // Will be selected dynamically
    },
    {
      id: 'multi_agent_synthesis',
      name: 'Multi-Agent Synthesis',
      description: 'Uses multiple agents and synthesizes responses',
      agentStrategy: [], // Will be selected dynamically, multiple agents
    },
    {
      id: 'reasoning_focused',
      name: 'Reasoning-Focused',
      description: 'Uses reasoning model with enhanced step-by-step thinking',
      agentStrategy: ['general_medical'],
      systemPromptModifier: 'Focus heavily on step-by-step medical reasoning. Show your thinking process.',
    },
  ];

  constructor(@InjectModel(ChatSession.name) private chatModel: Model<ChatSession>) {}

  /**
   * Select a variant for A/B testing (can be random or based on user characteristics)
   */
  selectVariant(userId: string, query: string): ABTestVariant {
    // Simple hash-based assignment for consistency per user
    const hash = this.simpleHash(userId + query);
    const variantIndex = hash % this.variants.length;
    return this.variants[variantIndex];
  }

  /**
   * Simple hash function for consistent variant assignment
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Record A/B test result
   */
  async recordTestResult(
    variantId: string,
    sessionId: string,
    userQuery: string,
    response: string,
    qualityScore: number,
    responseTime: number,
    userFeedback?: 'like' | 'dislike',
  ): Promise<void> {
    try {
      const session = await this.chatModel.findById(sessionId);
      if (!session) return;

      // Store AB test metadata
      if (!session.qualityMetrics) {
        session.qualityMetrics = {} as any;
      }

      (session.qualityMetrics as any).abTest = {
        variantId,
        responseTime,
        recordedAt: new Date(),
      };

      await session.save();

      this.logger.debug(`AB test result recorded: variant=${variantId}, score=${qualityScore}, feedback=${userFeedback || 'none'}`);
    } catch (err) {
      this.logger.error('Failed to record AB test result:', err);
    }
  }

  /**
   * Get A/B test statistics comparing variants
   */
  async getTestStatistics(): Promise<{
    variants: Array<{
      variantId: string;
      name: string;
      totalTests: number;
      averageQualityScore: number;
      averageResponseTime: number;
      likeRate: number;
      dislikeRate: number;
      overallPerformance: number;
    }>;
  }> {
    const sessions = await this.chatModel
      .find({
        'qualityMetrics.abTest': { $exists: true },
        deletedByUser: { $ne: true },
      })
      .select('qualityMetrics messages')
      .lean();

    const variantStats: Record<string, any> = {};

    for (const session of sessions) {
      const abTest = (session as any).qualityMetrics?.abTest;
      if (!abTest) continue;

      const variantId = abTest.variantId;
      if (!variantStats[variantId]) {
        variantStats[variantId] = {
          variantId,
          totalTests: 0,
          totalQualityScore: 0,
          totalResponseTime: 0,
          likes: 0,
          dislikes: 0,
        };
      }

      const stats = variantStats[variantId];
      stats.totalTests++;
      stats.totalQualityScore += (session as any).qualityMetrics?.qualityScore || 0;
      stats.totalResponseTime += abTest.responseTime || 0;

      // Check for user feedback
      const messages = (session as any).messages || [];
      const lastAssistantMsg = messages
        .filter((m: any) => m.role === 'assistant')
        .pop();
      if (lastAssistantMsg?.feedback === 'like') {
        stats.likes++;
      } else if (lastAssistantMsg?.feedback === 'dislike') {
        stats.dislikes++;
      }
    }

    const variants = Object.values(variantStats).map((stats: any) => {
      const variant = this.variants.find((v) => v.id === stats.variantId);
      const totalFeedback = stats.likes + stats.dislikes;
      
      return {
        variantId: stats.variantId,
        name: variant?.name || stats.variantId,
        totalTests: stats.totalTests,
        averageQualityScore: stats.totalTests > 0 
          ? Math.round((stats.totalQualityScore / stats.totalTests) * 100) / 100 
          : 0,
        averageResponseTime: stats.totalTests > 0 
          ? Math.round((stats.totalResponseTime / stats.totalTests) * 100) / 100 
          : 0,
        likeRate: totalFeedback > 0 
          ? Math.round((stats.likes / totalFeedback) * 100) 
          : 0,
        dislikeRate: totalFeedback > 0 
          ? Math.round((stats.dislikes / totalFeedback) * 100) 
          : 0,
        overallPerformance: this.calculateOverallPerformance(stats),
      };
    });

    return { variants };
  }

  /**
   * Calculate overall performance score for a variant
   */
  private calculateOverallPerformance(stats: any): number {
    const avgQuality = stats.totalTests > 0 ? stats.totalQualityScore / stats.totalTests : 0;
    const totalFeedback = stats.likes + stats.dislikes;
    const likeRate = totalFeedback > 0 ? stats.likes / totalFeedback : 0.5; // Default to neutral if no feedback
    
    // Weighted: 60% quality score, 40% user satisfaction
    return Math.round((avgQuality * 0.6 + likeRate * 100 * 0.4) * 100) / 100;
  }

  /**
   * Get the best performing variant
   */
  async getBestVariant(): Promise<ABTestVariant | null> {
    const stats = await this.getTestStatistics();
    if (stats.variants.length === 0) return null;

    const best = stats.variants.reduce((prev, current) => 
      current.overallPerformance > prev.overallPerformance ? current : prev
    );

    return this.variants.find((v) => v.id === best.variantId) || null;
  }

  /**
   * Get all available variants
   */
  getVariants(): ABTestVariant[] {
    return this.variants;
  }
}
