import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ButtonBg from '../../assets/button.svg';
import TalkBubble from '../../assets/Talk bubble.svg';
import OutlineLogo from '../../assets/outlinelogo.svg';
import authService from '../services/auth';
import { useAuthStore } from '../store/authStore';
import TermsScreen from './TermsScreen';

type AuthStep = 'intro' | 'phone' | 'otp' | 'profile';
type LegalModal = 'terms' | 'privacy' | null;

interface AuthPhoneScreenProps {
  onLoginSuccess: () => void;
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AuthPhoneScreen({ onLoginSuccess }: AuthPhoneScreenProps) {
  const { setTokens, setUser } = useAuthStore();

  const [legalModal, setLegalModal] = useState<LegalModal>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [step, setStep] = useState<AuthStep>('intro');
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const normalizedPhone = useMemo(() => phone.replace(/\D/g, '').slice(0, 10), [phone]);
  const isPhoneValid = normalizedPhone.length === 10;
  const isOtpValid = otp.trim().length === 6;
  const isNameValid = name.trim().length >= 2;
  const isEmailValid = !email.trim() || email.includes('@');
  const isDobValid = !dob.trim() || /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(dob.trim());

  const goBackTo = (target: AuthStep) => {
    Keyboard.dismiss();
    setStep(target);
  };

  // Swipe gesture for going back
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dx > 20 || gestureState.dx < -20;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 50) {
          // Swipe right - go back
          goBackTo('intro');
        }
      },
    })
  ).current;

  if (legalModal) {
    return <TermsScreen type={legalModal} onClose={() => setLegalModal(null)} />;
  }

  const sendOtp = async () => {
    if (resendCountdown > 0) {
      Alert.alert('Please wait', `You can resend OTP in ${resendCountdown}s`);
      return;
    }
    if (!termsAccepted) {
      Alert.alert('Terms required', 'Please accept Terms of Use and Privacy Policy to continue.');
      return;
    }
    if (!isPhoneValid) {
      Alert.alert('Invalid phone number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      await authService.sendOtp(normalizedPhone);
      setStep('otp');
      setResendCountdown(30);
      Alert.alert('OTP sent', `We sent a verification code to +91 ${normalizedPhone}.`);
    } catch (err: any) {
      Alert.alert('Failed to send OTP', err.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const verifyOtp = async () => {
    if (!isOtpValid) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP.');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.verifyOtp(normalizedPhone, otp.trim());
      await setTokens(result.accessToken, result.refreshToken);
      const profile = await authService.getProfile();
      setUser(profile);

      // If name is missing or it's a new user, always show profile completion
      if (result.isNewUser || !profile.name || profile.name.trim().length < 2) {
        setName(profile.name || '');
        setEmail(profile.email || '');
        setDob(profile.dob || profile.healthHistory?.dob || '');
        setStep('profile');
      } else {
        onLoginSuccess();
      }
    } catch (err: any) {
      Alert.alert('OTP verification failed', err.message || 'Please check OTP and try again.');
    } finally {
      setLoading(false);
    }
  };

  const saveProfileAndContinue = async () => {
    if (!isNameValid) {
      Alert.alert('Name required', 'Please enter your full name.');
      return;
    }
    if (!isEmailValid) {
      Alert.alert('Invalid email', 'Please enter a valid email address with @ symbol.');
      return;
    }
    if (!isDobValid) {
      Alert.alert('Invalid Date of Birth', 'Please use the format DD/MM/YYYY (e.g. 25/12/1990)');
      return;
    }

    setLoading(true);
    try {
      await authService.updateProfile({
        name: name.trim(),
        email: email.trim() || undefined,
        dob: dob.trim() || undefined,
      });
      const profile = await authService.getProfile();
      setUser(profile);
      onLoginSuccess();
    } catch (err: any) {
      Alert.alert('Profile update failed', err.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/background.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.55)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.overlay}
      >
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {step === 'intro' && (
            <View style={styles.fullScreenStep}>
              <View style={styles.introContentSection}>
                <View style={styles.talkBubbleWrap}>
                  <TalkBubble width={740} height={420} />
                </View>

                <View style={styles.introTextWrap}>
                  <Text style={styles.introTitle}>Get medical advice,</Text>
                  <Text style={styles.introTitleSecondary}>labs & prescriptions</Text>
                  <Text style={styles.introDesc}>Anytime. Free. No insurance billing.</Text>
                </View>

                <TouchableOpacity
                  style={styles.introLoginBtn}
                  onPress={() => setStep('phone')}
                  activeOpacity={0.85}
                >
                  <ButtonBg
                    width="100%"
                    height="100%"
                    style={StyleSheet.absoluteFill}
                    preserveAspectRatio="xMidYMid slice"
                    pointerEvents="none"
                  />
                  <Text style={styles.introLoginBtnTxt}>Continue</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 'phone' && (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View style={styles.fullScreenStep} {...panResponder.panHandlers}>
                <View style={styles.phoneContentSection}>
                  <View style={styles.phoneTopLogoWrap}>
                    <OutlineLogo width={440} height={440} />
                  </View>
                  <View style={styles.phoneTextWrap}>
                    <Text style={[styles.mainTitle, styles.phoneMainTitleRegular]}>Enter your number</Text>
                    <Text style={[styles.subTitle, styles.phoneSubTitleLight]}>We'll send a 6-digit code to verify you.</Text>
                  </View>

                  <View style={styles.phoneBox}>
                    <Text style={styles.phonePrefix}>+91</Text>
                    <TextInput
                      style={[styles.phoneField, styles.phoneFieldLight]}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="number-pad"
                      maxLength={10}
                      placeholder="Phone Number"
                      placeholderTextColor="#FFFFFF"
                      autoFocus
                    />
                  </View>

                  <View style={styles.consentWrap}>
                    <TouchableOpacity style={styles.agreeRow} onPress={() => setTermsAccepted((v) => !v)} activeOpacity={0.8}>
                      <View style={[styles.agreeBox, termsAccepted && styles.agreeBoxChecked]}>
                        {termsAccepted ? <Ionicons name="checkmark" size={14} color="#02101f" /> : null}
                      </View>
                      <Text style={styles.agreeText}>
                        I agree to Mediva's{' '}
                        <Text style={styles.agreeLink} onPress={() => setLegalModal('terms')}>Terms</Text> &{' '}
                        <Text style={styles.agreeLink} onPress={() => setLegalModal('privacy')}>Privacy</Text>
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.loginRow}>
                      <TouchableOpacity 
                        style={styles.smallBackBtn}
                        onPress={() => goBackTo('intro')}
                        activeOpacity={1}
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
                        style={[styles.loginBtnFlex, (!isPhoneValid || !termsAccepted) && styles.btnDisabled]}
                        onPress={sendOtp}
                        disabled={loading || !isPhoneValid || !termsAccepted}
                        activeOpacity={0.85}
                      >
                        <ButtonBg
                          width="100%"
                          height="100%"
                          style={StyleSheet.absoluteFill}
                          preserveAspectRatio="xMidYMid slice"
                          pointerEvents="none"
                        />
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.actionBtnTxt, styles.phoneSendCodeTxtLight]}>Send Code</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          )}

          {step === 'otp' && (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View style={styles.fullScreenStep}>
                <View style={styles.contentSection}>
                  <View style={styles.otpTopLogoWrap}>
                    <OutlineLogo width={440} height={440} />
                  </View>
                  <View style={styles.textWrap}>
                    <Text style={[styles.mainTitle, styles.otpTitleRegular]}>Enter OTP</Text>
                    <Text style={[styles.subTitle, styles.otpSubTitleLight]}>Code sent to +91 {normalizedPhone}</Text>
                  </View>

                  <TextInput
                    style={[styles.otpInput, styles.otpInputLight]}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="6-digit OTP"
                    placeholderTextColor="#FFFFFF"
                    autoFocus
                  />

                  <View style={styles.loginRow}>
                    <TouchableOpacity 
                      style={styles.smallBackBtn}
                      onPress={() => goBackTo('phone')}
                      activeOpacity={1}
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
                      style={[styles.loginBtnFlex, !isOtpValid && styles.btnDisabled]}
                      onPress={verifyOtp}
                      disabled={loading || !isOtpValid}
                      activeOpacity={0.85}
                    >
                      <ButtonBg
                        width="100%"
                        height="100%"
                        style={StyleSheet.absoluteFill}
                        preserveAspectRatio="xMidYMid slice"
                        pointerEvents="none"
                      />
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.actionBtnTxt, styles.otpActionBtnTxt]}>Verify & Login</Text>}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.resendBtn} onPress={sendOtp} disabled={loading || resendCountdown > 0}>
                    <Text style={[styles.resendTxt, styles.otpResendTxtLight]}>
                      Didn't receive code?{' '}
                      <Text style={[styles.resendLink, styles.otpResendLinkRegular]}>
                        {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend'}
                      </Text>
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          )}

          {step === 'profile' && (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View style={styles.fullScreenStep}>
                <View style={styles.contentSection}>
                  <View style={styles.textWrap}>
                    <Text style={styles.mainTitle}>Complete Profile</Text>
                    <Text style={styles.subTitle}>Tell us who you are.</Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Your Name</Text>
                    <TextInput
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                      placeholder="Enter full name"
                      placeholderTextColor="#CBD5E1"
                    />

                    <Text style={styles.label}>Date of Birth</Text>
                    <TextInput
                      style={styles.input}
                      value={dob}
                      onChangeText={setDob}
                      placeholder="DD/MM/YYYY"
                      placeholderTextColor="#CBD5E1"
                    />

                    <Text style={styles.label}>Email (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholder="you@example.com"
                      placeholderTextColor="#CBD5E1"
                    />
                  </View>

                  <View style={styles.loginRow}>
                    <TouchableOpacity 
                      style={styles.smallBackBtn}
                      onPress={() => goBackTo('phone')}
                      activeOpacity={1}
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
                      style={[styles.loginBtnFlex, (!isNameValid || !isEmailValid) && styles.btnDisabled]}
                      onPress={saveProfileAndContinue}
                      disabled={loading || !isNameValid || !isEmailValid}
                      activeOpacity={0.85}
                    >
                      <ButtonBg
                        width="100%"
                        height="100%"
                        style={StyleSheet.absoluteFill}
                        preserveAspectRatio="xMidYMid slice"
                        pointerEvents="none"
                      />
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnTxt}>Finish Setup</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          )}
        </KeyboardAvoidingView>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1 },
  scroll: {
    paddingBottom: 20,
  },
  paddingContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  fullScreenStep: {
    flex: 1,
  },
  headerImageWrapper: {
    height: 200,
    width: SCREEN_WIDTH,
    position: 'relative',
    overflow: 'hidden',
  },
  headerImage: {
    width: SCREEN_WIDTH,
    height: 200,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  headerFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 130,
  },
  contentSection: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    paddingTop: 0,
  },
  phoneContentSection: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    paddingTop: 0,
  },
  phoneTopLogoWrap: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: -60,
  },
  textWrap: {
    marginBottom: 24,
    paddingTop: 0,
  },
  phoneTextWrap: {
    marginBottom: 18,
    paddingTop: 0,
  },
  introContentSection: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    paddingTop: 0,
  },
  talkBubbleWrap: {
    position: 'absolute',
    top: -40,
    right: -270,
    alignItems: 'flex-end',
  },
  introTextWrap: {
    marginBottom: 18,
    paddingTop: 0,
  },
  otpTopLogoWrap: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: -60,
  },
  mainTitle: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 34,
    fontFamily: MED_FONT_BOLD,
  },
  phoneMainTitleRegular: {
    fontFamily: HELVETICA_NEUE_REGULAR,
    fontWeight: '400',
  },
  phoneSubTitleLight: {
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
  },
  subTitle: {
    color: '#CBD5E1',
    fontSize: 14,
    marginTop: 8,
    fontFamily: MED_FONT_REGULAR,
  },
  phoneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(2,12,29,0.4)',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  phonePrefix: {
    color: '#fff',
    fontSize: 16,
    fontFamily: MED_FONT_BOLD,
    marginRight: 12,
  },
  phoneField: {
    flex: 1,
    height: 52,
    color: '#fff',
    fontSize: 16,
    fontFamily: MED_FONT_REGULAR,
  },
  phoneFieldLight: {
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
  },
  otpInput: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(2,12,29,0.4)',
    color: '#fff',
    fontSize: 22,
    fontFamily: MED_FONT_BOLD,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 24,
  },
  resendBtn: {
    marginTop: 24,
    alignItems: 'center',
  },
  resendTxt: {
    color: '#CBD5E1',
    fontSize: 14,
    fontFamily: MED_FONT_REGULAR,
  },
  resendLink: {
    color: '#fff',
    fontFamily: MED_FONT_BOLD,
    textDecorationLine: 'underline',
  },
  consentWrap: {
    marginTop: 10,
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  agreeBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  agreeBoxChecked: {
    backgroundColor: '#fff',
  },
  agreeText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 14,
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
  },
  agreeLink: {
    color: '#fff',
    textDecorationLine: 'underline',
    fontFamily: HELVETICA_NEUE_REGULAR,
    fontWeight: '400',
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
    fontFamily: MED_FONT_BOLD,
  },
  phoneSendCodeTxtLight: {
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
  },
  otpTitleRegular: {
    fontFamily: HELVETICA_NEUE_REGULAR,
    fontWeight: '400',
  },
  otpSubTitleLight: {
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
  },
  otpInputLight: {
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
  },
  otpActionBtnTxt: {
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
  },
  otpResendTxtLight: {
    fontFamily: HELVETICA_NEUE_REGULAR,
    fontWeight: '400',
  },
  otpResendLinkRegular: {
    fontFamily: HELVETICA_NEUE_REGULAR,
    fontWeight: '400',
  },
  introTitle: {
    color: '#fff',
    fontSize: 36,
    lineHeight: 42,
    marginTop: 2,
    fontFamily: HELVETICA_NEUE_REGULAR,
    fontWeight: '400',
  },
  introTitleSecondary: {
    color: '#DBEAFE',
    fontSize: 32,
    lineHeight: 38,
    marginTop: 2,
    fontFamily: HELVETICA_NEUE_REGULAR,
    fontWeight: '400',
  },
  introDesc: {
    color: '#CBD5E1',
    marginTop: 6,
    lineHeight: 18,
    fontSize: 12,
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
    marginBottom: 16,
  },
  introLoginBtn: {
    marginTop: 0,
    width: '100%',
    maxWidth: 390,
    alignSelf: 'center',
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#60A5FA',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
    overflow: 'hidden', // ensures the svg stays inside rounded corners
  },
  introLoginBtnTxt: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
  },
  photoMosaic: {
    marginTop: 4,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  mosaicColLarge: {
    width: 110,
  },
  mosaicColMid: {
    width: 108,
    gap: 8,
  },
  mosaicLarge: {
    height: 140,
    borderRadius: 14,
    resizeMode: 'cover',
  },
  mosaicMidTop: {
    height: 82,
    borderRadius: 14,
    resizeMode: 'cover',
  },
  mosaicMidBottom: {
    height: 50,
    borderRadius: 14,
    resizeMode: 'cover',
  },
  loginHeroTitle: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 34,
    fontFamily: MED_FONT_BOLD,
    marginTop: 12,
  },
  loginHeroSubtitle: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 6,
    fontFamily: MED_FONT_REGULAR,
    marginBottom: 14,
  },
  phoneShell: {
    marginTop: 2,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1.3,
    borderColor: 'rgba(148,163,184,0.55)',
    backgroundColor: 'rgba(2,12,29,0.52)',
    paddingHorizontal: 10,
    height: 48,
  },
  inputGroup: {
    marginBottom: 20,
    gap: 2,
  },
  label: {
    color: '#fff',
    fontSize: 13,
    marginTop: 10,
    marginBottom: 6,
    fontFamily: MED_FONT_BOLD,
  },
  muted: {
    color: '#CBD5E1',
    fontSize: 12,
    marginBottom: 8,
    fontFamily: MED_FONT_REGULAR,
  },
  codeBadge: {
    height: 44,
    minWidth: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2,12,29,0.45)',
  },
  codeTxt: {
    color: '#fff',
    fontSize: 14,
    fontFamily: MED_FONT_BOLD,
  },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.45)',
    backgroundColor: 'rgba(2,12,29,0.45)',
    color: '#fff',
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: MED_FONT_REGULAR,
  },
  primaryBtn: {
    marginTop: 14,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnTxt: {
    color: '#02101f',
    fontSize: 15,
    fontFamily: MED_FONT_BOLD,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  linkBtn: {
    marginTop: 10,
    alignItems: 'center',
  },
  linkTxt: {
    color: '#fff',
    textDecorationLine: 'underline',
    fontSize: 13,
    fontFamily: MED_FONT_REGULAR,
  },
  consentHeading: {
    color: '#E2E8F0',
    marginBottom: 8,
    fontSize: 12,
    fontFamily: MED_FONT_BOLD,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#fff',
  },
  termsText: {
    flex: 1,
    color: '#E2E8F0',
    lineHeight: 18,
    fontSize: 12,
    fontFamily: MED_FONT_REGULAR,
  },
  termsLink: {
    color: '#fff',
    textDecorationLine: 'underline',
    fontFamily: MED_FONT_BOLD,
  },
  loginBottomBtn: {
    marginTop: 12,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBottomBtnTxt: {
    color: '#111827',
    fontSize: 15,
    fontFamily: MED_FONT_BOLD,
  },
});

