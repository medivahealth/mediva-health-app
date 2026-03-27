import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as HealthKitService from '../services/healthkit';
import * as HealthConnectService from '../services/healthconnect';
import api from '../services/api';
import { SIZES } from '../theme';

interface DevicesScreenProps {
  onBack: () => void;
}

export default function DevicesScreen({ onBack }: DevicesScreenProps) {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [healthConnectInstalled, setHealthConnectInstalled] = useState(false);
  const [healthData, setHealthData] = useState<any>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const isIOS = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';
  const isHealthKitAvailable = isIOS && HealthKitService.isModuleAvailable();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Check Health authorization status based on platform
      if (isHealthKitAvailable) {
        const auth = await HealthKitService.requestAuthorization(
          ['Workout', 'Steps', 'Distance', 'HeartRate', 'RestingHeartRate', 'HRV', 
           'Sleep', 'Height', 'Weight', 'OxygenSaturation', 'VO2Max', 'RespiratoryRate'],
          []
        );
        setAuthorized(auth);
      } else if (isAndroid) {
        const installed = await HealthConnectService.checkHealthConnectInstalled();
        setHealthConnectInstalled(installed);
        const hasPermission = installed
          ? await HealthConnectService.hasHealthConnectPermission()
          : false;
        setAuthorized(hasPermission);
      }

      // Load health summary from backend
      const summary = await api.get('/health/summary').catch(() => null);
      if (summary) {
        setHealthData(summary);
        setLastSynced(new Date().toISOString());
      }
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      if (isHealthKitAvailable) {
        const auth = authorized
          ? true
          : await HealthKitService.requestAuthorization(
              ['Workout', 'Steps', 'Distance', 'HeartRate', 'RestingHeartRate', 'HRV', 'Sleep', 'Height', 'Weight', 'OxygenSaturation', 'VO2Max', 'RespiratoryRate'],
              []
            );
        setAuthorized(auth);
        if (!auth) {
          Alert.alert('Permission Required', 'Please allow Apple Health permissions to sync your data.');
          return;
        }
        // Sync HealthKit data to backend
        await HealthKitService.syncToBackend(api);
      } else if (isAndroid) {
        const installed = await HealthConnectService.checkHealthConnectInstalled();
        setHealthConnectInstalled(installed);
        if (!installed) {
          Alert.alert('Health Connect Required', HealthConnectService.getHealthConnectSetupInstructions());
          return;
        }
        const hasPermissions = await HealthConnectService.requestHealthConnectPermissions();
        setAuthorized(hasPermissions);
        if (!hasPermissions) {
          Alert.alert('Permission Required', 'Please allow Health Connect permissions to sync your data.');
          return;
        }
        await HealthConnectService.syncHealthConnectToBackend(api);
      } else {
        Alert.alert('Unsupported Platform', 'Health source sync is available only on iOS and Android devices.');
        return;
      }
      
      // Refresh data
      await loadData();
      Alert.alert('Synced', 'Health data synced successfully!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  };

  const fmtValue = (v: any, unit?: string) => {
    if (v == null) return '—';
    if (typeof v === 'number') {
      const formatted = v % 1 === 0 ? v.toLocaleString() : v.toFixed(1);
      return unit ? `${formatted} ${unit}` : formatted;
    }
    return String(v);
  };

  const fmtSleep = (v: any) => {
    if (!v) return '—';
    if (typeof v === 'object' && v.durationHours) {
      const h = Math.floor(v.durationHours);
      const m = Math.round((v.durationHours - h) * 60);
      return `${h}h ${m}m`;
    }
    return String(v);
  };

  if (loading) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Health Sources</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={s.loadingText}>Loading health data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Health Sources</Text>
        <TouchableOpacity style={s.syncIconBtn} onPress={handleSync} disabled={syncing} activeOpacity={0.7}>
          {syncing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="sync-outline" size={22} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scrollView} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={s.subtitle}>
          {isIOS
            ? 'Connect Apple Health to get personalized health advice based on your real data.'
            : 'Connect Android Health Connect to sync real health data from Google Fit and other apps.'}
        </Text>

        {/* Platform Health Source Card */}
        <View style={s.sourceCard}>
          <View style={s.sourceHeader}>
            <View style={s.sourceInfo}>
              <Text style={s.sourceName}>{isIOS ? 'Apple Health' : 'Android Health Connect'}</Text>
              <Text style={[s.sourceStatus, authorized && s.sourceStatusConnected]}>
                {isIOS
                  ? (isHealthKitAvailable
                      ? (authorized ? 'Connected • Syncing data' : 'Not authorized')
                      : 'Requires iOS native build')
                  : (healthConnectInstalled
                      ? (authorized ? 'Connected • Syncing data' : 'Not authorized')
                      : 'Setup required')}
              </Text>
            </View>
            {(isHealthKitAvailable || isAndroid) && (
              <View style={[s.statusBadge, authorized ? s.statusBadgeConnected : s.statusBadgeDisconnected]}>
                <Text style={authorized ? s.statusTextConnected : s.statusTextDisconnected}>
                  {authorized ? 'Connected' : 'Disconnected'}
                </Text>
              </View>
            )}
          </View>

          {authorized && (
            <View style={s.dataPreview}>
              <Text style={s.dataPreviewTitle}>Latest Data</Text>
              <View style={s.dataGrid}>
                <View style={s.dataItem}>
                  <Text style={s.dataLabel}>Steps</Text>
                  <Text style={s.dataValue}>{fmtValue(healthData?.latest?.steps)}</Text>
                </View>
                <View style={s.dataItem}>
                  <Text style={s.dataLabel}>Heart Rate</Text>
                  <Text style={s.dataValue}>{fmtValue(healthData?.latest?.heartRate, 'bpm')}</Text>
                </View>
                <View style={s.dataItem}>
                  <Text style={s.dataLabel}>Sleep</Text>
                  <Text style={s.dataValue}>{fmtSleep(healthData?.latest?.sleep)}</Text>
                </View>
                <View style={s.dataItem}>
                  <Text style={s.dataLabel}>SpO₂</Text>
                  <Text style={s.dataValue}>{fmtValue(healthData?.latest?.spo2, '%')}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Privacy Note */}
        <View style={s.privacyCard}>
          <Text style={s.privacyText}>
            Your health data stays private. It's stored securely and only used to provide personalized health insights.
          </Text>
        </View>

        {/* Sync Button */}
        <TouchableOpacity 
          style={s.syncButton} 
          onPress={handleSync} 
          disabled={syncing}
          activeOpacity={0.7}
        >
          {syncing ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <>
              <Ionicons name="sync-outline" size={18} color="#000000" style={{ marginRight: 8 }} />
              <Text style={s.syncButtonText}>
                {isIOS ? 'Sync Apple Health' : 'Sync Health Connect'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {lastSynced && (
          <Text style={s.lastSyncText}>
            Last synced: {new Date(lastSynced).toLocaleString()}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 28,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: { paddingHorizontal: 8, paddingVertical: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  syncIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 30 },
  headerTitle: {
    fontSize: SIZES.xl,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue',
  },
  subtitle: {
    fontSize: SIZES.sm,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'HelveticaNeue-Light',
    lineHeight: 18,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#000000',
  },
  loadingText: {
    fontSize: SIZES.sm,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'HelveticaNeue-Light',
  },

  // Source Card
  sourceCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 16,
    borderRadius: SIZES.radiusLg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sourceInfo: {
    flex: 1,
  },
  sourceName: {
    fontSize: SIZES.base,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue',
  },
  sourceStatus: {
    fontSize: SIZES.xs,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'HelveticaNeue-Light',
    marginTop: 2,
  },
  sourceStatusConnected: {
    color: 'rgba(255,255,255,0.7)',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: SIZES.radiusFull,
    borderWidth: 1,
  },
  statusBadgeConnected: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  statusBadgeDisconnected: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statusTextConnected: {
    fontSize: SIZES.xs,
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue-Light',
  },
  statusTextDisconnected: {
    fontSize: SIZES.xs,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'HelveticaNeue-Light',
  },

  // Data Preview
  dataPreview: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  dataPreviewTitle: {
    fontSize: SIZES.sm,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue',
    marginBottom: 12,
  },
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dataItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: SIZES.radius,
    padding: 10,
    gap: 8,
  },
  dataLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'HelveticaNeue-Light',
  },
  dataValue: {
    fontSize: SIZES.sm,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue-Light',
    marginLeft: 'auto',
  },

  // Privacy Card
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 16,
    borderRadius: SIZES.radius,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  privacyText: {
    flex: 1,
    fontSize: SIZES.xs,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'HelveticaNeue-Light',
    lineHeight: 16,
  },

  // Sync Button
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: SIZES.radius,
  },
  syncButtonText: {
    fontSize: SIZES.base,
    fontWeight: '400',
    color: '#000000',
    fontFamily: 'HelveticaNeue',
  },
  lastSyncText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'HelveticaNeue-Light',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
});
