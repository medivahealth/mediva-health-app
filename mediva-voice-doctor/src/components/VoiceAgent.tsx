import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Settings, Mic, MicOff, Volume2 } from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

/** Public favicon.svg is a copy of the Talk bubble artwork. */
const TALK_BUBBLE_URL = '/favicon.svg';

/** Encode PCM for Gemini Live without stack overflow on large buffers. */
function int16PcmToBase64(pcm: Int16Array): string {
  const uint8 = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < uint8.length; i += chunk) {
    const sub = uint8.subarray(i, Math.min(i + chunk, uint8.length));
    binary += String.fromCharCode.apply(null, sub as unknown as number[]);
  }
  return btoa(binary);
}

interface VoiceAgentProps {
  onClose: () => void;
  /** In-app WebView: hide top bar; connection starts immediately (no Talk landing). */
  embed?: boolean;
}

type Voice = 'Kore' | 'Puck' | 'Fenrir' | 'Zephyr' | 'Charon';

interface SettingsState {
  voice: Voice;
  speed: number;
  subtitles: boolean;
}

function resolveGeminiApiKey(): string {
  return String(
    import.meta.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '',
  ).trim();
}

/** Injected by Expo VoiceWebScreen from GET /chat/voice-brief */
function readMedivaVoiceBrief(): string {
  if (typeof window === 'undefined') return '';
  try {
    const b = (window as unknown as { __MEDIVA_VOICE_BRIEF__?: string }).__MEDIVA_VOICE_BRIEF__;
    return typeof b === 'string' && b.trim() ? b.trim() : '';
  } catch {
    return '';
  }
}

function useIsNarrow(maxWidth = 640) {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < maxWidth : true,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [maxWidth]);
  return narrow;
}

export default function VoiceAgent({ onClose: _onClose, embed = false }: VoiceAgentProps) {
  const [configError, setConfigError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectingStage, setConnectingStage] = useState<string>('Initializing...');
  const [status, setStatus] = useState<'connecting' | 'ready' | 'user talks' | 'ai response'>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<SettingsState>({
    voice: 'Kore', // Girl doctor default
    speed: 1.0,
    subtitles: true,
  });
  const isNewTurnRef = useRef(true);
  const [aiTranscript, setAiTranscript] = useState('');

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<any>(null);
  const liveOpenRef = useRef(false);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNarrow = useIsNarrow(640);

  const voices: { name: Voice; label: string }[] = [
    { name: 'Kore', label: 'Female Doctor' },
    { name: 'Puck', label: 'Male Doctor' },
    { name: 'Zephyr', label: 'Soft Voice' },
  ];

  const initializeAudio = async () => {
    try {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        return; // Already initialized
      }
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      processorRef.current.onaudioprocess = (e) => {
        if (isMutedRef.current || !sessionRef.current || !liveOpenRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        try {
          sessionRef.current.sendRealtimeInput({
            media: {
              data: int16PcmToBase64(pcmData),
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } catch {
          // Session may close asynchronously while mic callback is still running.
          liveOpenRef.current = false;
        }
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
    } catch (err) {
      console.error('Audio initialization failed:', err);
      setConfigError(
        'Microphone access failed. Allow microphone permission in your browser/app settings, then reopen voice.',
      );
      setIsConnecting(false);
      setStatus('ready');
    }
  };

  const playNextInQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0 || !audioContextRef.current || audioContextRef.current.state === 'closed') return;

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    isPlayingRef.current = true;
    const pcmData = audioQueueRef.current.shift()!;
    
    const audioBuffer = audioContextRef.current.createBuffer(1, pcmData.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcmData.length; i++) {
      channelData[i] = pcmData[i] / 32768.0;
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = settings.speed;
    source.connect(audioContextRef.current.destination);
    
    source.onended = () => {
      isPlayingRef.current = false;
      playNextInQueue();
    };
    
    source.start();
  }, [settings.speed]);

  const connectToGemini = async () => {
    // Close existing session if any
    if (sessionRef.current) {
      liveOpenRef.current = false;
      sessionRef.current.close();
    }

    const apiKey = resolveGeminiApiKey();
    if (!apiKey) {
      setConfigError(
        'Missing API key. Create mediva-voice-doctor/.env.local with:\n\nGEMINI_API_KEY=your_key\n\nRestart: npm run dev',
      );
      setIsConnecting(false);
      return;
    }
    setConfigError(null);

    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    connectTimeoutRef.current = setTimeout(() => {
      connectTimeoutRef.current = null;
      setIsConnecting((still) => {
        if (still) {
          setConfigError(
            (prev) =>
              prev ||
              'Connection timed out. Check GEMINI_API_KEY in .env.local, restart npm run dev, and confirm your network allows WebSockets to Google.',
          );
        }
        return false;
      });
    }, 25000);

    const ai = new GoogleGenAI({ apiKey });

    const baseMedivaInstruction =
      `You are Dr. Mediva, an experienced and caring primary care physician with 15+ years of practice. You combine medical expertise with genuine empathy - like a trusted family doctor who knows your history and truly cares about your wellbeing.

CRITICAL RULE: LANGUAGE MATCHING
- Detect the language the user speaks and respond in the SAME language.
- Hindi → respond in Hindi, Telugu → Telugu, Tamil → Tamil, Bengali → Bengali, Kannada → Kannada, Marathi → Marathi.
- Use respectful forms: Hindi "Aap", Telugu "Meeru", etc.
- Medical terms can be in English when necessary, but explain in the user's language.

CONVERSATION STYLE (Be a real doctor, not a chatbot)
- Warm, professional yet approachable - like sitting across from your doctor
- Vary your openings naturally - "What brings you in today?", "How have you been feeling?", "Tell me what's been going on"
- Never use robotic phrases like "As an AI" or "I'm a virtual assistant"
- Use natural doctor-patient conversation flow:
  * Acknowledge concerns: "I understand that can be worrying"
  * Show you're listening: "That's helpful to know", "I see", "Good to know"
  * Build rapport: "Thanks for sharing that with me"
- Ask focused follow-up questions one at a time or in small groups (2 max)
- Show you're analyzing their data when available: "I can see from your recent readings that..."
- Be reassuring without dismissing concerns
- When you don't have all information: "Let me think about what else we need to know"
- Use phrases that show medical expertise: "In my experience", "What we typically see", "The research suggests"
- NEVER use phrases like "As an AI language model", "I'm just a chatbot", or any AI terminology

MEDICAL APPROACH:
1. You are EXCLUSIVELY a medical doctor. For non-medical topics, gently redirect to health.
2. When uncertain: "I want to be careful here - let me recommend you see a doctor for this"
3. Never give definitive diagnoses - always "possible causes", "what we're considering"
4. Emergency Protocol: If the user describes a life-threatening emergency (chest pain, severe bleeding, unconsciousness), immediately tell them to call 108/112 and offer to help find the nearest hospital.
5. Provide clear medical advice (with a disclaimer to consult a physical doctor for confirmation).
6. Be conversational and end-to-end - don't overwhelm with information, guide them step by step.

NEVER mention suicide, self-harm, or use discouraging language. Always be supportive and constructive.

IMPORTANT: Do not output your internal thinking process, reasoning, or "Clarifying" notes in the text response. Only output the actual words you are speaking to the user.`;

    const appBrief = readMedivaVoiceBrief();
    const systemInstruction = appBrief
      ? `${baseMedivaInstruction}\n\n---\nPATIENT CONTEXT (from the Mediva app — unified profile, wearables, and monitoring). Use this naturally; do not read it aloud verbatim. Reference trends and history when the user mentions mood, low energy, stress, or vague symptoms, and ask focused follow-up questions.\n\n${appBrief}\n---`
      : baseMedivaInstruction;

    try {
      const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: settings.voice } },
        },
        systemInstruction,
        outputAudioTranscription: {},
        inputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          liveOpenRef.current = true;
          if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
          
          setConnectingStage('Connecting to Dr. Mediva...');
          setIsConnecting(false);
          setStatus('ready');
          if (!audioContextRef.current) {
            initializeAudio();
          }
        },
        onmessage: async (message: LiveServerMessage) => {
          // Detect user speech from transcription if available
          if ((message as any).serverContent?.inputAudioTranscription) {
            setStatus('user talks');
          }

          if (message.serverContent?.modelTurn?.parts && status !== 'ready') {
            setStatus('ready');
          }

          if (message.serverContent?.modelTurn?.parts) {
            if (isNewTurnRef.current) {
              setAiTranscript('');
              isNewTurnRef.current = false;
            }
            const audioPart = message.serverContent.modelTurn.parts.find(p => p.inlineData);
            if (audioPart?.inlineData?.data) {
              const binaryString = atob(String(audioPart.inlineData.data));
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const pcmData = new Int16Array(bytes.buffer);
              audioQueueRef.current.push(pcmData);
              playNextInQueue();
              setStatus('ai response');
            }

            // Handle transcriptions - Filter out reasoning/thinking blocks
            message.serverContent.modelTurn.parts.forEach(part => {
              if (part.text) {
                const text = part.text;
                // Heuristic: skip text that looks like reasoning (starts with * or contains **)
                if (!text.trim().startsWith('*') && !text.includes('**')) {
                  setAiTranscript(prev => (prev + text).trimStart());
                }
              }
            });
          }

          if (message.serverContent?.interrupted) {
            audioQueueRef.current = [];
            isPlayingRef.current = false;
            setStatus('user talks');
            setAiTranscript(''); // Reset on interruption
            isNewTurnRef.current = true;
          }

          if (message.serverContent?.turnComplete) {
            setStatus('ready');
            isNewTurnRef.current = true;
          }
        },
        onerror: (err: unknown) => {
          liveOpenRef.current = false;
          sessionRef.current = null;
          console.error('Live API error:', err);
          if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
          const msg =
            err instanceof Error
              ? err.message
              : err && typeof err === 'object' && 'message' in err
                ? String((err as { message: unknown }).message)
                : String(err);
          setConfigError((prev) => prev || `Voice connection error: ${msg}`);
          setIsConnecting(false);
        },
        onclose: () => {
          liveOpenRef.current = false;
          sessionRef.current = null;
          if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
          setIsConnecting(false);
        },
      },
    });

      sessionRef.current = await sessionPromise;
    } catch (e: unknown) {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Failed to connect Live session:', e);
      setConfigError(`Failed to start voice: ${msg}`);
      setIsConnecting(false);
      liveOpenRef.current = false;
      sessionRef.current = null;
    }
  };

  useEffect(() => {
    connectToGemini();
    return () => {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      liveOpenRef.current = false;
      sessionRef.current?.close();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(err => console.error('Error closing AudioContext:', err));
      }
      audioContextRef.current = null;
    };
  }, [settings.voice]); // Reconnect when voice changes

  const handlePlayTest = (voiceName: string) => {
    const msg = `Hey, I'm Mediva, how can I help you?`;
    const utterance = new SpeechSynthesisUtterance(msg);
    utterance.rate = settings.speed;
    // Try to find a matching system voice if possible, otherwise use default
    const voices = window.speechSynthesis.getVoices();
    if (voiceName === 'Kore') utterance.pitch = 1.2;
    if (voiceName === 'Puck') utterance.pitch = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;
  };

  const docked = settings.subtitles && !!aiTranscript && status !== 'connecting';
  const bubbleGlowClass = isMuted
    ? 'talk-bubble-wrap--muted'
    : status === 'ai response'
      ? 'talk-bubble-wrap--active'
      : status === 'connecting'
        ? 'talk-bubble-wrap--connecting'
        : 'talk-bubble-wrap--idle';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-50 flex flex-col bg-black ${embed ? 'pt-[max(0.5rem,env(safe-area-inset-top))]' : 'supports-[padding:max(0px)]:pt-[max(0.75rem,env(safe-area-inset-top))]'}`}
    >
      {/* Header — hidden in Expo WebView (embed); use device back to leave */}
      {!embed && (
        <header className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <div />
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="rounded-full p-2 transition-colors hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Settings"
          >
            <Settings className="h-6 w-6" />
          </button>
        </header>
      )}

      {embed && (
        <div className="absolute left-3 right-3 top-[max(0.5rem,env(safe-area-inset-top))] z-[55] flex items-center justify-between sm:left-4 sm:right-4">
          <div />
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="rounded-full p-2 transition-colors hover:bg-white/10 min-h-[40px] min-w-[40px] flex items-center justify-center opacity-80"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      )}

      {configError && (
        <div className="mx-4 mb-3 shrink-0 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-left sm:mx-6 sm:px-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400 sm:text-[11px]">
            Configuration
          </p>
          <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-zinc-200 sm:text-sm">
            {configError}
          </p>
        </div>
      )}

      {/* Main — stack: subtitles (scroll) + bubble (flex center) */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-3 pt-2 sm:px-5 sm:pt-4 md:px-8 md:pt-8">
        <div className="flex max-h-[min(36vh,240px)] min-h-0 shrink-0 flex-col items-center overflow-y-auto overscroll-contain sm:max-h-[min(42vh,320px)] md:max-h-none">
          <AnimatePresence mode="wait">
            {status === 'connecting' && (
              <motion.div
                key="connecting"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="w-full max-w-2xl space-y-2 px-2 text-center sm:space-y-3 sm:px-4"
                style={{
                  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                  fontWeight: 300,
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-amber-400 sm:text-[10px] sm:tracking-[0.3em]">
                  Connecting
                </p>
                <p className="text-balance text-lg leading-snug tracking-wide text-white sm:text-xl md:text-2xl">
                  {connectingStage}
                </p>
              </motion.div>
            )}
            {settings.subtitles && aiTranscript && status !== 'connecting' && (
              <motion.div
                key="transcript"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="w-full max-w-2xl space-y-2 px-2 text-center sm:space-y-3 sm:px-4"
                style={{
                  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                  fontWeight: 300,
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-emerald-500 sm:text-[10px] sm:tracking-[0.3em]">
                  Dr. Mediva Speaking
                </p>
                <p className="text-balance text-lg leading-snug tracking-wide text-white sm:text-2xl md:text-3xl lg:text-4xl">
                  {aiTranscript}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Talk bubble asset — responsive width, docked position on narrow screens, moved down */}
        <div className="relative flex min-h-[min(48vh,300px)] flex-1 items-center justify-center py-4 sm:min-h-0 sm:py-6 mt-8 sm:mt-12">
          <motion.div
            className="flex w-[min(90vw,300px)] items-center justify-center sm:w-[min(82vw,340px)] md:w-[min(72vw,400px)] lg:max-w-[440px]"
            animate={
              docked
                ? {
                    scale: isNarrow ? 0.46 : 0.4,
                    x: isNarrow ? '-6%' : '-26%',
                    y: isNarrow ? '14%' : '26%',
                  }
                : {
                    scale:
                      status === 'ai response'
                        ? [1, 1.045, 1]
                        : status === 'user talks'
                          ? [1, 1.03, 1]
                          : status === 'connecting'
                            ? [1, 1.025, 1]
                            : [1, 1.018, 1],
                    x: 0,
                    y: 0,
                  }
            }
            transition={
              docked
                ? { type: 'spring', damping: 28, stiffness: 140 }
                : {
                    duration: status === 'ai response' ? 1.65 : status === 'connecting' ? 1.8 : 2.4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }
            }
          >
            <div className={`rounded-[2rem] transition-opacity duration-300 ${bubbleGlowClass}`}>
              <img
                src={TALK_BUBBLE_URL}
                alt=""
                className="talk-bubble-art"
                width={756}
                height={724}
                decoding="async"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer — wrap on very small widths, safe area */}
      <footer className="flex w-full shrink-0 flex-row flex-wrap items-center justify-between gap-3 bg-gradient-to-t from-black to-transparent px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:justify-end sm:gap-4 sm:px-5 sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pt-4 md:gap-6 md:px-8 md:pb-8">
        {/* Connection status + visualizer */}
        <div className="flex max-w-[min(100%,20rem)] items-center space-x-2 rounded-full bg-white/5 px-3 py-2 backdrop-blur-md sm:space-x-3 sm:px-4 sm:py-2.5">
          <div
            className={`w-2 h-2 rounded-full ${
              configError
                ? 'bg-red-500'
                : status === 'connecting'
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
            }`}
          />
          <span className="hidden min-[360px]:inline text-[9px] font-bold uppercase tracking-wider text-zinc-400 sm:text-[10px] sm:tracking-widest">
            {configError 
              ? 'No API key' 
              : isConnecting 
                ? connectingStage 
                : status === 'ready' 
                  ? 'Say something' 
                  : 'Listening'}
          </span>
          
          {/* Visualizer Bars */}
          <div className="flex space-x-1 ml-2">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                animate={{
                  height: 
                    status === 'ai response' 
                      ? [8, 16, 8] 
                      : status === 'connecting'
                        ? [6, 10, 6]
                        : 8,
                  opacity:
                    status === 'connecting'
                      ? [0.4, 1, 0.4]
                      : 1,
                }}
                transition={{
                  repeat: Infinity,
                  duration: status === 'connecting' ? 1 : 0.5,
                  delay: i * 0.1,
                }}
                className="w-0.5 bg-white/40 rounded-full"
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {isMuted && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-red-500 sm:text-[10px] sm:tracking-widest">
              Muted
            </span>
          )}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            className={`min-h-[52px] min-w-[52px] rounded-full p-4 shadow-2xl transition-all sm:min-h-0 sm:min-w-0 sm:p-5 ${isMuted ? 'scale-95 bg-red-500 text-white sm:scale-90' : 'bg-white text-black active:scale-95 sm:hover:scale-110'}`}
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </button>
        </div>
      </footer>

      {/* Settings Bottom Sheet */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-[70] max-h-[min(92dvh,640px)] space-y-6 overflow-y-auto rounded-t-[24px] bg-zinc-900 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:space-y-8 sm:rounded-t-[32px] sm:p-8"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-medium">Settings</h3>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/5 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Speed Slider */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-400 uppercase tracking-wider font-medium">Voice Speed</p>
                  <span className="text-sm font-medium">{settings.speed}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={settings.speed}
                  onChange={(e) => setSettings({ ...settings, speed: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>

              {/* Subtitles Toggle */}
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                <div className="flex items-center space-x-3">
                  <Volume2 className="w-5 h-5 text-zinc-400" />
                  <span className="font-medium">Subtitles</span>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, subtitles: !settings.subtitles })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings.subtitles ? 'bg-white' : 'bg-zinc-700'}`}
                >
                  <motion.div
                    animate={{ x: settings.subtitles ? 24 : 4 }}
                    className={`absolute top-1 w-4 h-4 rounded-full ${settings.subtitles ? 'bg-black' : 'bg-zinc-400'}`}
                  />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
