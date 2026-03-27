import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as SecureStore from 'expo-secure-store';
import { io, Socket } from 'socket.io-client';
import { Platform, Alert } from 'react-native';
import { BASE_URL } from './api';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { requestMicrophonePermission, showPermissionRationale } from '../utils/permissions';

export interface VoiceConversationCallbacks {
  onStateChange: (state: VoiceState) => void;
  onTranscript: (text: string, isUser: boolean) => void;
  onError: (error: string) => void;
  onMicLevel?: (level: number) => void; // For orb animation
  onConnectingProgress?: (stage: string) => void; // For brief unification stages
}

export type VoiceState = 'idle' | 'requesting_permission' | 'connecting' | 'unifying_data' | 'listening' | 'speaking';
export interface VoiceStartOptions {
  preferredLanguage?: string;
  location?: { lat: number; lng: number; city?: string; country?: string };
  voiceName?: string;
  subtitlesEnabled?: boolean;
  unifiedHealthData?: {
    hasAppleHealth?: boolean;
    hasHealthConnect?: boolean;
    hasWearables?: boolean;
    recordCount?: number;
  };
}

export class VoiceConversationService {
  private callbacks: VoiceConversationCallbacks;
  private socket: Socket | null = null;
  private recording: Audio.Recording | null = null;
  private isActive = false;
  private currentState: VoiceState = 'idle';
  private audioQueue: string[] = [];
  private isPlaying = false;
  private sound: Audio.Sound | null = null;
  private recordingInterval: ReturnType<typeof setInterval> | null = null;
  private authTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private fallbackSpeechTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentVolume: number = 1.0;
  private playbackRate: number = 1.0;
  private shouldReconnect = true;

  constructor(callbacks: VoiceConversationCallbacks) {
    this.callbacks = callbacks;
    this.setState('idle');
  }

  private setState(state: VoiceState) {
    this.currentState = state;
    this.callbacks.onStateChange(state);
  }

  /**
   * Perform brief data unification during connecting state
   * This analyzes user's health data while connecting
   */
  private performBriefUnification(options: VoiceStartOptions) {
    const healthData = options.unifiedHealthData;
    
    if (!healthData) {
      this.callbacks.onConnectingProgress?.('Getting ready...');
      return;
    }
    
    // Show brief analysis stages
    const stages: string[] = [];
    
    if (healthData.hasAppleHealth || healthData.hasHealthConnect) {
      stages.push('Syncing your health data...');
    }
    
    if (healthData.hasWearables) {
      stages.push('Analyzing wearable data...');
    }
    
    if (healthData.recordCount && healthData.recordCount > 0) {
      stages.push(`Reviewing ${healthData.recordCount} medical records...`);
    }
    
    if (stages.length === 0) {
      stages.push('Preparing your consultation...');
    }
    
    // Cycle through stages quickly
    let stageIndex = 0;
    const stageInterval = setInterval(() => {
      if (!this.isActive || this.currentState !== 'unifying_data') {
        clearInterval(stageInterval);
        return;
      }
      
      if (stageIndex < stages.length) {
        this.callbacks.onConnectingProgress?.(stages[stageIndex]);
        stageIndex++;
      } else {
        this.callbacks.onConnectingProgress?.('Connecting to Dr. Mediva...');
        clearInterval(stageInterval);
      }
    }, 400);
    
    // Clear interval after all stages or timeout
    setTimeout(() => {
      clearInterval(stageInterval);
    }, stages.length * 400 + 500);
  }

  async startConversation(options: VoiceStartOptions = {}) {
    if (this.isActive) return;
    
    // Check if user is logged in
    const token = await SecureStore.getItemAsync('accessToken');
    if (!token) {
      this.callbacks.onError('Please login first to use voice chat');
      return;
    }

    // Step 1: Request microphone permission
    this.setState('requesting_permission');
    
    const micPermission = await requestMicrophonePermission();
    
    if (!micPermission.granted) {
      if (micPermission.canAskAgain) {
        // Show rationale and try again
        showPermissionRationale(
          'microphone',
          async () => {
            // User accepted rationale, try requesting again
            const secondAttempt = await requestMicrophonePermission();
            if (secondAttempt.granted) {
              this.proceedWithConnection(options, token);
            } else {
              this.callbacks.onError('Microphone permission is required for voice chat');
              this.setState('idle');
            }
          },
          () => {
            this.callbacks.onError('Microphone permission is required for voice chat');
            this.setState('idle');
          }
        );
      } else {
        this.callbacks.onError('Microphone permission denied. Please enable it in settings.');
        this.setState('idle');
      }
      return;
    }
    
    // Permission granted, proceed with connection
    this.proceedWithConnection(options, token);
  }

  private async proceedWithConnection(options: VoiceStartOptions, token: string) {
    this.isActive = true;
    this.shouldReconnect = true;
    this.setState('connecting');
    this.callbacks.onConnectingProgress?.('Connecting to Dr. Mediva...');

    // Brief data unification stage
    setTimeout(() => {
      if (this.isActive && this.currentState === 'connecting') {
        this.setState('unifying_data');
        this.performBriefUnification(options);
      }
    }, 500);

    // Socket.io connection using /voice namespace
    const apiUrl = BASE_URL.replace(/\/api$/, '');
    const socketUrl = `${apiUrl}/voice`;
    
    console.log('Connecting to voice socket:', socketUrl);
    
    this.socket = io(socketUrl, {
      auth: { token: `Bearer ${token}` },
      extraHeaders: {
        Authorization: `Bearer ${token}`,
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 700,
      timeout: 8000,
    });

    this.socket.on('connect', () => {
      console.log('Voice socket connected, waiting for authorization...');
      if (this.pingInterval) clearInterval(this.pingInterval);
      this.pingInterval = setInterval(() => {
        this.socket?.emit('ping');
      }, 10000);
      
      this.authTimeout = setTimeout(() => {
        if (this.isActive && (this.currentState === 'connecting' || this.currentState === 'unifying_data')) {
          console.error('Authorization timeout');
          this.callbacks.onError('Connection timeout - please try again');
          this.stopConversation();
        }
      }, 8000);
    });

    this.socket.on('authorized', (data: { userId: string; role: string }) => {
      console.log('Voice socket authorized:', data.userId);
      if (this.authTimeout) {
        clearTimeout(this.authTimeout);
        this.authTimeout = null;
      }
      
      // Brief unification complete, start session
      this.callbacks.onConnectingProgress?.('Almost ready...');
      
      this.socket?.emit('start_session', {
        preferredLanguage: options.preferredLanguage || 'en',
        location: options.location,
        voiceName: options.voiceName || 'Aoede',
        subtitlesEnabled: options.subtitlesEnabled ?? true,
        unifiedHealthData: options.unifiedHealthData,
      });
    });

    this.socket.on('session_started', async () => {
      this.setState('listening');
      await this.startMicRecording();
    });

    this.socket.on('audio_chunk', async (payload: { data: string }) => {
      // payload.data is base64 PCM 16-bit 24kHz.
      if (this.fallbackSpeechTimeout) {
        clearTimeout(this.fallbackSpeechTimeout);
        this.fallbackSpeechTimeout = null;
      }
      Speech.stop();
      this.audioQueue.push(payload.data);
      if (!this.isPlaying) {
        this.processAudioQueue();
      }
    });

    this.socket.on('transcript', (payload: { text: string; isUser: boolean }) => {
      this.callbacks.onTranscript(payload.text, payload.isUser);
      if (!payload.isUser) {
        this.scheduleFallbackSpeech(payload.text);
      }
    });

    this.socket.on('error', (err: any) => {
      console.error('Socket error:', err);
      this.callbacks.onError(err.message || 'Voice connection error');
      this.stopConversation();
    });

    this.socket.on('disconnect', () => {
      console.log('Voice socket disconnected');
      if (!this.isActive || !this.shouldReconnect) {
        this.stopConversation();
        return;
      }
      this.setState('connecting');
    });
  }

  stopConversation() {
    // Clear auth timeout if pending
    if (this.authTimeout) {
      clearTimeout(this.authTimeout);
      this.authTimeout = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.fallbackSpeechTimeout) {
      clearTimeout(this.fallbackSpeechTimeout);
      this.fallbackSpeechTimeout = null;
    }
    Speech.stop();
    
    this.shouldReconnect = false;
    this.isActive = false;
    this.stopMicRecording();
    
    if (this.sound) {
      this.sound.stopAsync().catch(() => {});
      this.sound.unloadAsync().catch(() => {});
      this.sound = null;
    }

    if (this.socket) {
      try {
        this.socket.emit('end_session');
        this.socket.disconnect();
      } catch (e) {}
      this.socket = null;
    }
    
    this.audioQueue = [];
    this.isPlaying = false;
    this.setState('idle');
  }

  setVolume(volume: number) {
    this.currentVolume = Math.max(0, Math.min(1, volume));
    if (this.sound) {
      this.sound.setVolumeAsync(this.currentVolume).catch(() => {});
    }
  }

  setPlaybackRate(rate: number) {
    // Expo supports ~0.5 to 2.0 safely
    this.playbackRate = Math.max(0.5, Math.min(2.0, rate));
    if (this.sound) {
      this.sound.setRateAsync(this.playbackRate, true).catch(() => {});
    }
  }

  private async startMicRecording() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        this.callbacks.onError('Microphone permission denied');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const { recording } = await Audio.Recording.createAsync({
        isMeteringEnabled: true,
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });
      
      this.recording = recording;

      // Poll mic level for UI animation
      this.recordingInterval = setInterval(async () => {
        if (!this.isActive || !this.recording || this.currentState === 'speaking') return;
        
        try {
          const status = await this.recording.getStatusAsync();
          if (status.isRecording && status.metering !== undefined && this.callbacks.onMicLevel) {
            // metering is in dB, usually -160 to 0
            const level = Math.max(0, (status.metering + 160) / 160);
            this.callbacks.onMicLevel(level);
          }
        } catch (e) {}
      }, 100);

      // Expo AV: cycle recording to emit chunks (shorter interval = lower latency).
      setTimeout(() => this.cycleRecording(), 1200);

    } catch (err) {
      console.error('Mic error:', err);
      this.callbacks.onError('Failed to access microphone');
    }
  }

  private async cycleRecording() {
    if (!this.isActive || !this.recording) return;
    
    if (this.currentState === 'speaking') {
      // Pause mic polling if AI is speaking
      setTimeout(() => this.cycleRecording(), 1000);
      return;
    }

    try {
      const currentRecording = this.recording;
      this.recording = null;
      await currentRecording.stopAndUnloadAsync();
      const uri = currentRecording.getURI();
      
      if (uri && this.socket) {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        const mimeType =
          Platform.OS === 'ios'
            ? 'audio/wav'
            : Platform.OS === 'android'
              ? 'audio/mp4'
              : 'audio/webm';
        this.socket.emit('audio_data', { audio: base64, mimeType });
      }
      
      if (this.isActive && this.currentState === 'listening') {
        await this.startMicRecording();
      }
    } catch (e) {
      console.log('Cycle recording error', e);
      if (this.isActive && this.currentState === 'listening') {
        setTimeout(() => this.startMicRecording().catch(() => {}), 300);
      }
    }
  }

  private stopMicRecording() {
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
    if (this.recording) {
      this.recording.stopAndUnloadAsync().catch(() => {});
      this.recording = null;
    }
  }

  private async processAudioQueue() {
    if (this.audioQueue.length === 0 || !this.isActive) {
      this.isPlaying = false;
      if (this.isActive && this.currentState === 'speaking') {
        this.setState('listening');
      }
      return;
    }

    this.isPlaying = true;
    this.setState('speaking');

    const base64Data = this.audioQueue.shift()!;
    
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      // Create a WAV file from raw PCM to play in Expo AV
      const wavBase64 = this.addWavHeader(base64Data, 24000, 1, 16);
      
      // Use a temporary file path for audio playback
      const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
      const uri = `${docDir}temp_ai_audio_${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(uri, wavBase64, {
        encoding: 'base64',
      });

      const { sound } = await Audio.Sound.createAsync({ uri });
      this.sound = sound;
      await this.sound.setVolumeAsync(this.currentVolume);
      await this.sound.setRateAsync(this.playbackRate, true);
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
          this.processAudioQueue();
        }
      });

      await sound.playAsync();
    } catch (err) {
      console.error('Audio playback error', err);
      // Avoid synchronous recursion on repeated playback failures.
      setTimeout(() => this.processAudioQueue(), 0);
    }
  }

  private scheduleFallbackSpeech(text: string) {
    if (!text?.trim()) return;
    if (this.fallbackSpeechTimeout) clearTimeout(this.fallbackSpeechTimeout);
    this.fallbackSpeechTimeout = setTimeout(() => {
      if (!this.isActive || this.isPlaying || this.audioQueue.length > 0) return;
      this.setState('speaking');
      Speech.speak(text, {
        rate: this.playbackRate,
        pitch: 1.0,
        onDone: () => {
          if (this.isActive) this.setState('listening');
        },
        onStopped: () => {
          if (this.isActive) this.setState('listening');
        },
        onError: () => {
          if (this.isActive) this.setState('listening');
        },
      });
    }, 1200);
  }

  private addWavHeader(base64Data: string, sampleRate: number, channels: number, bitDepth: number): string {
    const binaryStr = Buffer.from(base64Data, 'base64').toString('binary');
    const pcmLength = binaryStr.length;
    
    const wavBuffer = new ArrayBuffer(44 + pcmLength);
    const view = new DataView(wavBuffer);
    
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmLength, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * (bitDepth / 8), true);
    view.setUint16(32, channels * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, pcmLength, true);
    
    const bytes = new Uint8Array(wavBuffer);
    for (let i = 0; i < pcmLength; i++) {
        bytes[44 + i] = binaryStr.charCodeAt(i);
    }
    
    return Buffer.from(wavBuffer).toString('base64');
  }

  private writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}
