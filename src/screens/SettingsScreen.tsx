import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ConsentToggle from '../components/ConsentToggle';
import TermsScreen from './TermsScreen';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import authService from '../services/auth';
import blogService from '../services/blog';
import type { ConsentStatus } from '../types';
import { COLORS, FONTS, SIZES } from '../theme';

interface SettingsScreenProps {
  onBack: () => void;
  onNavigateHealthHistory?: () => void;
}

export default function SettingsScreen({ onBack, onNavigateHealthHistory }: SettingsScreenProps) {
  const { user, setUser, logout } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [language, setLanguage] = useState(user?.preferredLanguage || 'en');
  const [consent, setConsent] = useState<ConsentStatus>({
    healthDataCollection: true, // Default ON
    aiAnalysis: true, // Default ON
    doctorSharing: true, // Default ON
    abdmAccess: true, // Default ON
  });
  const [loading, setLoading] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);

  useEffect(() => {
    if (user?.consentStatus) {
      setConsent(user.consentStatus);
    }
    loadConsent();
  }, []);

  const loadConsent = async () => {
    try {
      const c = await api.get('/user/consent');
      setConsent(c);
    } catch {}
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const updated = await authService.updateProfile({ name, email, preferredLanguage: language });
      setUser(updated);
      Alert.alert('Saved', 'Profile updated successfully');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleConsentChange = async (key: keyof ConsentStatus, value: boolean) => {
    const updated = { ...consent, [key]: value };
    setConsent(updated);
    try {
      await api.put('/user/consent', { [key]: value });
    } catch {
      setConsent(consent);
      Alert.alert('Error', 'Failed to update consent');
    }
  };

  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) return;
    setFeedbackSending(true);
    try {
      await blogService.submitFeedback(feedbackText.trim());
      Alert.alert('Thank You!', 'Your feedback has been sent to the Mediva team.');
      setFeedbackText('');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send feedback');
    } finally {
      setFeedbackSending(false);
    }
  };

  const handleExportData = async () => {
    setLoading(true);
    try {
      const data = await api.post('/user/data-export');
      Alert.alert(
        'Data Export',
        `Your data export contains ${Object.keys(data).length} sections. In production, this will be emailed to you.`,
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete your account and all associated data (health records, chat history, uploaded documents). This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/user/data');
              await logout();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete data');
            }
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: () => logout() },
    ]);
  };

  const handleLogoutAll = () => {
    Alert.alert(
      'Logout All Devices',
      'This will log you out of all devices where you are currently signed in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout All',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/user/logout-all');
              await logout();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to logout');
            }
          },
        },
      ],
    );
  };

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'mr', label: 'मराठी' },
    { code: 'kn', label: 'ಕನ್ನಡ' },
    { code: 'te', label: 'తెలుగు' },
    { code: 'ta', label: 'தமிழ்' },
    { code: 'bn', label: 'বাংলা' },
    { code: 'gu', label: 'ગુજરાતી' },
    { code: 'ml', label: 'മലയാളം' },
    { code: 'pa', label: 'ਪੰਜਾਬੀ' },
    { code: 'or', label: 'ଓଡ଼ିଆ' },
    { code: 'as', label: 'অসমীয়া' },
    { code: 'ur', label: 'اردو' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Profile</Text>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={COLORS.tertiary}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={COLORS.tertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          {user?.phone ? (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone</Text>
              <Text style={styles.readOnlyField}>+91 {user.phone}</Text>
            </View>
          ) : null}
          {user?.abhaAddress ? (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ABHA Address</Text>
              <Text style={styles.readOnlyField}>{user.abhaAddress}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleSaveProfile}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Save Profile</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Language */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="language-outline" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Language</Text>
          </View>
          <Text style={styles.sectionDesc}>AI responses will be in your preferred language</Text>
          <View style={styles.languageGrid}>
            {languages.map((l) => (
              <TouchableOpacity
                key={l.code}
                style={[styles.langChip, language === l.code && styles.langChipActive]}
                onPress={async () => {
                  setLanguage(l.code);
                  // Save language immediately when changed
                  try {
                    const updated = await authService.updateProfile({ preferredLanguage: l.code });
                    setUser(updated);
                  } catch (err: any) {
                    Alert.alert('Error', 'Failed to save language preference');
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.langText, language === l.code && styles.langTextActive]}>
                  {l.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Privacy & Consent */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Privacy & Consent</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Under the DPDP Act 2023, you control how your data is used. You can change these settings at any time.
          </Text>

          <ConsentToggle
            icon="📊"
            label="Health Data Collection"
            description="Allow Mediva to collect and store health data from your connected devices"
            value={consent.healthDataCollection}
            onValueChange={(v) => handleConsentChange('healthDataCollection', v)}
          />
          <ConsentToggle
            icon="🤖"
            label="AI Analysis"
            description="Allow AI to analyze your health data and provide personalized insights"
            value={consent.aiAnalysis}
            onValueChange={(v) => handleConsentChange('aiAnalysis', v)}
          />
          <ConsentToggle
            icon="👨‍⚕️"
            label="Doctor Sharing"
            description="Allow sharing your health data with empaneled doctors for review"
            value={consent.doctorSharing}
            onValueChange={(v) => handleConsentChange('doctorSharing', v)}
          />
          <ConsentToggle
            icon="🏥"
            label="ABDM Access"
            description="Allow fetching your health records from ABDM-linked facilities"
            value={consent.abdmAccess}
            onValueChange={(v) => handleConsentChange('abdmAccess', v)}
          />
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Legal</Text>
          </View>
          <Text style={styles.sectionDesc}>Read our terms and privacy policy</Text>

          <TouchableOpacity 
            style={styles.actionRow}
            onPress={() => setLegalModal('terms')}
            activeOpacity={0.7}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Terms of Use</Text>
              <Text style={styles.actionDesc}>Read our terms and conditions</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionRow}
            onPress={() => setLegalModal('privacy')}
            activeOpacity={0.7}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Privacy Policy</Text>
              <Text style={styles.actionDesc}>Read our privacy policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.tertiary} />
          </TouchableOpacity>
        </View>

        {/* Terms/Privacy Modal */}
        {legalModal && (
          <Modal
            visible={!!legalModal}
            animationType="slide"
            onRequestClose={() => setLegalModal(null)}
          >
            <TermsScreen type={legalModal} onClose={() => setLegalModal(null)} />
          </Modal>
        )}

        {/* Feedback */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="chatbox-ellipses-outline" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Feedback</Text>
          </View>
          <Text style={styles.sectionDesc}>Help us improve Mediva with your feedback</Text>
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }]}
            value={feedbackText}
            onChangeText={setFeedbackText}
            placeholder="Tell us what you think..."
            placeholderTextColor={COLORS.tertiary}
            multiline
          />
          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 10 }, (!feedbackText.trim() || feedbackSending) && { opacity: 0.5 }]}
            onPress={handleSendFeedback}
            disabled={!feedbackText.trim() || feedbackSending}
            activeOpacity={0.8}
          >
            {feedbackSending ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Send Feedback</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Health History */}
        {onNavigateHealthHistory && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="medical-outline" size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Health History</Text>
            </View>
            <Text style={styles.sectionDesc}>Update your medical history for better AI recommendations</Text>

            <TouchableOpacity style={styles.actionRow} onPress={onNavigateHealthHistory} activeOpacity={0.7}>
              <View style={styles.actionIcon}>
                <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>Edit Health History</Text>
                <Text style={styles.actionDesc}>Allergies, medications, conditions, and more</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.tertiary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Data Management */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="folder-outline" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Data Management</Text>
          </View>
          <Text style={styles.sectionDesc}>Your data rights under the DPDP Act 2023</Text>

          <TouchableOpacity style={styles.actionRow} onPress={handleExportData} activeOpacity={0.7}>
            <View style={styles.actionIcon}>
              <Ionicons name="download-outline" size={18} color={COLORS.primary} />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Export All Data</Text>
              <Text style={styles.actionDesc}>Download a copy of all your data (Right to Access)</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionRow} onPress={handleDeleteAccount} activeOpacity={0.7}>
            <View style={[styles.actionIcon, { backgroundColor: '#FFF0F0' }]}>
              <Ionicons name="trash-outline" size={18} color={COLORS.error} />
            </View>
            <View style={styles.actionInfo}>
              <Text style={[styles.actionTitle, { color: COLORS.error }]}>Delete All Data</Text>
              <Text style={styles.actionDesc}>Permanently delete your account and data (Right to Erasure)</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.tertiary} />
          </TouchableOpacity>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.accountBtn} onPress={handleLogoutAll} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.secondary} />
            <Text style={styles.accountBtnText}>Logout All Devices</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.accountBtn, { borderBottomWidth: 0 }]} onPress={handleLogout} activeOpacity={0.7}>
            <Ionicons name="exit-outline" size={18} color={COLORS.error} />
            <Text style={[styles.accountBtnText, { color: COLORS.error }]}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Mediva v1.0.0</Text>
          <Text style={styles.footerText}>Compliant with DPDP Act, 2023</Text>
          <Text style={styles.footerText}>Data stored in India (AWS Mumbai)</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 28,
    paddingBottom: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: SIZES.xl,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: FONTS.bold,
  },

  content: { paddingHorizontal: 16, paddingBottom: 40 },

  /* Sections */
  section: {
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radiusLg,
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: SIZES.base,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: FONTS.bold,
  },
  sectionDesc: {
    fontSize: SIZES.xs,
    color: COLORS.secondary,
    fontFamily: FONTS.regular,
    lineHeight: 16,
    marginBottom: 12,
  },

  /* Input */
  inputGroup: { marginBottom: 12 },
  inputLabel: {
    fontSize: SIZES.sm,
    fontWeight: '600',
    color: COLORS.secondary,
    fontFamily: FONTS.bold,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: SIZES.radius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: SIZES.base,
    color: COLORS.primary,
    fontFamily: FONTS.regular,
  },
  readOnlyField: {
    fontSize: SIZES.base,
    color: COLORS.secondary,
    fontFamily: FONTS.regular,
    backgroundColor: COLORS.inputBg,
    padding: 12,
    borderRadius: SIZES.radius,
  },

  /* Primary button */
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: SIZES.base,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },

  /* Language grid */
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: SIZES.radiusFull,
    backgroundColor: COLORS.inputBg,
  },
  langChipActive: {
    backgroundColor: COLORS.primary,
  },
  langText: {
    fontSize: SIZES.sm,
    color: COLORS.secondary,
    fontFamily: FONTS.regular,
  },
  langTextActive: {
    color: COLORS.white,
    fontWeight: '600',
    fontFamily: FONTS.bold,
  },

  /* Action rows */
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionInfo: { flex: 1 },
  actionTitle: {
    fontSize: SIZES.md,
    fontWeight: '600',
    color: COLORS.primary,
    fontFamily: FONTS.bold,
  },
  actionDesc: {
    fontSize: 11,
    color: COLORS.secondary,
    fontFamily: FONTS.regular,
    marginTop: 2,
    lineHeight: 15,
  },

  /* Account buttons */
  accountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  accountBtnText: {
    fontSize: SIZES.base,
    color: COLORS.secondary,
    fontFamily: FONTS.regular,
  },

  /* Footer */
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 11,
    color: COLORS.tertiary,
    fontFamily: FONTS.regular,
    marginBottom: 2,
  },
});
