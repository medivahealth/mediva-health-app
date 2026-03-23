import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ImageBackground,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ButtonBg from '../../assets/button.svg';
import TalkBubble from '../../assets/Talk bubble.svg';
import { requestAndResolveState } from '../services/location';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LocationComplianceScreenProps {
  onComplete: () => void;
}

const MED_FONT_REGULAR = Platform.select({
  ios: 'AvenirNext-Regular',
  android: 'sans-serif',
  default: 'System',
});

const MED_FONT_BOLD = Platform.select({
  ios: 'AvenirNext-DemiBold',
  android: 'sans-serif-medium',
  default: 'System',
});

const HELVETICA_NEUE_REGULAR = Platform.select({
  ios: 'HelveticaNeue',
  android: 'sans-serif',
  default: 'Helvetica',
});

const HELVETICA_NEUE_LIGHT = Platform.select({
  ios: 'HelveticaNeue-Light',
  android: 'sans-serif-light',
  default: 'Helvetica',
});

export default function LocationComplianceScreen({ onComplete }: LocationComplianceScreenProps) {
  const { setUser, logout } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const handleAllow = async () => {
    setLoading(true);
    try {
      const loc = await requestAndResolveState();
      if (!loc.consent) {
        Alert.alert(
          'Location required',
          'We need your location to confirm your state for clinical licensing compliance.'
        );
        return;
      }

      await api.put('/user/location', {
        consent: true,
        state: loc.state,
        country: loc.country,
        lat: loc.lat,
        lng: loc.lng,
      });

      const profile = await api.get('/user/profile');
      setUser(profile);
      onComplete();
    } catch (err: any) {
      Alert.alert('Location update failed', err.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground source={require('../../assets/background.png')} style={styles.background} resizeMode="cover">
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.55)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.overlay}
      >
        <View style={styles.fullScreenStep}>
          <View style={styles.talkBubbleWrap}>
            <TalkBubble width={740} height={420} />
          </View>
          <View style={styles.contentSection}>
            <View style={styles.textWrap}>
              <Text style={styles.mainTitle}>Enable Location Access</Text>
              <Text style={styles.subTitle}>
                Confirm your state for clinical licensing compliance.
              </Text>
              <Text style={styles.body}>
                We use your location to verify clinical licensing and comply with healthcare laws. Without this, we can't legally provide care.
              </Text>
            </View>

            <View style={styles.loginRow}>
              <TouchableOpacity
                style={styles.smallBackBtn}
                onPress={() => logout()}
                activeOpacity={0.8}
              >
                <ButtonBg
                  width="100%"
                  height="100%"
                  style={StyleSheet.absoluteFill}
                  preserveAspectRatio="xMidYMid slice"
                  pointerEvents="none"
                />
                <Ionicons name="arrow-back" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.loginBtnFlex}
                onPress={handleAllow}
                disabled={loading}
                activeOpacity={0.85}
              >
                <ButtonBg
                  width="100%"
                  height="100%"
                  style={StyleSheet.absoluteFill}
                  preserveAspectRatio="xMidYMid slice"
                  pointerEvents="none"
                />
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.actionBtnTxt}>Enable & Continue</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1 },
  fullScreenStep: {
    flex: 1,
  },
  talkBubbleWrap: {
    position: 'absolute',
    top: -40,
    right: -270,
    alignItems: 'flex-end',
  },
  headerImageWrapper: {
    height: SCREEN_HEIGHT * 0.45,
    width: SCREEN_WIDTH,
    position: 'relative',
    overflow: 'hidden',
  },
  headerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.45,
    resizeMode: 'cover',
  },
  headerFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
  },
  contentSection: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 34 : 26,
    paddingTop: 0,
  },
  textWrap: {
    marginBottom: 16,
    alignItems: 'center',
  },
  mainTitle: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 34,
    fontFamily: HELVETICA_NEUE_REGULAR,
    fontWeight: '400',
    textAlign: 'center',
  },
  subTitle: {
    color: '#DBEAFE',
    fontSize: 16,
    marginTop: 8,
    fontFamily: HELVETICA_NEUE_REGULAR,
    fontWeight: '400',
    textAlign: 'center',
  },
  body: {
    color: '#CBD5E1',
    fontSize: 14,
    marginTop: 12,
    lineHeight: 20,
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
    textAlign: 'center',
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  smallBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  loginBtnFlex: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  actionBtnTxt: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
  },
});


