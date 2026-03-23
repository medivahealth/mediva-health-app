// Shared TypeScript interfaces for Mediva

export interface User {
  _id: string;
  medivaid?: string;
  phone: string;
  name: string;
  email: string;
  abhaAddress: string;
  preferredLanguage: string;
  authProvider: string;
  emailVerified: boolean;
  profileImage: string;
  dob?: string;
  devices: { type: string; lastSynced: string; token?: string }[];
  consentStatus: ConsentStatus;
  role: string;
  healthHistory?: {
    allergies: string[];
    chronicConditions: string[];
    currentMedications: string[];
    pastSurgeries: string[];
    familyHistory: string[];
    bloodType: string;
    dob?: string;
    gender?: 'male' | 'female' | 'other' | '';
    height?: string;
    weight?: string;
    lifestyleFactors: {
      smoking: boolean;
      alcohol: boolean;
      exercise: string;
    };
    completedAt?: string;
  };

  locationState?: string;
  locationCountry?: string;
  locationLat?: number | null;
  locationLng?: number | null;
  locationUpdatedAt?: string | null;
  locationConsent?: boolean;
}

export interface ConsentStatus {
  healthDataCollection: boolean;
  aiAnalysis: boolean;
  doctorSharing: boolean;
  abdmAccess: boolean;
  grantedAt?: string;
}

export interface HealthRecord {
  type: string;
  value: any;
  unit?: string;
  timestamp: string;
  source: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'doctor';
  content: string;
  attachments?: Array<{ uri: string; filename?: string }>;
  modelUsed?: string;
  citations?: string[];
  severity?: string;
  feedback?: 'like' | 'dislike' | '';
  timestamp: string;
}

export interface ChatSession {
  _id: string;
  userId: string;
  messages: ChatMessage[];
  requiresDoctorReview: boolean;
  doctorApproved: boolean;
  doctorNotes: string;
  status: 'open' | 'pending_review' | 'reviewed' | 'closed';
  summary: string;
  location?: { lat: number; lng: number; city?: string; country?: string };
  proposedPrescription?: any[];
  finalPrescription?: any[];
  pinned?: boolean;
  updatedAt: string;
}

export interface MedicalDocument {
  _id: string;
  userId: string;
  s3Url: string;
  fileName: string;
  extractedText: string;
  structuredData: {
    modality?: string;
    bodyPart?: string;
    laterality?: string;
    studyDate?: string;
    summary?: string;
    keyFindings?: string[];
    recommendations?: string[];
    redFlags?: string[];
    measurements?: Record<string, any>;
    imageSummary?: string;
    imageFindings?: string[];
    imageLimitations?: string[];
    imageConfidence?: number;
    tests?: { name: string; value: string; unit: string; referenceRange?: string; date?: string }[];
    diagnosis?: string[];
    medications?: string[];
    notes?: string;
  };
  status: 'processing' | 'processed' | 'needs_review' | 'error';
  source: string;
  createdAt: string;
}

export interface CareContext {
  referenceNumber: string;
  display: string;
  hiType: string;
  facility: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
}
