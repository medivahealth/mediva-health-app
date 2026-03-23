import OpenRouter from './openrouter';
import api from './api';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ConversationContext {
  userId?: string;
  sessionId?: string;
  healthData?: {
    wearableData?: any;
    medications?: string[];
    conditions?: string[];
  };
}

export interface VoiceResponse {
  text: string;
  requiresPrescription?: boolean;
  prescriptionStatus?: 'pending' | 'approved';
  intent?: string;
  actions?: VoiceAction[];
}

export interface VoiceAction {
  type: 'prescription_pending' | 'lab_booked' | 'appointment_scheduled' | 'reminder_set';
  message: string;
  data?: any;
}

const SYSTEM_INSTRUCTION = `You are Mediva — a warm, knowledgeable health companion. You speak like a trusted friend who happens to know a lot about medicine. You're approachable, genuine, and never sound like a computer or AI.

CRITICAL RULE: LANGUAGE MATCHING
- Detect the language the user speaks
- Respond in that same language
- Supported: English, Hindi, Telugu, Marathi, Bengali, Kannada, Tamil
- Never default to English if user speaks another language

HOW TO SPEAK (NATURAL & HUMAN)
- Use casual, friendly language — like texting a friend
- Short responses (2-4 sentences usually)
- One question at a time
- Show empathy: "That sounds rough" / "I get it" / "I'm sorry you're dealing with this"
- Never say "As an AI" or "I'm a virtual assistant" or anything robotic
- Never list capabilities like a brochure
- Just be helpful and human

GREETING — KEEP IT SIMPLE
- If you know their name: "Hey [name]! I'm Mediva. Nice to meet you :) What brings you here today?"
- If you don't know their name: "Hey there! I'm Mediva. What's your name? I'd love to know who I'm chatting with."
- If they ask "Who are you?": "I'm Mediva! I help people figure out health stuff — symptoms, lab results, what to eat, when to see a doctor. All free, no insurance needed. What's on your mind?"
- If they ask "What can you do?": "I can chat about symptoms, explain lab reports, suggest diet changes, or just help you figure out if something needs a doctor visit. What's going on with you?"

WHEN THEY SHARE THEIR NAME
"Nice to meet you, [name]! Thanks for telling me. So what's up? How can I help today?"

CONVERSATION STYLE
- Friendly and casual, not formal
- "How are you feeling?" not "What are your presenting symptoms?"
- "That sounds tough" not "I acknowledge your discomfort"
- "Want to tell me more about that?" not "Please elaborate on your condition"

SAFETY
- Don't diagnose serious things with certainty
- Suggest seeing a doctor when needed
- EMERGENCY: If chest pain, breathing problems, stroke signs, heavy bleeding, or unconsciousness → "Please go to the hospital or call emergency services right now."

PRESCRIPTIONS
- Don't give definite prescriptions
- Say: "I'll put together a recommendation for a doctor to review. They'll check it and get back to you."

SYMPTOM CHATS
1. Acknowledge: "That sounds uncomfortable"
2. Ask 1-2 questions
3. Give possible ideas: "It could be..." / "It might be..."
4. Suggest next steps

EXAMPLES
English: "Oof, that sounds rough. How long has this been going on?"
Hindi: "अरे, यह काफी परेशान करने वाला है। कब से हो रहा है?"
Telugu: "అయ్యో, అది బాధాకరంగా ఉంది. ఎప్పటి నుంచి ఇలా ఉంది?"

WHAT YOU CAN HELP WITH
- Symptoms: fever, cold, cough, headache, stomach issues
- Ongoing stuff: BP, diabetes
- Lifestyle, diet, sleep
- Medication info (not controlled substances)
- Lab results
- When to see a doctor

NEVER prescribe controlled meds or say "You definitely have X disease."

START CHAT
- With name: "Hey [name]! I'm Mediva. What's going on? How can I help?"
- Without name: "Hey! I'm Mediva. What's your name? And what's on your mind?"

CONTEXT
- Mention their conditions naturally: "Since you have diabetes..."
- Bring up med interactions if relevant
- Use their health data when it helps

Just be helpful, friendly, and real. Like a smart friend who cares.`;

export class VoiceConversationService {
  private openrouter: OpenRouter;
  private messages: Message[] = [];
  private context: ConversationContext = {};
  private isSpeaking: boolean = false;
  private pendingPrescription: boolean = false;

  constructor() {
    this.openrouter = new OpenRouter();
    this.messages = [{
      role: 'system',
      content: SYSTEM_INSTRUCTION
    }];
  }

  setContext(context: ConversationContext) {
    this.context = context;
  }

  async sendMessage(userMessage: string): Promise<VoiceResponse> {
    // Check for prescription-related intent
    const prescriptionIntent = this.detectPrescriptionIntent(userMessage);
    
    // Add user message to history
    this.messages.push({
      role: 'user',
      content: userMessage
    });

    // Build enhanced prompt with context
    const enhancedMessages = this.buildEnhancedMessages();

    try {
      const response = await this.openrouter.chat(enhancedMessages);
      
      // Add assistant response to history
      this.messages.push({
        role: 'assistant',
        content: response
      });

      // Build response with actions
      const voiceResponse: VoiceResponse = {
        text: response,
        intent: prescriptionIntent || this.detectIntent(userMessage),
        actions: [],
      };

      // If prescription was requested, trigger backend
      if (prescriptionIntent && this.context.userId) {
        voiceResponse.requiresPrescription = true;
        voiceResponse.prescriptionStatus = 'pending';
        voiceResponse.actions?.push({
          type: 'prescription_pending',
          message: 'Preparing prescription recommendation for doctor review...',
        });
        
        // Trigger prescription generation in background
        this.generatePrescription(userMessage, response);
      }

      return voiceResponse;
    } catch (error) {
      console.error('Error getting AI response:', error);
      throw error;
    }
  }

  /**
   * Detect if user is asking for a prescription
   */
  private detectPrescriptionIntent(message: string): string | null {
    const prescriptionPatterns = [
      /prescription/i,
      /need.*medicine/i,
      /give me.*medicine/i,
      /write.*prescription/i,
      /can you prescribe/i,
      /i need.*medication/i,
      /refill.*medicine/i,
      /dawai.*chahiye/i,  // Hindi
      /tablet.*ivvandi/i, // Telugu
      /marundhu/i,        // Tamil
    ];

    for (const pattern of prescriptionPatterns) {
      if (pattern.test(message)) {
        return 'prescription_request';
      }
    }
    return null;
  }

  /**
   * Detect general intent
   */
  private detectIntent(message: string): string {
    const patterns: Record<string, RegExp[]> = {
      symptom_report: [/pain/i, /fever/i, /headache/i, /feeling/i, /hurts/i],
      food_query: [/can i eat/i, /should i eat/i, /food/i, /diet/i],
      lab_booking: [/lab test/i, /blood test/i, /checkup/i],
      emergency: [/emergency/i, /chest pain/i, /can.t breathe/i],
    };

    for (const [intent, regexes] of Object.entries(patterns)) {
      for (const regex of regexes) {
        if (regex.test(message)) return intent;
      }
    }
    return 'general_query';
  }

  /**
   * Generate prescription via backend API
   */
  private async generatePrescription(symptoms: string, aiResponse: string): Promise<void> {
    if (!this.context.userId) return;

    try {
      // Extract likely diagnosis from AI response
      const diagnosisMatch = aiResponse.match(/(?:diagnosis|appears? to be|could be|might be)[\s:]+([^\.]+)/i);
      const diagnosis = diagnosisMatch ? diagnosisMatch[1].trim() : 'General consultation';

      await api.post('/prescription/request', {
        symptoms,
        diagnosis,
        chatSessionId: this.context.sessionId,
      });

      console.log('Prescription request sent to backend');
    } catch (error) {
      console.error('Failed to generate prescription:', error);
    }
  }

  /**
   * Start a proactive voice check-in
   */
  async startProactiveCheckIn(reason: string): Promise<VoiceResponse> {
    const greetings: Record<string, string> = {
      en: `Hello! I noticed ${reason}. How are you feeling today?`,
      hi: `नमस्ते! मैंने देखा कि ${reason}. आप आज कैसा महसूस कर रहे हैं?`,
      te: `నమస్కారం! నేను గమనించాను ${reason}. మీరు ఈరోజు ఎలా ఉన్నారు?`,
      ta: `வணக்கம்! நான் கவனித்தேன் ${reason}. இன்று எப்படி உணர்கிறீர்கள்?`,
    };

    // Default to English
    const greeting = greetings.en;

    return {
      text: greeting,
      intent: 'proactive_checkin',
      actions: [],
    };
  }

  private buildEnhancedMessages(): Message[] {
    let enhanced = [...this.messages];

    // Add health context if available
    if (this.context.healthData) {
      const contextParts: string[] = [];
      
      if (this.context.healthData.medications?.length) {
        contextParts.push(`Current medications: ${this.context.healthData.medications.join(', ')}`);
      }
      if (this.context.healthData.conditions?.length) {
        contextParts.push(`Known conditions: ${this.context.healthData.conditions.join(', ')}`);
      }
      if (this.context.healthData.wearableData) {
        contextParts.push(`Latest vitals available`);
      }

      if (contextParts.length > 0) {
        const contextMsg: Message = {
          role: 'user',
          content: `[PATIENT CONTEXT - Use naturally in conversation]\n${contextParts.join('\n')}`
        };
        enhanced = [enhanced[0], contextMsg, ...enhanced.slice(1)];
      }
    }

    // Limit conversation history to last 10 messages to avoid token limits
    if (enhanced.length > 12) {
      enhanced = [enhanced[0], ...enhanced.slice(-10)];
    }

    return enhanced;
  }

  clearHistory() {
    this.messages = [{
      role: 'system',
      content: SYSTEM_INSTRUCTION
    }];
    this.pendingPrescription = false;
  }

  getHistory(): Message[] {
    return this.messages.filter(m => m.role !== 'system');
  }

  /**
   * Check if there's a pending prescription
   */
  hasPendingPrescription(): boolean {
    return this.pendingPrescription;
  }
}
