import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import ButtonBg from '../../assets/button.svg';
import abdmService from '../services/abdm';
import type { CareContext } from '../types';

interface ABHAScreenProps {
  onBack?: () => void;
}

export default function ABHAScreen({ onBack }: ABHAScreenProps) {
  const [step, setStep] = useState<'choice' | 'create' | 'link' | 'otp' | 'contexts' | 'done'>('choice');
  const [method, setMethod] = useState<'aadhaar' | 'mobile'>('mobile');
  const [identifier, setIdentifier] = useState('');
  const [abhaAddress, setAbhaAddress] = useState('');
  const [txnId, setTxnId] = useState('');
  const [otp, setOtp] = useState('');
  const [abhaResult, setAbhaResult] = useState<{ abhaNumber: string; abhaAddress: string } | null>(null);
  const [careContexts, setCareContexts] = useState<CareContext[]>([]);
  const [selectedContexts, setSelectedContexts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const handleInitiateEnrollment = async () => {
    if (!identifier.trim()) {
      Alert.alert('Error', 'Please enter your identifier');
      return;
    }
    setLoading(true);
    try {
      const result = await abdmService.initiateEnrollment(method, identifier);
      setTxnId(result.txnId);
      setStep('otp');
      Alert.alert('OTP Sent', result.message);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to initiate enrollment');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    try {
      const result = await abdmService.verifyOtp(txnId, otp);
      setAbhaResult(result);
      setStep('done');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkAbha = async () => {
    if (!abhaAddress.trim()) {
      Alert.alert('Error', 'Please enter your ABHA address');
      return;
    }
    setLoading(true);
    try {
      await abdmService.linkExistingAbha(abhaAddress);
      setAbhaResult({ abhaNumber: '', abhaAddress });
      setStep('done');
      Alert.alert('Success', 'ABHA linked successfully');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to link ABHA');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscoverContexts = async () => {
    setLoading(true);
    try {
      const contexts = await abdmService.discoverCareContexts();
      setCareContexts(contexts);
      setStep('contexts');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to discover records');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestConsent = async () => {
    if (selectedContexts.size === 0) {
      Alert.alert('Error', 'Please select at least one record');
      return;
    }
    setLoading(true);
    try {
      await abdmService.requestConsent(Array.from(selectedContexts));
      Alert.alert('Success', 'Consent requested. Records will be fetched once approved.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to request consent');
    } finally {
      setLoading(false);
    }
  };

  const toggleContext = (id: string) => {
    const next = new Set(selectedContexts);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedContexts(next);
  };

  return (
    <View style={styles.container}>
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Ayushman Bharat Health Account</Text>
        <Text style={styles.subtitle}>
          Your unique digital health ID for India
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>What is ABHA?</Text>
        <Text style={styles.infoText}>
          ABHA (Ayushman Bharat Health Account) is your unique digital health ID for India.
          It links your medical records across hospitals, labs, and clinics under the Ayushman Bharat Digital Mission (ABDM).
        </Text>
      </View>

      {step === 'choice' && (
        <View style={styles.choiceContainer}>
          <TouchableOpacity style={styles.choiceButton} onPress={() => setStep('create')}>
            <Text style={styles.choiceTitle}>Create New ABHA</Text>
            <Text style={styles.choiceDescription}>Register using Aadhaar or Mobile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.choiceButton} onPress={() => setStep('link')}>
            <Text style={styles.choiceTitle}>Link Existing ABHA</Text>
            <Text style={styles.choiceDescription}>Already have a health ID? Link it here</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'create' && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Create ABHA</Text>

          <View style={styles.methodRow}>
            <TouchableOpacity
              style={[styles.methodButton, method === 'mobile' && styles.methodActive]}
              onPress={() => setMethod('mobile')}
            >
              <Text style={styles.methodText}>Mobile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.methodButton, method === 'aadhaar' && styles.methodActive]}
              onPress={() => setMethod('aadhaar')}
            >
              <Text style={styles.methodText}>Aadhaar</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder={method === 'mobile' ? 'Enter mobile number' : 'Enter Aadhaar number'}
            placeholderTextColor="#aaa"
            value={identifier}
            onChangeText={setIdentifier}
            keyboardType="number-pad"
          />

          <TouchableOpacity style={styles.buttonWrap} onPress={handleInitiateEnrollment} disabled={loading} activeOpacity={0.8}>
            <ButtonBg width="100%" height={48} style={StyleSheet.absoluteFill} preserveAspectRatio="xMidYMid slice" />
            <View style={styles.buttonInner}>
              {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Send OTP</Text>}
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backLink} onPress={() => setStep('choice')}>
            <Text style={styles.backLinkText}>← Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'link' && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Link Existing ABHA</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your ABHA address (e.g., user@abdm)"
            placeholderTextColor="#aaa"
            value={abhaAddress}
            onChangeText={setAbhaAddress}
          />
          <TouchableOpacity style={styles.primaryButton} onPress={handleLinkAbha} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Link ABHA</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.backLink} onPress={() => setStep('choice')}>
            <Text style={styles.backLinkText}>← Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'otp' && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Verify OTP</Text>
          <TextInput
            style={[styles.input, { textAlign: 'center', letterSpacing: 8, fontSize: 22 }]}
            placeholder="Enter OTP"
            placeholderTextColor="#aaa"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
          />
          <TouchableOpacity style={styles.primaryButton} onPress={handleVerifyOtp} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Verify</Text>}
          </TouchableOpacity>
        </View>
      )}

      {step === 'done' && (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>ABHA Linked!</Text>
          {abhaResult?.abhaNumber && (
            <Text style={styles.abhaNumber}>{abhaResult.abhaNumber}</Text>
          )}
          <Text style={styles.abhaAddr}>{abhaResult?.abhaAddress}</Text>

          <TouchableOpacity style={styles.primaryButton} onPress={handleDiscoverContexts} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryButtonText}>Discover My Records</Text>}
          </TouchableOpacity>
        </View>
      )}

      {step === 'contexts' && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Available Records</Text>
          <Text style={styles.formSubtitle}>Select records you want to fetch:</Text>

          {careContexts.map((ctx) => (
            <TouchableOpacity
              key={ctx.referenceNumber}
              style={[styles.contextCard, selectedContexts.has(ctx.referenceNumber) && styles.contextSelected]}
              onPress={() => toggleContext(ctx.referenceNumber)}
            >
              <View style={styles.contextCheck}>
                <Text style={styles.checkText}>
                  {selectedContexts.has(ctx.referenceNumber) ? '[x]' : '[ ]'}
                </Text>
              </View>
              <View style={styles.contextInfo}>
                <Text style={styles.contextDisplay}>{ctx.display}</Text>
                <Text style={styles.contextFacility}>{ctx.facility}</Text>
                <Text style={styles.contextType}>{ctx.hiType}</Text>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.primaryButton} onPress={handleRequestConsent} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.primaryButtonText}>
                Grant Consent & Fetch ({selectedContexts.size})
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scrollView: { flex: 1, backgroundColor: '#000000' },
  content: { padding: 16, backgroundColor: '#000000' },
  header: {
    marginBottom: 16,
    backgroundColor: '#000000',
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: { fontSize: 20, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontFamily: 'HelveticaNeue-Light' },
  infoCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  infoTitle: { fontSize: 15, fontWeight: '400', color: '#FFFFFF', marginBottom: 6, fontFamily: 'HelveticaNeue' },
  infoText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 20, fontFamily: 'HelveticaNeue-Light' },
  choiceContainer: { gap: 12 },
  choiceButton: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', marginBottom: 12 },
  choiceTitle: { fontSize: 17, fontWeight: '400', color: '#FFFFFF', marginBottom: 4, fontFamily: 'HelveticaNeue' },
  choiceDescription: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: 'HelveticaNeue-Light' },
  formCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  formTitle: { fontSize: 18, fontWeight: '400', color: '#FFFFFF', marginBottom: 4, fontFamily: 'HelveticaNeue' },
  formSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 16, fontFamily: 'HelveticaNeue-Light' },
  methodRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  methodButton: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center' },
  methodActive: { borderColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.1)' },
  methodText: { fontSize: 14, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue-Light' },
  input: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#FFFFFF', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', fontFamily: 'HelveticaNeue-Light' },
  buttonWrap: {
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 6,
  },
  buttonInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '400',
    fontFamily: 'HelveticaNeue',
  },
  primaryButton: { backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryButtonText: { color: '#000000', fontSize: 16, fontWeight: '400', fontFamily: 'HelveticaNeue' },
  backLink: { marginTop: 12, alignItems: 'center' },
  backLinkText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'HelveticaNeue-Light' },
  successCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  successTitle: { fontSize: 22, fontWeight: '400', color: '#FFFFFF', marginBottom: 8, fontFamily: 'HelveticaNeue' },
  abhaNumber: { fontSize: 18, fontWeight: '400', color: '#FFFFFF', marginBottom: 4, fontFamily: 'HelveticaNeue-Light' },
  abhaAddr: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 20, fontFamily: 'HelveticaNeue-Light' },
  contextCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  contextSelected: { borderColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.1)' },
  contextCheck: { marginRight: 12 },
  checkText: { fontSize: 14, color: '#FFFFFF', fontFamily: 'HelveticaNeue-Light' },
  contextInfo: { flex: 1 },
  contextDisplay: { fontSize: 14, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue-Light' },
  contextFacility: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontFamily: 'HelveticaNeue-Light' },
  contextType: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2, fontFamily: 'HelveticaNeue-Light' },
});
