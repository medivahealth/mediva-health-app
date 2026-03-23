import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { GeminiVoiceService } from './gemini-voice.service';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service';
import { ChatService } from './chat.service';
import { PrescriptionService } from '../prescription/prescription.service';
import { EmergencyService } from './emergency.service';

interface VoiceSession {
  geminiSession: any;
  userId: string;
  transcripts: Array<{ text: string; isUser: boolean; timestamp: Date }>;
  sessionId?: string;
}

@WebSocketGateway({
  namespace: 'voice',
  cors: {
    origin: '*',
  },
})
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(VoiceGateway.name);
  private sessions: Map<string, VoiceSession> = new Map();

  constructor(
    private geminiVoiceService: GeminiVoiceService,
    private jwtService: JwtService,
    private authService: AuthService,
    private chatService: ChatService,
    private prescriptionService: PrescriptionService,
    private emergencyService: EmergencyService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const authHeader = (client.handshake.headers['authorization'] as string) || '';
      const tokenFromHeader = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const tokenFromAuth = (client.handshake.auth as any)?.token as string | undefined;
      // Handle both "Bearer token" and just "token" formats
      let token = tokenFromAuth || tokenFromHeader;
      if (token?.startsWith('Bearer ')) {
        token = token.slice(7);
      }

      this.logger.debug(`Token received: ${token ? 'yes' : 'no'}, length: ${token?.length || 0}`);

      if (!token) {
        this.logger.warn('Unauthorized: missing token');
        client.emit('error', { message: 'Unauthorized' });
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify(token) as any;
      const userId = payload?.sub as string | undefined;
      if (!userId) {
        this.logger.warn('Unauthorized: invalid token payload');
        client.emit('error', { message: 'Unauthorized' });
        client.disconnect(true);
        return;
      }

      const user = await this.authService.validateUser(userId);
      if (!user) {
        this.logger.warn(`Unauthorized: user not found: ${userId}`);
        client.emit('error', { message: 'Unauthorized' });
        client.disconnect(true);
        return;
      }

      (client.data as any).userId = userId;
      (client.data as any).role = payload?.role || user.role || 'user';

      // Emit success to client so they know they're authorized
      client.emit('authorized', { userId, role: (client.data as any).role });
      this.logger.log(`Voice client authorized: ${client.id} user=${userId}`);
    } catch (err: any) {
      this.logger.error(`Token verification failed: ${err?.message || err}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const session = this.sessions.get(client.id);
    if (session) {
      this.geminiVoiceService.closeSession(session.geminiSession);
      this.sessions.delete(client.id);
    }
  }

  @SubscribeMessage('start_session')
  async handleStartSession(client: Socket, payload: { 
    preferredLanguage?: string;
    location?: { lat: number; lng: number; city?: string; country?: string };
    voiceName?: string;
    subtitlesEnabled?: boolean;
  }) {
    try {
      const userId = (client.data as any).userId as string | undefined;
      if (!userId) {
        client.emit('error', { message: 'Unauthorized' });
        client.disconnect(true);
        return;
      }

      const geminiSession = await this.geminiVoiceService.createVoiceSession(
        (text, isUser) => {
          // Send transcript to client
          client.emit('transcript', { text, isUser, timestamp: new Date() });
          
          // Store transcript
          const session = this.sessions.get(client.id);
          if (session) {
            session.transcripts.push({ text, isUser, timestamp: new Date() });
          }
        },
        (audioChunk) => {
          // Send audio chunk to client
          client.emit('audio_chunk', { data: audioChunk });
        },
        (error) => {
          client.emit('error', { message: error });
        },
        userId,
        payload.preferredLanguage || 'en',
        payload.location,
        payload.voiceName,
      );

      if (!geminiSession) {
        client.emit('error', { message: 'Failed to create voice session' });
        return;
      }

      this.sessions.set(client.id, {
        geminiSession,
        userId,
        transcripts: [],
      });

      client.emit('session_started', { sessionId: client.id });
      this.logger.log(`Voice session started for user: ${userId}`);
    } catch (err) {
      this.logger.error('Error starting session:', err);
      client.emit('error', { message: 'Failed to start session' });
    }
  }

  @SubscribeMessage('audio_data')
  async handleAudioData(client: Socket, payload: { audio: string; mimeType?: string }) {
    const session = this.sessions.get(client.id);
    if (session && session.geminiSession) {
      await this.geminiVoiceService.sendAudio(session.geminiSession, payload.audio, payload.mimeType);
    }
  }

  @SubscribeMessage('end_session')
  async handleEndSession(client: Socket) {
    const session = this.sessions.get(client.id);
    if (session) {
      this.geminiVoiceService.closeSession(session.geminiSession);
      
      try {
        // Save conversation to chat session
        if (session.transcripts.length > 0) {
          // Create a chat session and save the conversation
          const userMessages = session.transcripts.filter(t => t.isUser);
          const aiMessages = session.transcripts.filter(t => !t.isUser);
          
          // Combine into a conversation summary
          const lastUserMsg = userMessages[userMessages.length - 1]?.text || '';
          const lastAiMsg = aiMessages[aiMessages.length - 1]?.text || '';
          
          // Save to chat history
          const result = await this.chatService.sendMessage(
            session.userId,
            lastUserMsg,
            'en',
            session.sessionId,
          );
          
          // Check if prescription is needed
          const needsPrescription = this.checkIfPrescriptionNeeded(session.transcripts);
          if (needsPrescription) {
            // Extract symptoms from conversation
            const symptoms = this.extractSymptoms(session.transcripts);
            const diagnosis = this.extractDiagnosis(session.transcripts);
            
            // Generate prescription recommendation
            await this.prescriptionService.generateRecommendation(
              session.userId,
              symptoms,
              diagnosis,
              result.sessionId,
            );
            
            client.emit('prescription_created', {
              message: 'A prescription has been prepared for doctor review. You will be notified once approved.',
            });
          }
          
          // Check for emergency
          const fullConversation = session.transcripts.map(t => t.text).join(' ');
          const emergencyCheck = this.emergencyService.detectEmergency(fullConversation);
          if (emergencyCheck.isEmergency) {
            client.emit('emergency_detected', {
              severity: emergencyCheck.severity,
              message: 'Emergency detected. Please call 108 immediately.',
            });
          }
        }
      } catch (err) {
        this.logger.error('Error saving voice conversation:', err);
      }
      
      this.sessions.delete(client.id);
      client.emit('session_ended', { 
        message: 'Conversation saved successfully',
        transcriptCount: session.transcripts.length,
      });
      this.logger.log(`Voice session ended for user: ${session.userId}`);
    }
  }

  private checkIfPrescriptionNeeded(transcripts: Array<{ text: string; isUser: boolean }>): boolean {
    const aiTexts = transcripts.filter(t => !t.isUser).map(t => t.text.toLowerCase()).join(' ');
    const userTexts = transcripts.filter(t => t.isUser).map(t => t.text.toLowerCase()).join(' ');
    
    // Check if AI mentioned prescription or medication
    const prescriptionKeywords = [
      'prescription', 'medicine', 'medication', 'tablet', 'syrup', 
      'take this', 'dosage', 'course', 'antibiotic', 'painkiller',
      'i will prepare a prescription', 'doctor will review'
    ];
    
    return prescriptionKeywords.some(kw => aiTexts.includes(kw));
  }

  private extractSymptoms(transcripts: Array<{ text: string; isUser: boolean }>): string {
    const userTexts = transcripts.filter(t => t.isUser).map(t => t.text).join('. ');
    return userTexts.substring(0, 500);
  }

  private extractDiagnosis(transcripts: Array<{ text: string; isUser: boolean }>): string {
    const aiTexts = transcripts.filter(t => !t.isUser).map(t => t.text).join('. ');
    // Look for diagnosis patterns
    const diagnosisMatch = aiTexts.match(/(?:diagnosed with|you have|it sounds like|this could be|you may have)\s+([^.]+)/i);
    return diagnosisMatch ? diagnosisMatch[1].trim() : 'Pending diagnosis';
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket) {
    client.emit('pong');
  }
}
