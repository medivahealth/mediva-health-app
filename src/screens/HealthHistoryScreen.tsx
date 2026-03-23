import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ImageBackground,
  Keyboard,
  Platform,
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
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import authService from '../services/auth';
import ButtonBg from '../../assets/button.svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

interface HealthHistoryScreenProps {
  onBack?: () => void;
  onComplete?: () => void;
  showSkip?: boolean;
}

interface HealthHistoryData {
  allergies: string[];
  chronicConditions: string[];
  currentMedications: string[];
  pastSurgeries: string[];
  familyHistory: string[];
  bloodType: string;
  dob: string;
  gender: string;
  height: string;
  weight: string;
  lifestyleFactors: {
    smoking: boolean;
    alcohol: boolean;
    exercise: string;
  };
}

export default function HealthHistoryScreen({ onBack, onComplete, showSkip = true }: HealthHistoryScreenProps) {
  const { user, setUser } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Profile fields (Step 1)
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  // Edit mode: when accessed from menu
  const isEditMode = !!onBack;

  const [data, setData] = useState<HealthHistoryData>({
    allergies: [],
    chronicConditions: [],
    currentMedications: [],
    pastSurgeries: [],
    familyHistory: [],
    bloodType: '',
    dob: '',
    gender: '',
    height: '',
    weight: '',
    lifestyleFactors: {
      smoking: false,
      alcohol: false,
      exercise: '',
    },
  });

  const [tempInputs, setTempInputs] = useState({
    allergies: '',
    chronicConditions: '',
    currentMedications: '',
    pastSurgeries: '',
    familyHistory: '',
  });

  useEffect(() => {
    loadHealthHistory();
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const loadHealthHistory = async () => {
    setLoading(true);
    try {
      const history = await api.get('/user/health-history');
      setData({
        allergies: Array.isArray(history?.allergies) ? history.allergies : [],
        chronicConditions: Array.isArray(history?.chronicConditions) ? history.chronicConditions : [],
        currentMedications: Array.isArray(history?.currentMedications) ? history.currentMedications : [],
        pastSurgeries: Array.isArray(history?.pastSurgeries) ? history.pastSurgeries : [],
        familyHistory: Array.isArray(history?.familyHistory) ? history.familyHistory : [],
        bloodType: history?.bloodType || '',
        dob: history?.dob || '',
        gender: history?.gender || '',
        height: history?.height || '',
        weight: history?.weight || '',
        lifestyleFactors: {
          smoking: history?.lifestyleFactors?.smoking === true,
          alcohol: history?.lifestyleFactors?.alcohol === true,
          exercise: history?.lifestyleFactors?.exercise || '',
        },
      });
    } catch (err) {
      console.log('Error loading health history:', err);
    } finally {
      setLoading(false);
    }
  };

  const addToList = (key: keyof HealthHistoryData, value: string) => {
    if (!value.trim()) return;
    const list = (data[key] as string[]) || [];
    if (list.includes(value.trim())) return;
    setData({ ...data, [key]: [...list, value.trim()] });
    setTempInputs({ ...tempInputs, [key as keyof typeof tempInputs]: '' });
  };

  const removeFromList = (key: keyof HealthHistoryData, index: number) => {
    const list = (data[key] as string[]) || [];
    setData({ ...data, [key]: list.filter((_, i) => i !== index) });
  };

  const validateData = () => {
    // 1. Email validation (only if provided since it's optional)
    if (email.trim() && !email.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address with @ symbol.');
      return false;
    }

    // 2. DOB validation (DD/MM/YYYY)
    const dobRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
    if (data.dob && !dobRegex.test(data.dob)) {
      Alert.alert('Invalid Date of Birth', 'Please use the format DD/MM/YYYY (e.g. 25/12/1990)');
      return false;
    }

    return true;
  };

  const handleSave = async (markComplete: boolean = false) => {
    if (!validateData()) return;

    setSaving(true);
    try {
      // 1. Update Profile (Name/Email)
      await authService.updateProfile({
        name: name.trim(),
        email: email.trim() || undefined,
      });

      // 2. Update Health History
      const updateData: any = { ...data };
      if (markComplete || isEditMode) {
        updateData.completedAt = new Date().toISOString();
      }
      const result = await api.put('/user/health-history', updateData);
      
      const freshProfile = await authService.getProfile();
      setUser(freshProfile);

      if (markComplete && onComplete) {
        onComplete();
      } else if (isEditMode && onBack) {
        onBack();
      }
    } catch (err: any) {
      Alert.alert('Save failed', err.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (name.trim().length < 2) {
        Alert.alert('Name required', 'Please enter your full name.');
        return;
      }
      if (email.trim() && !email.includes('@')) {
        Alert.alert('Invalid Email', 'Please enter a valid email address with @ symbol.');
        return;
      }
    }
    if (currentStep === 2) {
      const dobRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
      if (data.dob && !dobRegex.test(data.dob)) {
        Alert.alert('Invalid Date of Birth', 'Please use the format DD/MM/YYYY (e.g. 25/12/1990)');
        return;
      }
    }
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSave(true);
    }
  };

  const handleSkip = () => {
    if (onComplete) onComplete();
  };

  const totalSteps = 5;
  const progress = (currentStep / totalSteps) * 100;

  if (isEditMode) {
    if (loading) {
      return (
        <ImageBackground source={require('../../assets/background.png')} style={styles.background} resizeMode="cover">
          <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.38)', 'rgba(0,0,0,0.55)']} style={styles.overlay}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          </LinearGradient>
        </ImageBackground>
      );
    }

    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ImageBackground source={require('../../assets/background.png')} style={styles.background} resizeMode="cover">
          <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.38)', 'rgba(0,0,0,0.55)']} style={styles.overlay}>
            <View style={styles.fullScreenStep}>
              <View style={[styles.contentSection, { paddingTop: 60 }]}>
                <View style={styles.textWrap}>
                  <Text style={styles.mainTitle}>Health History</Text>
                  <Text style={styles.subTitle}>Keep your medical profile updated.</Text>
                </View>

                <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
                  <Text style={styles.innerStepTitle}>Personal Information</Text>
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Full Name</Text>
                    <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your Name" placeholderTextColor="#6B7280" />
                  </View>
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Email (Optional)</Text>
                    <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#6B7280" />
                  </View>
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Date of Birth</Text>
                    <TextInput style={styles.input} value={data.dob} onChangeText={(text) => setData({ ...data, dob: text })} placeholder="DD/MM/YYYY" placeholderTextColor="#6B7280" />
                  </View>
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Gender</Text>
                    <View style={styles.bloodTypeGrid}>
                      {['male', 'female', 'other'].map((g) => (
                        <TouchableOpacity 
                          key={g} 
                          style={[styles.bloodTypeBtn, data.gender === g && styles.bloodTypeBtnActive, { width: (SCREEN_WIDTH - 68) / 3 }]} 
                          onPress={() => setData({ ...data, gender: g })}
                        >
                          <Text style={[styles.bloodTypeText, data.gender === g && styles.bloodTypeTextActive]}>{g.charAt(0).toUpperCase() + g.slice(1)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.inputRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sectionLabel}>Height (cm)</Text>
                      <TextInput style={styles.input} value={data.height} onChangeText={(t) => setData({ ...data, height: t })} placeholder="175" keyboardType="numeric" placeholderTextColor="#6B7280" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.sectionLabel}>Weight (kg)</Text>
                      <TextInput style={styles.input} value={data.weight} onChangeText={(t) => setData({ ...data, weight: t })} placeholder="70" keyboardType="numeric" placeholderTextColor="#6B7280" />
                    </View>
                  </View>

                  <View style={[styles.section, { marginTop: 20 }]}>
                    <Text style={styles.sectionLabel}>Blood Type</Text>
                    <View style={styles.bloodTypeGrid}>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((type) => (
                        <TouchableOpacity key={type} style={[styles.bloodTypeBtn, data.bloodType === type && styles.bloodTypeBtnActive]} onPress={() => setData({ ...data, bloodType: type })}>
                          <Text style={[styles.bloodTypeText, data.bloodType === type && styles.bloodTypeTextActive]}>{type}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <Text style={[styles.innerStepTitle, { marginTop: 30 }]}>Medical History</Text>
                  {[
                    { label: 'Allergies', key: 'allergies', placeholder: 'e.g. Peanuts, Penicillin' },
                    { label: 'Chronic Conditions', key: 'chronicConditions', placeholder: 'e.g. Diabetes, Asthma' },
                    { label: 'Current Medications', key: 'currentMedications', placeholder: 'e.g. Metformin, Aspirin' },
                    { label: 'Past Surgeries', key: 'pastSurgeries', placeholder: 'Any surgeries?' },
                    { label: 'Family History', key: 'familyHistory', placeholder: 'Any family conditions?' }
                  ].map((item) => (
                    <View key={item.key} style={styles.section}>
                      <Text style={styles.sectionLabel}>{item.label}</Text>
                      <View style={styles.inputRow}>
                        <TextInput style={styles.input} value={tempInputs[item.key as keyof typeof tempInputs]} onChangeText={(t) => setTempInputs({ ...tempInputs, [item.key]: t })} placeholder={item.placeholder} placeholderTextColor="#6B7280" />
                        <TouchableOpacity style={styles.addBtn} onPress={() => addToList(item.key as keyof HealthHistoryData, tempInputs[item.key as keyof typeof tempInputs])}>
                          <Ionicons name="add" size={24} color="#02101f" />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.tagContainer}>
                        {(data[item.key as keyof HealthHistoryData] as string[]).map((val, idx) => (
                          <View key={idx} style={styles.tag}>
                            <Text style={styles.tagText}>{val}</Text>
                            <TouchableOpacity onPress={() => removeFromList(item.key as keyof HealthHistoryData, idx)}>
                              <Ionicons name="close" size={16} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}

                  <View style={[styles.section, { marginBottom: 30 }]}>
                    <Text style={styles.sectionLabel}>Lifestyle</Text>
                    <TouchableOpacity style={styles.checkboxRow} onPress={() => setData({ ...data, lifestyleFactors: { ...data.lifestyleFactors, smoking: !data.lifestyleFactors.smoking }})}>
                      <View style={[styles.checkbox, data.lifestyleFactors.smoking && styles.checkboxActive]}>{data.lifestyleFactors.smoking && <Ionicons name="checkmark" size={16} color="#02101f" />}</View>
                      <Text style={styles.checkboxLabel}>Smoking</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.checkboxRow} onPress={() => setData({ ...data, lifestyleFactors: { ...data.lifestyleFactors, alcohol: !data.lifestyleFactors.alcohol }})}>
                      <View style={[styles.checkbox, data.lifestyleFactors.alcohol && styles.checkboxActive]}>{data.lifestyleFactors.alcohol && <Ionicons name="checkmark" size={16} color="#02101f" />}</View>
                      <Text style={styles.checkboxLabel}>Consume Alcohol</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>

                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.smallBackBtn} onPress={onBack}>
                    <ButtonBg
                      width="100%"
                      height="100%"
                      style={StyleSheet.absoluteFill}
                      preserveAspectRatio="xMidYMid slice"
                      pointerEvents="none"
                    />
                    <Ionicons name="arrow-back" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.loginBtnFlex, saving && styles.btnDisabled]} onPress={() => handleSave(true)} disabled={saving}>
                    <ButtonBg
                      width="100%"
                      height="100%"
                      style={StyleSheet.absoluteFill}
                      preserveAspectRatio="xMidYMid slice"
                      pointerEvents="none"
                    />
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.actionBtnTxt}>Save Changes</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
      </TouchableWithoutFeedback>
    );
  }

  // Multi-step Flow
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ImageBackground source={require('../../assets/background.png')} style={styles.background} resizeMode="cover">
        <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.38)', 'rgba(0,0,0,0.55)']} style={styles.overlay}>
          <View style={styles.fullScreenStep}>
            {showSkip && (
              <TouchableOpacity style={styles.skipBtnLink} onPress={handleSkip}>
                <Text style={styles.skipBtnTxt}>Skip for now</Text>
              </TouchableOpacity>
            )}

            <View style={styles.contentSection}>
              <View style={styles.textWrap}>
                <Text style={styles.mainTitle}>Health History</Text>
                <Text style={styles.subTitle}>Step {currentStep} of {totalSteps}</Text>
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                  </View>
                </View>
              </View>

              <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
                {currentStep === 1 && (
                  <View>
                    <Text style={styles.innerStepTitle}>Basic Profile</Text>
                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>Your Name</Text>
                      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full Name" placeholderTextColor="#6B7280" />
                    </View>
                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>Email (Optional)</Text>
                      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#6B7280" />
                    </View>
                  </View>
                )}

                {currentStep === 2 && (
                  <View>
                    <Text style={styles.innerStepTitle}>Personal Details</Text>
                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>Date of Birth</Text>
                      <TextInput style={styles.input} value={data.dob} onChangeText={(t) => setData({ ...data, dob: t })} placeholder="DD/MM/YYYY" placeholderTextColor="#6B7280" />
                    </View>
                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>Gender</Text>
                      <View style={styles.bloodTypeGrid}>
                        {['male', 'female', 'other'].map((g) => (
                          <TouchableOpacity key={g} style={[styles.bloodTypeBtn, data.gender === g && styles.bloodTypeBtnActive, { width: (SCREEN_WIDTH - 68) / 3 }]} onPress={() => setData({ ...data, gender: g })}>
                            <Text style={[styles.bloodTypeText, data.gender === g && styles.bloodTypeTextActive]}>{g.charAt(0).toUpperCase() + g.slice(1)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View style={styles.inputRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sectionLabel}>Height (cm)</Text>
                        <TextInput style={styles.input} value={data.height} onChangeText={(t) => setData({ ...data, height: t })} placeholder="175" keyboardType="numeric" placeholderTextColor="#6B7280" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.sectionLabel}>Weight (kg)</Text>
                        <TextInput style={styles.input} value={data.weight} onChangeText={(t) => setData({ ...data, weight: t })} placeholder="70" keyboardType="numeric" placeholderTextColor="#6B7280" />
                      </View>
                    </View>
                    <View style={[styles.section, { marginTop: 20 }]}>
                      <Text style={styles.sectionLabel}>Blood Type</Text>
                      <View style={styles.bloodTypeGrid}>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((type) => (
                          <TouchableOpacity key={type} style={[styles.bloodTypeBtn, data.bloodType === type && styles.bloodTypeBtnActive]} onPress={() => setData({ ...data, bloodType: type })}>
                            <Text style={[styles.bloodTypeText, data.bloodType === type && styles.bloodTypeTextActive]}>{type}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                )}

                {currentStep === 3 && (
                  <View>
                    <Text style={styles.innerStepTitle}>Medical Conditions</Text>
                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>Allergies</Text>
                      <View style={styles.inputRow}>
                        <TextInput style={styles.input} value={tempInputs.allergies} onChangeText={(t) => setTempInputs({ ...tempInputs, allergies: t })} placeholder="e.g. Peanuts" placeholderTextColor="#6B7280" />
                        <TouchableOpacity style={styles.addBtn} onPress={() => addToList('allergies', tempInputs.allergies)}>
                          <Ionicons name="add" size={24} color="#02101f" />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.tagContainer}>
                        {data.allergies.map((val, idx) => (
                          <View key={idx} style={styles.tag}><Text style={styles.tagText}>{val}</Text><TouchableOpacity onPress={() => removeFromList('allergies', idx)}><Ionicons name="close" size={16} color="#fff" /></TouchableOpacity></View>
                        ))}
                      </View>
                    </View>
                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>Chronic Conditions</Text>
                      <View style={styles.inputRow}>
                        <TextInput style={styles.input} value={tempInputs.chronicConditions} onChangeText={(t) => setTempInputs({ ...tempInputs, chronicConditions: t })} placeholder="e.g. Diabetes" placeholderTextColor="#6B7280" />
                        <TouchableOpacity style={styles.addBtn} onPress={() => addToList('chronicConditions', tempInputs.chronicConditions)}>
                          <Ionicons name="add" size={24} color="#02101f" />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.tagContainer}>
                        {data.chronicConditions.map((val, idx) => (
                          <View key={idx} style={styles.tag}><Text style={styles.tagText}>{val}</Text><TouchableOpacity onPress={() => removeFromList('chronicConditions', idx)}><Ionicons name="close" size={16} color="#fff" /></TouchableOpacity></View>
                        ))}
                      </View>
                    </View>
                  </View>
                )}

                {currentStep === 4 && (
                  <View>
                    <Text style={styles.innerStepTitle}>History & Meds</Text>
                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>Current Medications</Text>
                      <View style={styles.inputRow}>
                        <TextInput style={styles.input} value={tempInputs.currentMedications} onChangeText={(t) => setTempInputs({ ...tempInputs, currentMedications: t })} placeholder="e.g. Metformin" placeholderTextColor="#6B7280" />
                        <TouchableOpacity style={styles.addBtn} onPress={() => addToList('currentMedications', tempInputs.currentMedications)}><Ionicons name="add" size={24} color="#02101f" /></TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>Past Surgeries</Text>
                      <View style={styles.inputRow}>
                        <TextInput style={styles.input} value={tempInputs.pastSurgeries} onChangeText={(t) => setTempInputs({ ...tempInputs, pastSurgeries: t })} placeholder="Add surgery" placeholderTextColor="#6B7280" />
                        <TouchableOpacity style={styles.addBtn} onPress={() => addToList('pastSurgeries', tempInputs.pastSurgeries)}><Ionicons name="add" size={24} color="#02101f" /></TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>Family Medical History</Text>
                      <View style={styles.inputRow}>
                        <TextInput style={styles.input} value={tempInputs.familyHistory} onChangeText={(t) => setTempInputs({ ...tempInputs, familyHistory: t })} placeholder="Add condition" placeholderTextColor="#6B7280" />
                        <TouchableOpacity style={styles.addBtn} onPress={() => addToList('familyHistory', tempInputs.familyHistory)}><Ionicons name="add" size={24} color="#02101f" /></TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}

                {currentStep === 5 && (
                  <View>
                    <Text style={styles.innerStepTitle}>Lifestyle</Text>
                    <View style={styles.section}>
                      <TouchableOpacity style={styles.checkboxRow} onPress={() => setData({ ...data, lifestyleFactors: { ...data.lifestyleFactors, smoking: !data.lifestyleFactors.smoking }})}>
                        <View style={[styles.checkbox, data.lifestyleFactors.smoking && styles.checkboxActive]}>{data.lifestyleFactors.smoking && <Ionicons name="checkmark" size={16} color="#02101f" />}</View>
                        <Text style={styles.checkboxLabel}>Daily Smoking</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.checkboxRow} onPress={() => setData({ ...data, lifestyleFactors: { ...data.lifestyleFactors, alcohol: !data.lifestyleFactors.alcohol }})}>
                        <View style={[styles.checkbox, data.lifestyleFactors.alcohol && styles.checkboxActive]}>{data.lifestyleFactors.alcohol && <Ionicons name="checkmark" size={16} color="#02101f" />}</View>
                        <Text style={styles.checkboxLabel}>Regular Alcohol</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>

              <View style={styles.actionRow}>
                {currentStep > 1 && (
                  <TouchableOpacity style={styles.smallBackBtn} onPress={() => setCurrentStep(currentStep - 1)}>
                    <ButtonBg
                      width="100%"
                      height="100%"
                      style={StyleSheet.absoluteFill}
                      preserveAspectRatio="xMidYMid slice"
                      pointerEvents="none"
                    />
                    <Ionicons name="arrow-back" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.loginBtnFlex, saving && styles.btnDisabled]} onPress={handleNext} disabled={saving}>
                  <ButtonBg
                    width="100%"
                    height="100%"
                    style={StyleSheet.absoluteFill}
                    preserveAspectRatio="xMidYMid slice"
                    pointerEvents="none"
                  />
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionBtnTxt}>
                      {currentStep === totalSteps ? 'Complete' : 'Next Step'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1 },
  fullScreenStep: { flex: 1 },
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
  skipBtnLink: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
  },
  skipBtnTxt: {
    color: '#fff',
    fontSize: 13,
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
  },
  contentSection: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'flex-start',
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    paddingTop: 20,
  },
  textWrap: {
    marginBottom: 20,
  },
  mainTitle: {
    color: '#fff',
    fontSize: 28,
    textAlign: 'center',
    fontFamily: HELVETICA_NEUE_REGULAR,
    fontWeight: '400',
  },
  subTitle: {
    color: '#fff',
    fontSize: 16,
    marginTop: 4,
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
    textAlign: 'center',
  },
  innerStepTitle: {
    color: '#fff',
    fontSize: 20,
    fontFamily: HELVETICA_NEUE_REGULAR,
    fontWeight: '400',
    marginBottom: 16,
  },
  progressContainer: {
    marginTop: 12,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  formScroll: {
    flex: 1,
  },
  section: {
    marginBottom: 20,
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: 0,
    padding: 0,
  },
  sectionLabel: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
    fontFamily: HELVETICA_NEUE_REGULAR,
    fontWeight: '400',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 50,
    backgroundColor: 'rgba(2,12,29,0.4)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    color: '#fff',
    paddingHorizontal: 16,
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
  },
  addBtn: {
    width: 50,
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  tagText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
  },
  bloodTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bloodTypeBtn: {
    width: (SCREEN_WIDTH - 88) / 4,
    height: 45,
    backgroundColor: 'rgba(2,12,29,0.4)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloodTypeBtnActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  bloodTypeText: {
    color: '#fff',
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
  },
  bloodTypeTextActive: {
    color: '#02101f',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#fff',
  },
  checkboxLabel: {
    color: '#fff',
    fontSize: 15,
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  smallBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0,
    borderColor: '#FFFFFF',
  },
  loginBtnFlex: {
    flex: 1,
    height: 48,
    borderRadius: 24,
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
  btnDisabled: {
    opacity: 0.5,
  },
  loadingText: {
    marginTop: 12,
    color: '#fff',
    fontFamily: HELVETICA_NEUE_LIGHT,
    fontWeight: '300',
  },
});
