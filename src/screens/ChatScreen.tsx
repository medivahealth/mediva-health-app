import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  PanResponder,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  ImageBackground,
  Animated,
  Alert,
  Dimensions,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { io, Socket } from 'socket.io-client';
import { Ionicons } from '@expo/vector-icons';
import ButtonBg from '../../assets/button.svg';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import chatService from '../services/chat';
import voiceService from '../services/voice';
import api, { API_BASE_URL, BASE_URL } from '../services/api';
import type { ChatMessage, ChatSession } from '../types';
import { SIZES } from '../theme';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { isNgrokUrl, ngrokClientHeaders } from '../utils/ngrok';

const logoImg = require('../../assets/applogo.png');
const bgImg = require('../../assets/background.png');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallDevice = SCREEN_HEIGHT < 700;

/* ─── Types ─── */
type Screen = 'chat' | 'history' | 'discover' | 'menu' | 'voice-agent';

interface ChatScreenProps {
  onNavigate: (screen: Screen) => void;
}

/* ─── Components ─── */
const ShiningDot = () => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[s.shiningDot, { opacity }]} />
  );
};

/* ─── Main Component ─── */
export default function ChatScreen({ onNavigate }: ChatScreenProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Array<{ uri: string; name: string; type: string }>>([]);
  const MAX_ATTACHMENTS = 5;
  const [isRecording, setIsRecording] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState<string>('');
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [emergencyDetected, setEmergencyDetected] = useState<{ isEmergency: boolean; severity?: 'EMERGENCY' | 'HIGH' } | null>(null);
  const aiResponseStartRef = useRef<View>(null);
  const responseScrollYRef = useRef<number>(0);
  const scrollRef = useRef<ScrollView>(null);
  const statusSocketRef = useRef<Socket | null>(null);
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  const {
    messages,
    addMessage,
    currentSessionId,
    setSessionId,
    setMessages,
    chatTitle,
    setChatTitle,
    isStreaming,
    setStreaming,
    streamingContent,
    appendStreamContent,
    clearStreamContent,
    clearChat,
  } = useChatStore();

  const { user } = useAuthStore();
  const preferredLang = user?.preferredLanguage || 'en';
  const hasMessages = messages.length > 0;

  const DEFAULT_SUGGESTED_PROMPTS = [
    'What symptoms should I watch for?',
    'How long can I expect this to last?',
    'Are there any red flags that need urgent care?',
    'What self-care can I do at home?',
    'Should I take any medications, and which ones?',
  ];

  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(DEFAULT_SUGGESTED_PROMPTS);
  const [showDisclaimerPopup, setShowDisclaimerPopup] = useState(false);

  const [dragTimestamp, setDragTimestamp] = useState<{ idx: number; text: string } | null>(null);
  const dragTimestampTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatFullDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const showDragTimestamp = (idx: number, iso: string) => {
    if (dragTimestampTimeoutRef.current) clearTimeout(dragTimestampTimeoutRef.current);
    setDragTimestamp({ idx, text: formatFullDateTime(iso) });
    dragTimestampTimeoutRef.current = setTimeout(() => setDragTimestamp(null), 2500);
  };

  const extractRelatedQuestions = (text: string) => {
    // Try multiple patterns to find related questions
    const patterns = [
      /---\s*\n\s*\*?\*?Related Questions\*?\*?\s*\n([\s\S]*?)$/i,
      /##\s*Related Questions\s*\n([\s\S]*?)(?=\n##|$)/i,
      /\*\*Related Questions\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/i,
      /(?:Related Questions|Follow-up Questions|You might also ask):?\s*\n([\s\S]*?)(?=\n\n|$)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const block = match[1];
        const qs = block
          .split('\n')
          .map((l) => l.replace(/^[-*•\d.]\s*/, '').replace(/^\*\*|\*\*$/g, '').trim())
          .filter((l) => l.length > 5 && (l.endsWith('?') || l.includes('?')))
          .slice(0, 5);

        if (qs.length > 0) return qs;
      }
    }

    return [];
  };

  // Generate dynamic 5-card suggestions based on live chat flow.
  const generateContextualSuggestions = (
    userInput?: string,
    assistantOutput?: string,
  ): string[] => {
    const fallbackLast = messages[messages.length - 1];
    const sourceText = (userInput || (fallbackLast?.role === 'user' ? fallbackLast.content : '') || '').toLowerCase();
    const aiText = (assistantOutput || '').toLowerCase();
    const combined = `${sourceText}\n${aiText}`;
    if (!combined.trim()) return DEFAULT_SUGGESTED_PROMPTS;

    // Context-aware suggestions based on user's last message
    if (combined.includes('symptom') || combined.includes('pain') || combined.includes('feel')) {
      return [
        'How long can these symptoms last?',
        'What can make this better or worse for me?',
        'Which other symptoms should I watch for?',
        'Should I see a doctor for this now?',
        'What home remedies can I try safely?',
      ];
    }
    if (combined.includes('medication') || combined.includes('medicine') || combined.includes('drug')) {
      return [
        'What side effects should I watch for?',
        'How should I take this medicine correctly?',
        'Can I take this with food?',
        'Can this interact with my other medicines?',
        'What should I do if I miss a dose?',
      ];
    }
    if (combined.includes('diet') || combined.includes('food') || combined.includes('eat')) {
      return [
        'What foods should I avoid right now?',
        'Which nutrients should I focus on?',
        'How many calories should I eat daily?',
        'Is this diet safe for my condition?',
        'What are healthier alternatives I can try?',
      ];
    }
    if (combined.includes('exercise') || combined.includes('workout') || combined.includes('fitness')) {
      return [
        'How often should I exercise each week?',
        'What exercises are safest for me?',
        'How can I avoid injury while exercising?',
        'Do I need a trainer for this plan?',
        'How many rest days should I keep?',
      ];
    }
    if (combined.includes('sleep') || combined.includes('tired') || combined.includes('insomnia')) {
      return [
        'How many hours should I sleep daily?',
        'Why am I waking up at night?',
        'How can I improve my sleep quality?',
        'Should I see a sleep specialist now?',
        'Are sleep aids safe for me?',
      ];
    }
    if (combined.includes('anxiety') || combined.includes('stress') || combined.includes('depression') || combined.includes('mental')) {
      return [
        'What coping strategies can help me right now?',
        'Should I see a therapist for this?',
        'How can I manage panic attacks safely?',
        'Can you guide me through breathing exercises?',
        'When is medication needed for my symptoms?',
      ];
    }
    if (combined.includes('blood') || combined.includes('test') || combined.includes('lab')) {
      return [
        'What do these test results mean for me?',
        'Are these values normal for my age?',
        'Should I repeat this test soon?',
        'What can affect these results?',
        'Do I need any further tests?',
      ];
    }
    if (combined.includes('hospital') || combined.includes('clinic') || combined.includes('nearby')) {
      return [
        'Which hospitals are closest to me right now?',
        'Can you suggest 24x7 hospitals near my location?',
        'Which nearby hospital is best for emergency care?',
        'Can you list affordable hospitals near me?',
        'Which hospital near me has the right specialist?',
      ];
    }

    // Return default suggestions with slight variation based on message length
    return DEFAULT_SUGGESTED_PROMPTS;
  };

  const [voiceLocale, setVoiceLocale] = useState<string>('en-US');

  // Debug: Log when messages change
  useEffect(() => {
    console.log('ChatScreen: Messages changed, count:', messages.length);
    if (messages.length > 0) {
      console.log('ChatScreen: First message:', messages[0].role, messages[0].content.substring(0, 50));
      // Scroll to end when messages are loaded
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Load voice preference on mount
  useEffect(() => {
    const loadVoicePreference = async () => {
      try {
        const savedVoiceId = await SecureStore.getItemAsync('voicePreference');
        if (savedVoiceId && savedVoiceId !== 'default') {
          // Map voice ID to locale
          const voiceLocaleMap: Record<string, string> = {
            'en-US': 'en-US',
            'en-GB': 'en-GB',
            'en-AU': 'en-AU',
            'hi-IN': 'hi-IN',
            'mr-IN': 'mr-IN',
            'kn-IN': 'kn-IN',
            'te-IN': 'te-IN',
            'ta-IN': 'ta-IN',
            'bn-IN': 'bn-IN',
            'gu-IN': 'gu-IN',
            'ml-IN': 'ml-IN',
            'pa-IN': 'pa-IN',
          };
          setVoiceLocale(voiceLocaleMap[savedVoiceId] || 'en-US');
        } else {
          // Use language-based locale mapping
          const langLocaleMap: Record<string, string> = {
            en: 'en-US', hi: 'hi-IN', mr: 'mr-IN', kn: 'kn-IN', te: 'te-IN',
            ta: 'ta-IN', bn: 'bn-IN', gu: 'gu-IN', ml: 'ml-IN', pa: 'pa-IN',
            or: 'or-IN', as: 'as-IN', ur: 'ur-PK',
          };
          setVoiceLocale(langLocaleMap[preferredLang] || 'en-US');
        }
      } catch (err) {
        console.error('Failed to load voice preference:', err);
        // Fallback to language-based locale
        const langLocaleMap: Record<string, string> = {
          en: 'en-US', hi: 'hi-IN', mr: 'mr-IN', kn: 'kn-IN', te: 'te-IN',
          ta: 'ta-IN', bn: 'bn-IN', gu: 'gu-IN', ml: 'ml-IN', pa: 'pa-IN',
          or: 'or-IN', as: 'as-IN', ur: 'ur-PK',
        };
        setVoiceLocale(langLocaleMap[preferredLang] || 'en-US');
      }
    };
    loadVoicePreference();
  }, [preferredLang]);

  /* ─── Welcome animation ─── */
  useEffect(() => {
    if (!hasMessages) {
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [hasMessages]);

  /* Load messages when session changes - but only if messages are empty */
  /* ChatHistoryScreen should have already set messages, but if not, load them here */
  useEffect(() => {
    const loadSessionMessages = async () => {
      if (currentSessionId) {
        try {
          const session = await chatService.getSession(currentSessionId);
          setCurrentSession(session);
          
          // Set the chat title from the session summary if available
          if (session.summary && session.summary.trim().length > 0 && session.summary !== 'New conversation') {
            setChatTitle(session.summary.trim());
          }
          
          if (messages.length === 0 && session.messages && session.messages.length > 0) {
            setMessages(session.messages);
          } else if (messages.length === 0) {
            setMessages([]);
          }
        } catch (err) {
          console.error('ChatScreen: Failed to load session messages:', err);
        }
      }
    };
    loadSessionMessages();
  }, [currentSessionId]);

  // Real-time doctor/prescription updates via WebSocket.
  useEffect(() => {
    if (statusSocketRef.current) {
      statusSocketRef.current.disconnect();
      statusSocketRef.current = null;
    }
    if (!currentSessionId) return;

    let isMounted = true;
    const connectRealtimeStatus = async () => {
      try {
        const token = await SecureStore.getItemAsync('accessToken');
        if (!token || !isMounted) return;

        const socket = io(`${API_BASE_URL}/chat-status`, {
          auth: { token: `Bearer ${token}` },
          // polling first helps ngrok free tier (extraHeaders apply); then upgrade to websocket
          transports: ['polling', 'websocket'],
          ...(isNgrokUrl(API_BASE_URL) ? { extraHeaders: ngrokClientHeaders() } : {}),
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 700,
        });

        statusSocketRef.current = socket;

        socket.on('authorized', () => {
          socket.emit('subscribe_session', { sessionId: currentSessionId });
        });

        socket.on('session_status', (payload: any) => {
          if (!isMounted || payload?.sessionId !== currentSessionId) return;
          setCurrentSession((prev) => ({ ...(prev || { _id: currentSessionId } as any), ...payload }));
          if (!isStreaming && !loading && Array.isArray(payload?.messages)) {
            setMessages(payload.messages);
          }
        });
      } catch (err) {
        console.log('Realtime status unavailable:', err);
      }
    };
    connectRealtimeStatus();

    return () => {
      isMounted = false;
      if (statusSocketRef.current) {
        statusSocketRef.current.disconnect();
        statusSocketRef.current = null;
      }
    };
  }, [currentSessionId, isStreaming, loading]);

  /* auto scroll — during streaming keep scrolling down; during loading scroll down too */
  useEffect(() => {
    if (isStreaming || loading) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [streamingContent, loading, isStreaming]);

  /* ─── Send message ─── */
  const sendMessage = async (text: string) => {
    const trimmedText = text.trim();
    const hasAttachments = pendingAttachments.length > 0;

    // Allow sending if there's text OR attachments (or both)
    if ((!trimmedText && !hasAttachments) || loading) return;

    // Build user message content
    let messageContent = trimmedText;
    if (hasAttachments) {
      const attachmentNames = pendingAttachments.map((a) => `📎 ${a.name}`).join('\n');
      messageContent = trimmedText
        ? `${trimmedText}\n${attachmentNames}`
        : attachmentNames;
    }

    const userMsg: ChatMessage = {
      role: 'user',
      content: messageContent,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);
    setInput('');
    setLoading(true);
    setThinkingStatus('Exploring your question...');

    let locationData = undefined;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        locationData = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      }
    } catch (e) {}

    // Remember scroll position for later — we'll scroll to the AI response start
    responseScrollYRef.current = 0;

    // Upload pending attachments first and clear chips immediately on submit.
    const attachmentsSnapshot = [...pendingAttachments];
    setPendingAttachments([]);
    const uploadedAttachments: string[] = [];
    if (hasAttachments) {
      try {
        for (const attachment of attachmentsSnapshot) {
          await api.uploadFile('/records/upload', { uri: attachment.uri, name: attachment.name, type: attachment.type }, 'file', { isRecord: 'false' });
          uploadedAttachments.push(attachment.name);
        }
      } catch (err: any) {
        // Restore chips if upload fails so user can retry quickly.
        setPendingAttachments(attachmentsSnapshot);
        Alert.alert('Upload Error', `Failed to upload attachments: ${err.message || 'Please try again.'}`);
        setLoading(false);
        return;
      }
    }

    try {
      clearStreamContent();
      let fullResponse = '';
      let sessionId = currentSessionId || undefined;
      let firstTokenReceived = false;

      let sentenceBuffer = '';
      const ttsQueue: string[] = [];
      let isPlayingTts = false;

      const playNextInQueue = async () => {
        if (ttsQueue.length === 0 || isPlayingTts) return;
        isPlayingTts = true;
        const textToSpeak = ttsQueue.shift()!;
        const ttsUri = `${BASE_URL}/chat/tts?text=${encodeURIComponent(textToSpeak)}&lang=${encodeURIComponent(preferredLang)}`;
        let player: ReturnType<typeof createAudioPlayer> | null = null;
        let sub: { remove: () => void } | null = null;
        try {
          await setAudioModeAsync({
            playsInSilentMode: true,
            interruptionMode: 'duckOthers',
            allowsRecording: false,
          });
          player = createAudioPlayer(
            {
              uri: ttsUri,
              ...(isNgrokUrl(ttsUri) ? { headers: ngrokClientHeaders() } : {}),
            },
            { updateInterval: 200 },
          );
          player.play();
          sub = player.addListener('playbackStatusUpdate', async (status) => {
            if (status.isLoaded && status.didJustFinish) {
              sub?.remove();
              sub = null;
              player?.remove();
              player = null;
              isPlayingTts = false;
              playNextInQueue();
            }
          });
        } catch (err) {
          console.error('TTS playback failed:', err);
          sub?.remove();
          player?.remove();
          isPlayingTts = false;
          playNextInQueue();
        }
      };

      const speakSentence = (text: string) => {
        const cleanText = text.replace(/\[\d+\]/g, '').trim();
        if (!cleanText || cleanText.length < 3) return;
        ttsQueue.push(cleanText);
        playNextInQueue();
      };

      const aiInput = hasAttachments
        ? `${trimmedText || 'Please analyze my uploaded files.'}\n\n[Uploaded files: ${uploadedAttachments.join(', ')}]`
        : text.trim();

      await chatService.streamMessage(
        aiInput,
        sessionId,
        preferredLang,
        (token) => {
          if (!firstTokenReceived) {
            firstTokenReceived = true;
            setThinkingStatus(''); // Clear status once tokens start
            setStreaming(true); // Only mark streaming once first token arrives
          }
          fullResponse += token;
          if (/[.!?]\s$/.test(sentenceBuffer)) {
            speakSentence(sentenceBuffer);
            sentenceBuffer = '';
          }

          appendStreamContent(token);
        },
        (doneData) => {
          if (sentenceBuffer.trim()) {
            speakSentence(sentenceBuffer);
            sentenceBuffer = '';
          }
          if (doneData?.chatTitle) {
            useChatStore.getState().setChatTitle(doneData.chatTitle);
          }
          const aiMsg: ChatMessage = {
            role: 'assistant',
            content: fullResponse,
            severity: doneData?.severity,
            timestamp: new Date().toISOString(),
          };
          addMessage(aiMsg);

          // Update suggestions based on AI response or generate contextual ones
          const extracted = extractRelatedQuestions(fullResponse);
          const newSuggestions = extracted.length > 0
            ? extracted
            : generateContextualSuggestions(aiInput, fullResponse);
          setSuggestedPrompts(newSuggestions.slice(0, 5));

          clearStreamContent();
          setStreaming(false);
          setThinkingStatus('');
          if (doneData?.sessionId) setSessionId(doneData.sessionId);

          // Check for emergency
          if (doneData?.isEmergency || doneData?.severity === 'EMERGENCY' || doneData?.severity === 'HIGH') {
            setEmergencyDetected({
              isEmergency: true,
              severity: doneData?.severity === 'EMERGENCY' ? 'EMERGENCY' : 'HIGH',
            });
          }

          // Scroll to start of AI response so user can read from top
          setTimeout(() => {
            if (responseScrollYRef.current > 0) {
              scrollRef.current?.scrollTo({
                y: responseScrollYRef.current,
                animated: true,
              });
            }
          }, 150);
        },
        (status) => {
          setThinkingStatus(status);
        },
        locationData,
      );
    } catch {
      try {
        const aiInput = hasAttachments
          ? `${trimmedText || 'Please analyze my uploaded files.'}\n\n[Uploaded files: ${uploadedAttachments.join(', ')}]`
          : text.trim();
        const result = await chatService.sendMessage(
          aiInput,
          currentSessionId || undefined,
          preferredLang,
          locationData,
        );
        if (result.sessionId) setSessionId(result.sessionId);
        if (result.chatTitle) setChatTitle(result.chatTitle);
        addMessage({
          role: 'assistant',
          content: result.response,
          severity: result.severity,
          timestamp: new Date().toISOString(),
        });

        const extracted = extractRelatedQuestions(result.response);
        const newSuggestions = extracted.length > 0
          ? extracted
          : generateContextualSuggestions(aiInput, result.response);
        setSuggestedPrompts(newSuggestions.slice(0, 5));
      } catch (err: any) {
        addMessage({
          role: 'assistant',
          content: `Sorry, I couldn't process your request. ${err.message || 'Please try again.'}`,
          timestamp: new Date().toISOString(),
        });
      }
      setStreaming(false);
      clearStreamContent();
      setThinkingStatus('');
    } finally {
      setLoading(false);
      setThinkingStatus('');
    }
  };

  /* ─── Attachments ─── */
  const addPendingAttachment = (uri: string, name: string, type: string) => {
    if (pendingAttachments.length >= MAX_ATTACHMENTS) {
      Alert.alert('Limit reached', `You can only attach up to ${MAX_ATTACHMENTS} files.`);
      return;
    }
    setPendingAttachments((prev) => [...prev, { uri, name, type }]);
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePickImage = async () => {
    setShowAttach(false);
    if (pendingAttachments.length >= MAX_ATTACHMENTS) {
      Alert.alert('Limit reached', `You can only attach up to ${MAX_ATTACHMENTS} files.`);
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow access to your photos in device Settings.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: false,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const fileName = asset.fileName || `photo_${Date.now()}.jpg`;
        const mimeType = asset.mimeType || (asset.uri?.endsWith('.png') ? 'image/png' : 'image/jpeg');
        addPendingAttachment(asset.uri, fileName, mimeType);
      }
    } catch (err: any) {
      Alert.alert('Photo Error', err.message || 'Could not pick photo. Please try again.');
    }
  };

  const handleCamera = async () => {
    setShowAttach(false);
    if (pendingAttachments.length >= MAX_ATTACHMENTS) {
      Alert.alert('Limit reached', `You can only attach up to ${MAX_ATTACHMENTS} files.`);
      return;
    }
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow camera access in device Settings.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        base64: false,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const fileName = asset.fileName || `camera_${Date.now()}.jpg`;
        addPendingAttachment(asset.uri, fileName, 'image/jpeg');
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Could not access camera. Please try again.');
    }
  };

  const handlePickFile = async () => {
    setShowAttach(false);
    if (pendingAttachments.length >= MAX_ATTACHMENTS) {
      Alert.alert('Limit reached', `You can only attach up to ${MAX_ATTACHMENTS} files.`);
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        addPendingAttachment(asset.uri, asset.name || `file_${Date.now()}`, asset.mimeType || 'application/octet-stream');
      }
    } catch (err: any) {
      Alert.alert('File Error', err.message || 'Could not pick file. Please try again.');
    }
  };

  const uploadAttachment = async (uri: string, name: string, type: string, isRecord: boolean = false) => {
    addMessage({
      role: 'user',
      content: `📎 Uploaded: ${name}`,
      timestamp: new Date().toISOString(),
    });

    setLoading(true);
    try {
      if (isRecord) {
        // Upload as medical record - saved for AI training and user records
        await api.uploadFile('/records/upload', { uri, name, type }, 'file', { isRecord: 'true' });
        addMessage({
          role: 'assistant',
          content: `✅ Medical record "${name}" has been saved to your records. I'll use this information to provide more personalized and accurate responses in the future.`,
          timestamp: new Date().toISOString(),
        });
      } else {
        // Upload as temporary attachment for current question
        await api.uploadFile('/records/upload', { uri, name, type }, 'file', { isRecord: 'false' });
        // After upload, ask AI to analyze
        await sendMessage(`I just uploaded a document "${name}". Please analyze it and help me with my question.`);
        return; // sendMessage handles loading state
      }
    } catch (err: any) {
      addMessage({
        role: 'assistant',
        content: `I couldn't process "${name}" right now. ${err.message || 'Please try again.'}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  /* ─── Voice: transcribe → put text in input box → user sends manually ─── */
  const [isTranscribing, setIsTranscribing] = useState(false);

  const handleVoiceToggle = async () => {
    if (isRecording) {
      // Stop recording → transcribe → put text in input box
      try {
        const uri = await voiceService.stopRecording();
        setIsRecording(false);
        if (uri) {
          setIsTranscribing(true);
          try {
            const result = await chatService.transcribeAudio(uri, preferredLang);
            if (result.transcription) {
              setInput((prev) => (prev ? prev + ' ' + result.transcription : result.transcription));
            } else {
              Alert.alert('Voice', 'Could not understand the audio. Please try again.');
            }
          } catch (err: any) {
            Alert.alert('Voice Error', err.message || 'Transcription failed. Please try again.');
          } finally {
            setIsTranscribing(false);
          }
        }
      } catch {
        setIsRecording(false);
      }
    } else {
      // Start recording
      try {
        await voiceService.startRecording();
        setIsRecording(true);
      } catch {
        Alert.alert('Microphone Error', 'Could not start recording. Please check permissions.');
      }
    }
  };

  /* ─── New Chat ─── */
  const handleNewChat = () => {
    setDragTimestamp(null);
    setSuggestedPrompts(DEFAULT_SUGGESTED_PROMPTS);
    clearChat();
  };

  /* ─── Like / Dislike feedback on AI messages ─── */
  const [feedbackMap, setFeedbackMap] = useState<Record<number, string>>({});

  useEffect(() => {
    const map: Record<number, string> = {};
    messages.forEach((msg, idx) => {
      if (msg.role === 'assistant' && msg.feedback) {
        map[idx] = msg.feedback;
      }
    });
    setFeedbackMap(map);
  }, [messages.length]);

  const handleFeedback = async (msgIndex: number, type: 'like' | 'dislike') => {
    const current = feedbackMap[msgIndex] || '';
    const next = current === type ? '' : type;
    setFeedbackMap((prev) => ({ ...prev, [msgIndex]: next }));

    if (!currentSessionId) return;
    try {
      const res = await chatService.messageFeedback(currentSessionId, msgIndex, type);
      setFeedbackMap((prev) => ({ ...prev, [msgIndex]: res.feedback }));
    } catch {
      setFeedbackMap((prev) => ({ ...prev, [msgIndex]: current }));
    }
  };

  /* ─── Message Actions ─── */
  const sanitizeAiText = (text: string) => {
    return text
      .replace(/Dr\.?\s*Mediva/gi, 'Mediva')
      .replace(/I am Mediva AI/gi, 'I am Mediva')
      .replace(/I am a Mediva AI/gi, 'I am a Mediva')
      .replace(/I'm Mediva AI/gi, 'I am Mediva')
      .replace(/I am an AI/gi, 'I am')
      .replace(/as an AI/gi, '')
      .replace(/as a Mediva AI/gi, 'as Mediva')
      .replace(/Mediva AI/gi, 'Mediva')
      .replace(/I am (?:a )?medical (?:assistant|AI|chatbot|bot)/gi, 'I am Mediva')
      .replace(/I'm (?:a )?medical (?:assistant|AI|chatbot|bot)/gi, 'I am Mediva')
      .replace(/as (?:a )?medical (?:assistant|AI|chatbot|bot)/gi, '')
      .replace(/your (?:medical )?(?:assistant|AI|chatbot|bot)/gi, 'Mediva')
      .replace(/virtual (?:medical )?(?:assistant|AI|chatbot|bot)/gi, '')
      .replace(/AI[- ]?(?:powered|based|driven)/gi, '')
      .replace(/artificial intelligence/gi, '')
      .replace(/(?:a )?specialized (?:medical )?(?:assistant|companion|platform|service)/gi, 'Mediva')
      .replace(/focused (?:on|in) (?:health|healthcare|medicine)/gi, '')
      .replace(/here to (?:assist|help) you (?:with|in) (?:your )?(?:health|healthcare|medical|wellness)/gi, 'here to help you')
      .replace(/(?:an? )?(?:virtual )?(?:digital )?(?:health|medical|AI) (?:assistant|companion|advisor)/gi, '');
  };

  const stripMarkdownPlain = (text: string) =>
    sanitizeAiText(text)
      .replace(/<!--.*?-->/g, '')
      .replace(/###?\s*(?:Sources|Detailed Analysis|Key Insights|Recommendations)[\s\S]*?$/gim, (match) => {
        // Specifically only strip "Sources" and everything after it
        if (match.toLowerCase().includes('sources')) return '';
        return match;
      })
      .replace(/---\s*\n?.*?(?:Related Questions|Shareable Link)[\s\S]*?$/gi, '')
      .replace(/#{1,3}\s/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\|/g, ' ')
      .replace(/[-*•]/g, '')
      .trim();

  const handleFollowUp = (question: string) => {
    setInput(question);
  };

  /* ─── Render AI bubble (full width, no bg) ─── */
  const renderAIMessage = (msg: ChatMessage, idx: number) => {
    const panHandlers = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only react to meaningful left-swipe gestures (avoid interfering with vertical scroll)
        return gestureState.dx < -35 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -60) showDragTimestamp(idx, msg.timestamp);
      },
    }).panHandlers;

    return (
      <View key={idx} style={s.aiMsgContainer} {...panHandlers}>
        {/* Time label - top right */}
        <Text style={s.messageTimeLabel}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>

        {/* Markdown-rendered content — full width, no bubble background */}
        <View style={s.aiContent}>
          {dragTimestamp?.idx === idx && (
            <View style={s.dragTimestampOverlay}>
              <Text style={s.dragTimestampText}>{dragTimestamp.text}</Text>
            </View>
          )}

          <MarkdownRenderer variant="chat" content={sanitizeAiText(msg.content)} onFollowUp={handleFollowUp} />

          {msg.severity && msg.severity !== 'LOW' && (
            <View
              style={[
                s.severityBadge,
                msg.severity === 'EMERGENCY' && s.emergencyBadge,
                msg.severity === 'HIGH' && s.highBadge,
              ]}
            >
              <Ionicons
                name={msg.severity === 'EMERGENCY' ? 'warning' : 'alert-circle-outline'}
                size={12}
                color={msg.severity === 'EMERGENCY' ? '#D32F2F' : '#F57C00'}
              />
              <Text style={s.severityText}>
                {msg.severity === 'EMERGENCY'
                  ? ' Emergency — Seek help now'
                  : msg.severity === 'HIGH'
                    ? ' High Priority'
                    : ` ${msg.severity}`}
              </Text>
            </View>
          )}
        </View>

        <View style={s.actionRow}>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => handleFeedback(idx, 'like')}
          >
            <Ionicons
              name={(feedbackMap[idx] || msg.feedback) === 'like' ? 'thumbs-up' : 'thumbs-up-outline'}
              size={16}
              color="#9CA3AF"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => handleFeedback(idx, 'dislike')}
          >
            <Ionicons
              name={(feedbackMap[idx] || msg.feedback) === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'}
              size={16}
              color="#9CA3AF"
            />
          </TouchableOpacity>
        </View>

      </View>
    );
  };

  /* ─── Parse message content for attachments ─── */
  const parseMessageContent = (content: string) => {
    const lines = content.split('\n');
    const textLines: string[] = [];
    const attachments: { name: string; isImage: boolean; ext: string }[] = [];

    lines.forEach((line) => {
      const match = line.match(/^📎\s*(.+)$/);
      if (match) {
        const name = match[1];
        const ext = name.split('.').pop()?.toLowerCase() || '';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic'].includes(ext);
        attachments.push({ name, isImage, ext });
      } else if (line.startsWith('📎 Uploaded:')) {
        const name = line.replace('📎 Uploaded:', '').trim();
        const ext = name.split('.').pop()?.toLowerCase() || '';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic'].includes(ext);
        attachments.push({ name, isImage, ext });
      } else {
        textLines.push(line);
      }
    });

    return { text: textLines.join('\n'), attachments };
  };

  const getFileIcon = (ext: string) => {
    if (['pdf'].includes(ext)) return 'document-text-outline';
    if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) return 'document-outline';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'grid-outline';
    if (['ppt', 'pptx'].includes(ext)) return 'easel-outline';
    if (['zip', 'rar', '7z'].includes(ext)) return 'archive-outline';
    if (['mp3', 'wav', 'm4a', 'aac'].includes(ext)) return 'musical-note-outline';
    if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return 'videocam-outline';
    return 'document-outline';
  };

  /* ─── Render user bubble (gray, right-aligned) ─── */
  const renderUserMessage = (msg: ChatMessage, idx: number) => {
    const panHandlers = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dx < -35 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -60) showDragTimestamp(idx, msg.timestamp);
      },
    }).panHandlers;

    const { text, attachments } = parseMessageContent(msg.content);

    return (
      <View key={idx} style={s.userMsgContainer} {...panHandlers}>
        {/* Time label - top right */}
        <Text style={s.messageTimeLabel}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>

        <View style={s.userBubble}>
          {dragTimestamp?.idx === idx && (
            <View style={s.dragTimestampOverlayRight}>
              <Text style={s.dragTimestampText}>{dragTimestamp.text}</Text>
            </View>
          )}

          {/* Text content */}
          {text.length > 0 && <Text style={s.userText}>{text}</Text>}

          {/* Attachments */}
          {attachments.length > 0 && (
            <View style={s.attachmentsContainer}>
              {attachments.map((att, i) => (
                <View key={i} style={att.isImage ? s.imageAttachment : s.fileAttachment}>
                  {att.isImage ? (
                    <>
                      <View style={s.imagePreviewPlaceholder}>
                        <Ionicons name="image" size={48} color="#6B7280" />
                      </View>
                      <View style={s.imageOverlay}>
                        <Ionicons name="image-outline" size={14} color="#FFFFFF" />
                        <Text style={s.attachmentName} numberOfLines={1}>{att.name}</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={s.fileIconContainer}>
                        <Ionicons name={getFileIcon(att.ext)} size={28} color="#FFFFFF" />
                      </View>
                      <Text style={s.attachmentName} numberOfLines={1}>{att.name}</Text>
                    </>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderPrescription = () => {
    if (!currentSession?.finalPrescription || currentSession.finalPrescription.length === 0) return null;

    return (
      <View key="prescription-card" style={s.prescriptionCard}>
        <View style={s.prescriptionHeader}>
          <Ionicons name="medical" size={20} color="#10b981" />
          <Text style={s.prescriptionTitle}>Digitally Signed Prescription</Text>
        </View>
        
        <View style={s.medicationList}>
          {currentSession.finalPrescription.map((med: any, i: number) => (
            <View key={i} style={s.medItem}>
              <Text style={s.medName}>{med.medication}</Text>
              <Text style={s.medDetails}>{med.dosage} • {med.frequency} • {med.duration}</Text>
              {med.instructions && <Text style={s.medInstructions}>{med.instructions}</Text>}
            </View>
          ))}
        </View>
        
        <View style={s.prescriptionFooter}>
          <Ionicons name="checkmark-circle" size={16} color="#10b981" />
          <Text style={s.issuedText}>Signed & Verified on {new Date(currentSession.updatedAt).toLocaleDateString()}</Text>
        </View>
      </View>
    );
  };

  const getDoctorWorkflowStatusLabel = (session: ChatSession) => {
    if (!session.requiresDoctorReview) {
      return session.finalPrescription?.length ? 'Prescription delivered' : 'AI guidance active';
    }
    if (session.finalPrescription?.length) return 'Prescription delivered';
    if (session.doctorApproved) return 'Doctor approved';
    if (session.status === 'reviewed') return 'Doctor reviewed';
    if (session.status === 'pending_review') return 'Waiting for doctor review';
    return 'AI drafted';
  };


  /* ─── Welcome / Empty state ─── */
  const renderWelcome = () => (
    <View style={s.welcomeContainer}>
      <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
        <Image source={logoImg} style={s.welcomeLogo} resizeMode="contain" />
      </Animated.View>
     
      <Text style={s.welcomeSubtitle}>Hi there! Ask me anything about your health</Text>
    </View>
  );

  /* ─── Header ─── */
  const renderHeader = () => (
    <View style={s.header}>
      <TouchableOpacity
        style={s.headerIconBtn}
        onPress={() => onNavigate('history')}
        activeOpacity={0.7}
      >
        <Ionicons name="chatbubbles-outline" size={22} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={s.headerCenter}>
        <Text style={s.headerTitle} numberOfLines={1}>
          {chatTitle && chatTitle.trim().length > 0 && chatTitle !== 'New conversation' 
            ? chatTitle 
            : (messages.find(m => m.role === 'user')?.content?.substring(0, 30) || 'New Chat')}
        </Text>
      </View>

      <View style={s.headerRight}>
        {hasMessages && (
          <TouchableOpacity
            style={s.headerIconBtn}
            onPress={handleNewChat}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={s.headerIconBtn}
          onPress={() => onNavigate('discover')}
          activeOpacity={0.7}
        >
          <Ionicons name="grid-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  /* ─── Input bar ─── */
  const renderInputBar = () => (
    <View style={s.inputContainer}>
      {showAttach && (
        <View style={s.attachRow}>
          <TouchableOpacity style={s.attachOption} activeOpacity={0.85} onPress={handlePickImage}>
            <View style={s.attachOptionIcon}>
              <Ionicons name="image-outline" size={20} color="#FFFFFF" />
            </View>
            <Text style={s.attachOptionLabel}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.attachOption} activeOpacity={0.85} onPress={handleCamera}>
            <View style={s.attachOptionIcon}>
              <Ionicons name="camera-outline" size={20} color="#FFFFFF" />
            </View>
            <Text style={s.attachOptionLabel}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.attachOption} activeOpacity={0.85} onPress={handlePickFile}>
            <View style={s.attachOptionIcon}>
              <Ionicons name="document-outline" size={20} color="#FFFFFF" />
            </View>
            <Text style={s.attachOptionLabel}>Document</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pending attachments preview */}
      {pendingAttachments.length > 0 && (
        <View style={s.pendingAttachmentsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {pendingAttachments.map((att, idx) => (
              <View key={idx} style={s.pendingAttachmentChip}>
                <Ionicons
                  name={att.type.startsWith('image/') ? 'image-outline' : 'document-outline'}
                  size={14}
                  color="#FFFFFF"
                />
                <Text style={s.pendingAttachmentName} numberOfLines={1}>
                  {att.name}
                </Text>
                <TouchableOpacity
                  style={s.removeAttachmentBtn}
                  onPress={() => removePendingAttachment(idx)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={12} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <Text style={s.attachmentCount}>
            {pendingAttachments.length}/{MAX_ATTACHMENTS}
          </Text>
        </View>
      )}

      <View style={s.inputRow}>
        {/* Upload button (left) */}
        <TouchableOpacity
          style={s.uploadBtn}
          onPress={() => {
            setShowAttach((v) => !v);
          }}
          activeOpacity={0.85}
          disabled={loading}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={s.inputWrap}>
          <TextInput
            style={s.textInput}
            placeholder={pendingAttachments.length > 0 ? 'Add a message (optional)...' : 'Message...'}
            placeholderTextColor="#9CA3AF"
            value={input}
            onChangeText={(t) => setInput(t)}
            multiline
            maxLength={2000}
            editable={!loading && !emergencyDetected?.isEmergency}
          />

          {/* Submit/Talk button inside the input box (right side) */}
          {input.trim().length > 0 || pendingAttachments.length > 0 ? (
            <TouchableOpacity
              style={s.submitBtn}
              onPress={() => sendMessage(input.trim())}
              activeOpacity={0.85}
              disabled={loading || !!emergencyDetected?.isEmergency}
            >
              <ButtonBg
                width="100%"
                height="100%"
                style={StyleSheet.absoluteFill}
                preserveAspectRatio="xMidYMid slice"
                pointerEvents="none"
              />
              <View style={s.submitBtnInner}>
                <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={s.voiceAgentBtnInside}
              onPress={() => onNavigate('voice-agent')}
              activeOpacity={0.85}
              disabled={loading}
            >
              <ButtonBg
                width="100%"
                height="100%"
                style={StyleSheet.absoluteFill}
                preserveAspectRatio="xMidYMid slice"
                pointerEvents="none"
              />
              <View style={s.voiceAgentBtnInsideInner}>
                <Ionicons name="radio" size={14} color="#FFFFFF" />
                <Text style={s.voiceAgentBtnInsideText}>Talk</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  /* ─── RENDER ─── */
  return (
    <ImageBackground source={bgImg} style={s.imageBackground} resizeMode="cover">
      <View style={s.blackOverlay} />
      <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {renderHeader()}

        <Modal
          transparent
          visible={showDisclaimerPopup}
          animationType="fade"
          onRequestClose={() => setShowDisclaimerPopup(false)}
        >
          <View style={s.disclaimerModalOverlay}>
            <View style={s.disclaimerModalBox}>
              <View style={s.disclaimerModalHeader}>
                <Ionicons name="information-circle-outline" size={18} color="#FFFFFF" />
                <Text style={s.disclaimerModalTitle}>Disclaimer</Text>
              </View>
              <Text style={s.disclaimerModalBody}>
              Mediva provides general health information only and is not a substitute for a doctor. Always consult your prescribing doctor for medical advice.

We are continuously improving Mediva to make it faster, smarter, and better for your health.

In an emergency, call 112 immediately.              </Text>
              <TouchableOpacity
                style={s.disclaimerModalCloseBtn}
                onPress={() => setShowDisclaimerPopup(false)}
                activeOpacity={0.8}
              >
                <Text style={s.disclaimerModalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <ScrollView
          ref={scrollRef}
          style={s.messagesArea}
          contentContainerStyle={[
            s.messagesContent,
            !hasMessages && s.messagesContentCenter,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderPrescription()}

          {!hasMessages && renderWelcome()}

          {messages.map((msg, idx) =>
            msg.role === 'user'
              ? renderUserMessage(msg, idx)
              : renderAIMessage(msg, idx),
          )}

          {/* Invisible marker — captures Y position of the AI response start */}
          <View
            ref={aiResponseStartRef}
            collapsable={false}
            onLayout={(e) => {
              if (loading || isStreaming) {
                responseScrollYRef.current = e.nativeEvent.layout.y;
              }
            }}
          />

          {/* Loading indicator - shining dot on left */}
          {(loading || isStreaming) && (
            <View style={s.loadingIndicatorRow}>
              <ShiningDot />
            </View>
          )}

          {/* Streaming AI response */}
          {isStreaming && (
            <View style={s.aiMsgContainer}>
              <View style={s.aiContent}>
                <MarkdownRenderer
                  variant="chat"
                  content={sanitizeAiText(streamingContent + '▊')}
                  onFollowUp={handleFollowUp}
                />
              </View>
            </View>
          )}

          {/* Follow-up chips removed; suggestions are shown above composer */}
        </ScrollView>

        {/* Suggestions above the message composer - hide when attachments open */}
        {!showAttach && (
          <View style={s.bottomPromptsWrap}>
            <View style={s.topMetaRow}>
              <TouchableOpacity
                style={s.topDisclaimerBtn}
                onPress={() => setShowDisclaimerPopup(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="information-circle-outline" size={12} color="#FFFFFF" />
                <Text style={s.topDisclaimerText}>Disclaimer</Text>
              </TouchableOpacity>
              <Text style={s.betaTagText}>Beta Early User</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.bottomPromptsScroll}
              keyboardShouldPersistTaps="handled"
            >
              {suggestedPrompts.slice(0, 5).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={s.topPromptChip}
                  onPress={() => sendMessage(p)}
                  activeOpacity={0.85}
                  disabled={loading || isStreaming}
                >
                  <Text style={s.topPromptChipText} numberOfLines={1}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {renderInputBar()}
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

/* ─── Styles ─── */
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  imageBackground: {
    flex: 1,
  },
  blackOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    opacity: 1,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 22,
    paddingBottom: 8,
    backgroundColor: '#000',
  },
  headerDark: {
    backgroundColor: '#1A202C',
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: SIZES.lg,
    fontWeight: '400',
    color: "#FFFFFF",
    fontFamily: 'HelveticaNeue',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  /* Messages area */
  messagesArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingBottom: 4,
    paddingTop: 8,
  },
  messagesContentCenter: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  /* Welcome / empty */
  welcomeContainer: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 24,
    paddingBottom: 24,
    backgroundColor: '#000',
  },
  welcomeLogo: {
    width: isSmallDevice ? 64 : 80,
    height: isSmallDevice ? 64 : 80,
    borderRadius: 20,
    marginBottom: 20,
  },
  welcomeHi: {
    fontSize: SIZES.md,
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue-regular',
    fontWeight: '300',
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: SIZES.sm,
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue',
    fontWeight: '400',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  topPromptsWrap: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 2,
  },
  bottomPromptsWrap: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 2,
    backgroundColor: '#000',
  },
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 4,
  },
  topDisclaimerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  topDisclaimerText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue-Light',
    fontWeight: '300',
  },
  betaTagText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontFamily: 'HelveticaNeue-Light',
    fontWeight: '300',
    letterSpacing: 0.2,
  },
  topPromptsScroll: {
    gap: 8,
  },
  bottomPromptsScroll: {
    gap: 8,
  },
  topPromptChip: {
    backgroundColor: '#0B1220',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#6B7280',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    maxWidth: SCREEN_WIDTH * 0.78,
  },
  topPromptChipText: {
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue-Light',
    fontWeight: '300',
    fontSize: 11,
    lineHeight: 14,
  },
  disclaimerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  disclaimerModalBox: {
    width: '100%',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
  },
  disclaimerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  disclaimerModalTitle: {
    fontFamily: 'HelveticaNeue',
    fontWeight: '400',
    color: '#FFFFFF',
    fontSize: 14,
  },
  disclaimerModalBody: {
    fontFamily: 'HelveticaNeue-Light',
    fontWeight: '300',
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  disclaimerModalCloseBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  disclaimerModalCloseText: {
    fontFamily: 'HelveticaNeue-Light',
    fontWeight: '300',
    color: '#FFFFFF',
    fontSize: 12,
  },
  dragTimestampOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 20,
  },
  dragTimestampOverlayRight: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 20,
  },
  dragTimestampText: {
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue-Light',
    fontWeight: '300',
    fontSize: 10,
    textAlign: 'center',
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  suggestionChip: {
    backgroundColor: '#000',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionChipIcon: {
    fontSize: 14,
  },
  suggestionChipText: {
    fontSize: SIZES.sm,
    color: '#FFFFFF',
    fontFamily: "HelveticaNeue-Light",
  },

  /* AI message — full width, no bubble bg */
  aiMsgContainer: {
    marginBottom: 12,
  },
  aiAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiAvatar: {
    width: 22,
    height: 22,
    borderRadius: 6,
    marginRight: 6,
  },
  aiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: "HelveticaNeue",
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  aiContent: {
    backgroundColor: '#000',
    borderWidth: 0,
    borderRadius: 12,
    position: 'relative',
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 8,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#000',
    borderWidth: 0,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  highBadge: { backgroundColor: '#000' },
  emergencyBadge: { backgroundColor: '#000' },
  severityText: {
    fontSize: SIZES.xs,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: "HelveticaNeue-Light",
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 8,
    paddingLeft: 2,
    gap: 2,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDivider: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginHorizontal: 2,
  },
  timestamp: {
    fontSize: 10,
    color: '#FFFFFF',
    marginTop: 2,
    paddingLeft: 4,
    fontFamily: "HelveticaNeue-Light",
  },

  /* User message — gray bubble, right aligned */
  userMsgContainer: {
    alignSelf: 'flex-end',
    marginBottom: 12,
    maxWidth: '92%',
  },
  userBubble: {
    backgroundColor: '#898989',
    borderWidth: 0,
    borderRadius: SIZES.radiusLg,
    borderBottomRightRadius: 4,
    position: 'relative',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userText: {
    color: '#FFFFFF',
    fontSize: SIZES.base,
    lineHeight: 20,
    fontFamily: 'HelveticaNeue-Light',
    fontWeight: '300',
  },
  messageTimeLabel: {
    fontSize: 9,
    color: '#6B7280',
    fontFamily: 'HelveticaNeue-Light',
    fontWeight: '300',
    textAlign: 'right',
    marginBottom: 2,
    marginRight: 4,
  },
  attachmentsContainer: {
    marginTop: 8,
    gap: 8,
  },
  imageAttachment: {
    width: 200,
    height: 140,
    borderRadius: 12,
    backgroundColor: '#1F2937',
    overflow: 'hidden',
    position: 'relative',
  },
  fileAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  imagePreviewPlaceholder: {
    flex: 1,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentName: {
    flex: 1,
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue-Light',
    fontWeight: '300',
  },
  userTimestamp: {
    fontSize: 10,
    color: '#FFFFFF',
    marginTop: 4,
    textAlign: 'right',
    fontFamily: "HelveticaNeue-Light",
  },

  /* Thinking / Exploring animation */
  thinkingContainer: {
    marginBottom: 20,
  },
  thinkingStepsWrap: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: SIZES.radiusLg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4,
    gap: 8,
  },
  thinkingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thinkingStepText: {
    color: "#FFFFFF",
    fontSize: SIZES.md,
    fontFamily: "HelveticaNeue-Light",
    fontWeight: '500',
  },
  thinkingStepDone: {
    color: "#10b981",
    fontSize: SIZES.sm,
    fontFamily: "HelveticaNeue-Light",
  },

  /* Input bar */
  inputContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#000',
    borderTopWidth: 0,
    borderTopColor: '#FFFFFF',
  },
  disclaimer: {
    fontSize: 9,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: "HelveticaNeue-Light",
  },
  attachRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginBottom: 4,
  },
  attachOption: {
    alignItems: 'center',
    gap: 4,
  },
  attachOptionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  attachOptionLabel: {
    fontSize: 10,
    color: '#FFFFFF',
    fontFamily: "HelveticaNeue-Light",
  },
  pendingAttachmentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginBottom: 4,
  },
  pendingAttachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    gap: 6,
    maxWidth: 180,
  },
  pendingAttachmentName: {
    flex: 1,
    fontSize: 11,
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue-Light',
    fontWeight: '300',
  },
  removeAttachmentBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentCount: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: 'HelveticaNeue-Light',
    fontWeight: '300',
    marginLeft: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  uploadBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  uploadBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 1,
  },
  uploadBtnText: {
    color: "#FFFFFF",
    fontFamily: "HelveticaNeue-Light",
    fontSize: 12,
  },
  voiceAgentBtn: {
    width: 110,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceAgentBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 1,
  },
  voiceAgentBtnText: {
    color: "#FFFFFF",
    fontFamily: "HelveticaNeue-Light",
    fontSize: 12,
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    borderRadius: 18,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#9CA3AF',
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    fontSize: SIZES.base,
    color: '#FFFFFF',
    maxHeight: 100,
    paddingVertical: 10,
    fontFamily: 'HelveticaNeue-Light',
    fontWeight: '300',
    flex: 1,
  },
  submitBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    marginRight: -7,
  },
  submitBtnInner: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  voiceAgentBtnInside: {
    width: 76,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    marginRight: -7,
  },
  voiceAgentBtnInsideInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 1,
  },
  voiceAgentBtnInsideText: {
    color: "#FFFFFF",
    fontFamily: 'HelveticaNeue-Light',
    fontWeight: '300',
    fontSize: 12,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: { opacity: 0.4 },
  voiceBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  voiceBtnActive: {
    backgroundColor: "#FFFFFF",
  },
  voiceBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  voiceBotBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },

  /* Recording indicator */
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D32F2F',
  },
  recordingText: {
    fontSize: SIZES.xs,
    color: '#D32F2F',
    fontFamily: "HelveticaNeue-Light",
  },
  /* Loading indicator - shining dot */
  loadingIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  shiningDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#9CA3AF',
  },
  prescriptionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  prescriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
  },
  prescriptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  medicationList: {
    gap: 12,
  },
  medItem: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
  },
  medName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  medDetails: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  medInstructions: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 4,
  },
  prescriptionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  issuedText: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
  },
  
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
    backgroundColor: '#000',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#6B7280',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  followUpChipDark: {
    backgroundColor: '#2D3748',
    borderColor: '#4A5568',
  },
  followUpChipIcon: {
    fontSize: 12,
    color: "#FFFFFF",
  },
  followUpChipText: {
    fontSize: SIZES.sm,
    color: '#FFFFFF',
    fontFamily: "HelveticaNeue-Light",
  },
  followUpChipTextDark: {
    color: '#E2E8F0',
  },
  
  /* Dark mode styles */
  headerTitleDark: {
    color: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#1A202C',
  },
  messagesAreaDark: {
    backgroundColor: '#1A202C',
  },
  inputContainerDark: {
    backgroundColor: '#1A202C',
    borderTopColor: '#2D3748',
  },
  textInputDark: {
    backgroundColor: '#2D3748',
    color: '#E2E8F0',
  },
  userBubbleDark: {
    backgroundColor: '#4A5568',
  },
  userTextDark: {
    color: '#FFFFFF',
  },
});
