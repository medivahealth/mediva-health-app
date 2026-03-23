import { EventEmitter } from 'events';

export interface ChatSessionUpdateEvent {
  sessionId: string;
  userId: string;
}

class ChatStatusBus extends EventEmitter {}

export const chatStatusBus = new ChatStatusBus();

export function emitChatSessionUpdate(event: ChatSessionUpdateEvent) {
  chatStatusBus.emit('session_update', event);
}

