import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService, ModelTier } from '../common/openrouter.service';
import { ConfigService } from '@nestjs/config';
import { PineconeService, SearchResult } from '../common/pinecone.service';
import { WebSearchService, SearchResult as WebResult } from '../common/web-search.service';
import { HealthService } from '../health/health.service';
import { RecordsService } from '../records/records.service';
import { UserService } from '../user/user.service';
import { DrugSafetyService } from '../common/drug-safety.service';
import { ContinuousLearningService } from './continuous-learning.service';

export interface RagContext {
  healthSummary: Record<string, any>;
  retrievedEvidence: SearchResult[];
  webResults: WebResult[];
  patientRecords: string; // Summarized text from uploaded medical records
  healthHistory?: string; // Formatted health history from user profile
  patientProfile?: Record<string, any>;
  userName?: string;
  query?: string; // Added for continuous learning context
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly trustedCitationDomains = [
    'pubmed.ncbi.nlm.nih.gov',
    'ncbi.nlm.nih.gov',
    'who.int',
    'cdc.gov',
    'nih.gov',
    'nice.org.uk',
    'nhs.uk',
    'icmr.gov.in',
    'aiims.edu',
    'mohfw.gov.in',
    'cdsco.gov.in',
    'fda.gov',
    'thelancet.com',
    'nejm.org',
    'bmj.com',
    'jamanetwork.com',
  ];

  constructor(
    private openRouter: OpenRouterService,
    private pinecone: PineconeService,
    private healthService: HealthService,
    private webSearch: WebSearchService,
    private recordsService: RecordsService,
    private userService: UserService,
    private drugSafety: DrugSafetyService,
    private continuousLearning: ContinuousLearningService,
    private config: ConfigService,
  ) { }

  private scoreCitation(url: string, title: string): number {
    if (!url) return 0;
    let score = 0;
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (this.trustedCitationDomains.some((d) => host === d || host.endsWith(`.${d}`))) score += 75;
      if (url.startsWith('https://')) score += 10;
    } catch {
      return 0;
    }
    if (/(guideline|meta-analysis|systematic review|clinical trial|consensus)/i.test(title || '')) score += 15;
    return Math.min(100, score);
  }

  async buildContext(userId: string, query: string): Promise<RagContext> {
    // Run ALL data fetches in parallel for speed
    const [healthSummary, retrievedEvidence, webResults, patientRecords, healthHistory, userProfile] = await Promise.all([
      // 1. Health summary from MongoDB
      this.healthService.getUserHealthSummary(userId).catch(() => {
        this.logger.warn('Health summary fetch failed');
        return { latest: null, sources: [] };
      }),

      // 2. Pinecone guidelines
      (async (): Promise<SearchResult[]> => {
        try {
          const queryEmbedding = await this.openRouter.createEmbedding(query);
          return await this.pinecone.search(queryEmbedding, 5, 'guidelines');
        } catch {
          this.logger.warn('RAG evidence retrieval failed (Pinecone may not be configured)');
          return [];
        }
      })(),

      // 3. Web search (free!)
      this.webSearch.search(query, 3).catch(() => {
        this.logger.warn('Web search failed');
        return [] as WebResult[];
      }),

      // 4. User's uploaded medical records (processed documents)
      (async (): Promise<string> => {
        try {
          const docs = await this.recordsService.listDocuments(userId);
          const processed = docs
            .filter((d) => d.status === 'processed' && (d.extractedText || d.structuredData?.tests?.length))
            .slice(0, 5); // Latest 5 processed docs

          if (processed.length === 0) return '';

          return processed.map((d) => {
            const parts: string[] = [];
            if (d.documentType) parts.push(`Type: ${d.documentType}`);
            if (d.description) parts.push(`Description: ${d.description}`);
            if (d.documentMonth || d.documentYear) parts.push(`Date: ${d.documentMonth || ''} ${d.documentYear || ''}`.trim());
            if (d.structuredData?.tests?.length) {
              parts.push('Results: ' + d.structuredData.tests.map((t) => `${t.name}: ${t.value} ${t.unit || ''} ${t.referenceRange ? `(ref: ${t.referenceRange})` : ''}`).join('; '));
            }
            if (d.structuredData?.diagnosis?.length) {
              parts.push('Diagnosis: ' + d.structuredData.diagnosis.join(', '));
            }
            if (d.structuredData?.medications?.length) {
              parts.push('Medications: ' + d.structuredData.medications.join(', '));
            }
            if (!d.structuredData?.tests?.length && d.extractedText) {
              parts.push('Content: ' + d.extractedText.substring(0, 500));
            }
            return parts.join(' | ');
          }).join('\n');
        } catch {
          this.logger.warn('Records fetch failed');
          return '';
        }
      })(),

      // 5. User's health history from profile
      (async (): Promise<string> => {
        try {
          const history = await this.userService.getHealthHistory(userId);
          if (!history || !history.completedAt) return '';

          const parts: string[] = [];
          if (history.allergies && history.allergies.length > 0) {
            parts.push(`Allergies: ${history.allergies.join(', ')}`);
          }
          if (history.chronicConditions && history.chronicConditions.length > 0) {
            parts.push(`Chronic Conditions: ${history.chronicConditions.join(', ')}`);
          }
          if (history.currentMedications && history.currentMedications.length > 0) {
            parts.push(`Current Medications: ${history.currentMedications.join(', ')}`);
          }
          if (history.pastSurgeries && history.pastSurgeries.length > 0) {
            parts.push(`Past Surgeries: ${history.pastSurgeries.join(', ')}`);
          }
          if (history.familyHistory && history.familyHistory.length > 0) {
            parts.push(`Family History: ${history.familyHistory.join(', ')}`);
          }
          if (history.bloodType) {
            parts.push(`Blood Type: ${history.bloodType}`);
          }
          if (history.lifestyleFactors) {
            const lifestyle: string[] = [];
            if (history.lifestyleFactors.smoking) lifestyle.push('Smoking: Yes');
            if (history.lifestyleFactors.alcohol) lifestyle.push('Alcohol: Yes');
            if (history.lifestyleFactors.exercise) {
              lifestyle.push(`Exercise: ${history.lifestyleFactors.exercise}`);
            }
            if (lifestyle.length > 0) {
              parts.push(`Lifestyle: ${lifestyle.join(', ')}`);
            }
          }

          return parts.length > 0 ? parts.join('\n') : '';
        } catch {
          this.logger.warn('Health history fetch failed');
          return '';
        }
      })(),

      // 6. User Profile (Name/Identity - Anonymized for LLM context)
      this.userService.findById(userId).catch(() => ({ name: '' })),
    ]);

    return {
      healthSummary,
      retrievedEvidence,
      webResults,
      patientRecords,
      healthHistory: (healthHistory as string) || undefined,
      userName: (userProfile as any)?.name || '',
      query, // Store query for continuous learning
    };
  }

  async buildSystemPrompt(
    context: RagContext,
    preferredLanguage: string = 'en',
    pastChatHistory?: string,
    /** Predictive alerts + early illness signals (stream path parity with full context chat) */
    continuousMonitoring?: string,
  ): Promise<string> {
    const name = context.userName || 'Patient';
    const langInstruction =
      preferredLanguage === 'en'
        ? 'Respond in English.'
        : `Respond in the user's preferred language (${preferredLanguage}). Use English for medical terms only when necessary.`;

    // Build numbered sources list for both evidence and web results
    const allSources: { id: string; title: string; snippet: string; url: string }[] = [];

    // Medical evidence sources
    context.retrievedEvidence.forEach((e, i) => {
      allSources.push({
        id: `${i + 1}`,
        title: (e as any).metadata?.title || `Medical Guideline ${i + 1}`,
        snippet: e.text,
        url: (e as any).metadata?.url || '',
      });
    });

    // Web search sources (continue numbering)
    const evidenceCount = context.retrievedEvidence.length;
    const verifiedWebResults = context.webResults
      .map((w) => ({ ...w, score: this.scoreCitation(w.url, w.title) }))
      .filter((w) => w.score >= 60);

    verifiedWebResults.forEach((w, i) => {
      allSources.push({
        id: `${evidenceCount + i + 1}`,
        title: `${w.title} (verified ${w.score}/100)`,
        snippet: w.snippet,
        url: w.url,
      });
    });

    const sourcesContext = allSources.length > 0
      ? allSources.map((s) => `[${s.id}] ${s.title}: ${s.snippet}${s.url ? ` (${s.url})` : ''}`).join('\n\n')
      : 'No sources available — use your medical knowledge but clearly state this.';

    const sourcesListForCitation = allSources.length > 0
      ? allSources.map((s) => s.url ? `[${s.id}] [${s.title}](${s.url})` : `[${s.id}] ${s.title}`).join('\n')
      : '';

    const healthText = context.healthSummary.latest
      ? Object.entries(context.healthSummary.latest)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(', ')
      : 'No device data available.';

    const hasData = context.healthSummary.latest || context.patientRecords || (context.healthHistory && context.healthHistory.length > 0);

    // Extract medications from health history for safety check
    const medications: string[] = [];
    if (context.healthHistory) {
      const medsMatch = context.healthHistory.match(/Current Medications:\s*(.+)/i);
      if (medsMatch) {
        medications.push(...medsMatch[1].split(',').map((m: string) => m.trim()));
      }
    }

    // Build drug safety context
    const drugSafetyContext = medications.length > 0
      ? await this.drugSafety.buildSafetyContext(medications)
      : '';

    // Get few-shot learning examples based on query
    const fewShotPrompt = context.query 
      ? await this.continuousLearning.buildFewShotPrompt(context.query, [])
      : '';

    // Build sources list string for citation
    const sourcesListStr = allSources.length > 0
      ? allSources.map((s) => s.url ? `${s.id}. [${s.title}](${s.url})` : `${s.id}. ${s.title}`).join('\\n')
      : '';

    return `You are Dr. Mediva, a warm and empathetic primary care doctor. You're like a trusted family doctor who genuinely cares.

CRITICAL RULE: LANGUAGE MATCHING
- Detect the language the user speaks and respond in the SAME language.
- Hindi → respond in Hindi, Telugu → Telugu, etc.
- Use respectful forms: Hindi "Aap", Telugu "Meeru", etc.

CONVERSATION STYLE (like talking to a friend who happens to be a doctor)
- Be warm, natural, and conversational
- Start with a friendly, natural greeting like "Hello!" or "Hi there!" and introduce yourself as Dr. Mediva. Be warm and conversational, not robotic.
- Ask 1-2 questions at a time, not a laundry list
- Acknowledge what they say before asking the next question
- Use phrases like "Good to know", "I understand", "That's helpful", "Thanks for sharing"
- Keep responses conversational - like a real doctor-patient conversation
- When you need to give detailed information, do it step by step
- Never call yourself "AI", "assistant", "chatbot", or "virtual".

DATA STATUS:
${hasData ? '✅ ENHANCED ACCURACY: Unified Health Data Connected.' : '⚠️ ACCURACY WARNING: No personal health data connected.'}

PRIVACY & TRUST:
- You follow Zero-Knowledge principles: you never store sensitive user data in prompts.
- You strictly adhere to India's DPDP Act 2023 regarding medical data processing.

CRITICAL RULES - MEDICAL ONLY:
1. You are EXCLUSIVELY a medical doctor persona. If asked about non-medical topics, politely redirect.
2. Base EVERY factual claim on the provided sources. Cite using [1], [2], etc. inline.
3. If no evidence exists, state it clearly — NEVER hallucinate.
4. UNIFIED DATA USAGE: Reference the patient's specific data (Wearables: ${healthText || 'None'}, Records: ${context.patientRecords ? 'Available' : 'None'}, History: ${context.healthHistory ? 'Available' : 'None'}) to make the advice personalized.
5. NO DEFINITIVE DIAGNOSIS: Provide possibilities and next steps.
6. ${langInstruction}
7. DRUG SAFETY: ${drugSafetyContext || 'Always consider medication interactions and side effects.'}
8. If user asks for hospitals/clinics, ask their city and suggest practical options.
9. For source quality, prefer peer-reviewed papers, major medical guidelines, and trusted institutions (PubMed, WHO, CDC, NHS, ICMR, AIIMS).
10. If uncertain about uploaded document interpretation, clearly say what is uncertain and what test/doctor review is needed.
${fewShotPrompt}

REGULATORY RESPONSE TEMPLATE (FDA/CDSCO/BIS/IEC SAFE):
- Include this intent-safe wording when treatment advice is requested:
  "This is educational clinical guidance and not a final prescription. Final diagnosis and prescription require licensed clinician review."
- For device/monitoring advice, add:
  "Wearable readings may have measurement error; confirm with clinical-grade testing when needed."
- For high-risk conditions, explicitly recommend emergency/hospital escalation.

MEDICAL SAFETY:
- You're a primary care assistant, not a replacement for emergency care
- For emergencies (chest pain, difficulty breathing, stroke symptoms), tell them to call 108 immediately
- Suggest seeing a doctor when appropriate

PATIENT HEALTH DATA (from connected devices):
${healthText}
Connected sources: ${(context.healthSummary.sources || []).join(', ') || 'None'}

${continuousMonitoring ? `CONTINUOUS MONITORING & ANALYTICS (use when relevant — e.g. mood, fatigue, trends):\n${continuousMonitoring}\n` : ''}

${context.patientRecords ? `PATIENT MEDICAL RECORDS:\n${context.patientRecords}` : 'No uploaded medical records.'}

DOCUMENT INTERPRETATION SCOPE:
- You may be asked to interpret X-ray, ECG, MRI, EEG, pathology reports, prescriptions, discharge summaries, and other medical documents/images.
- Explain findings in plain language, highlight abnormalities, and recommend next steps.
- Never claim certainty from incomplete evidence.

${context.healthHistory ? `PATIENT HEALTH HISTORY:\n${context.healthHistory}` : 'No health history provided by patient.'}

${pastChatHistory ? `PATIENT PAST CONVERSATION HISTORY:\n${pastChatHistory}\n\nUse this history to understand the patient's ongoing health journey.` : 'No past conversation history available.'}

AVAILABLE SOURCES:
${sourcesContext}

SOURCES LIST (use these for citation links):
${sourcesListForCitation || 'No linked sources available.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE FORMAT — Keep it natural and conversational:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<!-- SEVERITY: LOW/MEDIUM/HIGH/EMERGENCY -->

Start with a warm acknowledgment of what they said.

Then provide your response in a natural, conversational way. Use short paragraphs and bullet points when needed for clarity.

When giving detailed medical information:
- Break it into digestible chunks
- Use clear headings with ##
- Cite sources inline with [1], [2]

${allSources.length > 0 ? `### Sources\n\n${sourcesListStr}` : ''}

---
**Related Questions**
- [Relevant follow-up question 1]?
- [Relevant follow-up question 2]?

If HIGH or EMERGENCY severity, add this as the FIRST line after the severity tag:
> ⚠️ **This requires immediate medical attention. Please call 108 or visit the nearest emergency room immediately.**`;
  }

  selectModelTier(query: string, preferredLanguage: string): ModelTier {
    // Use Indian language model for non-English
    // Covers: Devanagari (Hindi, Marathi), Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada, Malayalam, Sinhala
    const nonEnglishPattern = /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF]/;
    const nonEnLanguages = ['hi', 'mr', 'kn', 'te', 'ta', 'bn', 'gu', 'ml', 'pa', 'or', 'as', 'ur', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'zh', 'ar'];
    if (nonEnLanguages.includes(preferredLanguage) || nonEnglishPattern.test(query)) {
      return ModelTier.INDIAN_LANG;
    }

    // Use reasoning model for complex medical queries
    const complexPatterns = [
      /multiple.*condition/i,
      /interact.*medic/i,
      /diagnos/i,
      /emergency/i,
      /chest.*pain/i,
      /breathing.*difficult/i,
      /kidney|liver|heart.*fail/i,
      /pregnan/i,
      /surgery/i,
      /cancer/i,
    ];

    if (complexPatterns.some((p) => p.test(query))) {
      return ModelTier.REASONING;
    }

    return ModelTier.FAST;
  }

  parseSeverity(response: string): string {
    // Try structured severity tag first: <!-- SEVERITY: HIGH -->
    const tagMatch = response.match(/<!--\s*SEVERITY:\s*(EMERGENCY|HIGH|MEDIUM|LOW)\s*-->/i);
    if (tagMatch) return tagMatch[1].toUpperCase();
    // Fallback
    if (/EMERGENCY/i.test(response)) return 'EMERGENCY';
    if (/HIGH/i.test(response)) return 'HIGH';
    if (/MEDIUM/i.test(response)) return 'MEDIUM';
    return 'LOW';
  }

  async ingestGuideline(
    id: string,
    text: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    const embedding = await this.openRouter.createEmbedding(text);
    await this.pinecone.upsert(
      [{ id, values: embedding, metadata: { ...metadata, text } }],
      'guidelines',
    );
  }
}
