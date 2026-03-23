import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import polarService from '../services/polar';
import DataCard from '../components/DataCard';
import ConnectPrompt from '../components/ConnectPrompt';
import PlatformBadge from '../components/PlatformBadge';

export default function PolarScreen() {
  const [connected, setConnected] = useState(false);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    // Physical info
    weight: null as number | null,
    height: null as number | null,
    restingHR: null as number | null,
    maxHR: null as number | null,
    vo2Max: null as number | null,
    // Activity
    steps: 0,
    calories: 0,
    activeCalories: 0,
    activityGoal: 0,
    // Sleep
    sleepScore: null as number | null,
    deepSleep: 0,
    remSleep: 0,
    lightSleep: 0,
    sleepCycles: 0,
    // Nightly Recharge
    rechargeStatus: null as number | null,
    hrvAvg: null as number | null,
    breathingRate: null as number | null,
    ansCharge: null as number | null,
    // Exercises
    exerciseCount: 0,
    lastExerciseSport: '',
    lastExerciseCalories: 0,
    lastExerciseDuration: '',
    lastExerciseAvgHR: null as number | null,
  });

  const handleConnect = async (accessToken: string) => {
    try {
      setLoading(true);
      polarService.configure({ accessToken });

      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const [physicalInfo, activities, sleep, recharge, exercises] = await Promise.all([
        polarService.getPhysicalInfo(),
        polarService.listActivitySummaries(),
        polarService.getSleepData(yesterday),
        polarService.getNightlyRecharge(yesterday),
        polarService.listExercises(),
      ]);

      const latestActivity = activities[activities.length - 1];
      const latestExercise = exercises.length > 0 ? exercises[exercises.length - 1] : null;

      setData({
        weight: physicalInfo?.weight || null,
        height: physicalInfo?.height || null,
        restingHR: physicalInfo?.resting_heart_rate || null,
        maxHR: physicalInfo?.maximum_heart_rate || null,
        vo2Max: physicalInfo?.vo2_max || null,
        steps: latestActivity?.active_steps || 0,
        calories: latestActivity?.calories || 0,
        activeCalories: latestActivity?.active_calories || 0,
        activityGoal: latestActivity?.daily_activity_goal || 0,
        sleepScore: sleep?.sleep_score || null,
        deepSleep: sleep?.deep_sleep || 0,
        remSleep: sleep?.rem_sleep || 0,
        lightSleep: sleep?.light_sleep || 0,
        sleepCycles: sleep?.sleep_cycles || 0,
        rechargeStatus: recharge?.nightly_recharge_status || null,
        hrvAvg: recharge?.heart_rate_variability_avg || null,
        breathingRate: recharge?.breathing_rate_avg || null,
        ansCharge: recharge?.ans_charge || null,
        exerciseCount: exercises.length,
        lastExerciseSport: latestExercise?.sport || '',
        lastExerciseCalories: latestExercise?.calories || 0,
        lastExerciseDuration: latestExercise?.duration || '',
        lastExerciseAvgHR: latestExercise?.heart_rate?.average || null,
      });

      setConnected(true);
    } catch (error) {
      console.error('Polar connection error:', error);
      Alert.alert('Connection Error', 'Failed to connect to Polar. Check your API token and try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (isoDuration: string): string => {
    if (!isoDuration) return '--';
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return isoDuration;
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const getRechargeLabel = (status: number | null): string => {
    if (status === null) return '--';
    if (status >= 3) return 'Very Good';
    if (status >= 1) return 'Good';
    if (status >= -1) return 'Normal';
    if (status >= -3) return 'Compromised';
    return 'Poor';
  };

  // Render the data sync info section
  const renderSyncInfo = () => (
    <View style={styles.syncCard}>
      <Text style={styles.syncTitle}>🔄 Dual Data Flow</Text>
      <Text style={styles.syncDescription}>
        Polar data reaches Mediva through two paths:
      </Text>

      <View style={styles.syncPath}>
        <View style={styles.syncPathHeader}>
          <Text style={styles.syncPathIcon}>☁️</Text>
          <Text style={styles.syncPathTitle}>Polar Accesslink API (Direct)</Text>
        </View>
        <Text style={styles.syncPathDesc}>
          Exclusive data: Nightly Recharge, ANS recovery, detailed training metrics, VO2 Max
        </Text>
        <View style={styles.syncPathBadge}>
          <Text style={styles.syncPathBadgeText}>✅ Connected via this screen</Text>
        </View>
      </View>

      <View style={styles.syncPath}>
        <View style={styles.syncPathHeader}>
          <Text style={styles.syncPathIcon}>{Platform.OS === 'ios' ? '🍎' : '🤖'}</Text>
          <Text style={styles.syncPathTitle}>
            {Platform.OS === 'ios' ? 'Apple HealthKit' : 'Health Connect'} (via Polar Flow app)
          </Text>
        </View>
        <Text style={styles.syncPathDesc}>
          Synced data: Steps, heart rate, workouts, sleep, calories
        </Text>
        <View style={[styles.syncPathBadge, { backgroundColor: '#FFF3E0' }]}>
          <Text style={[styles.syncPathBadgeText, { color: '#E65100' }]}>
            📱 Requires Polar Flow app installed with sync enabled
          </Text>
        </View>
      </View>

      <View style={styles.syncNote}>
        <Text style={styles.syncNoteText}>
          💡 For complete data, use both: the Polar API (this screen) gives you exclusive metrics like
          Nightly Recharge, while {Platform.OS === 'ios' ? 'HealthKit' : 'Health Connect'} combines Polar data with other sources.
        </Text>
      </View>
    </View>
  );

  if (!connected) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>🐻‍❄️ Polar</Text>
            <Text style={styles.subtitle}>Training, Sleep & Nightly Recharge</Text>
          </View>
          <PlatformBadge available={true} connected={false} platformName="Polar" />
        </View>

        {renderSyncInfo()}

        <ConnectPrompt
          platform="Polar"
          icon="🐻‍❄️"
          description="Connect your Polar device to track training sessions, daily activity, sleep analysis, and Nightly Recharge recovery metrics via the Polar Accesslink API."
          docsUrl="https://www.polar.com/accesslink-api/"
          onConnect={handleConnect}
          tokenValue={token}
          onTokenChange={setToken}
          color="#D32F2F"
        />

        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>Available Data Types</Text>

          <Text style={styles.apiLabel}>🔴 Polar API Exclusive</Text>
          {[
            { icon: '🔋', name: 'Nightly Recharge (ANS Recovery)' },
            { icon: '📊', name: 'HRV & Breathing Rate' },
            { icon: '💪', name: 'VO2 Max & Physical Info' },
            { icon: '📊', name: 'Sport-specific Training Metrics' },
            { icon: '❤️', name: 'Heart Rate Zones per Exercise' },
          ].map((item, i) => (
            <View key={`e${i}`} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{item.icon}</Text>
              <Text style={styles.featureName}>{item.name}</Text>
              <Text style={styles.exclusiveBadge}>API Only</Text>
            </View>
          ))}

          <Text style={[styles.apiLabel, { marginTop: 16 }]}>
            🔵 Also syncs to {Platform.OS === 'ios' ? 'HealthKit' : 'Health Connect'}
          </Text>
          {[
            { icon: '👣', name: 'Steps & Active Time' },
            { icon: '❤️', name: 'Heart Rate' },
            { icon: '🏃', name: 'Exercise Sessions' },
            { icon: '😴', name: 'Sleep Duration & Stages' },
            { icon: '🔥', name: 'Calories' },
          ].map((item, i) => (
            <View key={`s${i}`} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{item.icon}</Text>
              <Text style={styles.featureName}>{item.name}</Text>
              <Text style={styles.syncedBadge}>Synced</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🐻‍❄️ Polar</Text>
          <Text style={styles.subtitle}>Training, Sleep & Nightly Recharge</Text>
        </View>
        <PlatformBadge available={true} connected={true} platformName="Polar" />
      </View>

      {/* Nightly Recharge Card - Polar Exclusive */}
      <View style={styles.rechargeCard}>
        <View style={styles.exclusiveTag}>
          <Text style={styles.exclusiveTagText}>⭐ Polar Exclusive</Text>
        </View>
        <Text style={styles.rechargeTitle}>Nightly Recharge</Text>
        <Text style={styles.rechargeValue}>{getRechargeLabel(data.rechargeStatus)}</Text>
        <View style={styles.rechargeStats}>
          <View style={styles.rechargeStat}>
            <Text style={styles.rechargeStatValue}>{data.hrvAvg ? data.hrvAvg.toFixed(0) : '--'}</Text>
            <Text style={styles.rechargeStatLabel}>HRV (ms)</Text>
          </View>
          <View style={styles.rechargeStat}>
            <Text style={styles.rechargeStatValue}>{data.breathingRate ? data.breathingRate.toFixed(1) : '--'}</Text>
            <Text style={styles.rechargeStatLabel}>Breathing</Text>
          </View>
          <View style={styles.rechargeStat}>
            <Text style={styles.rechargeStatValue}>{data.ansCharge ? data.ansCharge.toFixed(0) : '--'}</Text>
            <Text style={styles.rechargeStatLabel}>ANS Charge</Text>
          </View>
        </View>
      </View>

      {/* Sync Status */}
      <View style={styles.syncStatusBar}>
        <Text style={styles.syncStatusIcon}>🔄</Text>
        <Text style={styles.syncStatusText}>
          Steps, HR, workouts & sleep also available in{' '}
          {Platform.OS === 'ios' ? 'HealthKit' : 'Health Connect'} tab via Polar Flow sync
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Daily Activity</Text>
      <DataCard icon="👣" title="Steps" value={data.steps} color="#D32F2F" subtitle="Also synced to HealthKit/Health Connect" />
      <DataCard icon="🔥" title="Calories" value={data.calories} unit="kcal" color="#FF5722" />
      <DataCard icon="⚡" title="Active Calories" value={data.activeCalories} unit="kcal" color="#FF9800" />
      <DataCard icon="🎯" title="Activity Goal" value={data.activityGoal > 0 ? `${Math.round(data.steps / data.activityGoal * 100)}` : '--'} unit="%" color="#4CAF50" subtitle={`Goal: ${data.activityGoal} steps`} />

      <Text style={styles.sectionTitle}>Sleep</Text>
      <DataCard icon="⭐" title="Sleep Score" value={data.sleepScore || '--'} unit="/100" color="#673AB7" />
      <DataCard icon="🛌" title="Deep Sleep" value={`${(data.deepSleep / 3600).toFixed(1)}`} unit="hrs" color="#3F51B5" />
      <DataCard icon="🌙" title="REM Sleep" value={`${(data.remSleep / 3600).toFixed(1)}`} unit="hrs" color="#9C27B0" />
      <DataCard icon="💤" title="Light Sleep" value={`${(data.lightSleep / 3600).toFixed(1)}`} unit="hrs" color="#7C4DFF" />
      <DataCard icon="🔄" title="Sleep Cycles" value={data.sleepCycles || '--'} color="#00BCD4" />

      <Text style={styles.sectionTitle}>Physical Info (Polar Exclusive)</Text>
      <DataCard icon="⚖️" title="Weight" value={data.weight ? data.weight.toFixed(1) : '--'} unit="kg" color="#795548" />
      <DataCard icon="📏" title="Height" value={data.height ? data.height.toFixed(0) : '--'} unit="cm" color="#607D8B" />
      <DataCard icon="💓" title="Resting HR" value={data.restingHR || '--'} unit="bpm" color="#E91E63" />
      <DataCard icon="❤️" title="Max HR" value={data.maxHR || '--'} unit="bpm" color="#F44336" />
      <DataCard icon="🫁" title="VO2 Max" value={data.vo2Max ? data.vo2Max.toFixed(1) : '--'} unit="ml/kg/min" color="#00BCD4" subtitle="Polar exclusive metric" />

      <Text style={styles.sectionTitle}>Recent Training</Text>
      {data.exerciseCount > 0 ? (
        <>
          <DataCard icon="🏋️" title="Last Exercise" value={data.lastExerciseSport || '--'} color="#D32F2F" />
          <DataCard icon="⏱️" title="Duration" value={formatDuration(data.lastExerciseDuration)} color="#FF5722" />
          <DataCard icon="🔥" title="Calories" value={data.lastExerciseCalories} unit="kcal" color="#FF9800" />
          <DataCard icon="❤️" title="Avg Heart Rate" value={data.lastExerciseAvgHR || '--'} unit="bpm" color="#E91E63" />
          <Text style={styles.exerciseCount}>Total exercises available: {data.exerciseCount}</Text>
        </>
      ) : (
        <Text style={styles.emptyText}>No recent exercises found</Text>
      )}

      <TouchableOpacity style={styles.disconnectButton} onPress={() => { setConnected(false); setToken(''); }}>
        <Text style={styles.disconnectText}>Disconnect Polar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 13, color: '#888', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#555', marginTop: 20, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Sync Info Card
  syncCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  syncTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 6 },
  syncDescription: { fontSize: 13, color: '#666', marginBottom: 14, lineHeight: 20 },
  syncPath: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  syncPathHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  syncPathIcon: { fontSize: 20, marginRight: 8 },
  syncPathTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  syncPathDesc: { fontSize: 12, color: '#666', lineHeight: 18, marginBottom: 8 },
  syncPathBadge: { backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  syncPathBadgeText: { fontSize: 11, color: '#2E7D32', fontWeight: '500' },
  syncNote: { backgroundColor: '#E3F2FD', borderRadius: 10, padding: 12, marginTop: 6 },
  syncNoteText: { fontSize: 12, color: '#1565C0', lineHeight: 18 },

  // Recharge Card
  rechargeCard: {
    backgroundColor: '#D32F2F',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 10,
  },
  exclusiveTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 8,
  },
  exclusiveTagText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  rechargeTitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  rechargeValue: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  rechargeStats: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  rechargeStat: { alignItems: 'center' },
  rechargeStatValue: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 2 },
  rechargeStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },

  // Sync Status Bar
  syncStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  syncStatusIcon: { fontSize: 18, marginRight: 8 },
  syncStatusText: { flex: 1, fontSize: 12, color: '#1565C0', lineHeight: 18 },

  // Features Section
  featuresSection: { padding: 20, backgroundColor: '#F8F9FA', borderRadius: 16, marginTop: 10 },
  featuresTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  apiLabel: { fontSize: 13, fontWeight: '700', color: '#D32F2F', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  featureIcon: { fontSize: 22, marginRight: 12, width: 30 },
  featureName: { fontSize: 15, color: '#555', flex: 1 },
  exclusiveBadge: { fontSize: 10, color: '#D32F2F', backgroundColor: '#FFCDD2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontWeight: '600', overflow: 'hidden' },
  syncedBadge: { fontSize: 10, color: '#1565C0', backgroundColor: '#BBDEFB', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontWeight: '600', overflow: 'hidden' },

  emptyText: { fontSize: 14, color: '#aaa', textAlign: 'center', paddingVertical: 20 },
  exerciseCount: { fontSize: 13, color: '#888', textAlign: 'center', marginTop: 8 },
  disconnectButton: { alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, backgroundColor: '#FFE5E5', marginTop: 30, marginBottom: 30 },
  disconnectText: { color: '#E74C3C', fontSize: 14, fontWeight: '600' },
});
