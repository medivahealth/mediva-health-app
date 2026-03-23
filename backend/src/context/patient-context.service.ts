import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { User } from '../user/user.schema';
import { ChatSession } from '../chat/chat.schema';
import { HealthData } from '../health/health.schema';
import { HealthService } from '../health/health.service';
import { RecordsService } from '../records/records.service';
import { UserService } from '../user/user.service';
import { OpenRouterService } from '../common/openrouter.service';

/**
 * Complete patient context - everything AI needs to know
 * This is the unified data structure that powers contextual health responses
 */
export interface CompletePatientContext {
  // Demographics
  demographics: {
    name: string;
    age: number | null;
    gender: string;
    location: string;
    phone?: string;
    email?: string;
    bloodType?: string;
  };

  // Health history from onboarding
  healthHistory: {
    allergies: string[];
    chronicConditions: string[];
    currentMedications: string[];
    pastSurgeries: string[];
    familyHistory: string[];
    lifestyleFactors: {
      smoking: boolean;
      alcohol: boolean;
      exercise: string;
    };
    completedAt?: Date;
  };

  // Latest wearable data
  wearableData: {
    heartRate: number | null;
    bloodPressure: { systolic: number; diastolic: number } | null;
    bloodGlucose: number | null;
    spo2: number | null;
    sleep: { durationHours: number; sleepScore?: number } | null;
    steps: number | null;
    weight: number | null;
    hrv: number | null;
    lastSynced: Date | null;
    sources: string[];
  };

  // Trends over time
  trends: {
    heartRateTrend: 'increasing' | 'decreasing' | 'stable' | 'unknown';
    bloodGlucoseTrend: 'increasing' | 'decreasing' | 'stable' | 'unknown';
    weightTrend: 'increasing' | 'decreasing' | 'stable' | 'unknown';
    sleepQualityTrend: 'improving' | 'declining' | 'stable' | 'unknown';
  };

  // ABDM records (FHIR bundles)
  abdmRecords: {
    conditions: any[];
    medications: any[];
    labResults: any[];
    procedures: any[];
    immunizations: any[];
    lastFetched: Date | null;
  };

  // Uploaded medical records
  uploadedRecords: {
    documents: any[];
    extractedData: {
      diagnoses: string[];
      medications: string[];
      labResults: string[];
    };
  };

  // Active prescriptions from our system
  activePrescriptions: any[];

  // Recent chat history summary
  recentHealthConcerns: string[];

  // AI-detected insights (Lotus-style)
  insights: {
    hiddenDiagnoses: HiddenDiagnosis[];
    careGaps: CareGap[];
    riskFactors: RiskFactor[];
    proactiveAlerts: ProactiveAlert[];
  };

  // Metadata
  contextBuiltAt: Date;
  dataCompleteness: number; // 0-100 score
}

export interface HiddenDiagnosis {
  condition: string;
  icdCode?: string;
  evidence: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high';
  detectedFrom: string; // 'lab_results' | 'symptoms' | 'medications' | 'wearable_data'
}

export interface CareGap {
  type: string;
  description: string;
  recommendation: string;
  urgency: 'routine' | 'urgent';
}

export interface RiskFactor {
  factor: string;
  level: 'low' | 'moderate' | 'high';
  evidence: string;
  modifiable: boolean;
}

export interface ProactiveAlert {
  type: 'trend_alert' | 'missed_medication' | 'abnormal_value' | 'follow_up_needed';
  message: string;
  severity: 'info' | 'warning' | 'urgent';
  actionRequired: boolean;
}

@Injectable()
export class PatientContextService {
  private readonly logger = new Logger(PatientContextService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(ChatSession.name) private chatModel: Model<ChatSession>,
    @InjectModel(HealthData.name) private healthModel: Model<HealthData>,
    private healthService: HealthService,
    private recordsService: RecordsService,
    private userService: UserService,
    private openRouter: OpenRouterService,
  ) {}

  /**
   * Build complete patient context - called on EVERY message
   * This is the core function that gives AI full patient understanding
   */
  async buildCompleteContext(userId: string): Promise<CompletePatientContext> {
    const startTime = Date.now();
    
    // Run all data fetches in parallel for speed
    const [
      user,
      healthSummary,
      abdmRecords,
      uploadedRecords,
      activePrescriptions,
      recentChats,
    ] = await Promise.all([
      this.userService.findById(userId).catch(() => null),
      this.healthService.getUserHealthSummary(userId).catch(() => ({ latest: {}, sources: [] })),
      this.getAbdmRecords(userId).catch(() => ({ conditions: [], medications: [], labResults: [], procedures: [], immunizations: [], lastFetched: null })),
      this.getUploadedRecords(userId).catch(() => ({ documents: [], extractedData: { diagnoses: [], medications: [], labResults: [] } })),
      this.getActivePrescriptions(userId).catch(() => []),
      this.getRecentChatSummary(userId).catch(() => []),
    ]);

    // Build demographics
    const demographics = this.buildDemographics(user);

    // Build health history
    const healthHistory = this.buildHealthHistory(user);

    // Build wearable data with trends
    const wearableData = this.buildWearableData(healthSummary);
    const trends = await this.calculateTrends(userId, healthSummary);

    // Build ABDM records
    const abdmData = this.buildAbdmData(abdmRecords);

    // Detect hidden issues (Lotus-style AI analysis)
    const insights = await this.detectHiddenIssues(
      userId,
      demographics,
      healthHistory,
      wearableData,
      abdmData,
      uploadedRecords.extractedData,
      recentChats,
    );

    // Calculate data completeness score
    const dataCompleteness = this.calculateDataCompleteness({
      demographics,
      healthHistory,
      wearableData,
      abdmRecords,
      uploadedRecords,
    });

    const context: CompletePatientContext = {
      demographics,
      healthHistory,
      wearableData,
      trends,
      abdmRecords: abdmData,
      uploadedRecords,
      activePrescriptions,
      recentHealthConcerns: recentChats,
      insights,
      contextBuiltAt: new Date(),
      dataCompleteness,
    };

    this.logger.log(`Context built for ${userId} in ${Date.now() - startTime}ms (completeness: ${dataCompleteness}%)`);
    
    return context;
  }

  /**
   * Background job - analyzes all patients every 6 hours
   * Generates proactive insights and alerts
   */
  @Cron('0 */6 * * *')
  async analyzeAllPatients(): Promise<void> {
    this.logger.log('Starting periodic analysis of all patients...');
    
    const activeUsers = await this.userModel.find({ 
      role: 'user',
      'healthHistory.completedAt': { $exists: true },
    }).limit(100); // Process in batches

    for (const user of activeUsers) {
      try {
        await this.analyzePatientHealth(user._id.toString());
      } catch (err) {
        this.logger.error(`Failed to analyze patient ${user._id}: ${err}`);
      }
    }

    this.logger.log(`Periodic analysis complete for ${activeUsers.length} patients`);
  }

  /**
   * Proactive health monitoring for a single patient
   * Detects anomalies and generates alerts
   */
  async analyzePatientHealth(userId: string): Promise<ProactiveAlert[]> {
    const context = await this.buildCompleteContext(userId);
    const alerts: ProactiveAlert[] = [];

    // Check for concerning trends
    if (context.trends.bloodGlucoseTrend === 'increasing' && context.healthHistory.chronicConditions.includes('Diabetes')) {
      alerts.push({
        type: 'trend_alert',
        message: 'Your blood glucose levels have been trending upward over the past week. This may need attention.',
        severity: 'warning',
        actionRequired: true,
      });
    }

    if (context.trends.heartRateTrend === 'increasing' && context.wearableData.heartRate && context.wearableData.heartRate > 100) {
      alerts.push({
        type: 'trend_alert',
        message: 'Your resting heart rate has been elevated. Consider checking with a doctor if this persists.',
        severity: 'warning',
        actionRequired: true,
      });
    }

    // Check for abnormal values
    if (context.wearableData.spo2 && context.wearableData.spo2 < 95) {
      alerts.push({
        type: 'abnormal_value',
        message: `Your SpO2 level (${context.wearableData.spo2}%) is below normal. Please monitor closely.`,
        severity: 'urgent',
        actionRequired: true,
      });
    }

    if (context.wearableData.bloodGlucose && context.wearableData.bloodGlucose > 180) {
      alerts.push({
        type: 'abnormal_value',
        message: `Your blood glucose (${context.wearableData.bloodGlucose} mg/dL) is high. Consider your next meal carefully.`,
        severity: 'warning',
        actionRequired: true,
      });
    }

    // Check for hidden diagnoses that need attention
    for (const diagnosis of context.insights.hiddenDiagnoses) {
      if (diagnosis.severity === 'high') {
        alerts.push({
          type: 'follow_up_needed',
          message: `Based on your health data, there may be an undiagnosed concern: ${diagnosis.condition}. Please discuss with a doctor.`,
          severity: 'urgent',
          actionRequired: true,
        });
      }
    }

    return alerts;
  }

  /**
   * Get patient timeline for doctor dashboard
   */
  async getPatientTimeline(userId: string): Promise<any> {
    const context = await this.buildCompleteContext(userId);
    
    return {
      patient: context.demographics,
      timeline: {
        conditions: context.abdmRecords.conditions,
        medications: [...context.healthHistory.currentMedications, ...context.abdmRecords.medications],
        labResults: context.abdmRecords.labResults,
        procedures: context.abdmRecords.procedures,
        recentVitals: context.wearableData,
        uploadedDocuments: context.uploadedRecords.documents,
      },
      insights: context.insights,
      dataCompleteness: context.dataCompleteness,
    };
  }

  // ─── Private Helper Methods ─────────────────────────────────────────

  private buildDemographics(user: any): CompletePatientContext['demographics'] {
    if (!user) {
      return {
        name: 'Patient',
        age: null,
        gender: 'Unknown',
        location: 'Unknown',
      };
    }

    return {
      name: user.name || 'Patient',
      age: null, // Calculate from DOB if available
      gender: 'Unknown', // Add to user schema if needed
      location: 'India', // Default
      phone: user.phone,
      email: user.email,
      bloodType: user.healthHistory?.bloodType,
    };
  }

  private buildHealthHistory(user: any): CompletePatientContext['healthHistory'] {
    if (!user?.healthHistory) {
      return {
        allergies: [],
        chronicConditions: [],
        currentMedications: [],
        pastSurgeries: [],
        familyHistory: [],
        lifestyleFactors: {
          smoking: false,
          alcohol: false,
          exercise: '',
        },
      };
    }

    return {
      allergies: user.healthHistory.allergies || [],
      chronicConditions: user.healthHistory.chronicConditions || [],
      currentMedications: user.healthHistory.currentMedications || [],
      pastSurgeries: user.healthHistory.pastSurgeries || [],
      familyHistory: user.healthHistory.familyHistory || [],
      lifestyleFactors: user.healthHistory.lifestyleFactors || {
        smoking: false,
        alcohol: false,
        exercise: '',
      },
      completedAt: user.healthHistory.completedAt,
    };
  }

  private buildWearableData(healthSummary: any): CompletePatientContext['wearableData'] {
    const latest = healthSummary.latest || {};
    
    return {
      heartRate: latest.heartRate ?? null,
      bloodPressure: null, // Extract from health data if available
      bloodGlucose: null, // Extract from health data if available
      spo2: latest.spo2 ?? null,
      sleep: latest.sleep ?? null,
      steps: latest.steps ?? null,
      weight: latest.weight ?? null,
      hrv: latest.hrv ?? null,
      lastSynced: new Date(),
      sources: healthSummary.sources || [],
    };
  }

  private async calculateTrends(userId: string, healthSummary: any): Promise<CompletePatientContext['trends']> {
    try {
      const oid = new Types.ObjectId(userId);
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Get health data for trend calculation
      const [recentHR, olderHR, recentWeight, olderWeight, recentSleep, olderSleep, recentGlucose, olderGlucose] = await Promise.all([
        // Recent 7 days
        this.healthModel.aggregate([
          { $match: { userId: oid, type: 'heart_rate', timestamp: { $gte: sevenDaysAgo } } },
          { $group: { _id: null, avg: { $avg: '$value' }, count: { $sum: 1 } } },
        ]),
        // Previous 7 days
        this.healthModel.aggregate([
          { $match: { userId: oid, type: 'heart_rate', timestamp: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } } },
          { $group: { _id: null, avg: { $avg: '$value' }, count: { $sum: 1 } } },
        ]),
        // Weight recent
        this.healthModel.aggregate([
          { $match: { userId: oid, type: 'weight', timestamp: { $gte: sevenDaysAgo } } },
          { $group: { _id: null, avg: { $avg: '$value' }, count: { $sum: 1 } } },
        ]),
        // Weight older
        this.healthModel.aggregate([
          { $match: { userId: oid, type: 'weight', timestamp: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } } },
          { $group: { _id: null, avg: { $avg: '$value' }, count: { $sum: 1 } } },
        ]),
        // Sleep recent
        this.healthModel.aggregate([
          { $match: { userId: oid, type: 'sleep', timestamp: { $gte: sevenDaysAgo } } },
          { $group: { _id: null, avgDuration: { $avg: '$value.durationHours' }, count: { $sum: 1 } } },
        ]),
        // Sleep older
        this.healthModel.aggregate([
          { $match: { userId: oid, type: 'sleep', timestamp: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } } },
          { $group: { _id: null, avgDuration: { $avg: '$value.durationHours' }, count: { $sum: 1 } } },
        ]),
        // Glucose recent
        this.healthModel.aggregate([
          { $match: { userId: oid, type: 'blood_glucose', timestamp: { $gte: sevenDaysAgo } } },
          { $group: { _id: null, avg: { $avg: '$value' }, count: { $sum: 1 } } },
        ]),
        // Glucose older
        this.healthModel.aggregate([
          { $match: { userId: oid, type: 'blood_glucose', timestamp: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } } },
          { $group: { _id: null, avg: { $avg: '$value' }, count: { $sum: 1 } } },
        ]),
      ]);

      // Calculate trends (compare recent vs older period)
      const calcTrend = (recent: any[], older: any[], threshold = 0.05): 'increasing' | 'decreasing' | 'stable' | 'unknown' => {
        const recentAvg = recent[0]?.avg || recent[0]?.avgDuration;
        const olderAvg = older[0]?.avg || older[0]?.avgDuration;
        
        if (recentAvg == null || olderAvg == null || recent[0]?.count < 2 || older[0]?.count < 2) {
          return 'unknown';
        }
        
        const change = (recentAvg - olderAvg) / olderAvg;
        
        if (Math.abs(change) < threshold) return 'stable';
        return change > 0 ? 'increasing' : 'decreasing';
      };

      const calcSleepTrend = (recent: any[], older: any[]): 'improving' | 'declining' | 'stable' | 'unknown' => {
        const recentAvg = recent[0]?.avgDuration;
        const olderAvg = older[0]?.avgDuration;
        
        if (recentAvg == null || olderAvg == null || recent[0]?.count < 2 || older[0]?.count < 2) {
          return 'unknown';
        }
        
        // For sleep, more is generally better (up to optimal range)
        const optimalSleep = 7.5;
        const recentDiff = Math.abs(recentAvg - optimalSleep);
        const olderDiff = Math.abs(olderAvg - optimalSleep);
        
        if (Math.abs(recentDiff - olderDiff) < 0.3) return 'stable';
        return recentDiff < olderDiff ? 'improving' : 'declining';
      };

      return {
        heartRateTrend: calcTrend(recentHR, olderHR),
        bloodGlucoseTrend: calcTrend(recentGlucose, olderGlucose),
        weightTrend: calcTrend(recentWeight, olderWeight),
        sleepQualityTrend: calcSleepTrend(recentSleep, olderSleep),
      };
    } catch {
      return {
        heartRateTrend: 'unknown',
        bloodGlucoseTrend: 'unknown',
        weightTrend: 'unknown',
        sleepQualityTrend: 'unknown',
      };
    }
  }

  private async getAbdmRecords(userId: string): Promise<any> {
    // Beta: ABDM/EHR connectivity is disabled. Keep structure but return empty.
    return {
      conditions: [],
      medications: [],
      labResults: [],
      procedures: [],
      immunizations: [],
      lastFetched: null,
    };
  }

  private buildAbdmData(abdmRecords: any): CompletePatientContext['abdmRecords'] {
    return {
      conditions: abdmRecords.conditions || [],
      medications: abdmRecords.medications || [],
      labResults: abdmRecords.labResults || [],
      procedures: abdmRecords.procedures || [],
      immunizations: abdmRecords.immunizations || [],
      lastFetched: abdmRecords.lastFetched,
    };
  }

  private async getUploadedRecords(userId: string): Promise<any> {
    try {
      const docs = await this.recordsService.listDocuments(userId);
      const processed = docs.filter((d: any) => d.status === 'processed');

      const extractedData = {
        diagnoses: [] as string[],
        medications: [] as string[],
        labResults: [] as string[],
      };

      for (const doc of processed) {
        if (doc.structuredData?.diagnosis) {
          extractedData.diagnoses.push(...doc.structuredData.diagnosis);
        }
        if (doc.structuredData?.medications) {
          extractedData.medications.push(...doc.structuredData.medications);
        }
        if (doc.structuredData?.tests) {
          extractedData.labResults.push(
            ...doc.structuredData.tests.map((t: any) => `${t.name}: ${t.value} ${t.unit || ''}`)
          );
        }
        // Modality-specific notes as additional context for AI
        if (doc.structuredData?.summary) {
          extractedData.diagnoses.push(doc.structuredData.summary);
        }
      }

      return {
        documents: processed.slice(0, 10), // Latest 10 documents
        extractedData,
      };
    } catch {
      return {
        documents: [],
        extractedData: {
          diagnoses: [],
          medications: [],
          labResults: [],
        },
      };
    }
  }

  private async getActivePrescriptions(userId: string): Promise<any[]> {
    // TODO: Implement when prescription module is created
    return [];
  }

  private async getRecentChatSummary(userId: string): Promise<string[]> {
    try {
      // Get recent chat sessions and extract health concerns
      const sessions = await this.chatModel
        .find({ userId: new Types.ObjectId(userId) })
        .sort({ updatedAt: -1 })
        .limit(10)
        .select('messages summary')
        .lean();

      const concerns: string[] = [];
      
      for (const session of sessions) {
        // Add session summary as a concern topic
        if (session.summary) {
          concerns.push(session.summary);
        }
        
        // Extract user messages to find health concerns
        const userMsgs = (session.messages || [])
          .filter((m: any) => m.role === 'user')
          .slice(-2); // Last 2 user messages per session
        
        for (const msg of userMsgs) {
          const content = msg.content?.substring(0, 100);
          if (content && !concerns.includes(content)) {
            concerns.push(content);
          }
        }
      }

      return concerns.slice(0, 15); // Max 15 recent concerns
    } catch {
      return [];
    }
  }

  /**
   * AI-powered detection of hidden diagnoses and health issues
   * This is the Lotus-style feature that finds things patients weren't told about
   */
  private async detectHiddenIssues(
    userId: string,
    demographics: any,
    healthHistory: any,
    wearableData: any,
    abdmRecords: any,
    extractedData: any,
    recentChats: string[],
  ): Promise<CompletePatientContext['insights']> {
    
    // Build context for AI analysis
    const analysisPrompt = `Analyze this patient's health data for potential undiagnosed conditions, care gaps, and risk factors.

PATIENT PROFILE:
- Name: ${demographics.name}
- Blood Type: ${demographics.bloodType || 'Unknown'}

HEALTH HISTORY:
- Chronic Conditions: ${healthHistory.chronicConditions.join(', ') || 'None reported'}
- Current Medications: ${healthHistory.currentMedications.join(', ') || 'None'}
- Allergies: ${healthHistory.allergies.join(', ') || 'None'}
- Family History: ${healthHistory.familyHistory.join(', ') || 'None'}
- Lifestyle: Smoking ${healthHistory.lifestyleFactors.smoking ? 'Yes' : 'No'}, Alcohol ${healthHistory.lifestyleFactors.alcohol ? 'Yes' : 'No'}, Exercise: ${healthHistory.lifestyleFactors.exercise || 'Not specified'}

RECENT VITALS (from wearables):
- Heart Rate: ${wearableData.heartRate || 'Not available'} bpm
- SpO2: ${wearableData.spo2 || 'Not available'}%
- Sleep: ${wearableData.sleep?.durationHours || 'Not available'} hours
- Weight: ${wearableData.weight || 'Not available'} kg
- HRV: ${wearableData.hrv || 'Not available'} ms

LAB RESULTS FROM RECORDS:
${extractedData.labResults.join('\n') || 'No lab results available'}

DIAGNOSES FROM RECORDS:
${extractedData.diagnoses.join('\n') || 'No diagnoses extracted'}

Analyze for:
1. HIDDEN DIAGNOSES: Conditions that may be present but not diagnosed (based on symptoms, lab values, medication patterns)
2. CARE GAPS: Recommended screenings or follow-ups that may be missing
3. RISK FACTORS: Modifiable and non-modifiable risk factors

Respond in JSON format:
{
  "hiddenDiagnoses": [
    {"condition": "Condition name", "icdCode": "Code if known", "evidence": "Why this might be present", "confidence": 0.7, "severity": "medium", "detectedFrom": "lab_results"}
  ],
  "careGaps": [
    {"type": "Missing screening", "description": "What's missing", "recommendation": "Action to take", "urgency": "routine"}
  ],
  "riskFactors": [
    {"factor": "Risk factor", "level": "moderate", "evidence": "Why it's a risk", "modifiable": true}
  ]
}`;

    try {
      const response = await this.openRouter.chat(
        [{ role: 'user', content: analysisPrompt }],
        'fast' as any,
        { temperature: 0.3, maxTokens: 1000 },
      );

      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          hiddenDiagnoses: parsed.hiddenDiagnoses || [],
          careGaps: parsed.careGaps || [],
          riskFactors: parsed.riskFactors || [],
          proactiveAlerts: [],
        };
      }
    } catch (err) {
      this.logger.warn(`Hidden issue detection failed for ${userId}: ${err}`);
    }

    return {
      hiddenDiagnoses: [],
      careGaps: [],
      riskFactors: [],
      proactiveAlerts: [],
    };
  }

  /**
   * Calculate data completeness score (0-100)
   */
  private calculateDataCompleteness(data: any): number {
    let score = 0;
    const weights = {
      demographics: 10,
      healthHistory: 30,
      wearableData: 30,
      abdmRecords: 20,
      uploadedRecords: 10,
    };

    // Check demographics
    if (data.demographics?.name && data.demographics?.name !== 'Patient') {
      score += weights.demographics;
    }

    // Check health history
    if (data.healthHistory?.completedAt) {
      score += weights.healthHistory;
    } else if (data.healthHistory?.chronicConditions?.length > 0 || data.healthHistory?.allergies?.length > 0) {
      score += weights.healthHistory * 0.5;
    }

    // Check wearable data
    if (data.wearableData?.sources?.length > 0) {
      const hasRealData = data.wearableData.sources.some((s: string) => !s.startsWith('demo:'));
      score += hasRealData ? weights.wearableData : weights.wearableData * 0.3;
    }

    // Check ABDM records
    if (data.abdmRecords?.conditions?.length > 0 || data.abdmRecords?.labResults?.length > 0) {
      score += weights.abdmRecords;
    }

    // Check uploaded records
    if (data.uploadedRecords?.documents?.length > 0) {
      score += weights.uploadedRecords;
    }

    return Math.min(100, Math.round(score));
  }
}
