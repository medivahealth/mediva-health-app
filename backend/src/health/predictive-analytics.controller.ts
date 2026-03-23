import { Controller, Get, UseGuards, Request, Post, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PredictiveAnalyticsService } from './predictive-analytics.service';

@Controller('health/analytics')
@UseGuards(JwtAuthGuard)
export class PredictiveAnalyticsController {
  constructor(private predictiveAnalytics: PredictiveAnalyticsService) {}

  @Get('trends')
  async getTrends(@Request() req: any) {
    const userId = req.user.userId;
    const trends = await this.predictiveAnalytics.analyzeTrends(userId);
    return { trends };
  }

  @Get('alerts')
  async getAlerts(@Request() req: any) {
    const userId = req.user.userId;
    const alerts = await this.predictiveAnalytics.generatePredictiveAlerts(userId);
    return { alerts };
  }

  @Get('insights')
  async getInsights(@Request() req: any) {
    const userId = req.user.userId;
    const insights = await this.predictiveAnalytics.getHealthInsights(userId);
    return { insights };
  }

  @Get('illness-check')
  async checkIllness(@Request() req: any) {
    const userId = req.user.userId;
    const result = await this.predictiveAnalytics.detectEarlyIllnessSigns(userId);
    return result;
  }

  @Post('check-all')
  async runFullAnalysis(@Request() req: any) {
    const userId = req.user.userId;
    
    const [trends, alerts, insights, illnessCheck] = await Promise.all([
      this.predictiveAnalytics.analyzeTrends(userId),
      this.predictiveAnalytics.generatePredictiveAlerts(userId),
      this.predictiveAnalytics.getHealthInsights(userId),
      this.predictiveAnalytics.detectEarlyIllnessSigns(userId),
    ]);

    return {
      trends,
      alerts,
      insights,
      illnessCheck,
      analyzedAt: new Date(),
    };
  }
}
