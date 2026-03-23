import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import garminService from '../services/garmin';
import DataCard from '../components/DataCard';
import ConnectPrompt from '../components/ConnectPrompt';
import PlatformBadge from '../components/PlatformBadge';

export default function GarminScreen() {
  const [connected, setConnected] = useState(false);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    steps: 0,
    distance: 0,
    floors: 0,
    avgHR: null as number | null,
    restingHR: null as number | null,
    stressLevel: null as number | null,
    bodyBattery: null as number | null,
    sleepDuration: 0,
    deepSleep: 0,
    remSleep: 0,
    pulseOx: null as number | null,
  });

  const handleConnect = async (accessToken: string) => {
    try {
      setLoading(true);
      garminService.configure({ accessToken, tokenSecret: '' });

      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const [daily, sleep, pulseOx, stress] = await Promise.all([
        garminService.getDailySummary(yesterday, today),
        garminService.getSleepData(yesterday, today),
        garminService.getPulseOx(yesterday, today),
        garminService.getStressData(yesterday, today),
      ]);

      const latestDaily = daily[daily.length - 1];
      const latestSleep = sleep[sleep.length - 1];
      const latestPulseOx = pulseOx[pulseOx.length - 1];
      const latestStress = stress[stress.length - 1];

      setData({
        steps: latestDaily?.steps || 0,
        distance: latestDaily?.distanceInMeters || 0,
        floors: latestDaily?.floorsClimbed || 0,
        avgHR: latestDaily?.averageHeartRateInBeatsPerMinute || null,
        restingHR: latestDaily?.restingHeartRateInBeatsPerMinute || null,
        stressLevel: latestStress?.averageStressLevel || null,
        bodyBattery: latestDaily?.bodyBatteryChargedValue || null,
        sleepDuration: latestSleep?.durationInSeconds || 0,
        deepSleep: latestSleep?.deepSleepDurationInSeconds || 0,
        remSleep: latestSleep?.remSleepInSeconds || 0,
        pulseOx: latestPulseOx?.averageSPO2 || null,
      });

      setConnected(true);
    } catch (error) {
      console.error('Garmin connection error:', error);
      Alert.alert('Connection Error', 'Failed to connect to Garmin. Check your API token and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>⌚ Garmin</Text>
            <Text style={styles.subtitle}>Health, Activity & Body Battery</Text>
          </View>
          <PlatformBadge available={true} connected={false} platformName="Garmin" />
        </View>
        <ConnectPrompt
          platform="Garmin"
          icon="⌚"
          description="Connect your Garmin device to track daily metrics including steps, stress, sleep, Pulse Ox, Body Battery, and activity data."
          docsUrl="https://developer.garmin.com/gc-developer-program/overview/"
          onConnect={handleConnect}
          tokenValue={token}
          onTokenChange={setToken}
          color="#007DC5"
        />

        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>Available Data Types</Text>
          <Text style={styles.apiLabel}>Health API</Text>
          {[
            { icon: '👣', name: 'Steps & Distance' },
            { icon: '😰', name: 'Stress Level' },
            { icon: '😴', name: 'Sleep (Deep, Light, REM)' },
            { icon: '🫁', name: 'Pulse Ox (SpO2)' },
            { icon: '🔋', name: 'Body Battery' },
            { icon: '❤️', name: 'Heart Rate' },
          ].map((item, i) => (
            <View key={`h${i}`} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{item.icon}</Text>
              <Text style={styles.featureName}>{item.name}</Text>
            </View>
          ))}
          <Text style={[styles.apiLabel, { marginTop: 16 }]}>Activity API</Text>
          {[
            { icon: '🏃', name: 'Fitness Activities' },
            { icon: '📊', name: 'Activity Details & Files' },
            { icon: '🗺️', name: 'Exercise Routes' },
          ].map((item, i) => (
            <View key={`a${i}`} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{item.icon}</Text>
              <Text style={styles.featureName}>{item.name}</Text>
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
          <Text style={styles.title}>⌚ Garmin</Text>
          <Text style={styles.subtitle}>Health, Activity & Body Battery</Text>
        </View>
        <PlatformBadge available={true} connected={true} platformName="Garmin" />
      </View>

      <Text style={styles.sectionTitle}>Daily Activity</Text>
      <DataCard icon="👣" title="Steps" value={data.steps} color="#007DC5" />
      <DataCard icon="📍" title="Distance" value={`${(data.distance / 1000).toFixed(1)}`} unit="km" color="#27AE60" />
      <DataCard icon="🪜" title="Floors Climbed" value={data.floors} color="#8E44AD" />

      <Text style={styles.sectionTitle}>Body Battery & Stress</Text>
      <DataCard icon="🔋" title="Body Battery" value={data.bodyBattery || '--'} unit="%" color="#4CAF50" />
      <DataCard icon="😰" title="Avg Stress Level" value={data.stressLevel || '--'} color="#FF9800" />

      <Text style={styles.sectionTitle}>Heart & Vitals</Text>
      <DataCard icon="❤️" title="Average HR" value={data.avgHR || '--'} unit="bpm" color="#E91E63" />
      <DataCard icon="💓" title="Resting HR" value={data.restingHR || '--'} unit="bpm" color="#C0392B" />
      <DataCard icon="🫁" title="Pulse Ox (SpO2)" value={data.pulseOx || '--'} unit="%" color="#00BCD4" />

      <Text style={styles.sectionTitle}>Sleep</Text>
      <DataCard icon="😴" title="Total Sleep" value={`${(data.sleepDuration / 3600).toFixed(1)}`} unit="hrs" color="#673AB7" />
      <DataCard icon="🛌" title="Deep Sleep" value={`${(data.deepSleep / 3600).toFixed(1)}`} unit="hrs" color="#3F51B5" />
      <DataCard icon="🌙" title="REM Sleep" value={`${(data.remSleep / 3600).toFixed(1)}`} unit="hrs" color="#9C27B0" />

      <TouchableOpacity style={styles.disconnectButton} onPress={() => { setConnected(false); setToken(''); }}>
        <Text style={styles.disconnectText}>Disconnect Garmin</Text>
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
  featuresSection: { padding: 20, backgroundColor: '#F8F9FA', borderRadius: 16, marginTop: 10 },
  featuresTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  apiLabel: { fontSize: 13, fontWeight: '700', color: '#007DC5', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  featureIcon: { fontSize: 22, marginRight: 12, width: 30 },
  featureName: { fontSize: 15, color: '#555' },
  disconnectButton: { alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, backgroundColor: '#FFE5E5', marginTop: 30, marginBottom: 30 },
  disconnectText: { color: '#E74C3C', fontSize: 14, fontWeight: '600' },
});
