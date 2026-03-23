import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import * as HealthKitService from '../services/healthkit';
import DataCard from '../components/DataCard';
import NotAvailable from '../components/NotAvailable';
import PlatformBadge from '../components/PlatformBadge';

export default function HealthKitScreen() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    steps: 0,
    distance: 0,
    flights: 0,
    activeEnergy: 0,
    basalEnergy: 0,
    heartRate: null as number | null,
    restingHR: null as number | null,
    hrv: null as number | null,
    weight: null as number | null,
    height: null as number | null,
    bmi: null as number | null,
    vo2Max: null as number | null,
    oxygenSaturation: null as number | null,
    respiratoryRate: null as number | null,
    sleep: [] as any[],
    workouts: [] as any[],
  });

  const isAvailable = Platform.OS === 'ios' && HealthKitService.isModuleAvailable();

  useEffect(() => {
    if (isAvailable) {
      initHealthKit();
    } else {
      setLoading(false);
    }
  }, []);

  const initHealthKit = async () => {
    const result = await HealthKitService.requestAuthorization(
      ['Workout', 'Steps', 'Distance', 'FlightsClimbed', 'ActiveEnergy', 'BasalEnergy',
       'HeartRate', 'RestingHeartRate', 'HRV', 'BloodPressure', 'OxygenSaturation',
       'Sleep', 'Height', 'Weight', 'BMI', 'BodyFat', 'Water', 'VO2Max', 'RespiratoryRate'],
      ['Workout', 'Water', 'Weight', 'Height', 'BloodPressure']
    );
    setAuthorized(result);
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

    const [steps, distance, flights, activeEnergy, basalEnergy, heartRate, restingHR, hrv, weight, height, bmi, vo2Max, oxygenSaturation, respiratoryRate, sleep, workouts] =
      await Promise.all([
        HealthKitService.getSteps(today, now),
        HealthKitService.getTotalDistance(today, now),
        HealthKitService.getFlightsClimbed(today, now),
        HealthKitService.getActiveEnergy(today, now),
        HealthKitService.getBasalEnergy(today, now),
        HealthKitService.getLatestHeartRate(),
        HealthKitService.getLatestRestingHeartRate(),
        HealthKitService.getLatestHRV(),
        HealthKitService.getLatestWeight(),
        HealthKitService.getLatestHeight(),
        HealthKitService.getLatestBMI(),
        HealthKitService.getVO2Max(),
        HealthKitService.getOxygenSaturation(),
        HealthKitService.getRespiratoryRate(),
        HealthKitService.getSleepSamples(yesterday, now),
        HealthKitService.queryWorkouts({ limit: 5 }),
      ]);

    setData({
      steps: Math.round(steps), distance, flights: Math.round(flights),
      activeEnergy: Math.round(activeEnergy), basalEnergy: Math.round(basalEnergy),
      heartRate, restingHR, hrv, weight, height, bmi,
      vo2Max, oxygenSaturation, respiratoryRate,
      sleep, workouts,
    });
  };

  if (!isAvailable) {
    return (
      <NotAvailable
        platform="Apple HealthKit"
        reason={Platform.OS === 'android'
          ? 'HealthKit is only available on iOS devices. Use Health Connect for Android.'
          : 'HealthKit native module not found. You need a development build (not Expo Go) to use HealthKit.'}
        icon="🍎"
        docsUrl="https://developer.apple.com/documentation/healthkit"
        instructions={Platform.OS === 'ios'
          ? 'Build with: npx expo prebuild --clean && npx expo run:ios'
          : 'Switch to the Health Connect tab for Android health data.'}
      />
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading HealthKit data...</Text>
      </View>
    );
  }

  if (!authorized) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>🔒</Text>
        <Text style={styles.errorText}>HealthKit Authorization Required</Text>
        <TouchableOpacity style={styles.button} onPress={initHealthKit}>
          <Text style={styles.buttonText}>Request Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🍎 Apple HealthKit</Text>
          <Text style={styles.subtitle}>iOS Health Data + Apple Watch + Polar</Text>
        </View>
        <PlatformBadge available={true} connected={true} platformName="HealthKit" />
      </View>

      <TouchableOpacity style={styles.refreshButton} onPress={loadData}>
        <Text style={styles.refreshText}>🔄 Refresh Data</Text>
      </TouchableOpacity>

      {/* Data Sources Info */}
      <View style={styles.sourcesCard}>
        <Text style={styles.sourcesTitle}>📡 Connected Data Sources</Text>
        <Text style={styles.sourcesDescription}>
          HealthKit aggregates data from all these apps automatically:
        </Text>
        <View style={styles.sourcesList}>
          {HealthKitService.HEALTHKIT_DATA_SOURCES.map((source, i) => (
            <View key={i} style={styles.sourceRow}>
              <Text style={styles.sourceIcon}>{source.icon}</Text>
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceName}>{source.name}</Text>
                <Text style={styles.sourceTypes}>{source.types.join(' • ')}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.polarSyncNote}>
          <Text style={styles.polarSyncIcon}>🐻‍❄️</Text>
          <Text style={styles.polarSyncText}>
            Polar Flow app syncs training, activity, sleep & HR to HealthKit automatically when installed
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Activity & Fitness</Text>
      <DataCard icon="👣" title="Steps" value={data.steps} color="#4A90E2" subtitle="From all sources (Apple Watch, Polar, etc.)" />
      <DataCard icon="📍" title="Distance" value={`${(data.distance / 1000).toFixed(1)}`} unit="km" color="#27AE60" />
      <DataCard icon="🪜" title="Flights Climbed" value={data.flights} unit="flights" color="#8E44AD" />
      <DataCard icon="🔥" title="Active Energy" value={data.activeEnergy} unit="kcal" color="#E74C3C" />
      <DataCard icon="⚡" title="Basal Energy" value={data.basalEnergy} unit="kcal" color="#F39C12" />

      <Text style={styles.sectionTitle}>Heart & Vitals</Text>
      <DataCard icon="❤️" title="Heart Rate" value={data.heartRate || '--'} unit="bpm" color="#E74C3C" subtitle="Apple Watch / Polar" />
      <DataCard icon="💓" title="Resting HR" value={data.restingHR || '--'} unit="bpm" color="#C0392B" />
      <DataCard icon="📊" title="HRV" value={data.hrv ? data.hrv.toFixed(0) : '--'} unit="ms" color="#2980B9" />
      <DataCard icon="🫁" title="VO2 Max" value={data.vo2Max ? data.vo2Max.toFixed(1) : '--'} unit="ml/kg/min" color="#00BCD4" subtitle="Polar / Apple Watch" />
      <DataCard icon="💨" title="Respiratory Rate" value={data.respiratoryRate ? data.respiratoryRate.toFixed(1) : '--'} unit="br/min" color="#009688" />
      <DataCard icon="🩸" title="Oxygen Saturation" value={data.oxygenSaturation ? `${(data.oxygenSaturation * 100).toFixed(0)}` : '--'} unit="%" color="#3F51B5" />

      <Text style={styles.sectionTitle}>Body Measurements</Text>
      <DataCard icon="⚖️" title="Weight" value={data.weight ? data.weight.toFixed(1) : '--'} unit="kg" color="#8E44AD" />
      <DataCard icon="📏" title="Height" value={data.height ? data.height.toFixed(0) : '--'} unit="cm" color="#16A085" />
      <DataCard icon="📐" title="BMI" value={data.bmi ? data.bmi.toFixed(1) : '--'} color="#D35400" />

      <Text style={styles.sectionTitle}>Sleep</Text>
      {data.sleep.length > 0 ? (
        data.sleep.slice(0, 5).map((s: any, i: number) => (
          <DataCard key={i} icon="😴" title={s.value || 'Sleep'} value={`${(s.duration / 3600).toFixed(1)}`} unit="hrs" color="#9B59B6" subtitle="Polar / Apple Watch" />
        ))
      ) : (
        <Text style={styles.emptyText}>No sleep data available</Text>
      )}

      <Text style={styles.sectionTitle}>Recent Workouts</Text>
      {data.workouts.length > 0 ? (
        data.workouts.slice(0, 5).map((w: any, i: number) => (
          <DataCard key={i} icon="🏋️" title={w.workoutActivityType || 'Workout'} value={`${((w.duration || 0) / 60).toFixed(0)}`} unit="min" color="#D32F2F" subtitle={`${w.totalEnergyBurned || 0} kcal`} />
        ))
      ) : (
        <Text style={styles.emptyText}>No recent workouts</Text>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Data sourced from Apple Health</Text>
        <Text style={styles.footerText}>Including Apple Watch, Polar Flow & other connected apps</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 13, color: '#888', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#555', marginTop: 20, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  loadingText: { fontSize: 16, color: '#888' },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorText: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 16 },
  button: { backgroundColor: '#4A90E2', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 25 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  refreshButton: { alignSelf: 'flex-end', marginBottom: 10 },
  refreshText: { fontSize: 14, color: '#4A90E2', fontWeight: '500' },
  emptyText: { fontSize: 14, color: '#aaa', textAlign: 'center', paddingVertical: 20 },
  sourcesCard: {
    backgroundColor: '#F0F7FF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#D0E3FF',
  },
  sourcesTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 6 },
  sourcesDescription: { fontSize: 13, color: '#666', marginBottom: 14, lineHeight: 20 },
  sourcesList: {},
  sourceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E0ECFF' },
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
  footer: { alignItems: 'center', paddingVertical: 30 },
  footerText: { fontSize: 12, color: '#bbb' },
});
