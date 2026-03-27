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
        suggestedRedirect: "Hi, I'm Dr. Mediva. I focus on medical and health-related questions. Tell me your symptom or health concern, and I'll help you step by step.",
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
            ? "I focus on health and medical care - symptoms, medications, reports, and treatment guidance. What health concern can I help you with today?"
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
        ? "Hi, I'm Dr. Mediva. I can support you with medical and health questions. What would you like help with today?"
        : undefined,
    };
  }
}
