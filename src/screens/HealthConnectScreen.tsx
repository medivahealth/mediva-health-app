import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import * as HealthConnectService from '../services/healthconnect';
import DataCard from '../components/DataCard';
import NotAvailable from '../components/NotAvailable';
import PlatformBadge from '../components/PlatformBadge';

export default function HealthConnectScreen() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [data, setData] = useState({
    steps: 0,
    distance: 0,
    activeCalories: 0,
    heartRate: null as number | null,
    weight: null as number | null,
    vo2Max: null as number | null,
    oxygenSaturation: null as number | null,
    respiratoryRate: null as number | null,
    sleep: [] as any[],
    exercises: [] as any[],
  });

  const isAvailable = Platform.OS === 'android';
  const isModuleReady = HealthConnectService.isModuleAvailable();

  useEffect(() => {
    if (isModuleReady) {
      initHealthConnect();
    } else {
      setLoading(false);
    }
  }, []);

  const initHealthConnect = async () => {
    const result = await HealthConnectService.requestPermissions();
    setConnected(result);
    if (result) {
      await loadData();
    }
    setLoading(false);
  };

  const loadData = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const [steps, distance, activeCalories, heartRate, weight, vo2Max, oxygenSaturation, respiratoryRate, sleep, exercises] =
      await Promise.all([
        HealthConnectService.getSteps(today, now),
        HealthConnectService.getDistance(today, now),
        HealthConnectService.getActiveCalories(today, now),
        HealthConnectService.getHeartRate(today, now).then(r => r.length > 0 ? r[r.length - 1]?.bpm : null),
        HealthConnectService.getWeight(today, now),
        HealthConnectService.getVO2Max(today, now),
        HealthConnectService.getOxygenSaturation(today, now),
        HealthConnectService.getRespiratoryRate(today, now),
        HealthConnectService.getSleep(yesterday, now),
        HealthConnectService.getExerciseSessions(yesterday, now),
      ]);

    setData({
      steps, distance, activeCalories,
      heartRate,
      weight, vo2Max, oxygenSaturation, respiratoryRate,
      sleep, exercises,
    });
  };

  if (!isAvailable) {
    return (
      <NotAvailable
        platform="Health Connect"
        reason="Health Connect is only available on Android devices. Use Apple HealthKit for iOS."
        icon="🤖"
        docsUrl="https://developer.android.com/health-and-fitness/guides/health-connect"
        instructions="Switch to the Apple HealthKit tab for iOS health data."
      />
    );
  }

  if (!isModuleReady) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>🤖 Health Connect</Text>
            <Text style={styles.subtitle}>Android Health Data + Polar</Text>
          </View>
          <PlatformBadge available={true} connected={false} platformName="Health Connect" />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoTitle}>Development Build Required</Text>
          <Text style={styles.infoText}>
            Health Connect requires a development build with native modules.
            It is not available in Expo Go.
          </Text>
          <Text style={styles.infoSteps}>
            To enable:{'\n'}
            1. npx expo prebuild --clean{'\n'}
            2. npx expo run:android{'\n'}
            3. Install Health Connect app from Play Store
          </Text>
        </View>

        {/* Data Sources Info */}
        <View style={styles.sourcesCard}>
          <Text style={styles.sourcesTitle}>📡 Compatible Data Sources</Text>
          <Text style={styles.sourcesDescription}>
            Health Connect aggregates data from all these apps:
          </Text>
          {HealthConnectService.HEALTH_CONNECT_DATA_SOURCES.map((source, i) => (
            <View key={i} style={styles.sourceRow}>
              <Text style={styles.sourceIcon}>{source.icon}</Text>
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceName}>{source.name}</Text>
                <Text style={styles.sourceTypes}>{source.types.join(' • ')}</Text>
              </View>
            </View>
          ))}
          <View style={styles.polarSyncNote}>
            <Text style={styles.polarSyncIcon}>🐻‍❄️</Text>
            <Text style={styles.polarSyncText}>
              Polar Flow syncs training, activity, sleep & HR to Health Connect automatically when installed on Android
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Supported Data Types</Text>
        {HealthConnectService.SUPPORTED_TYPES.map((type, index) => (
          <View key={index} style={styles.typeCard}>
            <Text style={styles.typeIcon}>{getTypeIcon(type)}</Text>
            <Text style={styles.typeName}>{type}</Text>
            <Text style={styles.typeBadge}>Available</Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Requires Android 14+ or Health Connect app</Text>
          <Text style={styles.footerText}>Aggregates data from Polar Flow, Samsung Health, Google Fit, etc.</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🤖 Health Connect</Text>
          <Text style={styles.subtitle}>Android Health Data + Polar</Text>
        </View>
        <PlatformBadge available={true} connected={connected} platformName="Health Connect" />
      </View>

      <TouchableOpacity style={styles.refreshButton} onPress={loadData}>
        <Text style={styles.refreshText}>🔄 Refresh Data</Text>
      </TouchableOpacity>

      {/* Data Sources */}
      <View style={styles.sourcesCard}>
        <Text style={styles.sourcesTitle}>📡 Connected Data Sources</Text>
        {HealthConnectService.HEALTH_CONNECT_DATA_SOURCES.map((source, i) => (
          <View key={i} style={styles.sourceRow}>
            <Text style={styles.sourceIcon}>{source.icon}</Text>
            <View style={styles.sourceInfo}>
              <Text style={styles.sourceName}>{source.name}</Text>
              <Text style={styles.sourceTypes}>{source.types.join(' • ')}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Activity</Text>
      <DataCard icon="👣" title="Steps" value={data.steps || '--'} color="#4CAF50" subtitle="From all sources (Polar, Samsung, etc.)" />
      <DataCard icon="📍" title="Distance" value={data.distance ? `${(data.distance / 1000).toFixed(1)}` : '--'} unit="km" color="#2196F3" />
      <DataCard icon="🔥" title="Active Calories" value={data.activeCalories || '--'} unit="kcal" color="#FF5722" />

      <Text style={styles.sectionTitle}>Heart & Vitals</Text>
      <DataCard icon="❤️" title="Heart Rate" value={data.heartRate || '--'} unit="bpm" color="#E91E63" subtitle="Polar / Samsung / Garmin" />
      <DataCard icon="🫁" title="VO2 Max" value={data.vo2Max ? data.vo2Max.toFixed(1) : '--'} unit="ml/kg/min" color="#00BCD4" subtitle="Polar / Garmin" />
      <DataCard icon="🩸" title="Oxygen Saturation" value={data.oxygenSaturation ? `${data.oxygenSaturation}` : '--'} unit="%" color="#9C27B0" />
      <DataCard icon="💨" title="Respiratory Rate" value={data.respiratoryRate ? data.respiratoryRate.toFixed(1) : '--'} unit="br/min" color="#009688" />

      <Text style={styles.sectionTitle}>Sleep</Text>
      {data.sleep.length > 0 ? (
        data.sleep.slice(0, 5).map((s: any, i: number) => (
          <DataCard key={i} icon="😴" title="Sleep Session" value={`${((s.duration || 0) / 3600).toFixed(1)}`} unit="hrs" color="#673AB7" />
        ))
      ) : (
        <DataCard icon="😴" title="Sleep" value="--" unit="hrs" color="#673AB7" subtitle="Connect to see data" />
      )}

      <Text style={styles.sectionTitle}>Exercise Sessions</Text>
      {data.exercises.length > 0 ? (
        data.exercises.slice(0, 5).map((e: any, i: number) => (
          <DataCard key={i} icon="🏋️" title={e.exerciseType || 'Exercise'} value={`${((e.duration || 0) / 60).toFixed(0)}`} unit="min" color="#D32F2F" />
        ))
      ) : (
        <DataCard icon="🏋️" title="Exercises" value="--" color="#D32F2F" subtitle="From Polar Flow, Samsung Health, etc." />
      )}

      <Text style={styles.sectionTitle}>Body</Text>
      <DataCard icon="⚖️" title="Weight" value={data.weight ? data.weight.toFixed(1) : '--'} unit="kg" color="#795548" />
    </ScrollView>
  );
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    Steps: '👣', HeartRate: '❤️', Sleep: '😴', ExerciseSession: '🏋️',
    Distance: '📍', ActiveCalories: '🔥', Weight: '⚖️', Height: '📏',
    BloodPressure: '🩸', OxygenSaturation: '🫁', RespiratoryRate: '💨',
    BodyTemperature: '🌡️', BloodGlucose: '💉', MindfulnessSession: '🧘',
    Vo2Max: '🫁', RestingHeartRate: '💓', FloorsClimbed: '🪜',
    Hydration: '💧', Nutrition: '🍎',
  };
  return icons[type] || '📋';
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 13, color: '#888', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#555', marginTop: 20, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoCard: { backgroundColor: '#F0F7FF', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#D0E3FF' },
  infoIcon: { fontSize: 36, marginBottom: 8 },
  infoTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 8 },
  infoText: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 12 },
  infoSteps: { fontSize: 13, color: '#555', backgroundColor: '#fff', borderRadius: 8, padding: 12, width: '100%', lineHeight: 22 },
  sourcesCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  sourcesTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 6 },
  sourcesDescription: { fontSize: 13, color: '#666', marginBottom: 14, lineHeight: 20 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#C8E6C9' },
  sourceIcon: { fontSize: 24, marginRight: 12, width: 32 },
  sourceInfo: { flex: 1 },
  sourceName: { fontSize: 14, fontWeight: '600', color: '#333' },
  sourceTypes: { fontSize: 11, color: '#888', marginTop: 2 },
  polarSyncNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  polarSyncIcon: { fontSize: 24, marginRight: 10 },
  polarSyncText: { flex: 1, fontSize: 12, color: '#795548', lineHeight: 18 },
  typeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  typeIcon: { fontSize: 20, marginRight: 12 },
  typeName: { flex: 1, fontSize: 15, color: '#333' },
  typeBadge: { fontSize: 11, color: '#27AE60', backgroundColor: '#E5FFE5', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  refreshButton: { alignSelf: 'flex-end', marginBottom: 10 },
  refreshText: { fontSize: 14, color: '#4CAF50', fontWeight: '500' },
  footer: { alignItems: 'center', paddingVertical: 30 },
  footerText: { fontSize: 12, color: '#bbb' },
});
