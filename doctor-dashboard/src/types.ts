export interface ChatMessage {
  role: 'user' | 'assistant' | 'doctor';
  content: string;
  modelUsed?: string;
  citations?: string[];
  severity?: string;
  timestamp: string;
}

export interface PatientInfo {
  _id: string;
  name?: string;
  phone: string;
  email?: string;
  abhaAddress?: string;
  devices?: { type: string; lastSynced: string }[];
  consentStatus?: {
    healthDataCollection: boolean;
    aiAnalysis: boolean;
    doctorSharing: boolean;
  };
}

export interface CaseSession {
  _id: string;
  userId: string | PatientInfo;
  messages: ChatMessage[];
  requiresDoctorReview: boolean;
  doctorApproved: boolean;
  doctorNotes?: string;
  status: 'open' | 'pending_review' | 'reviewed' | 'closed';
  summary?: string;
  location?: { lat: number; lng: number; city?: string; country?: string };
  proposedPrescription?: any[];
  finalPrescription?: any[];
  updatedAt: string;
  createdAt: string;
}

export interface DashboardStats {
  pending: number;
  reviewed: number;
  total: number;
}

export interface CasesResponse {
  cases: CaseSession[];
  total: number;
  page: number;
  pages: number;
}
