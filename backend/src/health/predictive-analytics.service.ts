import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HealthData } from './health.schema';
import { UserService } from '../user/user.service';

export interface HealthTrend {
  metric: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
  period: number; // days
  concern: boolean;
}

export interface PredictiveAlert {
  userId: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  recommendedAction: string;
  triggeredAt: Date;
  metrics: Record<string, any>;
}

@Injectable()
export class PredictiveAnalyticsService {
  private readonly logger = new Logger(PredictiveAnalyticsService.name);

  constructor(
    @InjectModel(HealthData.name) private healthModel: Model<HealthData>,
    private userService: UserService,
  ) {}

  /**
   * Analyze wearable data trends and detect concerning patterns
   */
  async analyzeTrends(userId: string): Promise<HealthTrend[]> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const oid = new Types.ObjectId(userId);

    // Get data for last 7 days
    const healthData = await this.healthModel
      .find({
        userId: oid,
        timestamp: { $gte: sevenDaysAgo },
      })
      .sort({ timestamp: 1 })
      .lean();

    if (healthData.length === 0) return [];

    // Group by metric type
    const byType = healthData.reduce((acc, record) => {
      if (!acc[record.type]) acc[record.type] = [];
      acc[record.type].push(record);
      return acc;
    }, {} as Record<string, typeof healthData>);

    const trends: HealthTrend[] = [];

    // Analyze each metric
    for (const [type, records] of Object.entries(byType)) {
      if (records.length < 3) continue; // Need enough data points

      // Split into first half vs second half
      const midPoint = Math.floor(records.length / 2);
      const firstHalf = records.slice(0, midPoint);
      const secondHalf = records.slice(midPoint);

      const firstAvg = firstHalf.reduce((sum, r) => sum + (r.value || 0), 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, r) => sum + (r.value || 0), 0) / secondHalf.length;

      const changePercent = firstAvg !== 0 ? ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100 : 0;
      const direction = changePercent > 5 ? 'increasing' : changePercent < -5 ? 'decreasing' : 'stable';

      // Determine if concerning based on metric type
      let concern = false;
      
      switch (type) {
        case 'hrv': // Declining HRV is concerning
          concern = changePercent < -10; // 10% decline
          break;
        case 'resting_heart_rate': // Increasing RHR is concerning
          concern = changePercent > 10; // 10% increase
          break;
        case 'sleep_duration': // Declining sleep is concerning
          concern = changePercent < -15; // 15% decline
          break;
        case 'steps': // Significant decline in activity
          concern = changePercent < -30; // 30% decline
          break;
        case 'spo2': // Declining oxygen saturation
          concern = changePercent < -3; // 3% decline is serious
          break;
        case 'weight': // Rapid weight change
          concern = Math.abs(changePercent) > 5; // 5% change either way
          break;
      }

      trends.push({
        metric: type,
        direction,
        changePercent: Math.round(changePercent * 100) / 100,
        period: 7,
        concern,
      });
    }

    return trends;
  }

  /**
   * Generate predictive health alerts based on trends
   */
  async generatePredictiveAlerts(userId: string): Promise<PredictiveAlert[]> {
    const trends = await this.analyzeTrends(userId);
    const concerningTrends = trends.filter((t) => t.concern);

    if (concerningTrends.length === 0) return [];

    const user = await this.userService.findById(userId);
    const alerts: PredictiveAlert[] = [];

    for (const trend of concerningTrends) {
      const alert = this.createAlertForTrend(userId, trend, user.name);
      if (alert) alerts.push(alert);
    }

    // Special: Multiple declining metrics = higher concern
    if (concerningTrends.length >= 2) {
      alerts.push({
        userId,
        alertType: 'multi_metric_decline',
        severity: 'high',
        title: 'Multiple Health Metrics Declining',
        message: `We've noticed concerning trends in ${concerningTrends.length} health metrics over the past week. This pattern may indicate increased stress, illness onset, or other health changes.`,
        recommendedAction: 'Consider scheduling a consultation to discuss these changes. Monitor your symptoms closely.',
        triggeredAt: new Date(),
        metrics: {
          decliningMetrics: concerningTrends.map((t) => t.metric),
        },
      });
    }

    // Absolute threshold alerts from latest wearable values (continuous monitoring rules)
    const oid = new Types.ObjectId(userId);
    const [latestRestingHr, latestSpo2, latestSleep, latestHrv] = await Promise.all([
      this.healthModel.findOne({ userId: oid, type: 'resting_heart_rate' }).sort({ timestamp: -1 }).lean(),
      this.healthModel.findOne({ userId: oid, type: 'spo2' }).sort({ timestamp: -1 }).lean(),
      this.healthModel.findOne({ userId: oid, type: 'sleep_duration' }).sort({ timestamp: -1 }).lean(),
      this.healthModel.findOne({ userId: oid, type: 'hrv' }).sort({ timestamp: -1 }).lean(),
    ]);

    if (typeof latestRestingHr?.value === 'number' && latestRestingHr.value >= 110) {
      alerts.push({
        userId,
        alertType: 'threshold_rhr_high',
        severity: 'high',
        title: 'High Resting Heart Rate',
        message: `Latest resting heart rate is ${latestRestingHr.value} bpm, above safety threshold.`,
        recommendedAction: 'Recheck after rest and hydration. If persistent or with symptoms, seek urgent medical review.',
        triggeredAt: new Date(),
        metrics: { restingHeartRate: latestRestingHr.value, threshold: 110 },
      });
    }

    if (typeof latestSpo2?.value === 'number' && latestSpo2.value < 94) {
      alerts.push({
        userId,
        alertType: 'threshold_spo2_low',
        severity: 'high',
        title: 'Low Oxygen Saturation',
        message: `Latest SpO2 is ${latestSpo2.value}%, below clinical alert threshold (<94%).`,
        recommendedAction: 'Repeat measurement with proper fit. If still low or breathing symptoms present, seek immediate medical care.',
        triggeredAt: new Date(),
        metrics: { spo2: latestSpo2.value, threshold: 94 },
      });
    }

    if (typeof latestSleep?.value === 'number' && latestSleep.value < 5) {
      alerts.push({
        userId,
        alertType: 'threshold_sleep_low',
        severity: 'medium',
        title: 'Very Low Sleep Duration',
        message: `Latest sleep duration is ${latestSleep.value} hours, below healthy target.`,
        recommendedAction: 'Prioritize sleep hygiene tonight and monitor fatigue, mood, and concentration.',
        triggeredAt: new Date(),
        metrics: { sleepHours: latestSleep.value, threshold: 5 },
      });
    }

    if (typeof latestHrv?.value === 'number' && latestHrv.value < 20) {
      alerts.push({
        userId,
        alertType: 'threshold_hrv_low',
        severity: 'medium',
        title: 'Low HRV',
        message: `Latest HRV is ${latestHrv.value}, which may indicate high stress/recovery load.`,
        recommendedAction: 'Reduce high-intensity effort, hydrate, and focus on rest and recovery.',
        triggeredAt: new Date(),
        metrics: { hrv: latestHrv.value, threshold: 20 },
      });
    }

    return alerts;
  }

  /**
   * Create specific alert for a trend
   */
  private createAlertForTrend(
    userId: string,
    trend: HealthTrend,
    userName?: string,
  ): PredictiveAlert | null {
    const name = userName || 'there';

    switch (trend.metric) {
      case 'hrv':
        if (trend.direction === 'decreasing' && trend.changePercent < -10) {
          return {
            userId,
            alertType: 'hrv_decline',
            severity: 'medium',
            title: 'Declining Heart Rate Variability',
            message: `Hi ${name}, your HRV has decreased by ${Math.abs(trend.changePercent)}% over the past week. Lower HRV can indicate increased stress, fatigue, or early signs of illness.`,
            recommendedAction: 'Prioritize rest, hydration, and stress management. Consider reducing intense exercise temporarily.',
            triggeredAt: new Date(),
            metrics: {
              hrvChange: trend.changePercent,
              period: trend.period,
            },
          };
        }
        break;

      case 'resting_heart_rate':
        if (trend.direction === 'increasing' && trend.changePercent > 10) {
          return {
            userId,
            alertType: 'rhr_increase',
            severity: 'medium',
            title: 'Elevated Resting Heart Rate',
            message: `Your resting heart rate has increased by ${Math.abs(trend.changePercent)}% recently. This can signal stress, dehydration, illness, or reduced fitness.`,
            recommendedAction: 'Stay hydrated, get adequate rest, and monitor for other symptoms. If sustained, consult a healthcare provider.',
            triggeredAt: new Date(),
            metrics: {
              rhrChange: trend.changePercent,
              period: trend.period,
            },
          };
        }
        break;

      case 'sleep_duration':
        if (trend.direction === 'decreasing' && trend.changePercent < -15) {
          return {
            userId,
            alertType: 'sleep_deficit',
            severity: 'medium',
            title: 'Sleep Duration Declining',
            message: `You're sleeping ${Math.abs(trend.changePercent)}% less than usual this week. Consistent sleep deprivation affects immunity, mood, and cognitive function.`,
            recommendedAction: 'Aim for 7-9 hours nightly. Maintain consistent sleep schedule and good sleep hygiene.',
            triggeredAt: new Date(),
            metrics: {
              sleepChange: trend.changePercent,
              period: trend.period,
            },
          };
        }
        break;

      case 'spo2':
        if (trend.direction === 'decreasing' && trend.changePercent < -3) {
          return {
            userId,
            alertType: 'spo2_decline',
            severity: 'high',
            title: 'Blood Oxygen Levels Decreasing',
            message: `Your blood oxygen saturation (SpO2) has decreased noticeably. This could indicate respiratory issues or other health concerns.`,
            recommendedAction: 'Monitor closely. If you experience shortness of breath, chest discomfort, or dizziness, seek medical attention promptly.',
            triggeredAt: new Date(),
            metrics: {
              spo2Change: trend.changePercent,
              period: trend.period,
            },
          };
        }
        break;

      case 'weight':
        if (Math.abs(trend.changePercent) > 5) {
          const direction = trend.direction === 'increasing' ? 'gained' : 'lost';
          return {
            userId,
            alertType: 'weight_change',
            severity: 'low',
            title: `Significant Weight ${direction === 'gained' ? 'Gain' : 'Loss'}`,
            message: `You've ${direction} approximately ${Math.abs(trend.changePercent)}% body weight recently. While this can be normal, rapid changes warrant attention.`,
            recommendedAction: 'Track your diet and activity. If unintentional or accompanied by other symptoms, consult a healthcare provider.',
            triggeredAt: new Date(),
            metrics: {
              weightChange: trend.changePercent,
              direction,
              period: trend.period,
            },
          };
        }
        break;
    }

    return null;
  }

  /**
   * Get proactive health insights (not urgent, just informative)
   */
  async getHealthInsights(userId: string): Promise<string[]> {
    const trends = await this.analyzeTrends(userId);
    const insights: string[] = [];

    // Positive trends
    const positiveTrends = trends.filter((t) => !t.concern && t.changePercent !== 0);

    positiveTrends.forEach((trend) => {
      switch (trend.metric) {
        case 'steps':
          if (trend.direction === 'increasing') {
            insights.push('Great job! Your daily activity has increased. Keep up the active lifestyle! 🎉');
          }
          break;
        case 'sleep_duration':
          if (trend.direction === 'increasing') {
            insights.push('Excellent! You\'re getting better sleep lately. Quality rest supports overall health. 😴');
          }
          break;
        case 'hrv':
          if (trend.direction === 'increasing') {
            insights.push('Positive trend! Your HRV is improving, indicating better cardiovascular fitness and stress resilience. 💪');
          }
          break;
      }
    });

    return insights;
  }

  /**
   * Check if user might be getting sick (early warning)
   */
  async detectEarlyIllnessSigns(userId: string): Promise<{
    isGettingSick: boolean;
    confidence: number;
    indicators: string[];
    recommendation: string;
  }> {
    const trends = await this.analyzeTrends(userId);
    
    // Early illness indicators
    const illnessIndicators: string[] = [];
    let indicatorCount = 0;

    // Check for common pre-illness patterns
    if (trends.some((t) => t.metric === 'hrv' && t.concern)) {
      illnessIndicators.push('Declining HRV (often drops before illness)');
      indicatorCount++;
    }

    if (trends.some((t) => t.metric === 'resting_heart_rate' && t.concern)) {
      illnessIndicators.push('Elevated resting heart rate');
      indicatorCount++;
    }

    if (trends.some((t) => t.metric === 'sleep_duration' && t.concern)) {
      illnessIndicators.push('Disrupted sleep patterns');
      indicatorCount++;
    }

    const confidence = Math.min(100, indicatorCount * 30); // Max 100%
    const isGettingSick = indicatorCount >= 2;

    return {
      isGettingSick,
      confidence,
      indicators: illnessIndicators,
      recommendation: isGettingSick
        ? 'Your biometric data suggests you may be getting sick. Prioritize rest, stay hydrated, and consider reducing physical stress. Monitor for symptoms.'
        : 'No early illness patterns detected. Continue healthy habits!',
    };
  }
}
