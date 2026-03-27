import { create } from 'zustand';
import type { ChatMessage, ChatSession } from '../types';

interface ChatState {
  currentSessionId: string | null;
  chatTitle: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  sessions: ChatSession[];

  setSessionId: (id: string) => void;
  setChatTitle: (title: string) => void;
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamContent: (content: string) => void;
  clearStreamContent: () => void;
  setSessions: (sessions: ChatSession[]) => void;
  clearChat: () => void;
}

/* Generate a short title from first user message */
function generateTitle(content: string): string {
  const cleaned = content.replace(/\n/g, ' ').trim();
  if (cleaned.length <= 40) return cleaned;
  return cleaned.substring(0, 37) + '...';
}

export const useChatStore = create<ChatState>((set, get) => ({
  currentSessionId: null,
  chatTitle: 'New Chat',
  messages: [],
  isStreaming: false,
  streamingContent: '',
  sessions: [],

  setSessionId: (id: string) => set({ currentSessionId: id }),

  setChatTitle: (title: string) => set({ chatTitle: title }),

  addMessage: (message: ChatMessage) =>
    set((state) => {
      // Auto-set title from first user message
      const newMessages = [...state.messages, message];
      const update: Partial<ChatState> = { messages: newMessages };
      if (
        message.role === 'user' &&
        state.messages.filter((m) => m.role === 'user').length === 0
      ) {
        update.chatTitle = generateTitle(message.content);
      }
      return update as any;
    }),

  setMessages: (messages: ChatMessage[]) => {
    set((state) => {
      const firstUser = messages.find((m) => m.role === 'user');
      // Only auto-generate title if it's currently the default and we have a user message
      const shouldGenerateTitle = 
        state.chatTitle === 'New Chat' && 
        firstUser && 
        firstUser.content &&
        firstUser.content.trim().length > 0;
      
      const newTitle = shouldGenerateTitle 
        ? generateTitle(firstUser.content) 
        : state.chatTitle;
      
      return { messages: messages || [], chatTitle: newTitle };
    });
  },

  setStreaming: (streaming: boolean) => set({ isStreaming: streaming }),

  appendStreamContent: (content: string) =>
    set((state) => ({ streamingContent: state.streamingContent + content })),

  clearStreamContent: () => set({ streamingContent: '' }),

  setSessions: (sessions: ChatSession[]) => set({ sessions }),

  clearChat: () =>
    set({
      currentSessionId: null,
      chatTitle: 'New Chat',
      messages: [],
      isStreaming: false,
      streamingContent: '',
    }),
}));
