import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreenModule from 'expo-splash-screen';
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useAuthStore } from './src/store/authStore';

/* ─── Screens ─── */
import CustomSplash from './src/screens/SplashScreen';
import AuthPhoneScreen from './src/screens/AuthPhoneScreen';
import ChatScreen from './src/screens/ChatScreen';
import ChatHistoryScreen from './src/screens/ChatHistoryScreen';
import DiscoverScreen from './src/screens/DiscoverScreen';
import MenuScreen from './src/screens/MenuScreen';
import VoiceWebScreen from './src/screens/VoiceWebScreen';
import RecordsScreen from './src/screens/RecordsScreen';
import DevicesScreen from './src/screens/DevicesScreen';
import ABHAScreen from './src/screens/ABHAScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import HealthHistoryScreen from './src/screens/HealthHistoryScreen';
import LocationComplianceScreen from './src/screens/LocationComplianceScreen';

const logoImg = require('./assets/applogo1.png');

SplashScreenModule.preventAutoHideAsync().catch(() => {});

/* ─── Navigation stack ─── */
type Screen =
  | 'chat'
  | 'history'
  | 'discover'
  | 'menu'
  | 'voice-agent'
  | 'records'
  | 'devices'
  | 'abha'
  | 'settings'
  | 'health-history';

export default function App() {
  const [screen, setScreen] = useState<Screen>('chat');
  const [initialArticleId, setInitialArticleId] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const { isAuthenticated, isLoading, loadStoredAuth, setUser, user, logout } = useAuthStore();
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const getAuthUser = () => useAuthStore.getState().user;

  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    loadStoredAuth();
  }, []);

  /* Load user profile when auth is restored from stored tokens */
  const fetchUserProfile = useCallback(() => {
    setProfileLoadError(null);
    import('./src/services/auth').then(({ default: authService }) => {
      authService
        .getProfile()
        .then((profile) => setUser(profile))
        .catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : 'Could not load your profile.';
          setProfileLoadError(
            `${message}\n\nCheck: backend running, same Wi‑Fi, and EXPO_PUBLIC_API_URL in .env matches your PC’s LAN IP (with /api).`,
          );
          if (__DEV__) {
            console.warn('[Auth] getProfile failed — stuck without user object:', err);
          }
        });
    });
  }, [setUser]);

  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchUserProfile();
    }
  }, [isAuthenticated, user, fetchUserProfile]);

  // Track if user manually navigated to health-history (from menu) using ref to avoid timing issues
  const manualHealthHistoryNavRef = useRef(false);

  /* Health history: only auto-leave health-history screen after completion (menu-driven visits use manual ref) */
  useEffect(() => {
    if (isAuthenticated && user?.healthHistory?.completedAt && screen === 'health-history' && !manualHealthHistoryNavRef.current) {
      setScreen('chat');
    }
  }, [isAuthenticated, user?.healthHistory?.completedAt, screen]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreenModule.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  /* ─── Deep Linking ─── */
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const parsed = Linking.parse(event.url);
      if (parsed.path === 'discover' || (parsed.path && parsed.path.includes('discover'))) {
        const id = parsed.queryParams?.id || parsed.path?.split('/').pop();
        if (id) {
          setInitialArticleId(Array.isArray(id) ? id[0] : id);
          setScreen('discover');
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    Linking.getInitialURL().then((url: string | null) => {
      if (url) handleDeepLink({ url });
    });

    return () => subscription.remove();
  }, []);

  /* ─── Splash ─── */
  if (showSplash && fontsLoaded) {
    return (
      <>
        <StatusBar style="light" />
        <CustomSplash onFinish={() => setShowSplash(false)} />
      </>
    );
  }

  /* ─── Loading ─── */
  if (!fontsLoaded || isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar style="light" />
        <Image source={logoImg} style={styles.loadingLogo} resizeMode="contain" />
        <ActivityIndicator size="large" color="#111" style={{ marginTop: 20 }} />
        <Text style={styles.loadingText}>Loading Mediva...</Text>
      </SafeAreaView>
    );
  }

  /* ─── Auth ─── */
  if (!isAuthenticated) {
    return (
      <AuthPhoneScreen
        onLoginSuccess={() => {
          import('./src/store/chatStore').then(({ useChatStore }) => {
            useChatStore.getState().clearChat();
          });
          // Do not jump to chat here — onboarding order is: location → health history → chat (see gates below).
        }}
      />
    );
  }

  /* Authenticated but profile not hydrated yet (token set before getProfile) — avoid flashing chat */
  if (isAuthenticated && !user) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar style="light" />
        <Image source={logoImg} style={styles.loadingLogo} resizeMode="contain" />
        {profileLoadError ? (
          <>
            <Text style={styles.profileErrorTitle}>Couldn&apos;t connect</Text>
            <Text style={styles.profileErrorText}>{profileLoadError}</Text>
            <TouchableOpacity style={styles.profileRetryBtn} onPress={fetchUserProfile}>
              <Text style={styles.profileRetryBtnText}>Try again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileSignOutBtn}
              onPress={() => {
                setProfileLoadError(null);
                logout();
              }}
            >
              <Text style={styles.profileSignOutBtnText}>Sign out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color="#111" style={{ marginTop: 20 }} />
            <Text style={styles.loadingText}>Setting up your account...</Text>
            <Text style={styles.loadingHint}>Loading your profile from the server…</Text>
          </>
        )}
      </SafeAreaView>
    );
  }

  /* Mandatory onboarding: location first, then health history, then main app */
  if (isAuthenticated && user && user.locationConsent !== true) {
    return (
      <LocationComplianceScreen
        onComplete={() => {
          const u = getAuthUser();
          if (!u?.healthHistory?.completedAt) {
            setScreen('health-history');
          } else {
            setScreen('chat');
          }
        }}
      />
    );
  }

  if (isAuthenticated && user && user.locationConsent === true && !user.healthHistory?.completedAt) {
    return (
      <HealthHistoryScreen
        onBack={() => {
          Alert.alert(
            'Health history required',
            'Please complete your health history to use Mediva. This helps us keep you safe.',
            [{ text: 'OK' }],
          );
        }}
        onComplete={() => {
          manualHealthHistoryNavRef.current = false;
          import('./src/store/chatStore').then(({ useChatStore }) => {
            useChatStore.getState().clearChat();
          });
          setScreen('chat');
        }}
        showSkip={false}
      />
    );
  }

  /* ─── Voice bot closes — messages already synced via chatStore ─── */
  const handleVoiceClose = () => setScreen('chat');

  /* ─── Navigate ─── */
  const navigate = (s: Screen | string) => setScreen(s as Screen);
  const goBack = () => setScreen('chat');

  /* ─── Render current screen ─── */
  const renderScreen = () => {
    switch (screen) {
      case 'chat':
        return <ChatScreen onNavigate={navigate as any} />;
      case 'history':
        return <ChatHistoryScreen onBack={goBack} onNavigateMenu={() => setScreen('menu')} />;
      case 'discover':
        return (
          <DiscoverScreen 
            onBack={() => {
              setInitialArticleId(null);
              goBack();
            }} 
            initialArticleId={initialArticleId} 
          />
        );
      case 'menu':
        return (
          <MenuScreen
            onBack={goBack}
            onNavigateRecords={() => setScreen('records')}
            onNavigateDevices={() => setScreen('devices')}
            onNavigateABHA={() => setScreen('abha')}
            onNavigateHealthHistory={() => {
              manualHealthHistoryNavRef.current = true;
              setScreen('health-history');
            }}
          />
        );
      case 'voice-agent':
        return <VoiceWebScreen onClose={handleVoiceClose} />;
      case 'records':
        return <RecordsScreen onBack={() => setScreen('menu')} />;
      case 'devices':
        return <DevicesScreen onBack={() => setScreen('menu')} />;
      case 'settings':
        return (
          <SettingsScreen
            onBack={() => setScreen('menu')}
            onNavigateHealthHistory={() => {
              manualHealthHistoryNavRef.current = true;
              setScreen('health-history');
            }}
          />
        );
      case 'health-history':
        return (
          <HealthHistoryScreen
            onBack={() => {
              manualHealthHistoryNavRef.current = false;
              setScreen('menu');
            }}
            onComplete={() => {
              manualHealthHistoryNavRef.current = false;
              // Clear chat to ensure the first conversation 
              // accounts for the new health history data immediately
              import('./src/store/chatStore').then(({ useChatStore }) => {
                useChatStore.getState().clearChat();
              });
              setScreen('chat');
            }}
            showSkip={!user?.healthHistory?.completedAt}
          />
        );
      case 'abha':
        return (
          <View style={{ flex: 1 }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingTop: Platform.OS === 'ios' ? 56 : 40,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#F0F0F0',
              backgroundColor: '#000000',
            }}>
              <TouchableOpacity
                onPress={() => setScreen('menu')}
                style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 20, color: '#FFFFFF' }}>←</Text>
              </TouchableOpacity>
              <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue' }}>ABHA</Text>
              <View style={{ width: 36 }} />
            </View>
            <ABHAScreen />
          </View>
        );
      default:
        return <ChatScreen onNavigate={navigate as any} />;
    }
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="light" />
        {renderScreen()}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingLogo: {
    width: 100,
    height: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#999',
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  loadingHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#CCC',
    fontFamily: 'SpaceGrotesk_400Regular',
    paddingHorizontal: 32,
    textAlign: 'center',
  },
  profileErrorTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  profileErrorText: {
    marginTop: 12,
    fontSize: 13,
    color: '#666',
    fontFamily: 'SpaceGrotesk_400Regular',
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  profileRetryBtn: {
    marginTop: 24,
    backgroundColor: '#111',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  profileRetryBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  profileSignOutBtn: {
    marginTop: 12,
    paddingVertical: 12,
  },
  profileSignOutBtnText: {
    color: '#999',
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
});
