import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ButtonBg from '../../assets/button.svg';

const logoImg = require('../../assets/applogo.png');

interface TermsScreenProps {
  type: 'terms' | 'privacy';
  onClose: () => void;
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

export default function TermsScreen({ type, onClose }: TermsScreenProps) {
  const isTerms = type === 'terms';

  return (
    <ImageBackground
      source={require('../../assets/background.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(0,0,0,0.82)', 'rgba(0,0,0,0.65)', 'rgba(0,0,0,0.82)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <ButtonBg
              width="100%"
              height="100%"
              style={StyleSheet.absoluteFill}
              preserveAspectRatio="xMidYMid slice"
              pointerEvents="none"
            />
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isTerms ? 'Terms of Use' : 'Privacy Policy'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Branding */}
          <View style={styles.branding}>
            <Image source={logoImg} style={styles.logoFallback} resizeMode="contain" />
            <Text style={styles.brandName}>Mediva</Text>
            <Text style={styles.brandTagline}>
              World-class Health , Absolutely free.
            </Text>
          </View>

          {isTerms ? <TermsContent /> : <PrivacyContent />}

          <Text style={styles.footer}>
            © {new Date().getFullYear()} Mediva Health Technologies. All rights
            reserved.
          </Text>
        </ScrollView>
      </LinearGradient>
    </ImageBackground>
  );
}

/* ─── Terms Content ─── */
function TermsContent() {
  return (
    <>
      <Text style={styles.updated}>Last updated: February 2026</Text>

      <Section title="1. Acceptance of Terms">
        By accessing or using the Mediva application ("Service"), you agree to be
        bound by these Terms of Use. If you do not agree, please do not use the
        Service.
      </Section>

      <Section title="2. Description of Service">
        Mediva is a health companion that provides health insights,
        connects wearable devices, and offers doctor-verified medical
        information. The Service is provided free of charge.
      </Section>

      <Section title="3. Eligibility">
        You must be at least 18 years old to use this Service. By using Mediva,
        you represent that you meet this requirement.
      </Section>

      <Section title="4. User Accounts">
        You are responsible for maintaining the confidentiality of your account
        credentials. You agree to notify us immediately of any unauthorized use
        of your account.
      </Section>

      <Section title="5. Health Information Disclaimer">
        Mediva provides health insights that are reviewed by
        qualified medical doctors. However, this information is for educational
        purposes only and should not replace professional medical advice,
        diagnosis, or treatment. Always consult your healthcare provider for
        medical decisions.
      </Section>

      <Section title="6. Data Collection & Privacy">
        Your use of the Service is also governed by our Privacy Policy. By using
        Mediva, you consent to the collection and use of information as described
        therein.
      </Section>

      <Section title="7. Intellectual Property">
        All content, trademarks, and intellectual property in the Service are
        owned by Mediva Health Technologies. You may not reproduce, modify, or
        distribute any part of the Service without our express permission.
      </Section>

      <Section title="8. Prohibited Conduct">
        You agree not to: misuse the Service; attempt to gain unauthorized
        access; transmit harmful content; or use the Service for unlawful
        purposes.
      </Section>

      <Section title="9. Limitation of Liability">
        To the fullest extent permitted by law, Mediva shall not be liable for
        any indirect, incidental, or consequential damages arising from your use
        of the Service.
      </Section>

      <Section title="10. Changes to Terms">
        We reserve the right to modify these Terms at any time. Continued use of
        the Service after changes constitutes acceptance of the updated Terms.
      </Section>

      <Section title="11. Contact Us">
        If you have questions about these Terms, contact us at
        support@mediva.com.
      </Section>
    </>
  );
}

/* ─── Privacy Content ─── */
function PrivacyContent() {
  return (
    <>
      <Text style={styles.updated}>Last updated: February 2026</Text>

      <Section title="1. Information We Collect">
        We collect information you provide directly (name, email, phone number)
        and data from connected health devices (heart rate, steps, sleep, etc.)
        with your explicit consent.
      </Section>

      <Section title="2. How We Use Your Information">
        Your data is used to: provide personalized health insights; enable
        AI-powered health analysis; allow doctor review of flagged cases; improve
        our services; and comply with legal obligations.
      </Section>

      <Section title="3. Data Protection">
        We use industry-standard encryption (AES-256, TLS 1.3) to protect your
        data in transit and at rest. Your health data is stored securely in
        compliance with applicable regulations.
      </Section>

      <Section title="4. Data Sharing">
        We do not sell your personal data. We may share data with: doctors on
        our platform (with your consent); service providers who assist us; or
        when required by law.
      </Section>

      <Section title="5. Your Rights">
        You have the right to: access your data; correct inaccuracies; delete
        your account and data; export your data; and withdraw consent at any
        time.
      </Section>

      <Section title="6. Cookies & Tracking">
        We use minimal analytics to improve the app experience. No third-party
        advertising trackers are used.
      </Section>

      <Section title="7. DPDP Act Compliance">
        Mediva complies with India's Digital Personal Data Protection Act, 2023.
        We process your data only for lawful purposes with your consent.
      </Section>

      <Section title="8. Data Retention">
        We retain your data for as long as your account is active. Upon account
        deletion, all personal data is permanently removed within 30 days.
      </Section>

      <Section title="9. Children's Privacy">
        Our Service is not directed to individuals under 18. We do not
        knowingly collect data from minors.
      </Section>

      <Section title="10. Changes to This Policy">
        We may update this Privacy Policy periodically. We will notify you of
        significant changes via email or in-app notification.
      </Section>

      <Section title="11. Contact Us">
        For privacy-related inquiries, contact us at privacy@mediva.com.
      </Section>
    </>
  );
}

/* ─── Reusable section ─── */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

/* ─── Styles ─── */
const styles = StyleSheet.create({
  background: { flex: 1 },
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 34,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFF',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  closeTxt: { fontSize: 18, color: '#fff' },
  headerTitle: {
    fontSize: 18,
    fontWeight: '400',
    color: '#fff',
    fontFamily: HELVETICA_NEUE_REGULAR,
  },
  body: { flex: 1 },
  bodyContent: { padding: 24, paddingBottom: 60 },
  branding: { alignItems: 'center', marginBottom: 28 },
  logoFallback: { width: 64, height: 64, borderRadius: 12, marginBottom: 10 },
  brandName: {
    fontSize: 28,
    fontWeight: '300',
    color: '#fff',
    fontFamily: HELVETICA_NEUE_LIGHT,
  },
  brandTagline: {
    fontSize: 13,
    color: '#CBD5E1',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
  },
  updated: {
    fontSize: 12,
    color: '#CBD5E1',
    marginBottom: 20,
    fontStyle: 'italic',
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
  },
  section: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(2,12,29,0.45)',
    borderRadius: 14,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#fff',
    marginBottom: 6,
    fontFamily: HELVETICA_NEUE_REGULAR,
  },
  sectionBody: {
    fontSize: 14,
    color: '#E2E8F0',
    lineHeight: 22,
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
  },
  footer: {
    fontSize: 12,
    color: '#CBD5E1',
    textAlign: 'center',
    marginTop: 28,
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
  },
});
