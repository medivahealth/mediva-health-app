import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../common/openrouter.service';

/**
 * Intent types the AI can recognize
 */
export type IntentType = 
  | 'health_question'      // General health questions
  | 'symptom_report'       // Reporting symptoms, asking for diagnosis
  | 'prescription_request' // Asking for medication, refill, prescription
  | 'lab_booking'          // Wanting to book a lab test
  | 'food_query'           // Questions about food/diet
  | 'emergency'            // Emergency situations
  | 'medication_info'      // Asking about medication information
  | 'appointment'          // Wanting to book appointment with doctor
  | 'record_request'       // Asking for medical records
  | 'general_greeting'     // Greetings, small talk
  | 'unknown';             // Couldn't classify

export interface ClassifiedIntent {
  type: IntentType;
  confidence: number;
  entities: {
    symptoms?: string[];
    medications?: string[];
    bodyParts?: string[];
    duration?: string;
    severity?: 'mild' | 'moderate' | 'severe';
    foodItem?: string;
    testType?: string;
  };
  reasoning: string;
}

@Injectable()
export class IntentClassifierService {
  private readonly logger = new Logger(IntentClassifierService.name);

  // Quick pattern matching for common intents (faster than LLM)
  private readonly patterns: Record<IntentType, RegExp[]> = {
    emergency: [
      /emergency/i,
      /can'?t breathe/i,
      /chest pain/i,
      /heart attack/i,
      /stroke/i,
      /severe bleeding/i,
      /unconscious/i,
      /not breathing/i,
      /seizure/i,
      /overdose/i,
      /suicid/i,
    ],
    prescription_request: [
      /prescription/i,
      /need.*medicine/i,
      /refill/i,
      /can you prescribe/i,
      /write.*prescription/i,
      /get.*medication/i,
      /repeat.*medicine/i,
    ],
    lab_booking: [
      /lab test/i,
      /blood test/i,
      /book.*test/i,
      /get.*tested/i,
      /diagnostic/i,
      /checkup/i,
      /health check/i,
    ],
    food_query: [
      /can i eat/i,
      /should i eat/i,
      /is it safe to eat/i,
      /can i have/i,
      /diet/i,
      /food/i,
    ],
    symptom_report: [
      /i have.*pain/i,
      /i feel/i,
      /my.*hurts/i,
      /symptom/i,
      /suffering from/i,
      /experiencing/i,
      /headache/i,
      /fever/i,
      /cough/i,
      /cold/i,
      /stomach/i,
      /nausea/i,
      /dizziness/i,
    ],
    medication_info: [
      /what is/i,
      /side effect/i,
      /dosage/i,
      /how to take/i,
      /medicine.*for/i,
      /drug interaction/i,
    ],
    appointment: [
      /appointment/i,
      /book.*doctor/i,
      /see a doctor/i,
      /consult/i,
      /specialist/i,
    ],
    record_request: [
      /my record/i,
      /medical history/i,
      /lab result/i,
      /prescription history/i,
      /show my/i,
    ],
    health_question: [
      /what is/i,
      /how does/i,
      /why do/i,
      /explain/i,
      /tell me about/i,
      /difference between/i,
    ],
    general_greeting: [
      /^hi$/i,
      /^hello$/i,
      /^hey$/i,
      /^good morning/i,
      /^good evening/i,
      /how are you/i,
    ],
    unknown: [],
  };

  constructor(private openRouter: OpenRouterService) {}

  /**
   * Classify user intent using pattern matching first, then LLM if needed
   */
  async classifyIntent(message: string): Promise<ClassifiedIntent> {
    // 1. Quick pattern matching for obvious cases
    const quickResult = this.quickClassify(message);
    if (quickResult && quickResult.confidence > 0.9) {
      return quickResult;
    }

    // 2. Use LLM for nuanced classification
    return this.llmClassify(message, quickResult);
  }

  /**
   * Quick pattern-based classification (fast, no LLM call)
   */
  private quickClassify(message: string): ClassifiedIntent | null {
    // Check emergency first (highest priority)
    for (const pattern of this.patterns.emergency) {
      if (pattern.test(message)) {
        return {
          type: 'emergency',
          confidence: 0.95,
          entities: { severity: 'severe' },
          reasoning: 'Matched emergency pattern',
        };
      }
    }

    // Check other patterns
    for (const [intentType, patterns] of Object.entries(this.patterns)) {
      if (intentType === 'unknown' || intentType === 'emergency') continue;
      
      for (const pattern of patterns) {
        if (pattern.test(message)) {
          return {
            type: intentType as IntentType,
            confidence: 0.85,
            entities: this.extractEntities(message, intentType as IntentType),
            reasoning: `Matched pattern: ${pattern}`,
          };
        }
      }
    }

    return null;
  }

  /**
   * Extract entities from message using patterns
   */
  private extractEntities(message: string, intentType: IntentType): ClassifiedIntent['entities'] {
    const entities: ClassifiedIntent['entities'] = {};

    // Extract duration patterns
    const durationMatch = message.match(/for\s+(\d+\s*(hours?|days?|weeks?|months?))/i);
    if (durationMatch) {
      entities.duration = durationMatch[1];
    }

    // Extract severity indicators
    if (/severe|extreme|unbearable|worst/i.test(message)) {
      entities.severity = 'severe';
    } else if (/moderate|medium|somewhat/i.test(message)) {
      entities.severity = 'moderate';
    } else if (/mild|slight|little/i.test(message)) {
      entities.severity = 'mild';
    }

    // Extract food items for food queries
    if (intentType === 'food_query') {
      const foodMatch = message.match(/can i (?:eat|have)\s+(?:a\s+)?(.+?)(?:\?|$|at|in)/i);
      if (foodMatch) {
        entities.foodItem = foodMatch[1].trim();
      }
    }

    return entities;
  }

  /**
   * Use LLM for nuanced intent classification
   */
  private async llmClassify(
    message: string,
    quickResult: ClassifiedIntent | null,
  ): Promise<ClassifiedIntent> {
    const prompt = `Classify this health-related message and extract entities.

Message: "${message}"

${quickResult ? `Initial classification: ${quickResult.type} (confidence: ${quickResult.confidence})` : ''}

Respond in JSON format:
{
  "type": "one of: health_question, symptom_report, prescription_request, lab_booking, food_query, emergency, medication_info, appointment, record_request, general_greeting, unknown",
  "confidence": 0.0-1.0,
  "entities": {
    "symptoms": ["list of mentioned symptoms"],
    "medications": ["list of mentioned medications"],
    "bodyParts": ["affected body parts"],
    "duration": "how long if mentioned",
    "severity": "mild/moderate/severe",
    "foodItem": "food item if relevant",
    "testType": "type of test if relevant"
  },
  "reasoning": "brief explanation"
}`;

    try {
      const response = await this.openRouter.chat(
        [{ role: 'user', content: prompt }],
        'fast' as any,
        { temperature: 0.1, maxTokens: 300 },
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          type: parsed.type || 'unknown',
          confidence: parsed.confidence || 0.5,
          entities: parsed.entities || {},
          reasoning: parsed.reasoning || '',
        };
      }
    } catch (err) {
      this.logger.warn(`LLM intent classification failed: ${err}`);
    }

    // Fallback to quick result or unknown
    return quickResult || {
      type: 'unknown',
      confidence: 0.3,
      entities: {},
      reasoning: 'Could not classify with confidence',
    };
  }

  /**
   * Determine if the intent requires doctor review
   */
  requiresDoctorReview(intent: ClassifiedIntent): boolean {
    return [
      'prescription_request',
      'symptom_report',
    ].includes(intent.type) && intent.entities.severity !== 'mild';
  }

  /**
   * Determine if the intent can trigger a prescription
   */
  canTriggerPrescription(intent: ClassifiedIntent): boolean {
    return intent.type === 'prescription_request' || 
           (intent.type === 'symptom_report' && intent.confidence > 0.7);
  }
}
