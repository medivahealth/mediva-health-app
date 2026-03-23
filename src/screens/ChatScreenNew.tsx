import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import chatService from '../services/chat';
import type { ChatMessage } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Lotus AI Dark Theme - Pure black with white text
const THEME = {
  bg: '#000000',
  surface: '#1C1C1E',
  surfaceLight: '#2C2C2E',
  text: '#FFFFFF',
  textSecondary: '#EBEBF5',
  textMuted: '#8E8E93',
  accent: '#0A84FF',
  accentGradient: ['#0A84FF', '#5E5CE6'] as const,
  userBubble: '#1C1C1E',
  border: '#38383A',
  success: '#30D158',
  warning: '#FF9F0A',
  error: '#FF453A',
};

type Screen = 'chat' | 'history' | 'discover' | 'menu' | 'voice-agent';

interface ChatScreenProps {
  onNavigate: (screen: Screen) => void;
}

// Simplified typing indicator
const TypingIndicator = () => (
  <View style={styles.typingContainer}>
    <ActivityIndicator size="small" color={THEME.accent} />
    <Text style={styles.typingText}>Thinking...</Text>
  </View>
);

export default function ChatScreen({ onNavigate }: ChatScreenProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  
  const {
    messages,
    addMessage,
    currentSessionId,
    setSessionId,
    isStreaming,
    setStreaming,
    streamingContent,
    appendStreamContent,
    clearStreamContent,
    clearChat,
  } = useChatStore();

  const { user } = useAuthStore();
  const hasMessages = messages.length > 0;

  // Auto scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, streamingContent]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);
    setInput('');
    setLoading(true);

    try {
      clearStreamContent();
      let fullResponse = '';

      await chatService.streamMessage(
        text.trim(),
        currentSessionId || undefined,
        user?.preferredLanguage || 'en',
        (token) => {
          fullResponse += token;
          appendStreamContent(token);
        },
        (doneData) => {
          const aiMsg: ChatMessage = {
            role: 'assistant',
            content: fullResponse,
            severity: doneData?.severity,
            timestamp: new Date().toISOString(),
          };
          addMessage(aiMsg);
          clearStreamContent();
          setStreaming(false);
          if (doneData?.sessionId) setSessionId(doneData.sessionId);
        },
        (status) => {
          // Status updates
        },
      );
    } catch (err: any) {
      addMessage({
        role: 'assistant',
        content: 'Sorry, I couldn\'t process that. Please try again.',
        timestamp: new Date().toISOString(),
      });
      setStreaming(false);
      clearStreamContent();
    } finally {
      setLoading(false);
    }
  };

  const handleVoicePress = () => {
    onNavigate('voice-agent');
  };

  const handleNewChat = () => {
    clearChat();
  };

  // Welcome screen
  const renderWelcome = () => (
    <View style={styles.welcomeContainer}>
      <Text style={styles.welcomeTitle}>Hey there—I'm Mediva.</Text>
      <Text style={styles.welcomeText}>
        To ensure every patient receives exceptional care, we're gradually accepting new patients. 
        While you wait for full access, I'd love to get to know you and help prioritize your onboarding.
      </Text>
      <Text style={styles.welcomeText}>
        This first chat is simply about understanding your health priorities so our care team can 
        support you as soon as full access opens. No pressure—you can skip anything.
      </Text>
      <Text style={styles.welcomeQuestion}>Ready to start?</Text>
      
      <View style={styles.quickReplies}>
        {['Yes, I\'m ready', 'Not right now', 'Help me pick priorities'].map((text, i) => (
          <TouchableOpacity
            key={i}
            style={styles.quickReplyButton}
            onPress={() => sendMessage(text)}
            activeOpacity={0.7}
          >
            <Text style={styles.quickReplyText}>{text}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Header
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => onNavigate('history')} style={styles.headerButton}>
        <Ionicons name="chevron-back" size={24} color={THEME.text} />
      </TouchableOpacity>
      
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>Limited Access</Text>
        <View style={styles.statusDot} />
      </View>
      
      <View style={styles.headerRight}>
        {hasMessages && (
          <TouchableOpacity onPress={handleNewChat} style={styles.headerButton}>
            <Ionicons name="add" size={24} color={THEME.text} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.headerButton}>
          <Text style={styles.faqText}>See FAQs</Text>
          <Ionicons name="chevron-forward" size={16} color={THEME.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render user message
  const renderUserMessage = (msg: ChatMessage, idx: number) => (
    <View key={idx} style={styles.userMessageContainer}>
      <View style={styles.userBubble}>
        <Text style={styles.userText}>{msg.content}</Text>
      </View>
      <Text style={styles.timestamp}>
        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  // Render AI message - clean, no labels
  const renderAIMessage = (msg: ChatMessage, idx: number) => (
    <View key={idx} style={styles.aiMessageContainer}>
      <Text style={styles.aiText}>{msg.content}</Text>
      <View style={styles.messageActions}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="thumbs-up-outline" size={18} color={THEME.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="thumbs-down-outline" size={18} color={THEME.textMuted} />
        </TouchableOpacity>
      </View>
      <Text style={styles.timestamp}>
        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  // Input bar with voice button
  const renderInput = () => (
    <View style={styles.inputContainer}>
      {/* Medical Disclaimer */}
      <Text style={styles.disclaimer}>
        <Ionicons name="information-circle" size={12} color={THEME.textMuted} /> Medical Disclaimer
      </Text>
      
      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.attachButton}>
          <Ionicons name="add" size={24} color={THEME.text} />
        </TouchableOpacity>
        
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder="Message"
            placeholderTextColor={THEME.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
          />
        </View>
        
        {input.trim().length > 0 ? (
          <TouchableOpacity
            style={styles.sendButton}
            onPress={() => sendMessage(input)}
            disabled={loading}
          >
            <Ionicons name="arrow-up" size={20} color={THEME.text} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleVoicePress} activeOpacity={0.8}>
            <LinearGradient
              colors={THEME.accentGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.voiceButton}
            >
              <Ionicons name="mic" size={18} color={THEME.text} />
              <Text style={styles.voiceButtonText}>Voice</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {renderHeader()}
      
      <ScrollView
        ref={scrollRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!hasMessages && renderWelcome()}
        
        {messages.map((msg, idx) =>
          msg.role === 'user'
            ? renderUserMessage(msg, idx)
            : renderAIMessage(msg, idx)
        )}
        
        {isStreaming && streamingContent && (
          <View style={styles.aiMessageContainer}>
            <Text style={styles.aiText}>{streamingContent}</Text>
          </View>
        )}
        
        {loading && !isStreaming && <TypingIndicator />}
        
        {/* Quick replies after AI response */}
        {!loading && !isStreaming && messages.length > 0 && 
         messages[messages.length - 1]?.role === 'assistant' && (
          <View style={styles.quickReplies}>
            {['Tell me more', 'What should I do?', 'Is this serious?', 'Thank you'].map((text, i) => (
              <TouchableOpacity
                key={i}
                style={styles.quickReplyButton}
                onPress={() => sendMessage(text)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickReplyText}>{text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
      
      {renderInput()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    backgroundColor: THEME.bg,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.text,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.success,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  faqText: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginRight: 4,
  },
  
  // Messages
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  
  // Welcome
  welcomeContainer: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: THEME.text,
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 15,
    color: THEME.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  welcomeQuestion: {
    fontSize: 16,
    fontWeight: '500',
    color: THEME.text,
    marginTop: 8,
    marginBottom: 16,
  },
  
  // User messages
  userMessageContainer: {
    alignItems: 'flex-end',
    marginBottom: 16,
    marginLeft: 40,
  },
  userBubble: {
    backgroundColor: THEME.userBubble,
    borderRadius: 20,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '100%',
  },
  userText: {
    fontSize: 16,
    color: THEME.text,
    lineHeight: 22,
  },
  
  // AI messages - clean, no labels
  aiMessageContainer: {
    marginBottom: 16,
    marginRight: 40,
  },
  aiText: {
    fontSize: 16,
    color: THEME.text,
    lineHeight: 24,
  },
  messageActions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  actionButton: {
    padding: 4,
  },
  
  // Timestamp
  timestamp: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 4,
  },
  
  // Quick replies
  quickReplies: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  quickReplyButton: {
    backgroundColor: THEME.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  quickReplyText: {
    fontSize: 14,
    color: THEME.text,
  },
  
  // Typing indicator
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  typingText: {
    fontSize: 14,
    color: THEME.textSecondary,
  },
  
  // Input
  inputContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: THEME.bg,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  disclaimer: {
    fontSize: 11,
    color: THEME.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: THEME.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    minHeight: 40,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 16,
    color: THEME.text,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  voiceButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.text,
  },
});
