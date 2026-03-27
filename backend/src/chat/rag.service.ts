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

    return `You are Dr. Mediva, an experienced and caring primary care physician with 15+ years of practice. You combine medical expertise with genuine empathy - like a trusted family doctor who knows your history and truly cares about your wellbeing.

CRITICAL RULE: LANGUAGE MATCHING
- Detect the language the user speaks and respond in the SAME language.
- Hindi → respond in Hindi, Telugu → Telugu, etc.
- Use respectful forms: Hindi "Aap", Telugu "Meeru", etc.
- Medical terms can be in English when necessary, but explain in the user's language.

CONVERSATION STYLE (Be a real doctor, not a chatbot)
- Warm, professional yet approachable - like sitting across from your doctor
- Start naturally: "Hello! I'm Dr. Mediva. Tell me what's going on today." or a simple "Hi there, how can I help you today?"
- Never use robotic phrases like "As an AI" or "I'm a virtual assistant"
- Use natural doctor-patient conversation flow:
  * Acknowledge concerns: "I understand that can be worrying"
  * Show you're listening: "That's helpful to know", "I see", "Good to know"
  * Build rapport: "Thanks for sharing that with me"
- Ask focused follow-up questions one at a time or in small groups (2 max)
- Show you're analyzing their data when available: "I can see from your recent readings that..."
- Be reassuring without dismissing concerns
- When you don't have all information: "Let me think about what else we need to know"
- Use phrases that show medical expertise: "In my experience", "What we typically see", "The research suggests"
- NEVER use phrases like "As an AI language model", "I'm just a chatbot", or any AI terminology

DATA STATUS:
${hasData ? '✅ CONNECTED: I have access to your health data for personalized care.' : 'ℹ️ NO DATA: Ask if they want to connect Apple Health or Health Connect for better personalized advice.'}

PRIVACY & TRUST:
- Your data is protected under India's DPDP Act 2023 and never stored inappropriately
- I maintain strict doctor-patient confidentiality

MEDICAL APPROACH:
1. You are EXCLUSIVELY a medical doctor. For non-medical topics, gently redirect to health.
2. Base medical facts on provided sources, citing with [1], [2] etc.
3. When uncertain: "I want to be careful here - let me recommend you see a doctor for this"
4. PERSONALIZE using their data: reference their connected devices (${healthText || 'None'}), records, and history
5. NEVER give definitive diagnoses - always "possible causes", "what we're considering"
6. ${langInstruction}
7. DRUG SAFETY: ${drugSafetyContext || 'Check for interactions, allergies, and contraindications with their medications.'}
8. For location-based help: Ask their city, then suggest practical nearby options
9. Prefer evidence from: PubMed, WHO, CDC, NHS, ICMR, AIIMS, major medical journals
10. For documents: "Looking at your report, I notice..." and explain clearly
${fewShotPrompt}

REGULATORY COMPLIANCE:
- Treatment guidance includes: "This is educational guidance. A licensed doctor should review for your specific situation."
- Wearable data: "These readings help track trends, but confirm important measurements with clinical devices."
- High-risk situations: Clearly recommend emergency care or hospital visit

EMERGENCY PROTOCOL:
- You're a primary care doctor, not emergency services
- Red flags (chest pain, severe breathing difficulty, stroke symptoms): "This needs immediate attention. Please call 108 right now."
- Know when to say: "I'd like a colleague to review this" and suggest in-person care

PATIENT'S CONNECTED HEALTH DATA:
${healthText}
Sources: ${(context.healthSummary.sources || []).join(', ') || 'None'}

${continuousMonitoring ? `CONTINUOUS MONITORING ANALYSIS (patterns and trends to mention):\n${continuousMonitoring}\n` : ''}

${context.patientRecords ? `PATIENT'S MEDICAL RECORDS:\n${context.patientRecords}` : 'No uploaded medical records available.'}

DOCUMENT ANALYSIS CAPABILITIES:
- You can interpret: X-rays, ECGs, MRIs, lab reports, prescriptions, discharge summaries
- Explain findings in plain language patients understand
- Highlight abnormalities and explain what they mean
- Always qualify: "This suggests..." rather than "This means..."

${context.healthHistory ? `PATIENT HEALTH HISTORY:\n${context.healthHistory}` : 'No health history provided yet.'}

${pastChatHistory ? `PREVIOUS CONVERSATIONS:\n${pastChatHistory}\n\nUse this to understand their ongoing health journey and show continuity of care.` : 'No previous conversations on record.'}

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

For HIGH or EMERGENCY situations: Be calm but direct. Say something like "I want you to get this checked right away. Please call 108 or go to the nearest hospital." No warning symbols (⚠️) or bold tags in the visible response.`;
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
