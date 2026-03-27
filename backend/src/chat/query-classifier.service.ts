import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService, ModelTier } from '../common/openrouter.service';

export interface QueryClassification {
  isMedical: boolean;
  category: 'medical' | 'general' | 'coding' | 'other';
  confidence: number;
  suggestedRedirect?: string;
}

@Injectable()
export class QueryClassifierService {
  private readonly logger = new Logger(QueryClassifierService.name);

  constructor(private openRouter: OpenRouterService) {}

  private readonly greetingPatterns = [
    /\b(hi|hello|hey|heyy|yo|wassup|sup|good morning|good afternoon|good evening)\b/i,
  ];

  private pickRedirect(query: string): string {
    const friendlyGreetings = [
      "Hey, good to hear from you. Tell me what health issue or symptom is bothering you, and I'll help step by step.",
      "Hi there. I'm here for your health questions - symptoms, medicines, reports, or treatment guidance. What would you like help with right now?",
      "Hello. We can talk through any health concern together. What are you feeling today?",
      "Thanks for checking in. I'm your medical assistant for health concerns - what should we focus on first?",
    ];
    const strictRedirects = [
      "I can help with health and medical topics - symptoms, medications, reports, and treatment guidance. What health concern should we start with?",
      "Let's focus on your health. Share your symptom, report, or medicine question, and I'll guide you clearly.",
      "I work best on medical questions. Tell me what's going on with your health, and we'll sort it out together.",
      "I'm here for medical support. What symptom or health concern would you like to discuss first?",
    ];

    const isGreeting = this.greetingPatterns.some((pattern) => pattern.test(query));
    const pool = isGreeting ? friendlyGreetings : strictRedirects;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Classify if a query is medical-related
   * Returns classification with confidence score
   */
  async classifyQuery(query: string): Promise<QueryClassification> {
    // Quick keyword-based pre-filter for common non-medical topics
    const nonMedicalKeywords = [
      'coding', 'programming', 'code', 'javascript', 'python', 'html', 'css',
      'software', 'app development', 'website', 'computer', 'technology',
      'recipe', 'cooking', 'food recipe', 'how to cook',
      'movie', 'film', 'entertainment', 'game', 'gaming',
      'weather', 'sports', 'news', 'politics',
      'what is coding', 'explain coding', 'learn programming',
    ];

    const lowerQuery = query.toLowerCase();
    const hasNonMedicalKeyword = nonMedicalKeywords.some(keyword => 
      lowerQuery.includes(keyword)
    );

    if (hasNonMedicalKeyword) {
      return {
        isMedical: false,
        category: lowerQuery.includes('coding') || lowerQuery.includes('programming') 
          ? 'coding' 
          : 'general',
        confidence: 0.9,
        suggestedRedirect: this.pickRedirect(query),
      };
    }

    // Use LLM for more nuanced classification
    try {
      const classificationPrompt = `You are a medical query classifier. Determine if the following user query is related to health, medicine, or medical conditions.

Query: "${query}"

Respond with ONLY a JSON object in this exact format:
{
  "isMedical": true or false,
  "category": "medical" or "general" or "coding" or "other",
  "confidence": 0.0 to 1.0,
  "reason": "brief explanation"
}

Rules:
- If the query is about health, symptoms, diseases, medications, medical conditions, treatments, wellness, fitness, nutrition (health-related), mental health, or asking for medical advice → isMedical: true
- If the query is about programming, coding, technology (non-medical), recipes, entertainment, general knowledge → isMedical: false
- Be strict: Only health/medical topics are medical
- Confidence should reflect how certain you are (0.9+ for clear cases, 0.6-0.8 for ambiguous)`;

      const response = await this.openRouter.chat(
        [{ role: 'user', content: classificationPrompt }],
        ModelTier.FAST,
        { temperature: 0.1, maxTokens: 200 },
      );

      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          isMedical: parsed.isMedical === true,
          category: parsed.category || 'other',
          confidence: parsed.confidence || 0.5,
          suggestedRedirect: !parsed.isMedical 
            ? this.pickRedirect(query)
            : undefined,
        };
      }
    } catch (err) {
      this.logger.warn('Query classification failed, using fallback:', err);
    }

    // Fallback: Assume medical if contains health-related keywords
    const medicalKeywords = [
      'pain', 'symptom', 'disease', 'illness', 'sick', 'health', 'medical',
      'doctor', 'medicine', 'medication', 'treatment', 'diagnosis', 'condition',
      'fever', 'headache', 'cough', 'blood', 'heart', 'lung', 'stomach',
      'diabetes', 'hypertension', 'cancer', 'infection', 'virus', 'bacteria',
      'wellness', 'fitness', 'nutrition', 'diet', 'exercise', 'mental health',
      'anxiety', 'depression', 'stress', 'sleep', 'weight', 'bp', 'sugar',
    ];

    const hasMedicalKeyword = medicalKeywords.some(keyword => 
      lowerQuery.includes(keyword)
    );

    return {
      isMedical: hasMedicalKeyword,
      category: hasMedicalKeyword ? 'medical' : 'general',
      confidence: hasMedicalKeyword ? 0.7 : 0.6,
      suggestedRedirect: !hasMedicalKeyword
        ? this.pickRedirect(query)
        : undefined,
    };
  }
}
