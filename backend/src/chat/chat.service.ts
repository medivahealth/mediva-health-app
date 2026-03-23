import { Injectable, NotFoundException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatSession } from './chat.schema';
import { RagService } from './rag.service';
import { EmergencyService } from './emergency.service';
import { QueryClassifierService } from './query-classifier.service';
import { MultiAgentService } from './multi-agent.service';
import { EvaluationService } from './evaluation.service';
import { ABTestingService } from './ab-testing.service';
import { DoctorService } from '../doctor/doctor.service';
import { OpenRouterService, ModelTier } from '../common/openrouter.service';
import { PatientContextService, CompletePatientContext } from '../context/patient-context.service';
import { IntentClassifierService, ClassifiedIntent } from './intent-classifier.service';
import { WebSearchService } from '../common/web-search.service';
import { PredictiveAnalyticsService } from '../health/predictive-analytics.service';
import { emitChatSessionUpdate } from './chat-status.bus';
import type OpenAI from 'openai';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(ChatSession.name) private chatModel: Model<ChatSession>,
    private ragService: RagService,
    private emergencyService: EmergencyService,
    private queryClassifier: QueryClassifierService,
    private multiAgent: MultiAgentService,
    private evaluationService: EvaluationService,
    private abTesting: ABTestingService,
    @Inject(forwardRef(() => DoctorService)) private doctorService: DoctorService,
    private openRouter: OpenRouterService,
    private patientContextService: PatientContextService,
    private intentClassifier: IntentClassifierService,
    private webSearchService: WebSearchService,
    private predictiveAnalytics: PredictiveAnalyticsService,
  ) {}

  async getOrCreateSession(userId: string, sessionId?: string): Promise<ChatSession> {
    if (sessionId) {
      const session = await this.chatModel.findOne({
        _id: sessionId,
        userId: new Types.ObjectId(userId),
      });
      if (session) return session;
    }

    // Always create a new session when no sessionId is provided
    // This ensures "New Chat" actually starts a fresh session
    const session = await this.chatModel.create({
      userId: new Types.ObjectId(userId),
      messages: [],
      status: 'open',
    });

    return session;
  }

  /** Generate a short title from user message (fallback when AI title fails) */
  private generateSummary(content: string): string {
    const cleaned = content.replace(/\n/g, ' ').trim();
    if (cleaned.length <= 50) return cleaned;
    return cleaned.substring(0, 47) + '...';
  }

  private formatMonitoringBlock(
    alerts: Array<{ severity?: string; title?: string; message?: string }>,
    illness: { isGettingSick?: boolean; confidence?: number; indicators?: string[] } | null,
  ): string | undefined {
    const lines: string[] = [];
    if (alerts?.length) {
      for (const a of alerts.slice(0, 8)) {
        lines.push(`- [${a.severity || 'INFO'}] ${a.title || 'Alert'}: ${a.message || ''}`);
      }
    }
    if (illness && (illness.indicators?.length || illness.isGettingSick)) {
      lines.push(
        `- Early illness signals: ${illness.isGettingSick ? 'possible unwell pattern' : 'no strong pattern'} (confidence ${illness.confidence ?? 0}%). Indicators: ${(illness.indicators || []).slice(0, 6).join(', ') || 'none'}`,
      );
    }
    return lines.length ? lines.join('\n') : undefined;
  }

  /** Short chat list title — AI-generated from first exchange */
  private async generateAiChatTitle(userMessage: string, assistantExcerpt: string): Promise<string> {
    const cleanedUser = userMessage.replace(/\n/g, ' ').trim().slice(0, 450);
    const cleanedAsst = assistantExcerpt.replace(/\n/g, ' ').trim().slice(0, 280);
    const prompt = `Name this medical support chat. Output ONLY a short title (max 42 characters), no quotes, no emoji. Use the same language as the user's message when it is clearly not English.
Patient said: ${cleanedUser}
Assistant begins: ${cleanedAsst}
Title:`;
    try {
      const raw = await this.openRouter.chat(
        [{ role: 'user', content: prompt }] as OpenAI.Chat.ChatCompletionMessageParam[],
        ModelTier.FAST,
        { temperature: 0.25, maxTokens: 48 },
      );
      const t = String(raw || '')
        .replace(/^["'\s]+|["'\s]+$/g, '')
        .split('\n')[0]
        .trim();
      if (t.length >= 3) return t.slice(0, 85);
    } catch (e) {
      this.logger.warn(`AI chat title failed: ${e}`);
    }
    return this.generateSummary(userMessage);
  }

  /** Compact context for Mediva Voice (WebView) — merged into Gemini Live instructions */
  async getVoiceBriefForUser(userId: string): Promise<{ brief: string }> {
    try {
      const ctx = await this.patientContextService.buildCompleteContext(userId);
      const [alerts, illness] = await Promise.all([
        this.predictiveAnalytics.generatePredictiveAlerts(userId).catch(() => []),
        this.predictiveAnalytics.detectEarlyIllnessSigns(userId).catch(() => null),
      ]);
      const wearable = ctx.wearableData;
      const lines: string[] = [
        `Patient name: ${ctx.demographics.name || 'Unknown'}`,
        `Data completeness: ${ctx.dataCompleteness}%`,
        `Chronic conditions: ${ctx.healthHistory.chronicConditions.join(', ') || 'none'}`,
        `Medications: ${ctx.healthHistory.currentMedications.join(', ') || 'none'}`,
        `Allergies: ${ctx.healthHistory.allergies.join(', ') || 'none'}`,
        `Latest vitals — HR: ${wearable.heartRate ?? 'n/a'}, SpO2: ${wearable.spo2 ?? 'n/a'}, sleep h: ${wearable.sleep?.durationHours ?? 'n/a'}, weight kg: ${wearable.weight ?? 'n/a'}`,
        `Sources: ${wearable.sources.join(', ') || 'none'}`,
        `Trends — HR: ${ctx.trends.heartRateTrend}, sleep: ${ctx.trends.sleepQualityTrend}, weight: ${ctx.trends.weightTrend}`,
      ];
      if (ctx.insights?.proactiveAlerts?.length) {
        lines.push(
          `Proactive alerts: ${ctx.insights.proactiveAlerts
            .slice(0, 5)
            .map((a) => a.message)
            .join(' | ')}`,
        );
      }
      const mon = this.formatMonitoringBlock(alerts as any, illness as any);
      if (mon) lines.push(`Analytics:\n${mon}`);
      return { brief: lines.join('\n').slice(0, 4500) };
    } catch (e) {
      this.logger.warn(`Voice brief failed: ${e}`);
      return { brief: '' };
    }
  }

  private async generateGreetingResponse(
    userId: string,
    preferredLanguage: string,
  ): Promise<string> {
    const nowHour = new Date().getHours();
    const timeGreeting =
      nowHour < 12 ? 'Good morning' : nowHour < 18 ? 'Good afternoon' : 'Good evening';

    const localizedBase: Record<string, string> = {
      en: `${timeGreeting}!`,
      hi: 'नमस्ते!',
      mr: 'नमस्कार!',
      te: 'నమస్కారం!',
      bn: 'নমস্কার!',
      kn: 'ನಮಸ್ಕಾರ!',
      ta: 'வணக்கம்!',
    };

    try {
      const ctx = await this.patientContextService.buildCompleteContext(userId);
      const name = ctx.demographics.name?.trim();
      const chronic = ctx.healthHistory.chronicConditions?.[0];
      const intro = `${localizedBase[preferredLanguage] || localizedBase.en} ${
        name ? `${name}, ` : ''
      }I'm Dr. Mediva.`;

      if (chronic) {
        return `${intro} I can already see your ${chronic} history in your records, so we can tailor your care better today. What would you like help with right now?`;
      }
      return `${intro} I'm ready to help with your symptoms, reports, or health questions. What would you like to discuss today?`;
    } catch {
      return `${localizedBase[preferredLanguage] || localizedBase.en} I'm Dr. Mediva. Tell me what you're feeling right now, and I'll guide you step by step.`;
    }
  }

  private emitSessionUpdate(session: ChatSession) {
    const sessionId = session._id?.toString();
    const userId = (session.userId as Types.ObjectId)?.toString?.();
    if (!sessionId || !userId) return;
    emitChatSessionUpdate({ sessionId, userId });
  }

  async sendMessage(
    userId: string,
    message: string,
    preferredLanguage: string = 'en',
    sessionId?: string,
  ): Promise<{
    response: string;
    severity: string;
    sessionId: string;
    requiresDoctorReview: boolean;
    isEmergency?: boolean;
    chatTitle?: string;
  }> {
    const session = await this.getOrCreateSession(userId, sessionId);

    // Emergency detection BEFORE RAG context building
    const emergencyCheck = this.emergencyService.detectEmergency(message, preferredLanguage);
    if (emergencyCheck.isEmergency) {
      // Add user message
      session.messages.push({
        role: 'user',
        content: message,
        modelUsed: '',
        citations: [],
        severity: emergencyCheck.severity || 'EMERGENCY',
        timestamp: new Date(),
      } as any);

      // Add emergency response
      const emergencyResponse = `⚠️ **EMERGENCY DETECTED**

This appears to be a medical emergency. Please take the following actions immediately:

1. **Call 108** (India Emergency Services) or your local emergency number
2. If someone is with you, ask them to call for help
3. Stay calm and follow any first aid instructions if available

**Do not wait for an AI response. Seek immediate medical attention.**

If you're able to, please share your location with emergency services.`;

      session.messages.push({
        role: 'assistant',
        content: emergencyResponse,
        modelUsed: 'emergency-detection',
        citations: [],
        severity: emergencyCheck.severity || 'EMERGENCY',
        timestamp: new Date(),
      } as any);

      session.requiresDoctorReview = true;
      session.status = 'pending_review';
      if (!session.summary) {
        session.summary = await this.generateAiChatTitle(message, emergencyResponse).catch(() =>
          this.generateSummary(message),
        );
      }
      await session.save();
      this.emitSessionUpdate(session);

      return {
        response: emergencyResponse,
        severity: emergencyCheck.severity || 'EMERGENCY',
        sessionId: session._id!.toString(),
        requiresDoctorReview: true,
        isEmergency: true,
        chatTitle: session.summary,
      };
    }

    // Check for simple greeting and return friendly response directly
    const isGreeting = /^(hi|hello|hey|good morning|good evening|good afternoon|how are you|what's up|sup)$/i.test(message.trim());
    if (isGreeting && session.messages.length === 0) {
      const greetingResponse = await this.generateGreetingResponse(userId, preferredLanguage);
      
      session.summary = 'New conversation';
      session.messages.push({
        role: 'user',
        content: message,
        modelUsed: '',
        citations: [],
        severity: '',
        timestamp: new Date(),
      } as any);
      session.messages.push({
        role: 'assistant',
        content: greetingResponse,
        modelUsed: 'greeting-handler',
        citations: [],
        severity: 'LOW',
        timestamp: new Date(),
      } as any);
      await session.save();
      this.emitSessionUpdate(session);
      
      return {
        response: greetingResponse,
        severity: 'LOW',
        sessionId: session._id!.toString(),
        requiresDoctorReview: false,
        chatTitle: session.summary || 'New conversation',
      };
    }

    // Add user message
    session.messages.push({
      role: 'user',
      content: message,
      modelUsed: '',
      citations: [],
      severity: '',
      timestamp: new Date(),
    } as any);

    // Build RAG context + continuous monitoring (wearables / predictive signals)
    const [context, predictiveAlerts, illnessSignals] = await Promise.all([
      this.ragService.buildContext(userId, message),
      this.predictiveAnalytics.generatePredictiveAlerts(userId).catch(() => []),
      this.predictiveAnalytics.detectEarlyIllnessSigns(userId).catch(() => null),
    ]);
    const nearbyHospitals = await this.fetchNearbyHospitals(message, location);
    const monitoringBlock = this.formatMonitoringBlock(
      predictiveAlerts as any,
      illnessSignals as any,
    );

    // Get all past chat sessions for comprehensive patient history
    const pastSessions = await this.chatModel
      .find({ userId: new Types.ObjectId(userId), _id: { $ne: session._id } })
      .sort({ updatedAt: -1 })
      .limit(5) // Last 5 sessions
      .select('messages summary')
      .lean();

    // Build unified patient history from past chats
    const pastChatHistory = pastSessions
      .map((s: any) => {
        const recentMsgs = s.messages?.slice(-4) || []; // Last 4 messages per session
        return `Session: ${s.summary || 'Previous consultation'}\n${recentMsgs
          .map((m: any) => `${m.role === 'user' ? 'Patient' : 'Mediva'}: ${m.content.substring(0, 200)}`)
          .join('\n')}`;
      })
      .join('\n\n---\n\n');

    const systemPrompt = await this.ragService.buildSystemPrompt(
      context,
      preferredLanguage,
      pastChatHistory,
      monitoringBlock,
    );
    const modelTier = this.ragService.selectModelTier(message, preferredLanguage);

    // Multi-agent: Select appropriate agent(s)
    const selectedAgents = await this.multiAgent.selectAgent(message, context);

    // A/B Testing: Select variant for this query
    const abVariant = this.abTesting.selectVariant(userId, message);
    const startTime = Date.now();

    // Build messages for LLM
    const llmMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add recent chat history (last 10 messages for context), including feedback signals
    const recentMessages = session.messages.slice(-10);
    for (const msg of recentMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        let content = msg.content;
        // Append feedback signal so the model can learn from user preferences
        const fb = (msg as any).feedback;
        if (msg.role === 'assistant' && fb) {
          content += fb === 'dislike'
            ? '\n\n[User feedback: The user disliked this response. Improve on this.]'
            : '\n\n[User feedback: The user liked this response.]';
        }
        llmMessages.push({ 
          role: msg.role as 'user' | 'assistant', 
          content 
        } as OpenAI.Chat.ChatCompletionMessageParam);
      }
    }

    // Get AI response using multi-agent system
    // For single agent, use specialized prompt; for multiple, synthesize
    const agentSystemPrompt = selectedAgents.length === 1
      ? this.multiAgent.getAgentSystemPrompt(selectedAgents[0], systemPrompt)
      : systemPrompt;
    
    const finalMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: agentSystemPrompt },
      ...llmMessages.slice(1),
    ];

    const response = await this.multiAgent.getMultiAgentResponse(
      message,
      selectedAgents,
      systemPrompt,
      llmMessages.slice(1),
    );
    const severity = this.ragService.parseSeverity(response);
    const requiresDoctorReview = severity === 'HIGH' || severity === 'EMERGENCY';

    // Add assistant message
    const assistantMessage = {
      role: 'assistant',
      content: response,
      modelUsed: this.openRouter.getModelForTier(modelTier),
      citations: context.retrievedEvidence.map((e) => e.text),
      severity,
      timestamp: new Date(),
    } as any;
    session.messages.push(assistantMessage);

    const userTurns = session.messages.filter((m: any) => m.role === 'user').length;
    if (userTurns === 1) {
      try {
        session.summary = await this.generateAiChatTitle(message, response);
      } catch {
        session.summary = this.generateSummary(message);
      }
    } else if (!session.summary) {
      session.summary = this.generateSummary(message);
    }

    // Calculate quality metrics
    const citationCount = context.retrievedEvidence.length + context.webResults.length;
    const responseLength = response.length;
    // Quality score: based on length (200-2000 chars ideal), citations (more is better), and severity handling
    let qualityScore = 50; // Base score
    if (responseLength >= 200 && responseLength <= 2000) qualityScore += 20;
    if (citationCount >= 2) qualityScore += 20;
    if (citationCount >= 5) qualityScore += 10;
    if (severity && (severity === 'HIGH' || severity === 'EMERGENCY')) qualityScore += 10; // Proper severity detection

    session.qualityMetrics = {
      responseLength,
      citationCount,
      qualityScore: Math.min(100, qualityScore),
    };

    // Automatic evaluation of response quality - do async (fire and forget) for speed
    this.evaluationService.evaluateResponse(
      session._id!.toString(),
      message,
      response,
      context.retrievedEvidence.map((e) => e.text),
      severity,
    ).then((evaluationMetrics) => {
      // Store evaluation
      this.evaluationService.storeEvaluation(
        session._id!.toString(),
        session.messages.length - 1,
        evaluationMetrics,
        'auto',
      ).then(() => {
        // Update quality score with evaluation if better
        if (evaluationMetrics.overallScore > qualityScore) {
          session.qualityMetrics.qualityScore = evaluationMetrics.overallScore;
          session.save().catch(() => {}); // Save in background
        }
      }).catch(() => {});
    }).catch(() => {});

    // Record A/B test result - do async for speed
    const responseTime = Date.now() - startTime;
    this.abTesting.recordTestResult(
      abVariant.id,
      session._id!.toString(),
      message,
      response,
      session.qualityMetrics.qualityScore || 0,
      responseTime,
    ).catch(() => {});

    if (requiresDoctorReview) {
      session.requiresDoctorReview = true;
      session.status = 'pending_review';
      await session.save();
      this.emitSessionUpdate(session);
      
      // Auto-assign to least-busy doctor
      try {
        await this.doctorService.autoAssignCase(session._id!.toString());
      } catch (err) {
        // Log but don't fail the request if assignment fails
        console.error('Failed to auto-assign case:', err);
      }
    } else {
      await session.save();
      this.emitSessionUpdate(session);
    }

    return {
      response,
      severity,
      sessionId: session._id!.toString(),
      requiresDoctorReview,
      chatTitle: session.summary,
    };
  }

  /**
   * NEW: Context-aware message handling with full patient context
   * This method uses the unified patient context for personalized responses
   */
  async sendMessageWithContext(
    userId: string,
    message: string,
    preferredLanguage: string = 'en',
    sessionId?: string,
    location?: { lat: number; lng: number; city?: string; country?: string },
  ): Promise<{
    response: string;
    severity: string;
    sessionId: string;
    requiresDoctorReview: boolean;
    isEmergency?: boolean;
    intent?: ClassifiedIntent;
    contextCompleteness?: number;
    chatTitle?: string;
  }> {
    const session = await this.getOrCreateSession(userId, sessionId);
    if (location) session.location = location; // Store recent location
    const startTime = Date.now();

    // 1. Classify intent first
    const intent = await this.intentClassifier.classifyIntent(message);
    this.logger.log(`Intent classified: ${intent.type} (confidence: ${intent.confidence})`);

    // 2. Check for emergency
    if (intent.type === 'emergency') {
      const emergencyResponse = this.emergencyService.detectEmergency(message, preferredLanguage);
      session.messages.push({
        role: 'user',
        content: message,
        modelUsed: '',
        citations: [],
        severity: 'EMERGENCY',
        timestamp: new Date(),
      } as any);

      const emergencyMessage = `**EMERGENCY DETECTED**

This appears to be a medical emergency. Please:

1. Call 108 (India Emergency Services) immediately
2. If someone is with you, ask them to call for help
3. Stay calm and follow any first aid instructions if available

Do not wait for an AI response. Seek immediate medical attention.`;

      session.messages.push({
        role: 'assistant',
        content: emergencyMessage,
        modelUsed: 'emergency-detection',
        citations: [],
        severity: 'EMERGENCY',
        timestamp: new Date(),
      } as any);

      session.requiresDoctorReview = true;
      session.status = 'pending_review';
      if (!session.summary) {
        session.summary = await this.generateAiChatTitle(message, emergencyMessage).catch(() =>
          this.generateSummary(message),
        );
      }
      await session.save();
      this.emitSessionUpdate(session);

      return {
        response: emergencyMessage,
        severity: 'EMERGENCY',
        sessionId: session._id!.toString(),
        requiresDoctorReview: true,
        isEmergency: true,
        intent,
        chatTitle: session.summary,
      };
    }

    // 3. Build complete patient context (everything AI needs to know)
    const patientContext = await this.patientContextService.buildCompleteContext(userId);
    this.logger.log(`Context built for ${userId}: ${patientContext.dataCompleteness}% complete`);

    // 4. Build enhanced system prompt with full context + continuous analytics
    const [predictiveAlerts, illnessSignals] = await Promise.all([
      this.predictiveAnalytics.generatePredictiveAlerts(userId).catch(() => []),
      this.predictiveAnalytics.detectEarlyIllnessSigns(userId).catch(() => null),
    ]);

    const nearbyHospitals = await this.fetchNearbyHospitals(message, location);
    const systemPrompt = this.buildContextAwareSystemPrompt(
      patientContext,
      intent,
      preferredLanguage,
      location,
      nearbyHospitals,
      predictiveAlerts,
      illnessSignals,
    );

    // 5. Add user message
    session.messages.push({
      role: 'user',
      content: message,
      modelUsed: '',
      citations: [],
      severity: '',
      timestamp: new Date(),
    } as any);

    // 6. Build conversation with context
    const llmMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add recent chat history
    const recentMessages = session.messages.slice(-10);
    for (const msg of recentMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        llmMessages.push({ 
          role: msg.role as 'user' | 'assistant', 
          content: msg.content 
        } as OpenAI.Chat.ChatCompletionMessageParam);
      }
    }

    // 7. Get AI response
    const modelTier = this.ragService.selectModelTier(message, preferredLanguage);
    const rawResponse = await this.openRouter.chat(llmMessages, modelTier);
    const response = this.appendNearbyHospitals(rawResponse, nearbyHospitals);
    const severity = this.ragService.parseSeverity(response);
    const requiresDoctorReview = this.intentClassifier.requiresDoctorReview(intent) || 
                                  severity === 'HIGH' || 
                                  severity === 'EMERGENCY';

    // 8. Add assistant message
    session.messages.push({
      role: 'assistant',
      content: response,
      modelUsed: this.openRouter.getModelForTier(modelTier),
      citations: [],
      severity,
      timestamp: new Date(),
    } as any);

    const ctxUserTurns = session.messages.filter((m: any) => m.role === 'user').length;
    if (ctxUserTurns === 1) {
      try {
        session.summary = await this.generateAiChatTitle(message, response);
      } catch {
        session.summary = this.generateSummary(message);
      }
    } else if (!session.summary) {
      session.summary = this.generateSummary(message);
    }

    // 9. Update session
    if (requiresDoctorReview) {
      session.requiresDoctorReview = true;
      session.status = 'pending_review';
      await session.save();
      this.emitSessionUpdate(session);
      try {
        await this.doctorService.autoAssignCase(session._id!.toString());
      } catch (err) {
        this.logger.warn(`Failed to auto-assign high-priority case: ${err}`);
      }
    } else {
      await session.save();
      this.emitSessionUpdate(session);
    }

    this.logger.log(`Message processed in ${Date.now() - startTime}ms`);

    return {
      response,
      severity,
      sessionId: session._id!.toString(),
      requiresDoctorReview,
      intent,
      contextCompleteness: patientContext.dataCompleteness,
      chatTitle: session.summary,
    };
  }

  /**
   * Build a context-aware system prompt with full patient data
   */
  private buildContextAwareSystemPrompt(
    context: CompletePatientContext,
    intent: ClassifiedIntent,
    preferredLanguage: string,
    location?: { lat: number; lng: number; city?: string; country?: string },
    nearbyHospitals: string[] = [],
    predictiveAlerts: any[] = [],
    illnessSignals: any = null,
  ): string {
    const langInstruction = preferredLanguage === 'en'
      ? 'Respond in English.'
      : `Respond in ${preferredLanguage}. Use English for medical terms when necessary.`;
      
    const locationContext = location ? `\n\nPATIENT CURRENT LOCATION (for context-aware advice like local environmental health factors):\n- City: ${location.city || 'Unknown'}\n- Country: ${location.country || 'Unknown'}\n- Lat/Lng: ${location.lat}, ${location.lng}\n` : '';
    const hospitalContext = nearbyHospitals.length > 0
      ? `\nNEARBY HOSPITAL OPTIONS:\n${nearbyHospitals.join('\n')}\n`
      : '';
    const monitoringContext = predictiveAlerts.length > 0
      ? `\nCONTINUOUS MONITORING ALERTS:\n${predictiveAlerts
          .slice(0, 5)
          .map((a: any) => `- [${a.severity}] ${a.title}: ${a.message}`)
          .join('\n')}\n`
      : '\nCONTINUOUS MONITORING ALERTS: None active.\n';
    const illnessContext = illnessSignals
      ? `\nEARLY ILLNESS SIGNALS:\n- Suspected: ${illnessSignals.isGettingSick ? 'Yes' : 'No'}\n- Confidence: ${illnessSignals.confidence || 0}%\n- Indicators: ${(illnessSignals.indicators || []).join(', ') || 'None'}\n`
      : '';

    // Build patient summary
    const patientSummary = `
PATIENT PROFILE:
- Name: ${context.demographics.name}
- Blood Type: ${context.demographics.bloodType || 'Unknown'}

HEALTH HISTORY:
- Chronic Conditions: ${context.healthHistory.chronicConditions.join(', ') || 'None reported'}
- Current Medications: ${context.healthHistory.currentMedications.join(', ') || 'None'}
- Allergies: ${context.healthHistory.allergies.join(', ') || 'None known'}
- Family History: ${context.healthHistory.familyHistory.join(', ') || 'Not provided'}
- Lifestyle: Smoking ${context.healthHistory.lifestyleFactors.smoking ? 'Yes' : 'No'}, Alcohol ${context.healthHistory.lifestyleFactors.alcohol ? 'Yes' : 'No'}, Exercise: ${context.healthHistory.lifestyleFactors.exercise || 'Not specified'}

CURRENT VITALS (from wearables):
- Heart Rate: ${context.wearableData.heartRate || 'Not available'} bpm
- SpO2: ${context.wearableData.spo2 || 'Not available'}%
- Sleep: ${context.wearableData.sleep?.durationHours || 'Not available'} hours
- Weight: ${context.wearableData.weight || 'Not available'} kg
- Data Sources: ${context.wearableData.sources.join(', ') || 'None connected'}

DATA COMPLETENESS: ${context.dataCompleteness}%
${context.dataCompleteness < 50 ? '\n[NOTE: Limited patient data available. Recommend connecting wearables and completing health history for better analysis.]' : ''}
`;

    // Add detected insights if any
    const insightsSection = context.insights.hiddenDiagnoses.length > 0 
      ? `\nPOTENTIAL CONCERNS DETECTED:\n${context.insights.hiddenDiagnoses.map(d => `- ${d.condition}: ${d.evidence} (confidence: ${Math.round(d.confidence * 100)}%)`).join('\n')}`
      : '';

    // Intent-specific instructions
    const intentInstructions = this.getIntentSpecificInstructions(intent);

    return `You are Dr. Mediva, an advanced AI health assistant with complete knowledge of this patient's health data. You provide personalized, evidence-based advice.

${patientSummary}
${insightsSection}

CURRENT QUERY INTENT: ${intent.type}
${intentInstructions}
${locationContext}
${hospitalContext}
${monitoringContext}
${illnessContext}

CLINICAL GUIDELINES & SAFETY (FDA COMPLIANCE):
1. You are a Clinical Support AI. You CANNOT prescribe medications directly.
2. If medicine is needed, you MUST draft a "Prescription Proposal" and tell the patient: "I've drafted a prescription proposal. A human Mediva doctor will review and sign it shortly. You'll see the official prescription in your app soon."
3. Follow evidence-based medical paths. Only recommend FDA-approved medications for the symptoms described.
4. Check for contraindications in the patient's history below.
5. Use regulatory-safe wording: "This is clinical guidance, final diagnosis/prescription requires licensed clinician review."
6. For device data, mention: "Wearable readings can contain measurement errors and may need clinical confirmation."

RULES:
1. Use the patient's specific health data to personalize your response
2. Reference their conditions, medications, and vitals when relevant
3. Be empathetic and act like a caring doctor
4. Never make a definitive diagnosis - provide possibilities and next steps
5. If severity is HIGH or EMERGENCY, start with: "This requires immediate medical attention. Please call 108 or visit the nearest emergency room."
6. ${langInstruction}
7. Keep responses concise but thorough
8. Ask ONE relevant follow-up question to understand the patient better
9. For vague complaints (feeling low, tired, stressed, anxious), connect sleep, activity, vitals, and CONTINUOUS MONITORING / EARLY ILLNESS sections when present; be empathetic, avoid minimizing, and gently explore mood, stressors, support, and safety (including crisis resources if appropriate).

RESPONSE FORMAT:
<!-- SEVERITY: LOW/MEDIUM/HIGH/EMERGENCY -->

## Clear Title

[Your response here with relevant patient data references]

### Recommendations
- [Actionable advice based on patient's specific situation]

### When to see a doctor
- [Clear guidance on when to seek professional help]`;
  }

  /**
   * Get intent-specific instructions for the AI
   */
  private getIntentSpecificInstructions(intent: ClassifiedIntent): string {
    switch (intent.type) {
      case 'symptom_report':
        return 'The patient is reporting symptoms. Analyze possible causes, ask clarifying questions, and recommend appropriate next steps. Consider their existing conditions and medications.';
      
      case 'prescription_request':
        return 'The patient is asking about medication or prescriptions. NOTE: You cannot prescribe directly. Draft a "Prescription Proposal" for a human doctor to review. The proposal should include: medication name, dosage, frequency, and duration. Warn the patient that this is only a proposal and not a valid prescription yet.';
      
      case 'food_query':
        return `The patient is asking about food/diet. Consider their conditions (especially diabetes, hypertension, etc.) and current medications. Provide specific guidance for ${intent.entities.foodItem || 'the food they mentioned'}.`;
      
      case 'lab_booking':
        return 'The patient wants to book a lab test. Suggest appropriate tests based on their symptoms and history. Explain what the tests would reveal.';
      
      case 'medication_info':
        return 'The patient is asking about medication. Provide information about uses, side effects, interactions (especially with their current medications), and proper usage.';
      
      default:
        return 'Provide helpful, personalized health guidance based on the patient\'s query and their health data.';
    }
  }

  private async fetchNearbyHospitals(message: string, location?: any): Promise<string[]> {
    const needsHospitalHelp = /hospital|clinic|doctor near|nearby care|emergency room|er near/i.test(message);
    if (!location || !needsHospitalHelp) return [];
    try {
      const lat = location.lat ?? location.latitude;
      const lng = location.lng ?? location.longitude;
      const where = location.city || location.country || (lat !== undefined && lng !== undefined ? `${lat},${lng}` : '');
      if (!where) return [];
      const hospitalResults = await this.webSearchService.search(`best hospitals near ${where}`, 3);
      return hospitalResults.map((h, i) => `${i + 1}. ${h.title}${h.url ? ` (${h.url})` : ''}`);
    } catch {
      return [];
    }
  }

  private appendNearbyHospitals(response: string, nearbyHospitals: string[]): string {
    if (nearbyHospitals.length === 0) return response;
    if (/nearby hospital options|hospitals near/i.test(response)) return response;
    return `${response}\n\n### Nearby hospitals (web results)\n${nearbyHospitals.map((h) => `- ${h}`).join('\n')}`;
  }

  async *sendMessageStream(
    userId: string,
    message: string,
    preferredLanguage: string = 'en',
    sessionId?: string,
    location?: { lat: number; lng: number; city?: string; country?: string },
  ): AsyncGenerator<{ type: string; data: string }> {
    const session = await this.getOrCreateSession(userId, sessionId);
    if (location) session.location = location;

    // Check for simple greeting and return friendly response directly
    const isGreeting = /^(hi|hello|hey|good morning|good evening|good afternoon|how are you|what's up|sup)$/i.test(message.trim());
    if (isGreeting && session.messages.length === 0) {
      const greetingResponse = await this.generateGreetingResponse(userId, preferredLanguage);
      
      session.summary = 'New conversation';
      session.messages.push({
        role: 'user',
        content: message,
        modelUsed: '',
        citations: [],
        severity: '',
        timestamp: new Date(),
      } as any);
      
      const currentSessionId = session._id!.toString();
      yield { type: 'session', data: currentSessionId };
      
      for (const char of greetingResponse) {
        yield { type: 'token', data: char };
      }
      
      session.messages.push({
        role: 'assistant',
        content: greetingResponse,
        modelUsed: 'greeting-handler',
        citations: [],
        severity: 'LOW',
        timestamp: new Date(),
      } as any);
      await session.save();
      this.emitSessionUpdate(session);
      
      yield {
        type: 'done',
        data: JSON.stringify({
          sessionId: currentSessionId,
          severity: 'LOW',
          chatTitle: session.summary,
        }),
      };
      return;
    }

    // Query classification - check if it's medical
    const classification = await this.queryClassifier.classifyQuery(message);
    if (!classification.isMedical && classification.confidence > 0.7) {
      // Non-medical query - redirect
      session.messages.push({
        role: 'user',
        content: message,
        modelUsed: '',
        citations: [],
        severity: '',
        timestamp: new Date(),
      } as any);

      const redirectResponse = classification.suggestedRedirect || 
        "Hello! I'm Dr. Mediva. I focus on health and medical care. Tell me what symptoms or health concern you'd like help with.";
      
      const currentSessionId = session._id!.toString();
      yield { type: 'session', data: currentSessionId };
      
      for (const char of redirectResponse) {
        yield { type: 'token', data: char };
      }

      session.messages.push({
        role: 'assistant',
        content: redirectResponse,
        modelUsed: 'query-classifier',
        citations: [],
        severity: 'LOW',
        timestamp: new Date(),
      } as any);

      const redirectUserTurns = session.messages.filter((m: any) => m.role === 'user').length;
      if (redirectUserTurns === 1) {
        try {
          session.summary = await this.generateAiChatTitle(message, redirectResponse);
        } catch {
          session.summary = this.generateSummary(message);
        }
      } else if (!session.summary) {
        session.summary = this.generateSummary(message);
      }
      await session.save();
      this.emitSessionUpdate(session);
      yield {
        type: 'done',
        data: JSON.stringify({
          sessionId: currentSessionId,
          severity: 'LOW',
          chatTitle: session.summary,
        }),
      };
      return;
    }

    // Emergency detection BEFORE RAG context building
    const emergencyCheck = this.emergencyService.detectEmergency(message, preferredLanguage);
    if (emergencyCheck.isEmergency) {
      // Add user message
      session.messages.push({
        role: 'user',
        content: message,
        modelUsed: '',
        citations: [],
        severity: emergencyCheck.severity || 'EMERGENCY',
        timestamp: new Date(),
      } as any);

      const currentSessionId = session._id!.toString();
      yield { type: 'session', data: currentSessionId };
      yield { type: 'emergency', data: JSON.stringify({ isEmergency: true, severity: emergencyCheck.severity || 'EMERGENCY' }) };

      // Add emergency response
      const emergencyResponse = `⚠️ **EMERGENCY DETECTED**

This appears to be a medical emergency. Please take the following actions immediately:

1. **Call 108** (India Emergency Services) or your local emergency number
2. If someone is with you, ask them to call for help
3. Stay calm and follow any first aid instructions if available

**Do not wait for an AI response. Seek immediate medical attention.**

If you're able to, please share your location with emergency services.`;

      // Stream emergency response
      for (const char of emergencyResponse) {
        yield { type: 'token', data: char };
      }

      session.messages.push({
        role: 'assistant',
        content: emergencyResponse,
        modelUsed: 'emergency-detection',
        citations: [],
        severity: emergencyCheck.severity || 'EMERGENCY',
        timestamp: new Date(),
      } as any);

      session.requiresDoctorReview = true;
      session.status = 'pending_review';
      if (!session.summary) {
        session.summary = await this.generateAiChatTitle(message, emergencyResponse).catch(() =>
          this.generateSummary(message),
        );
      }
      await session.save();
      this.emitSessionUpdate(session);

      // Auto-assign emergency case to least-busy doctor
      try {
        await this.doctorService.autoAssignCase(currentSessionId);
      } catch (err) {
        console.error('Failed to auto-assign emergency case:', err);
      }

      yield {
        type: 'done',
        data: JSON.stringify({
          severity: emergencyCheck.severity || 'EMERGENCY',
          requiresDoctorReview: true,
          sessionId: currentSessionId,
          isEmergency: true,
          chatTitle: session.summary,
        }),
      };
      return;
    }

    session.messages.push({
      role: 'user',
      content: message,
      modelUsed: '',
      citations: [],
      severity: '',
      timestamp: new Date(),
    } as any);

    const currentSessionId = session._id!.toString();
    yield { type: 'session', data: currentSessionId };

    // Emit status updates while building context (exploring phase)
    const statusMsgs: Record<string, string> = {
      en: 'Exploring your health data...',
      hi: 'आपके स्वास्थ्य डेटा की जाँच कर रहा हूँ...',
      te: 'మీ ఆరోగ్య సమాచారాన్ని పరిశీలిస్తున్నాను...',
      ka: 'ನಿಮ್ಮ ಆರೋಗ್ಯ ಮಾಹಿತಿಯನ್ನು ಪರಿಶೀಲಿಸುತ್ತಿದ್ದೇನೆ...',
      ta: 'உங்கள் சுகாதாரத் தரவை ஆராய்கிறேன்...',
      bn: 'আপনার স্বাস্থ্য তথ্য পরীক্ষা করছি...',
    };
    
    // Automatic language detection: if query has non-English chars, prefer that for status
    const nonEnglishPattern = /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF]/;
    const detectedLang = nonEnglishPattern.test(message) ? (preferredLanguage === 'en' ? 'hi' : preferredLanguage) : preferredLanguage;
    
    yield { type: 'status', data: statusMsgs[detectedLang] || statusMsgs['en'] };

    const [context, predictiveAlerts, illnessSignals] = await Promise.all([
      this.ragService.buildContext(userId, message),
      this.predictiveAnalytics.generatePredictiveAlerts(userId).catch(() => []),
      this.predictiveAnalytics.detectEarlyIllnessSigns(userId).catch(() => null),
    ]);
    const nearbyHospitals = await this.fetchNearbyHospitals(message, location);
    const streamMonitoringBlock = this.formatMonitoringBlock(
      predictiveAlerts as any,
      illnessSignals as any,
    );

    yield { type: 'status', data: detectedLang === 'en' ? 'Analyzing medical evidence...' : 'चिकित्सा साक्ष्यों का विश्लेषण कर रहा हूँ...' };

    // Update preferredLanguage if non-English detected but user didn't specify
    if (nonEnglishPattern.test(message) && preferredLanguage === 'en') {
        // Simple heuristic: if it looks like Telugu script, use 'te'
        if (/[\u0C00-\u0C7F]/.test(message)) preferredLanguage = 'te';
        else if (/[\u0900-\u097F]/.test(message)) preferredLanguage = 'hi';
        else if (/[\u0C80-\u0CFF]/.test(message)) preferredLanguage = 'kn';
        else if (/[\u0B80-\u0BFF]/.test(message)) preferredLanguage = 'ta';
        else if (/[\u0980-\u09FF]/.test(message)) preferredLanguage = 'bn';
    }

    // Get all past chat sessions for comprehensive patient history
    const pastSessions = await this.chatModel
      .find({ userId: new Types.ObjectId(userId), _id: { $ne: session._id } })
      .sort({ updatedAt: -1 })
      .limit(5) // Last 5 sessions
      .select('messages summary')
      .lean();

    // Build unified patient history from past chats
    const pastChatHistory = pastSessions
      .map((s: any) => {
        const recentMsgs = s.messages?.slice(-4) || []; // Last 4 messages per session
        return `Session: ${s.summary || 'Previous consultation'}\n${recentMsgs
          .map((m: any) => `${m.role === 'user' ? 'Patient' : 'Mediva'}: ${m.content.substring(0, 200)}`)
          .join('\n')}`;
      })
      .join('\n\n---\n\n');

    const systemPrompt = await this.ragService.buildSystemPrompt(
      context,
      preferredLanguage,
      pastChatHistory,
      streamMonitoringBlock,
    );
    const modelTier = this.ragService.selectModelTier(message, preferredLanguage);

    // Multi-agent and A/B testing in parallel for speed
    const [selectedAgents, abVariant] = await Promise.all([
      this.multiAgent.selectAgent(message, context),
      Promise.resolve(this.abTesting.selectVariant(userId, message)),
    ]);
    const startTime = Date.now();

    const llmMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    const recentMessages = session.messages.slice(-10);
    for (const msg of recentMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        let content = msg.content;
        const fb = (msg as any).feedback;
        if (msg.role === 'assistant' && fb) {
          content += fb === 'dislike'
            ? '\n\n[User feedback: The user disliked this response. Improve on this.]'
            : '\n\n[User feedback: The user liked this response.]';
        }
        llmMessages.push({ 
          role: msg.role as 'user' | 'assistant', 
          content 
        } as OpenAI.Chat.ChatCompletionMessageParam);
      }
    }

    // Start streaming immediately - no need for extra status update

    // Use multi-agent system for response
    // For streaming, we'll use the primary agent's specialized prompt
    const agentSystemPrompt = selectedAgents.length === 1
      ? this.multiAgent.getAgentSystemPrompt(selectedAgents[0], systemPrompt)
      : systemPrompt;

    const finalMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: agentSystemPrompt },
      ...llmMessages.slice(1),
    ];

    // Stream response
    const stream = await this.openRouter.chatStream(finalMessages, modelTier);
    let fullResponse = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        yield { type: 'token', data: content };
      }
    }

    // If multiple agents, synthesize (for now, use primary agent response)
    // In future, could enhance to synthesize multiple agent responses

    fullResponse = this.appendNearbyHospitals(fullResponse, nearbyHospitals);
    const severity = this.ragService.parseSeverity(fullResponse);
    const requiresDoctorReview = severity === 'HIGH' || severity === 'EMERGENCY';

    const assistantMessage = {
      role: 'assistant',
      content: fullResponse,
      modelUsed: this.openRouter.getModelForTier(modelTier),
      citations: context.retrievedEvidence.map((e) => e.text),
      severity,
      timestamp: new Date(),
    } as any;
    session.messages.push(assistantMessage);

    const streamUserTurns = session.messages.filter((m: any) => m.role === 'user').length;
    if (streamUserTurns === 1) {
      try {
        session.summary = await this.generateAiChatTitle(message, fullResponse);
      } catch {
        session.summary = this.generateSummary(message);
      }
    } else if (!session.summary) {
      session.summary = this.generateSummary(message);
    }

    // Calculate quality metrics
    const citationCount = context.retrievedEvidence.length + context.webResults.length;
    const responseLength = fullResponse.length;
    let qualityScore = 50;
    if (responseLength >= 200 && responseLength <= 2000) qualityScore += 20;
    if (citationCount >= 2) qualityScore += 20;
    if (citationCount >= 5) qualityScore += 10;
    if (severity && (severity === 'HIGH' || severity === 'EMERGENCY')) qualityScore += 10;

    session.qualityMetrics = {
      responseLength,
      citationCount,
      qualityScore: Math.min(100, qualityScore),
    };

    // Automatic evaluation of response quality (async, don't block response)
    this.evaluationService.evaluateResponse(
      session._id!.toString(),
      message,
      fullResponse,
      context.retrievedEvidence.map((e) => e.text),
      severity,
    ).then((evaluationMetrics) => {
      // Store evaluation
      this.evaluationService.storeEvaluation(
        session._id!.toString(),
        session.messages.length - 1,
        evaluationMetrics,
        'auto',
      );
      
      // Update quality score with evaluation if better
      if (evaluationMetrics.overallScore > qualityScore) {
        session.qualityMetrics.qualityScore = evaluationMetrics.overallScore;
        session.save().catch(() => {});
      }
    }).catch(() => {});

    // Record A/B test result
    const responseTime = Date.now() - startTime;
    this.abTesting.recordTestResult(
      abVariant.id,
      session._id!.toString(),
      message,
      fullResponse,
      session.qualityMetrics.qualityScore || 0,
      responseTime,
    ).catch(() => {});

    if (requiresDoctorReview) {
      session.requiresDoctorReview = true;
      session.status = 'pending_review';
      await session.save();
      this.emitSessionUpdate(session);
      
      // Auto-assign to least-busy doctor
      try {
        await this.doctorService.autoAssignCase(currentSessionId);
      } catch (err) {
        // Log but don't fail the request if assignment fails
        console.error('Failed to auto-assign case:', err);
      }
    } else {
      await session.save();
      this.emitSessionUpdate(session);
    }

    yield {
      type: 'done',
      data: JSON.stringify({
        severity,
        requiresDoctorReview,
        sessionId: currentSessionId,
        chatTitle: session.summary,
      }),
    };
  }

  async renameSession(userId: string, sessionId: string, title: string): Promise<{ success: boolean }> {
    const result = await this.chatModel.updateOne(
      { _id: sessionId, userId: new Types.ObjectId(userId), deletedByUser: { $ne: true } },
      { $set: { summary: title.trim().substring(0, 100) } },
    );
    if (result.modifiedCount === 0) {
      throw new NotFoundException('Chat session not found');
    }
    return { success: true };
  }

  async togglePinSession(userId: string, sessionId: string): Promise<{ pinned: boolean }> {
    const session = await this.chatModel.findOne({
      _id: sessionId,
      userId: new Types.ObjectId(userId),
      deletedByUser: { $ne: true },
    });
    if (!session) throw new NotFoundException('Chat session not found');
    session.pinned = !session.pinned;
    await session.save();
    this.emitSessionUpdate(session);
    return { pinned: session.pinned };
  }

  async softDeleteSession(userId: string, sessionId: string): Promise<{ success: boolean }> {
    const result = await this.chatModel.updateOne(
      { _id: sessionId, userId: new Types.ObjectId(userId) },
      { $set: { deletedByUser: true, deletedAt: new Date() } },
    );
    if (result.modifiedCount === 0) {
      throw new NotFoundException('Chat session not found');
    }
    return { success: true };
  }

  async getHistory(userId: string, page: number = 1, limit: number = 20) {
    const sessions = await this.chatModel
      .find({ userId: new Types.ObjectId(userId), deletedByUser: { $ne: true } })
      .sort({ pinned: -1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('_id userId summary pinned status requiresDoctorReview updatedAt createdAt messages')
      .lean()
      .exec();

    // For history list, include message count and first user message for fallback title
    const lightSessions = sessions.map((s: any) => ({
      _id: s._id,
      userId: s.userId,
      summary: s.summary || '',
      pinned: !!s.pinned,
      status: s.status,
      requiresDoctorReview: s.requiresDoctorReview,
      updatedAt: s.updatedAt,
      createdAt: s.createdAt,
      messageCount: s.messages?.length || 0,
      // Include first user message as fallback title if no summary
      messages: s.messages?.slice(0, 2).map((m: any) => ({
        role: m.role,
        content: m.content?.substring(0, 100),
        timestamp: m.timestamp,
      })) || [],
    }));

    const total = await this.chatModel.countDocuments({ userId: new Types.ObjectId(userId), deletedByUser: { $ne: true } });

    return { sessions: lightSessions, total, page, pages: Math.ceil(total / limit) };
  }

  async getSession(userId: string, sessionId: string): Promise<ChatSession> {
    const session = await this.chatModel.findOne({
      _id: sessionId,
      userId: new Types.ObjectId(userId),
    });
    if (!session) throw new NotFoundException('Chat session not found');
    return session;
  }

  /**
   * Set feedback (like / dislike) on a specific assistant message.
   * messageIndex is the 0-based index in the session.messages array.
   */
  async setMessageFeedback(
    userId: string,
    sessionId: string,
    messageIndex: number,
    feedback: 'like' | 'dislike' | '',
  ): Promise<{ success: boolean; feedback: string }> {
    const session = await this.chatModel.findOne({
      _id: sessionId,
      userId: new Types.ObjectId(userId),
    });
    if (!session) throw new NotFoundException('Chat session not found');

    const msg = session.messages[messageIndex];
    if (!msg || msg.role !== 'assistant') {
      throw new NotFoundException('Assistant message not found at this index');
    }

    // Toggle: if same feedback, clear it; otherwise set it
    const currentFeedback = (msg as any).feedback || '';
    const newFeedback = currentFeedback === feedback ? '' : feedback;
    (msg as any).feedback = newFeedback;
    session.markModified('messages');
    await session.save();
    this.emitSessionUpdate(session);

    return { success: true, feedback: newFeedback };
  }
}
