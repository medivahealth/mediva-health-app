import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { PatientContextService, CompletePatientContext } from '../context/patient-context.service';

/** Default Live model — gemini-2.0-flash-exp often closes immediately on newer API stacks. */
const DEFAULT_VOICE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

/**
 * Strip WAV container to raw PCM for Gemini Live (expects audio/pcm;rate=16000 for 16k mono).
 */
function stripWavToPcmBase64(base64: string): { data: string; mimeType: string } | null {
  const buf = Buffer.from(base64, 'base64');
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    return null;
  }
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    const padded = chunkSize + (chunkSize % 2);
    if (chunkId === 'data') {
      const pcm = buf.subarray(offset + 8, offset + 8 + chunkSize);
      return { data: Buffer.from(pcm).toString('base64'), mimeType: 'audio/pcm;rate=16000' };
    }
    offset += 8 + padded;
  }
  return null;
}

function inferMimeFromPayload(base64: string, clientMime?: string): string {
  if (clientMime && clientMime.trim()) return clientMime.trim();
  const head = Buffer.from(base64.slice(0, Math.min(base64.length, 96)), 'base64');
  if (head.length >= 12 && head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WAVE') {
    return 'audio/wav';
  }
  if (head.length >= 8 && head.toString('ascii', 4, 8) === 'ftyp') {
    return 'audio/mp4';
  }
  return 'audio/pcm;rate=16000';
}

@Injectable()
export class GeminiVoiceService {
  private readonly logger = new Logger(GeminiVoiceService.name);
  private genAI: GoogleGenAI | null = null;

  constructor(
    private configService: ConfigService,
    private patientContextService: PatientContextService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.logger.log(`Gemini API Key configured: ${apiKey ? 'YES (length: ' + apiKey.length + ')' : 'NO - voice will not work!'}`);
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
    }
  }

  async createVoiceSession(
    onTranscript: (text: string, isUser: boolean) => void,
    onAudioChunk: (base64Audio: string) => void,
    onError: (error: string) => void,
    userId?: string,
    preferredLanguage: string = 'en',
    location?: { lat: number; lng: number; city?: string; country?: string },
    voiceName: string = 'Aoede',
  ) {
    if (!this.genAI) {
      onError('Gemini API not configured');
      return null;
    }

    // Base system instruction for Dr. Mediva - natural conversational style like Lotus AI
    let systemInstruction = `You are Dr. Mediva, a warm and empathetic primary care doctor.

CRITICAL RULE: LANGUAGE MATCHING
- Detect the language the user speaks and respond in the SAME language.
- Supported languages: English, Hindi, Marathi, Telugu, Bengali, Kannada, Tamil.
- Hindi → respond in Hindi, Telugu → Telugu, Marathi → Marathi, Bengali → Bengali, Kannada → Kannada, Tamil → Tamil.
- Use respectful forms: Hindi "Aap", Telugu "Meeru", etc.

CONVERSATION STYLE (like talking to a friend who happens to be a doctor)
- Be warm, natural, and conversational
- Ask 1-2 questions at a time, not a laundry list
- Acknowledge what they say before asking the next question
- Use phrases like "Good to know", "I understand", "That's helpful"
- Keep responses short and natural - like a real conversation
- Vary your openings - don't use the same greeting every time

MEDICAL SAFETY
- You're a primary care assistant, not a replacement for emergency care
- For emergencies (chest pain, difficulty breathing, stroke symptoms), tell them to call 108 immediately
- Suggest seeing a doctor when appropriate
- If user asks for nearby hospitals or clinics, ask/confirm city and suggest practical options.
- If signs are HIGH PRIORITY (worsening severe symptoms, persistent high fever, low SpO2, red-flag pain), explicitly say: "This seems high priority."
- Then ask naturally: "Would you like me to refer you to a doctor now?" and guide next steps.

PRESCRIPTION HANDLING
- You CANNOT prescribe medications directly
- If medicine is needed, say: "I'll prepare a prescription proposal for doctor verification."
- Tell the user clearly: "Your doctor will verify your prescription in-app."
- After verification, tell them naturally: "Your prescription is ready in the app - tap to view and share to a nearby pharmacy."
- Ask one clarifying question before suggesting any prescription proposal unless emergency care is required.

REGULATORY SAFE WORDING
- If user requests diagnosis/prescription, include:
  "This is clinical guidance, and final diagnosis/prescription needs licensed doctor review."
- Mention wearable uncertainty when relevant:
  "Wearable readings can have errors, so confirm important abnormalities with clinical testing."

DOCUMENT & IMAGE UNDERSTANDING
- If user asks about uploaded reports or images, explain findings in plain language.
- Supported medical artifacts include: X-ray, ECG, MRI, EEG, pathology reports, prescriptions, and discharge summaries.
- If certainty is low, state uncertainty clearly and suggest confirmatory next step.

START OF CONVERSATION
Begin naturally: "Hi [Name]! I'm Dr. Mediva. How can I help you today?" or if no name: "Hi! I'm Dr. Mediva. What brings you in today?"`;

    // Add location context if available
    if (location) {
      systemInstruction += `\n\nPATIENT LOCATION:\n- City: ${location.city || 'Unknown'}\n- Country: ${location.country || 'Unknown'}\n- Lat/Lng: ${location.lat}, ${location.lng}\nUse this for environmental health factors (allergies, weather-related symptoms).`;
    }

    // Voice: skip web search here — it added seconds of latency; hospitals work in text chat.

    // Patient context: short timeout so Live connects fast (Perplexity-like); enrich when ready.
    const CONTEXT_BUDGET_MS = 800;
    let context: CompletePatientContext | null = null;
    if (userId) {
      try {
        context = await Promise.race([
          this.patientContextService.buildCompleteContext(userId),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), CONTEXT_BUDGET_MS)),
        ]);
        if (!context) {
          this.logger.warn(
            `Patient context not ready within ${CONTEXT_BUDGET_MS}ms — starting voice without full profile`,
          );
        }
        if (context) {
          const ctx = context;

          const patientSummary = `

PATIENT PROFILE:
- Name: ${ctx.demographics.name}
- Blood Type: ${ctx.demographics.bloodType || 'Unknown'}

HEALTH HISTORY:
- Chronic Conditions: ${ctx.healthHistory.chronicConditions.join(', ') || 'None reported'}
- Current Medications: ${ctx.healthHistory.currentMedications.join(', ') || 'None'}
- Allergies: ${ctx.healthHistory.allergies.join(', ') || 'None known'}

CURRENT VITALS (from wearables):
- Heart Rate: ${ctx.wearableData.heartRate ?? 'Not available'} bpm
- SpO2: ${ctx.wearableData.spo2 ?? 'Not available'}%
- Steps today: ${ctx.wearableData.steps ?? 'Not available'}
- Weight: ${ctx.wearableData.weight ?? 'Not available'} kg

DATA COMPLETENESS: ${ctx.dataCompleteness}%
${ctx.dataCompleteness < 50 ? '[NOTE: Limited patient data available — double-check important details with the patient.]' : ''}
`;

          const hidden = ctx.insights.hiddenDiagnoses;
          const careGaps = ctx.insights.careGaps;

          let insightsSection = '';
          if (hidden.length > 0) {
            insightsSection += '\nPOTENTIAL HIDDEN DIAGNOSES:\n';
            insightsSection += hidden
              .slice(0, 3)
              .map(
                (d) =>
                  `- ${d.condition} (${d.severity}) — ${d.evidence} (confidence: ${Math.round(
                    d.confidence * 100,
                  )}%)`,
              )
              .join('\n');
          }

          if (careGaps.length > 0) {
            insightsSection += '\n\nCARE GAPS:\n';
            insightsSection += careGaps
              .slice(0, 3)
              .map((g) => `- ${g.description} — ${g.recommendation} (${g.urgency})`)
              .join('\n');
          }

          const langNote =
            preferredLanguage === 'en'
              ? 'Speak in natural English.'
              : `Prefer ${preferredLanguage} for conversation. Use English medical terms where helpful.`;

          systemInstruction += `

You are currently talking to this specific patient. Use their data to personalize your counseling.
${patientSummary}
${insightsSection}

ADDITIONAL RULES:
- Always consider this patient's chronic conditions, medications, and vitals before giving advice.
- If data seems incomplete, ask gentle follow-up questions to confirm history.
- ${langNote}
`;
        }
      } catch (err) {
        this.logger.warn(`Failed to build patient context for voice session: ${err}`);
      }
    }

    const voiceModel =
      this.configService.get<string>('GEMINI_VOICE_MODEL')?.trim() || DEFAULT_VOICE_MODEL;

    try {
      this.logger.log(`Creating Gemini Live session (model=${voiceModel})...`);

      const session = await this.genAI.live.connect({
        model: voiceModel,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
          systemInstruction,
        },
        callbacks: {
          onopen: () => {
            this.logger.log('Gemini voice session opened - ready for audio');
          },
          onmessage: (message: LiveServerMessage) => {
            // Handle audio chunks
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  onAudioChunk(part.inlineData.data);
                }
              }
            }

            // Handle transcripts
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              if (text) onTranscript(text, false); // AI speaking
            }

            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              if (text) onTranscript(text, true); // User spoke
            }
          },
          onerror: (err) => {
            const detail =
              err && typeof err === 'object'
                ? JSON.stringify(err, Object.getOwnPropertyNames(err as object))
                : String(err);
            this.logger.error(`Gemini voice error: ${detail}`);
            onError('Connection error: ' + (err && (err as any).message ? (err as any).message : detail));
          },
          onclose: (event?: any) => {
            const code = event?.code ?? event?.status ?? event?.reason;
            const reason = event?.reason ?? event?.message ?? '';
            this.logger.warn(
              `Gemini voice session closed code=${code ?? 'n/a'} reason=${reason || 'n/a'} raw=${JSON.stringify(event)}`,
            );
          },
        },
      });

      return session;
    } catch (err: any) {
      this.logger.error('Failed to create Gemini session:', err?.message || err);
      this.logger.error('Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      onError('Failed to initialize voice session: ' + (err?.message || 'Unknown error'));
      return null;
    }
  }

  async sendAudio(session: any, base64Audio: string, clientMimeType?: string) {
    if (!session || !base64Audio) return;

    const inferred = inferMimeFromPayload(base64Audio, clientMimeType);
    let data = base64Audio;
    let mimeType = inferred;

    if (inferred.includes('wav')) {
      const stripped = stripWavToPcmBase64(base64Audio);
      if (stripped) {
        data = stripped.data;
        mimeType = stripped.mimeType;
      }
    }

    try {
      session.sendRealtimeInput({
        media: { data, mimeType },
      });
    } catch (e: any) {
      this.logger.warn(`sendRealtimeInput failed: ${e?.message || e}`);
    }
  }

  closeSession(session: any) {
    if (session) {
      session.close();
    }
  }
}
