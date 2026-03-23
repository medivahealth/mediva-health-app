import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Platform,
  BackHandler,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { isNgrokUrl, ngrokClientHeaders } from '../utils/ngrok';
import api from '../services/api';

function resolveVoiceWebUrl(): string {
  const fromEnv =
    process.env.EXPO_PUBLIC_VOICE_WEB_URL ||
    (Constants.expoConfig?.extra as { voiceWebUrl?: string } | undefined)?.voiceWebUrl;
  return String(fromEnv || '').trim().replace(/\/$/, '');
}

/** Web app skips Talk landing and hides chrome when embed=1 */
function voiceUrlWithEmbed(uri: string): string {
  try {
    const u = new URL(uri);
    u.searchParams.set('embed', '1');
    return u.toString();
  } catch {
    const sep = uri.includes('?') ? '&' : '?';
    return `${uri}${sep}embed=1`;
  }
}

type Props = {
  onClose: () => void;
};

/**
 * Embeds the Mediva Voice web app (mediva-voice-doctor) in a WebView.
 * Set EXPO_PUBLIC_VOICE_WEB_URL in project root .env (same host as Expo can reach, often your LAN IP).
 */
export default function VoiceWebScreen({ onClose }: Props) {
  const uri = resolveVoiceWebUrl();
  const webUri = uri ? voiceUrlWithEmbed(uri) : '';
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** null = still fetching /chat/voice-brief; string = ready (may be empty) */
  const [voiceBrief, setVoiceBrief] = useState<string | null>(null);
  const webRef = useRef<WebView>(null);

  // Prime native mic permission (Android especially); WKWebView still requires https for getUserMedia on iOS.
  useEffect(() => {
    if (!uri) return;
    void requestRecordingPermissionsAsync();
  }, [uri]);

  // Load unified patient + monitoring context before WebView runs (Gemini reads window.__MEDIVA_VOICE_BRIEF__)
  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ brief: string }>('/chat/voice-brief');
        if (!cancelled) setVoiceBrief(typeof res?.brief === 'string' ? res.brief : '');
      } catch {
        if (!cancelled) setVoiceBrief('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uri]);

  // No on-screen close button — Android back returns to chat.
  useEffect(() => {
    if (!uri) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [uri, onClose]);

  const handleError = useCallback((desc: string) => {
    setLoadError(desc);
    setLoading(false);
  }, []);

  if (!uri) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.toolbar}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.toolbarTitle}>Voice</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.missingWrap}>
          <Text style={styles.missingTitle}>Voice web URL not set</Text>
          <Text style={styles.missingBody}>
            Add to your project root <Text style={styles.mono}>.env</Text>:
          </Text>
          <Text style={styles.monoBlock}>
            EXPO_PUBLIC_VOICE_WEB_URL=https://YOUR_LAN_IP:5173
          </Text>
          <Text style={styles.missingBody}>
            Run <Text style={styles.mono}>mediva-voice-doctor</Text> with{' '}
            <Text style={styles.mono}>npm run dev:https</Text> (HTTPS is required for the mic on real iOS and
            Android devices). Restart Expo after changing .env. Rebuild the dev client after native config
            changes (<Text style={styles.mono}>npx expo prebuild</Text> / <Text style={styles.mono}>expo run:*</Text>
            ).
          </Text>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <Text style={styles.backBtnText}>Back to chat</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const voiceBriefBootstrap =
    voiceBrief === null
      ? ''
      : `(function(){try{window.__MEDIVA_VOICE_BRIEF__=${JSON.stringify(voiceBrief)};}catch(e){}})();`;

  return (
    <View style={styles.safe}>
      <View style={styles.webWrap}>
        <View style={styles.floatingTopBar} pointerEvents="box-none">
          <TouchableOpacity onPress={onClose} style={styles.floatingBtn} accessibilityLabel="Close voice">
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.floatingSpacer} />
        </View>
        {voiceBrief !== null ? (
        <WebView
          ref={webRef}
          source={
            isNgrokUrl(webUri)
              ? { uri: webUri, headers: ngrokClientHeaders() }
              : { uri: webUri }
          }
          style={styles.webview}
          onLoadStart={() => {
            setLoading(true);
            setLoadError(null);
          }}
          onLoadEnd={() => setLoading(false)}
          onMessage={(e) => {
            if (e.nativeEvent.data === 'MEDIVA_VOICE_CLOSE') {
              onClose();
            }
          }}
          onHttpError={(e) => handleError(`HTTP ${e.nativeEvent.statusCode}`)}
          onError={(e) => handleError(e.nativeEvent.description || 'WebView error')}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          allowsFullscreenVideo
          setSupportMultipleWindows={false}
          {...(Platform.OS === 'android' ? { mixedContentMode: 'always' as const } : {})}
          // Mic for Gemini Live in the page (Android 13+ / iOS WebKit)
          {...(Platform.OS === 'android' ? { androidLayerType: 'hardware' as const } : {})}
          {...(Platform.OS === 'ios'
            ? {
                mediaCapturePermissionGrantType: 'grantIfSameHostElsePrompt' as const,
              }
            : {})}
          injectedJavaScriptBeforeContentLoaded={`${voiceBriefBootstrap}\n${injectedViewport}`}
        />
        ) : (
          <View style={styles.briefLoading} pointerEvents="none">
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Preparing your health context…</Text>
          </View>
        )}

        {loading && !loadError && voiceBrief !== null && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Loading voice…</Text>
          </View>
        )}

        {loadError && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorTitle}>Could not load voice page</Text>
            <Text style={styles.errorBody}>{loadError}</Text>
            <Text style={styles.errorHint}>
              Check EXPO_PUBLIC_VOICE_WEB_URL, firewall, and mediva-voice-doctor (
              <Text style={styles.mono}>npm run dev:https</Text>). Run{' '}
              <Text style={styles.mono}>npm install</Text> at the repo root (patch-package applies the WebView
              SSL dev patch for Android and iOS), then rebuild a <Text style={styles.mono}>dev client</Text> (
              <Text style={styles.mono}>npx expo run:ios</Text> / <Text style={styles.mono}>run:android</Text>
              )—not Expo Go. Or use an <Text style={styles.mono}>ngrok https</Text> URL for the voice app.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => webRef.current?.reload()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={onClose}>
              <Text style={styles.backBtnText}>Back to chat</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

/** Helps small WebViews behave like a full-width mobile viewport */
const injectedViewport = `
  (function() {
    var m = document.querySelector('meta[name="viewport"]');
    if (!m) {
      m = document.createElement('meta');
      m.name = 'viewport';
      document.head.appendChild(m);
    }
    m.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover');
  })();
  true;
`;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hintBanner: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(251, 191, 36, 0.35)',
  },
  hintBannerText: {
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: 12,
    lineHeight: 17,
  },
  webWrap: {
    flex: 1,
    backgroundColor: '#000',
  },
  floatingTopBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 10 : 8,
    left: 10,
    right: 10,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floatingBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  floatingSpacer: {
    width: 40,
    height: 40,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  briefLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 12,
    fontSize: 14,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    padding: 24,
    justifyContent: 'center',
  },
  errorTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorBody: {
    color: '#fca5a5',
    fontSize: 14,
    marginBottom: 12,
  },
  errorHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  retryText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  missingWrap: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  missingTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  missingBody: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#a7f3d0',
  },
  monoBlock: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#a7f3d0',
    fontSize: 13,
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
  },
  backBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  backBtnText: {
    color: '#93c5fd',
    fontSize: 16,
    fontWeight: '600',
  },
});
