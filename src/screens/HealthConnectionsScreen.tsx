import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  Image,
} from 'react-native';

const logoImg = require('../../assets/applogo.png');
import * as HealthKitService from '../services/healthkit';
import api from '../services/api';

export default function HealthConnectionsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // HealthKit native availability (only true in native builds on iOS)
  const healthKitAvailable = Platform.OS === 'ios' && HealthKitService.isModuleAvailable();
  const [healthKitAuthorized, setHealthKitAuthorized] = useState(false);

  const loadConnections = useCallback(async () => {
    try {
      // Beta: Apple Health only. No external wearables connectors.
      // We keep this function so pull-to-refresh works and future sources can be re-added later.
    } catch (err: any) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // ─── Direct HealthKit sync (native builds only) ─────────────

  const handleHealthKitSync = async () => {
    if (!healthKitAvailable) {
      Alert.alert(
        '📱 Native Build Required',
        'Apple Health can only be read from a native iOS build.\n\n' +
        'You\'re running in Expo Go which doesn\'t support native HealthKit.\n\n' +
        'To get REAL Apple Watch data:\n' +
        '1. Run: npx eas build --platform ios --profile development\n' +
        '2. Install the .ipa on your iPhone\n' +
        '3. The app will ask for Health permissions\n' +
        '4. Your real data will sync automatically',
      );
      return;
    }

    setSyncing(true);
    try {
      // Request HealthKit authorization
      const authorized = await HealthKitService.requestAuthorization(
        ['Steps', 'HeartRate', 'RestingHeartRate', 'HRV', 'Sleep',
         'ActiveEnergy', 'Weight', 'OxygenSaturation', 'VO2Max',
         'RespiratoryRate', 'Distance', 'FlightsClimbed', 'Workout'],
        [],
      );
      setHealthKitAuthorized(authorized);

      if (!authorized) {
        Alert.alert('Permission Denied', 'Please allow Health access in Settings → Privacy → Health → Mediva');
        return;
      }

      // Read real data from HealthKit and push to backend
      await HealthKitService.syncToBackend(api);

      Alert.alert(
        '✅ Real Data Synced',
        'Your actual Apple Watch / HealthKit data has been synced to Mediva!',
      );
    } catch (err: any) {
      Alert.alert('Sync Error', err.message || 'Failed to read HealthKit data');
    } finally {
      setSyncing(false);
    }
  };

  const handleSync = async () => {
    // If HealthKit is available natively, prefer direct sync
    if (healthKitAvailable && healthKitAuthorized) {
      await handleHealthKitSync();
      return;
    }

    setSyncing(true);
    try {
      await handleHealthKitSync();
    } catch (err: any) {
      Alert.alert('Sync Error', err.message || 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Loading health sources...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          loadConnections();
        }} />
      }
    >
      {/* Header */}
      <View style={styles.headerCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Image source={logoImg} style={{ width: 32, height: 32, marginRight: 8, borderRadius: 6 }} resizeMode="contain" />
          <Text style={styles.headerTitle}>Health Connections</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Connect your health devices and wearables
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>1</Text>
            <Text style={styles.statLabel}>Source</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>🍎</Text>
            <Text style={styles.statLabel}>Apple Health</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {healthKitAvailable ? '✅' : '📱'}
            </Text>
            <Text style={styles.statLabel}>
              {healthKitAvailable ? 'Native' : 'Expo Go'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.syncButton}
          onPress={handleSync}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.syncButtonText}>
              {healthKitAvailable ? '🔄 Sync Apple Health' : 'ℹ️ How to enable Apple Health'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Runtime mode banner */}
      {!healthKitAvailable && Platform.OS === 'ios' && (
        <View style={[styles.bannerCard, { backgroundColor: '#FFF3E0', borderColor: '#FFE0B2' }]}>
          <Text style={styles.bannerIcon}>⚠️</Text>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>Running in Expo Go</Text>
            <Text style={styles.bannerText}>
              Expo Go cannot access Apple Health. All health data shown is{' '}
              <Text style={{ fontWeight: '700', color: '#E65100' }}>DEMO / simulated</Text> data.
              {'\n\n'}To read your <Text style={styles.bold}>real Apple Watch</Text> data:
            </Text>
            <View style={styles.stepsList}>
              <Text style={styles.stepItem}>1️⃣  Install EAS CLI: npm i -g eas-cli</Text>
              <Text style={styles.stepItem}>2️⃣  Build: npx eas build --platform ios --profile development</Text>
              <Text style={styles.stepItem}>3️⃣  Install the build on your iPhone</Text>
              <Text style={styles.stepItem}>4️⃣  The app will request Health permissions</Text>
              <Text style={styles.stepItem}>5️⃣  Real Apple Watch data flows in automatically</Text>
            </View>
            <Text style={[styles.bannerText, { marginTop: 6, fontStyle: 'italic' }]}>
              ✅ No Mac needed — EAS builds in the cloud!
            </Text>
          </View>
        </View>
      )}

      {healthKitAvailable && (
        <View style={[styles.bannerCard, { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' }]}>
          <Text style={styles.bannerIcon}>✅</Text>
          <View style={styles.bannerContent}>
            <Text style={[styles.bannerTitle, { color: '#2E7D32' }]}>
              Native Build — Real Data Available
            </Text>
            <Text style={[styles.bannerText, { color: '#1B5E20' }]}>
              This build can read your actual Apple Health data directly from your iPhone.
              Tap "Connect Apple Health" to authorize and sync real data.
            </Text>
          </View>
        </View>
      )}

      {/* Source cards */}
      <Text style={styles.sectionTitle}>Apple Health</Text>
      <View style={styles.sourceCard}>
        <View style={styles.sourceHeader}>
          <View style={styles.sourceTitleRow}>
            <Text style={styles.sourceIcon}>🍎</Text>
            <View style={styles.sourceTitleCol}>
              <Text style={styles.sourceName}>Apple Health / Apple Watch</Text>
              <Text style={styles.sourceLastSync}>
                {healthKitAvailable ? 'Native build: Real data available' : 'Expo Go: Requires EAS iOS build'}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={[styles.statusBadge, healthKitAvailable ? styles.statusConnected : styles.statusDisconnected]}>
              <Text style={[styles.statusText, healthKitAvailable ? styles.statusTextConnected : styles.statusTextDisconnected]}>
                {healthKitAvailable ? '● Ready' : '○ Not available'}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sourceDescription}>
          Mediva reads your Apple Health data (from Apple Watch) and continuously updates your unified health profile.
        </Text>

        <View style={styles.dataTypesRow}>
          {['Steps', 'Heart Rate', 'Resting HR', 'HRV', 'Sleep', 'SpO₂', 'Weight', 'Blood Pressure'].map((t) => (
            <View key={t} style={styles.dataTypeBadge}>
              <Text style={styles.dataTypeText}>{t}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.connectBtn, { backgroundColor: '#111' }, syncing && styles.connectBtnDisabled]}
          onPress={handleSync}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.connectText}>
              {healthKitAvailable ? '🔄 Sync Apple Health Now' : '📱 Build iOS app to enable HealthKit'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {healthKitAvailable
            ? '✅ Native build — real health data available'
            : '📱 Expo Go — demo data mode'}
        </Text>
        <Text style={styles.footerText}>Apple Health only • Beta</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#888', fontSize: 14 },

  headerCard: {
    backgroundColor: '#4A90E2',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 6 },
  headerSubtitle: { fontSize: 14, color: '#D0E3FF', marginBottom: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  syncButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  syncButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  bannerCard: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  bannerIcon: { fontSize: 24, marginRight: 12, marginTop: 2 },
  bannerContent: { flex: 1 },
  bannerTitle: { fontSize: 15, fontWeight: '700', color: '#E65100', marginBottom: 6 },
  bannerText: { fontSize: 12, color: '#BF360C', lineHeight: 18 },
  bold: { fontWeight: '700' },
  stepsList: { marginTop: 8 },
  stepItem: { fontSize: 11, color: '#BF360C', lineHeight: 20, paddingLeft: 4 },

  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 12 },

  sourceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  sourceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  sourceTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  sourceIcon: { fontSize: 30, marginRight: 12 },
  sourceTitleCol: { flex: 1 },
  sourceName: { fontSize: 17, fontWeight: '700', color: '#333' },
  sourceLastSync: { fontSize: 11, color: '#888', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusConnected: { backgroundColor: '#E8F5E9' },
  statusDisconnected: { backgroundColor: '#F5F5F5' },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusTextConnected: { color: '#2E7D32' },
  statusTextDisconnected: { color: '#999' },

  demoBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  demoBadgeText: { fontSize: 9, fontWeight: '700', color: '#E65100' },

  realBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  realBadgeText: { fontSize: 9, fontWeight: '700', color: '#2E7D32' },

  sourceDescription: { fontSize: 13, color: '#666', lineHeight: 19, marginBottom: 10 },

  dataTypesRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  dataTypeBadge: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 5,
    marginBottom: 5,
  },
  dataTypeText: { fontSize: 10, color: '#666', fontWeight: '500' },

  connectedActions: { flexDirection: 'row', justifyContent: 'space-between' },
  syncSourceBtn: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  syncSourceText: { color: '#1565C0', fontWeight: '600', fontSize: 14 },
  disconnectBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  disconnectText: { color: '#D32F2F', fontWeight: '500', fontSize: 14 },

  connectBtn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  connectBtnDisabled: { opacity: 0.6 },
  connectText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  footer: { alignItems: 'center', paddingVertical: 30 },
  footerText: { fontSize: 12, color: '#ccc' },
});
