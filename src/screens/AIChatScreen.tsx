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
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

const logoImg = require('../../assets/applogo.png');
import ChatBubble from '../components/ChatBubble';
import { useChatStore } from '../store/chatStore';
import chatService from '../services/chat';
import fileUploadService from '../services/file-upload';
import type { ChatMessage } from '../types';
import { COLORS, FONTS, SIZES } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallDevice = SCREEN_HEIGHT < 700;

export default function AIChatScreen() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { messages, addMessage, currentSessionId, setSessionId, isStreaming, setStreaming, streamingContent, appendStreamContent, clearStreamContent } = useChatStore();

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, streamingContent]);

  const sendMessage = async (text: string, attachments?: any[]) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
      attachments,
    };
    addMessage(userMsg);
    setInput('');
    setLoading(true);

    try {
      // Try streaming first, fall back to regular
      setStreaming(true);
      clearStreamContent();

      let fullResponse = '';
      let sessionId = currentSessionId || undefined;

      await chatService.streamMessage(
        text.trim(),
        sessionId,
        'en',
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

          if (doneData?.requiresDoctorReview) {
            addMessage({
              role: 'assistant',
              content: '⚠️ This response has been flagged for doctor review. A physician will review your case and respond within 24 hours.',
              timestamp: new Date().toISOString(),
            });
          }
        },
      );
    } catch {
      // Fallback to non-streaming
      try {
        const result = await chatService.sendMessage(text.trim(), currentSessionId || undefined, 'en');
        if (result.sessionId) setSessionId(result.sessionId);

        addMessage({
          role: 'assistant',
          content: result.response,
          severity: result.severity,
          timestamp: new Date().toISOString(),
        });

        if (result.requiresDoctorReview) {
          addMessage({
            role: 'assistant',
            content: '⚠️ This response has been flagged for doctor review.',
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        addMessage({
          role: 'assistant',
          content: `Sorry, I couldn't process your request. ${err.message || 'Please check your connection and try again.'}`,
          timestamp: new Date().toISOString(),
        });
      }
      setStreaming(false);
      clearStreamContent();
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (category: 'xray' | 'lab_report' | 'prescription' | 'photo') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        setUploading(true);
        const files = await fileUploadService.uploadMultiple(
          result.assets.map(a => ({ uri: a.uri, filename: a.fileName || undefined })),
          category
        );
        
        if (files.length > 0) {
          const fileNames = files.map(f => f.filename).join(', ');
          sendMessage(`I've uploaded ${files.length} file(s): ${fileNames}. Please analyze them.`, files);
        }
      }
    } catch (err) {
      Alert.alert('Upload Failed', 'Could not upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        setUploading(true);
        const files = await fileUploadService.uploadMultiple(
          result.assets.map(a => ({ uri: a.uri, filename: a.name })),
          'document'
        );
        
        if (files.length > 0) {
          const fileNames = files.map(f => f.filename).join(', ');
          sendMessage(`I've uploaded ${files.length} document(s): ${fileNames}. Please review.`, files);
        }
      }
    } catch (err) {
      Alert.alert('Upload Failed', 'Could not upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const showUploadOptions = () => {
    Alert.alert(
      'Upload File',
      'What would you like to upload?',
      [
        { text: 'X-Ray / Scan', onPress: () => pickImage('xray') },
        { text: 'Lab Report', onPress: () => pickImage('lab_report') },
        { text: 'Prescription', onPress: () => pickImage('prescription') },
        { text: 'Photo', onPress: () => pickImage('photo') },
        { text: 'Document/PDF', onPress: pickDocument },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Image source={logoImg} style={styles.headerLogo} resizeMode="contain" />
          <View>
            <Text style={styles.headerTitle}>AI Health Chat</Text>
            <Text style={styles.headerSubtitle}>
              Powered by RAG + Evidence-Based Medicine
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Image source={logoImg} style={styles.emptyLogo} resizeMode="contain" />
            <Text style={styles.emptyTitle}>How can I help you today?</Text>
            <Text style={styles.emptySubtitle}>Ask me anything about your health</Text>
            
            <View style={styles.suggestions}>
              {[
                'How did I sleep last night?',
                'My heart rate seems high',
                'What does my blood test mean?',
                'Summarize my health this week',
              ].map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.suggestion}
                  onPress={() => sendMessage(s)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {messages.map((msg, idx) => (
          <ChatBubble
            key={idx}
            role={msg.role}
            content={msg.content}
            severity={msg.severity}
            timestamp={msg.timestamp}
          />
        ))}

        {isStreaming && streamingContent && (
          <ChatBubble
            role="assistant"
            content={streamingContent + '▊'}
            timestamp={new Date().toISOString()}
          />
        )}

        {loading && !isStreaming && (
          <View style={styles.loadingBubble}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>Thinking...</Text>
          </View>
        )}
        
        {/* Quick follow-up suggestions */}
        {!loading && !isStreaming && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && (
          <View style={styles.followUpChips}>
            {['Tell me more', 'What should I do?', 'Is this serious?', 'Thank you'].map((f, i) => (
              <TouchableOpacity
                key={i}
                style={styles.followUpChip}
                onPress={() => sendMessage(f)}
                activeOpacity={0.7}
              >
                <Text style={styles.followUpChipText}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        {/* Medical disclaimer */}
        <Text style={styles.disclaimer}>
          For informational purposes only. Not a substitute for professional medical advice.
        </Text>
        
        <View style={styles.inputRow}>
          <TouchableOpacity 
            style={styles.attachButton}
            onPress={showUploadOptions}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#4A90E2" />
            ) : (
              <Text style={styles.attachIcon}>📎</Text>
            )}
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder="Type your health question..."
            placeholderTextColor="#aaa"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
            editable={!loading && !uploading}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || loading) && styles.sendDisabled]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: isSmallDevice ? 10 : 14,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: isSmallDevice ? 32 : 40,
    height: isSmallDevice ? 32 : 40,
    marginRight: 12,
    borderRadius: 10,
  },
  headerTitle: { fontSize: isSmallDevice ? 16 : 18, fontWeight: '700', color: COLORS.white, fontFamily: FONTS.bold },
  headerSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontFamily: FONTS.regular },
  messages: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 16 },
  emptyState: { alignItems: 'center', paddingVertical: isSmallDevice ? 24 : 40 },
  emptyLogo: {
    width: isSmallDevice ? 56 : 72,
    height: isSmallDevice ? 56 : 72,
    borderRadius: 16,
    marginBottom: 16,
  },
  emptyTitle: { fontSize: isSmallDevice ? 16 : 18, fontWeight: '700', color: COLORS.primary, marginBottom: 4, textAlign: 'center', fontFamily: FONTS.bold },
  emptySubtitle: { fontSize: SIZES.sm, color: COLORS.secondary, textAlign: 'center', fontFamily: FONTS.regular, marginBottom: 20 },
  suggestions: { width: '100%', paddingHorizontal: 8 },
  suggestion: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  suggestionText: { fontSize: SIZES.md, color: COLORS.primary, fontFamily: FONTS.regular },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    maxWidth: '60%',
  },
  loadingText: { marginLeft: 8, color: COLORS.secondary, fontSize: SIZES.md, fontFamily: FONTS.regular },
  inputContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.bg,
  },
  disclaimer: {
    fontSize: 9,
    color: COLORS.tertiary,
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: FONTS.regular,
  },
  textInputRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.inputBg,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: SIZES.base,
    maxHeight: 100,
    color: COLORS.primary,
    fontFamily: FONTS.regular,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendDisabled: { opacity: 0.4 },
  sendIcon: { color: COLORS.white, fontSize: 18 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  attachIcon: { fontSize: 20 },
  
  /* Follow-up chips */
  followUpChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  followUpChip: {
    backgroundColor: '#F0F4F8',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D0D7DE',
  },
  followUpChipText: {
    fontSize: SIZES.sm,
    color: '#24292F',
    fontFamily: FONTS.regular,
  },
});
