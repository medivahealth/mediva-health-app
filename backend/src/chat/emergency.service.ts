import { Injectable } from '@nestjs/common';

export interface EmergencyDetectionResult {
  isEmergency: boolean;
  severity: 'EMERGENCY' | 'HIGH' | null;
  keywords: string[];
}

@Injectable()
export class EmergencyService {
  // Emergency keywords in multiple languages
  private readonly emergencyKeywords = {
    en: [
      'chest pain',
      'unconscious',
      'bleeding heavily',
      "can't breathe",
      'can not breathe',
      'heart attack',
      'stroke',
      'severe pain',
      'difficulty breathing',
      'shortness of breath',
      'choking',
      'severe bleeding',
      'unresponsive',
      'not breathing',
      'cardiac arrest',
      'severe allergic reaction',
      'anaphylaxis',
      'severe burn',
      'severe injury',
      'severe trauma',
      'severe headache',
      'severe dizziness',
      'severe nausea',
      'severe vomiting',
      'severe abdominal pain',
      'severe back pain',
      'severe chest pain',
      'severe difficulty breathing',
    ],
    hi: [
      'सीने में दर्द',
      'बेहोश',
      'खून बह रहा है',
      'सांस नहीं आ रही',
      'सांस नहीं आ रहा',
      'दिल का दौरा',
      'स्ट्रोक',
      'तीव्र दर्द',
      'सांस लेने में कठिनाई',
      'गला घुट रहा है',
      'गंभीर रक्तस्राव',
      'प्रतिक्रिया नहीं',
      'सांस नहीं ले रहा',
      'हृदय गति रुकना',
      'गंभीर एलर्जी',
      'गंभीर जलन',
      'गंभीर चोट',
      'गंभीर सिरदर्द',
      'गंभीर चक्कर',
      'गंभीर पेट दर्द',
      'गंभीर पीठ दर्द',
    ],
  };

  detectEmergency(message: string, language: string = 'en'): EmergencyDetectionResult {
    const lowerMessage = message.toLowerCase().trim();
    const detectedKeywords: string[] = [];
    let severity: 'EMERGENCY' | 'HIGH' | null = null;

    // Get keywords for the language (fallback to English)
    const keywords = this.emergencyKeywords[language as keyof typeof this.emergencyKeywords] || this.emergencyKeywords.en;

    // Check for emergency keywords
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        detectedKeywords.push(keyword);
        
        // Determine severity based on keyword
        if (
          keyword.includes('unconscious') ||
          keyword.includes('not breathing') ||
          keyword.includes('cardiac arrest') ||
          keyword.includes('choking') ||
          keyword.includes('anaphylaxis') ||
          keyword.includes('बेहोश') ||
          keyword.includes('सांस नहीं') ||
          keyword.includes('हृदय गति रुकना')
        ) {
          severity = 'EMERGENCY';
        } else if (severity !== 'EMERGENCY') {
          severity = 'HIGH';
        }
      }
    }

    // Check for emergency patterns
    const emergencyPatterns = [
      /(?:severe|extreme|intense|acute)\s+(?:pain|bleeding|difficulty|shortness)/i,
      /(?:can'?t|cannot|unable to)\s+(?:breathe|breathe properly|move|feel)/i,
      /(?:heart|chest)\s+(?:attack|pain|palpitations)/i,
      /(?:emergency|urgent|immediate)\s+(?:help|medical|attention)/i,
      /(?:call|dial)\s*(?:108|ambulance|emergency)/i,
    ];

    for (const pattern of emergencyPatterns) {
      if (pattern.test(message)) {
        if (!detectedKeywords.length) {
          detectedKeywords.push('emergency pattern detected');
        }
        if (severity !== 'EMERGENCY') {
          severity = severity || 'HIGH';
        }
      }
    }

    return {
      isEmergency: detectedKeywords.length > 0 || severity !== null,
      severity: severity || (detectedKeywords.length > 0 ? 'HIGH' : null),
      keywords: detectedKeywords,
    };
  }
}
