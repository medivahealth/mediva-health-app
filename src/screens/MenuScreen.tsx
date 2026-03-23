import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  TextInput,
  Alert,
  Image,
  Switch,
  ActivityIndicator,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import TermsScreen from './TermsScreen';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import authService from '../services/auth';
import type { ConsentStatus } from '../types';
import { SIZES } from '../theme';
import ButtonBg from '../../assets/button.svg';

const logoImg = require('../../assets/applogo.png');

type MenuSection =
  | 'main'
  | 'profile'
  | 'app'
  | 'help'
  | 'records'
  | 'abha'
  | 'devices'
  | 'privacy';

interface MenuScreenProps {
  onBack: () => void;
  onNavigateRecords: () => void;
  onNavigateDevices: () => void;
  onNavigateABHA: () => void;
  onNavigateHealthHistory?: () => void;
}

export default function MenuScreen({
  onBack,
  onNavigateRecords,
  onNavigateDevices,
  onNavigateABHA,
  onNavigateHealthHistory,
}: MenuScreenProps) {
  const [section, setSection] = useState<MenuSection>('main');
  const { user, setUser, logout } = useAuthStore();

  /* ─── Profile states ─── */
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);

  // Sync name and email when user changes
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setLanguage(user.preferredLanguage || 'en');
    }
  }, [user]);

  // Load consent status
  useEffect(() => {
    const loadConsent = async () => {
      try {
        const c = await api.get('/user/consent');
        if (c) {
          setConsent({
            healthDataCollection: c.healthDataCollection ?? true,
            aiAnalysis: c.aiAnalysis ?? true,
            doctorSharing: c.doctorSharing ?? true,
            abdmAccess: c.abdmAccess ?? true,
          });
        }
      } catch (err) {
        console.error('Failed to load consent:', err);
      }
    };
    if (user) {
      loadConsent();
    }
  }, [user]);

  // Load voice preference on mount
  useEffect(() => {
    const loadVoicePreference = async () => {
      try {
        const savedVoice = await SecureStore.getItemAsync('voicePreference');
        if (savedVoice) {
          setVoice(savedVoice);
        }
      } catch (err) {
        console.error('Failed to load voice preference:', err);
      }
    };
    loadVoicePreference();
  }, []);

  /* ─── Consent states ─── */
  const [consent, setConsent] = useState<ConsentStatus>({
    healthDataCollection: true, // Default ON
    aiAnalysis: true, // Default ON
    doctorSharing: true, // Default ON
    abdmAccess: true, // Default ON
  });

  /* ─── Language ─── */
  const [language, setLanguage] = useState(user?.preferredLanguage || 'en');

  /* ─── Voice ─── */
  const [voice, setVoice] = useState('default'); // 'default', 'male', 'female'
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);

  /* ─── Feedback ─── */
  const [feedback, setFeedback] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  /* ─── Profile image helpers ─── */
  const profileImageUrl = user?.profileImage || '';

  const handleChangeProfileImage = async () => {
    try {
      // Request permission
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission needed',
          'Please allow access to your photos in device Settings to change your profile picture.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setUploadingImage(true);
        try {
          const { profileImage } = await authService.uploadProfileImage(result.assets[0].uri);
          if (user) {
            setUser({ ...user, profileImage });
          }
          Alert.alert('Updated', 'Profile image updated successfully');
        } catch (err: any) {
          Alert.alert('Error', err.message || 'Failed to upload image');
        } finally {
          setUploadingImage(false);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to open image picker');
      setUploadingImage(false);
    }
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

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const updated = await authService.updateProfile({
        name,
        email,
        preferredLanguage: language,
      });
      setUser(updated);
      Alert.alert('Saved', 'Profile updated successfully');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleConsentChange = async (key: keyof ConsentStatus, value: boolean) => {
    if (!value) {
      Alert.alert(
        'Are you sure?',
        'Turning this off may affect Mediva\'s ability to provide you with accurate, personalized health insights.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Turn Off',
            style: 'destructive',
            onPress: () => {
              setConsent((prev) => ({ ...prev, [key]: false }));
              api.put('/user/consent', { [key]: false }).catch(() => {});
            },
          },
        ],
      );
    } else {
      setConsent((prev) => ({ ...prev, [key]: true }));
      api.put('/user/consent', { [key]: true }).catch(() => {});
    }
  };

  const handleDeleteAllData = () => {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete your account and all associated data. This cannot be undone.',
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
              Alert.alert('Error', err.message || 'Failed to delete');
            }
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: () => logout() },
    ]);
  };

  const handleLogoutAll = () => {
    Alert.alert('Logout from all devices', 'This will sign you out everywhere.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout All',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post('/user/logout-all');
          } catch {}
          await logout();
        },
      },
    ]);
  };

  const handleSendFeedback = async () => {
    if (!feedback.trim()) return;
    try {
      await api.post('/user/feedback', { message: feedback.trim() });
      Alert.alert('Thank you!', 'Your feedback has been sent to our team.');
      setFeedback('');
      setSection('main');
    } catch {
      Alert.alert('Error', 'Could not send feedback. Please try again.');
    }
  };

  /* ─── Shared header ─── */
  const renderSectionHeader = (title: string, back: MenuSection | 'close' = 'main') => (
    <View style={s.sectionHeader}>
      <TouchableOpacity
        style={s.backBtn}
        onPress={() => (back === 'close' ? onBack() : setSection(back))}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={{ width: 36 }} />
    </View>
  );

  /* ─── Profile section ─── */
  if (section === 'profile') {
    return (
      <>
        <View style={s.container}>
          {renderSectionHeader('Account Settings')}
          <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Avatar */}
          <View style={s.avatarSection}>
            <TouchableOpacity onPress={handleChangeProfileImage} activeOpacity={0.8} style={s.avatarCircleWrap}>
              {profileImageUrl ? (
                <Image source={{ uri: profileImageUrl }} style={s.avatarImage} />
              ) : (
                <View style={s.avatarCircle}>
                  <Text style={s.avatarLetter}>
                    {(user?.name || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={s.avatarEditBadge}>
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="camera" size={12} color="#FFFFFF" />
                )}
              </View>
            </TouchableOpacity>
            <Text style={s.avatarName}>{user?.name || 'User'}</Text>
            {user?.medivaid ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                <Ionicons name="id-card-outline" size={14} color="#10b981" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981', letterSpacing: 1 }}>{user.medivaid}</Text>
              </View>
            ) : null}
            <Text style={s.avatarEmail}>{user?.email || ''}</Text>
            <View style={s.authBadge}>
              <Ionicons
                name={
                  user?.authProvider === 'google'
                    ? 'logo-google'
                    : user?.authProvider === 'apple'
                    ? 'logo-apple'
                    : 'mail-outline'
                }
                size={12}
                color="rgba(255,255,255,0.5)"
              />
              <Text style={s.authBadgeText}>
                {user?.authProvider === 'google'
                  ? 'Google'
                  : user?.authProvider === 'apple'
                  ? 'Apple'
                  : 'Email'}
              </Text>
            </View>
          </View>

          <Text style={s.fieldLabel}>Full Name</Text>
          <TextInput style={s.fieldInput} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="rgba(255,255,255,0.4)" />

          <Text style={s.fieldLabel}>Email</Text>
          <TextInput style={s.fieldInput} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="rgba(255,255,255,0.4)" keyboardType="email-address" autoCapitalize="none" />

          <TouchableOpacity style={s.buttonWrap} onPress={handleSaveProfile} activeOpacity={0.8}>
            <ButtonBg width="100%" height={48} style={StyleSheet.absoluteFill} preserveAspectRatio="xMidYMid slice" />
            <View style={s.buttonInner}>
              <Text style={s.buttonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
            </View>
          </TouchableOpacity>

          <View style={s.dangerSection}>
            <TouchableOpacity style={s.dangerBtn} onPress={handleLogoutAll}>
              <Ionicons name="log-out-outline" size={18} color="#f59e0b" />
              <Text style={[s.dangerBtnText, { color: '#f59e0b' }]}>Logout from all devices</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.dangerBtn} onPress={handleDeleteAllData}>
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={[s.dangerBtnText, { color: '#ef4444' }]}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
      </>
    );
  }

  /* ─── App settings section ─── */
  if (section === 'app') {
    return (
      <>
        <View style={s.container}>
        {renderSectionHeader('App Settings')}
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Language */}
          <Text style={s.groupTitle}>Language</Text>
          <Text style={s.groupDesc}>Choose your preferred language for responses</Text>
          <View style={s.langGrid}>
            {languages.map((l) => (
              <TouchableOpacity
                key={l.code}
                style={[s.langChip, language === l.code && s.langChipActive]}
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
              >
                <Text style={[s.langChipText, language === l.code && s.langChipTextActive]}>
                  {l.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Voice */}
          <Text style={s.groupTitle}>Voice</Text>
          <Text style={s.groupDesc}>Audio response settings for the speak bot</Text>
          <TouchableOpacity 
            style={s.menuItem}
            onPress={() => {
              // Show voice selection options
              const voiceOptions = [
                { id: 'default', label: 'Default (System)' },
                { id: 'en-US', label: 'English (US)' },
                { id: 'en-GB', label: 'English (British)' },
                { id: 'hi-IN', label: 'Hindi' },
                { id: 'mr-IN', label: 'Marathi' },
                { id: 'kn-IN', label: 'Kannada' },
                { id: 'te-IN', label: 'Telugu' },
                { id: 'ta-IN', label: 'Tamil' },
                { id: 'bn-IN', label: 'Bengali' },
                { id: 'gu-IN', label: 'Gujarati' },
                { id: 'ml-IN', label: 'Malayalam' },
                { id: 'pa-IN', label: 'Punjabi' },
              ];
              
              Alert.alert(
                'Select Voice',
                'Choose a voice for AI responses',
                [
                  ...voiceOptions.map((v) => ({
                    text: v.label,
                    onPress: async () => {
                      setVoice(v.id);
                      // Store voice preference in SecureStore
                      try {
                        await SecureStore.setItemAsync('voicePreference', v.id);
                        Alert.alert('Saved', `Voice set to ${v.label}`);
                      } catch (err) {
                        console.error('Failed to save voice preference:', err);
                      }
                    },
                  })),
                  { text: 'Cancel', style: 'cancel' },
                ],
                { cancelable: true }
              );
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="volume-high-outline" size={20} color="#FFFFFF" />
            <View style={s.menuItemInfo}>
              <Text style={s.menuItemTitle}>Voice Selection</Text>
              <Text style={s.menuItemDesc}>
                {voice === 'default' ? 'Default • English' : voice}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>

          {/* Legal */}
          <Text style={s.groupTitle}>Legal</Text>
          <TouchableOpacity 
            style={s.menuItem}
            onPress={() => setLegalModal('terms')}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
            <View style={s.menuItemInfo}>
              <Text style={s.menuItemTitle}>Terms of Use</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={s.menuItem}
            onPress={() => setLegalModal('privacy')}
            activeOpacity={0.7}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color="#FFFFFF" />
            <View style={s.menuItemInfo}>
              <Text style={s.menuItemTitle}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </ScrollView>
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
      </>
    );
  }

  /* ─── Help & Feedback ─── */
  if (section === 'help') {
    return (
      <>
        <View style={s.container}>
        {renderSectionHeader('Help & Feedback')}
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={s.groupTitle}>Send us a message</Text>
          <Text style={s.groupDesc}>We'd love to hear from you. Your feedback helps us improve Mediva.</Text>
          <TextInput
            style={s.feedbackInput}
            placeholder="Tell us what's on your mind..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={feedback}
            onChangeText={setFeedback}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[s.buttonWrap, !feedback.trim() && s.buttonDisabled]}
            onPress={handleSendFeedback}
            disabled={!feedback.trim()}
            activeOpacity={0.8}
          >
            <ButtonBg width="100%" height={48} style={StyleSheet.absoluteFill} preserveAspectRatio="xMidYMid slice" />
            <View style={s.buttonInner}>
              <Text style={s.buttonText}>Send Feedback</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
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
      </>
    );
  }

  /* ─── Privacy & Consent ─── */
  if (section === 'privacy') {
    return (
      <>
        <View style={s.container}>
          {renderSectionHeader('Privacy & Consent')}
          <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={s.groupDesc}>
            Control how your data is used. These are on by default to give you the best experience.
          </Text>

          {[
            { key: 'healthDataCollection' as keyof ConsentStatus, title: 'Health Data Collection', desc: 'Collect and store data from connected devices', icon: 'heart-outline' as const },
            { key: 'aiAnalysis' as keyof ConsentStatus, title: 'Analysis', desc: 'We analyze your data for personalized insights', icon: 'analytics-outline' as const },
            { key: 'doctorSharing' as keyof ConsentStatus, title: 'Doctor Sharing', desc: 'Share data with verified doctors for review', icon: 'people-outline' as const },
            { key: 'abdmAccess' as keyof ConsentStatus, title: 'ABDM Access', desc: 'Fetch records from ABDM-linked facilities', icon: 'medkit-outline' as const },
          ].map((item) => (
            <View key={item.key} style={s.consentItem}>
              <View style={s.consentInfo}>
                <Ionicons name={item.icon} size={20} color="#FFFFFF" style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={s.consentTitle}>{item.title}</Text>
                  <Text style={s.consentDesc}>{item.desc}</Text>
                </View>
              </View>
              <Switch
                value={!!consent[item.key]}
                onValueChange={(v) => handleConsentChange(item.key, v)}
                trackColor={{ false: '#E0E0E0', true: '#111' }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}

          <Text style={[s.groupTitle, { marginTop: 24 }]}>Legal</Text>
          <TouchableOpacity
            style={s.menuItem}
            onPress={() => setLegalModal('terms')}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
            <View style={s.menuItemInfo}>
              <Text style={s.menuItemTitle}>Terms of Use</Text>
              <Text style={s.menuItemDesc}>Read legal terms</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.menuItem}
            onPress={() => setLegalModal('privacy')}
            activeOpacity={0.7}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color="#FFFFFF" />
            <View style={s.menuItemInfo}>
              <Text style={s.menuItemTitle}>Privacy Policy</Text>
              <Text style={s.menuItemDesc}>Data processing and consent policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>

            <Text style={[s.groupTitle, { marginTop: 28 }]}>Data Management</Text>
            <TouchableOpacity style={s.dangerBtn} onPress={handleDeleteAllData}>
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={[s.dangerBtnText, { color: '#ef4444' }]}>Delete All Data</Text>
            </TouchableOpacity>
          </ScrollView>
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
      </>
    );
  }

  /* ─── Main Menu ─── */
  return (
    <>
      <View style={s.container}>
      <View style={s.sectionHeader}>
        <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.sectionTitle}>Menu</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User card - clickable to go to profile */}
        <TouchableOpacity 
          style={s.userCard} 
          onPress={() => setSection('profile')}
          activeOpacity={0.7}
        >
          {profileImageUrl ? (
            <Image source={{ uri: profileImageUrl }} style={s.userCardAvatarImg} />
          ) : (
            <View style={s.userCardAvatar}>
              <Text style={s.userCardAvatarText}>
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={s.userCardInfo}>
            <Text style={s.userCardName}>{user?.name || 'User'}</Text>
            {user?.medivaid ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 2, backgroundColor: 'rgba(16,185,129,0.1)', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                <Ionicons name="id-card-outline" size={12} color="#10b981" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#10b981', letterSpacing: 0.5 }}>{user.medivaid}</Text>
              </View>
            ) : null}
            <Text style={s.userCardEmail}>{user?.email || ''}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>


        {/* Menu items */}
        <Text style={s.groupTitle}>Settings</Text>
        {[
          { key: 'profile' as MenuSection, icon: 'person-outline', title: 'Account Settings', desc: 'Profile, sign-in method, delete account' },
          { key: 'help' as MenuSection, icon: 'chatbubble-ellipses-outline', title: 'Help & Feedback', desc: 'Send us a message' },
        ].map((item) => (
          <TouchableOpacity key={item.key} style={s.menuItem} onPress={() => setSection(item.key)} activeOpacity={0.7}>
            <Ionicons name={item.icon as any} size={20} color="#FFFFFF" />
            <View style={s.menuItemInfo}>
              <Text style={s.menuItemTitle}>{item.title}</Text>
              <Text style={s.menuItemDesc}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        ))}

        <Text style={s.groupTitle}>Health</Text>
        {[
          { action: onNavigateHealthHistory || (() => {}), icon: 'heart-outline', title: 'Health History', desc: 'View or update your medical history' },
          { action: onNavigateRecords, icon: 'document-text-outline', title: 'Records', desc: 'Uploaded documents & reports' },
          { action: onNavigateDevices, icon: 'watch-outline', title: 'Devices', desc: 'Connect wearables & health apps' },
          { action: onNavigateABHA, icon: 'medkit-outline', title: 'ABHA', desc: 'Link your ABHA health records' },
          { action: () => setSection('privacy'), icon: 'shield-checkmark-outline', title: 'Privacy & Consent', desc: 'Data collection & sharing controls' },
        ].map((item, i) => (
          <TouchableOpacity key={i} style={s.menuItem} onPress={item.action} activeOpacity={0.7}>
            <Ionicons name={item.icon as any} size={20} color="#FFFFFF" />
            <View style={s.menuItemInfo}>
              <Text style={s.menuItemTitle}>{item.title}</Text>
              <Text style={s.menuItemDesc}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        ))}

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={s.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={s.footer}>
          <Image source={logoImg} style={s.footerLogo} resizeMode="contain" />
          <Text style={s.footerVersion}>Mediva v1.0.0</Text>
          <Text style={s.footerCopy}>© 2026 Mediva Health Technologies</Text>
        </View>
      </ScrollView>
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
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 28,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#000000',
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: SIZES.xl, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue' },
  scrollContent: { padding: 16, paddingBottom: 40, backgroundColor: '#000000' },

  /* User card */
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: SIZES.radiusLg,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  quickEditSection: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: SIZES.radiusLg,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  quickEditRow: {
    gap: 12,
  },
  quickEditField: {
    marginBottom: 8,
  },
  quickEditLabel: {
    fontSize: SIZES.sm,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue',
    marginBottom: 6,
  },
  quickEditInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: SIZES.radius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: SIZES.base,
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue-Light',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  quickSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: SIZES.radius,
    paddingVertical: 12,
    marginTop: 4,
  },
  quickSaveBtnText: {
    color: '#000000',
    fontSize: SIZES.base,
    fontWeight: '400',
    fontFamily: 'HelveticaNeue',
  },
  userCardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  userCardAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
  },
  userCardAvatarText: { color: '#000000', fontSize: SIZES.xl, fontWeight: '400', fontFamily: 'HelveticaNeue' },
  userCardInfo: { flex: 1 },
  userCardName: { fontSize: SIZES.lg, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue-Light' },
  userCardEmail: { fontSize: SIZES.sm, color: 'rgba(255,255,255,0.6)', fontFamily: 'HelveticaNeue-Light', marginTop: 2 },

  /* Groups */
  groupTitle: {
    fontSize: SIZES.sm,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'HelveticaNeue',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },
  groupDesc: { fontSize: SIZES.sm, color: 'rgba(255,255,255,0.5)', fontFamily: 'HelveticaNeue-Light', lineHeight: 18, marginBottom: 16 },

  /* Menu items */
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    gap: 14,
  },
  menuItemInfo: { flex: 1 },
  menuItemTitle: { fontSize: SIZES.base, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue-Light' },
  menuItemDesc: { fontSize: SIZES.xs, color: 'rgba(255,255,255,0.5)', fontFamily: 'HelveticaNeue-Light', marginTop: 2 },

  /* Profile section */
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatarCircleWrap: { position: 'relative', marginBottom: 12 },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 72, height: 72, borderRadius: 36 },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  avatarLetter: { color: '#000000', fontSize: 28, fontWeight: '400', fontFamily: 'HelveticaNeue' },
  avatarName: { fontSize: SIZES.xl, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue' },
  avatarEmail: { fontSize: SIZES.sm, color: 'rgba(255,255,255,0.6)', fontFamily: 'HelveticaNeue-Light', marginTop: 2 },
  authBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: SIZES.radiusFull,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  authBadgeText: { fontSize: SIZES.xs, color: 'rgba(255,255,255,0.5)', fontFamily: 'HelveticaNeue-Light' },

  /* Fields */
  fieldLabel: { fontSize: SIZES.sm, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue', marginBottom: 6, marginTop: 16 },
  fieldInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: SIZES.radius,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: SIZES.base,
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue-Light',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  /* Buttons */
  buttonWrap: { height: 48, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginTop: 24, position: 'relative' },
  buttonDisabled: { opacity: 0.4 },
  buttonInner: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#000000', fontSize: SIZES.lg, fontWeight: '400', fontFamily: 'HelveticaNeue' },

  /* Danger */
  dangerSection: { marginTop: 32, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 16 },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  dangerBtnText: { fontSize: SIZES.base, fontWeight: '400', fontFamily: 'HelveticaNeue-Light', color: '#ef4444' },

  /* Language */
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  langChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: SIZES.radiusFull, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: 'transparent' },
  langChipActive: { backgroundColor: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.4)" },
  langChipText: { fontSize: SIZES.sm, color: "#FFFFFF", fontFamily: 'HelveticaNeue-Light' },
  langChipTextActive: { color: "#FFFFFF", fontWeight: '400', fontFamily: 'HelveticaNeue' },

  /* Consent */
  consentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  consentInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  consentTitle: { fontSize: SIZES.base, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue-Light' },
  consentDesc: { fontSize: SIZES.xs, color: 'rgba(255,255,255,0.5)', fontFamily: 'HelveticaNeue-Light', marginTop: 2 },

  /* Feedback */
  feedbackInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: SIZES.radius,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: SIZES.base,
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue-Light',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    minHeight: 120,
    textAlignVertical: 'top',
  },

  /* Logout */
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: SIZES.radius,
    marginTop: 24,
  },
  logoutText: { fontSize: SIZES.lg, fontWeight: '400', color: '#ef4444', fontFamily: 'HelveticaNeue-Light' },

  /* Footer */
  footer: { alignItems: 'center', marginTop: 32 },
  footerLogo: { width: 32, height: 32, borderRadius: 8, marginBottom: 8 },
  footerVersion: { fontSize: SIZES.xs, color: 'rgba(255,255,255,0.5)', fontFamily: 'HelveticaNeue-Light' },
  footerCopy: { fontSize: SIZES.xs, color: 'rgba(255,255,255,0.5)', fontFamily: 'HelveticaNeue-Light', marginTop: 2 },
});
