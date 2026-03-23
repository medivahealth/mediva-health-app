import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service';
import { ChatSession } from './chat.schema';
import { chatStatusBus, ChatSessionUpdateEvent } from './chat-status.bus';

@WebSocketGateway({
  namespace: 'chat-status',
  cors: { origin: '*' },
})
export class ChatStatusGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatStatusGateway.name);
  private clientSubscriptions = new Map<string, { sessionId: string; userId: string }>();

  constructor(
    private jwtService: JwtService,
    private authService: AuthService,
    @InjectModel(ChatSession.name) private chatModel: Model<ChatSession>,
  ) {}

  onModuleInit() {
    chatStatusBus.on('session_update', this.handleSessionUpdate);
  }

  onModuleDestroy() {
    chatStatusBus.off('session_update', this.handleSessionUpdate);
  }

  async handleConnection(client: Socket) {
    try {
      const authHeader = (client.handshake.headers['authorization'] as string) || '';
      const tokenFromHeader = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const tokenFromAuth = (client.handshake.auth as any)?.token as string | undefined;
      let token = tokenFromAuth || tokenFromHeader;
      if (token?.startsWith('Bearer ')) token = token.slice(7);

      if (!token) {
        client.emit('error', { message: 'Unauthorized' });
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify(token) as any;
      const userId = payload?.sub as string | undefined;
      if (!userId) {
        client.emit('error', { message: 'Unauthorized' });
        client.disconnect(true);
        return;
      }

      const user = await this.authService.validateUser(userId);
      if (!user) {
        client.emit('error', { message: 'Unauthorized' });
        client.disconnect(true);
        return;
      }

      (client.data as any).userId = userId;
      client.emit('authorized', { userId });
    } catch (err: any) {
      this.logger.warn(`Chat status auth failed: ${err?.message || err}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.clearSubscription(client);
  }

  @SubscribeMessage('subscribe_session')
  async handleSubscribeSession(client: Socket, payload: { sessionId: string }) {
    const userId = (client.data as any).userId as string | undefined;
    if (!userId || !payload?.sessionId) return;

    const session = await this.chatModel.findOne({
      _id: payload.sessionId,
      userId: new Types.ObjectId(userId),
    });
    if (!session) {
      client.emit('error', { message: 'Session not found' });
      return;
    }

    this.clearSubscription(client);
    this.clientSubscriptions.set(client.id, { sessionId: payload.sessionId, userId });
    client.join(this.roomKey(payload.sessionId, userId));
    client.emit('session_status', this.toStatusPayload(session));
  }

  private clearSubscription(client: Socket) {
    const sub = this.clientSubscriptions.get(client.id);
    if (sub) {
      client.leave(this.roomKey(sub.sessionId, sub.userId));
      this.clientSubscriptions.delete(client.id);
    }
  }

  private readonly handleSessionUpdate = async (event: ChatSessionUpdateEvent) => {
    try {
      const session = await this.chatModel.findOne({
        _id: event.sessionId,
        userId: new Types.ObjectId(event.userId),
      });
      if (!session) return;
      this.server
        .to(this.roomKey(event.sessionId, event.userId))
        .emit('session_status', this.toStatusPayload(session));
    } catch {
      // Ignore event fanout failures; next event will refresh.
    }
  };

  private roomKey(sessionId: string, userId: string) {
    return `session:${sessionId}:user:${userId}`;
  }

  private toStatusPayload(session: ChatSession) {
    return {
      sessionId: session._id?.toString(),
      status: session.status,
      doctorApproved: session.doctorApproved,
      doctorNotes: session.doctorNotes || '',
      requiresDoctorReview: session.requiresDoctorReview,
      finalPrescription: session.finalPrescription || [],
      messages: (session.messages || []).map((m: any) => ({
        role: m.role,
        content: m.content,
        severity: m.severity || '',
        timestamp: m.timestamp,
      })),
      updatedAt: (session as any).updatedAt,
    };
  }
}

