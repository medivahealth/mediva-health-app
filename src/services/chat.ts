/**
 * AI Chat service - messages, streaming, voice
 */
import api from './api';
import type { ChatSession } from '../types';

class ChatServiceClient {
  /** Transcription only — fast, no AI processing. For putting text in input box. */
  async transcribeAudio(audioUri: string, preferredLanguage?: string): Promise<{ transcription: string }> {
    const extraFields: Record<string, string> = {};
    if (preferredLanguage) extraFields.preferredLanguage = preferredLanguage;
    return api.uploadFile('/chat/transcribe', {
      uri: audioUri,
      name: 'audio.wav',
      type: 'audio/wav',
    }, 'audio', extraFields);
  }

  async sendMessage(
    message: string,
    sessionId?: string,
    preferredLanguage?: string,
    location?: { lat: number; lng: number; city?: string; country?: string },
  ): Promise<{
    response: string;
    severity: string;
    sessionId: string;
    requiresDoctorReview: boolean;
    chatTitle?: string;
  }> {
    return api.post('/chat/message', { message, sessionId, preferredLanguage, location });
  }

  async streamMessage(
    message: string,
    sessionId?: string,
    preferredLanguage?: string,
    onToken?: (token: string) => void,
    onDone?: (data: any) => void,
    onStatus?: (status: string) => void,
    location?: { lat: number; lng: number; city?: string; country?: string },
  ): Promise<void> {
    return api.streamChat(message, sessionId, preferredLanguage, onToken, onDone, onStatus, location);
  }

  async sendVoiceMessage(
    audioUri: string,
    sessionId?: string,
    preferredLanguage?: string,
  ): Promise<any> {
    const extraFields: Record<string, string> = {};
    if (sessionId) extraFields.sessionId = sessionId;
    if (preferredLanguage) extraFields.preferredLanguage = preferredLanguage;

    return api.uploadFile('/chat/voice', {
      uri: audioUri,
      name: 'audio.wav',
      type: 'audio/wav',
    }, 'audio', extraFields);
  }

  async getHistory(
    page?: number,
    limit?: number,
  ): Promise<{ sessions: ChatSession[]; total: number; page: number; pages: number }> {
    const params = new URLSearchParams();
    if (page) params.set('page', page.toString());
    if (limit) params.set('limit', limit.toString());
    return api.get(`/chat/history?${params.toString()}`);
  }

  async getSession(sessionId: string): Promise<ChatSession> {
    return api.get(`/chat/session?id=${sessionId}`);
  }

  async messageFeedback(
    sessionId: string,
    messageIndex: number,
    feedback: 'like' | 'dislike' | '',
  ): Promise<{ success: boolean; feedback: string }> {
    return api.post('/chat/feedback', { sessionId, messageIndex, feedback });
  }

  async renameSession(sessionId: string, title: string): Promise<{ success: boolean }> {
    return api.patch(`/chat/session/${sessionId}/rename`, { title });
  }

  async togglePinSession(sessionId: string): Promise<{ pinned: boolean }> {
    return api.patch(`/chat/session/${sessionId}/pin`, {});
  }

  async deleteSession(sessionId: string): Promise<{ success: boolean }> {
    return api.delete(`/chat/session/${sessionId}`);
  }
}

export const chatService = new ChatServiceClient();
export default chatService;
