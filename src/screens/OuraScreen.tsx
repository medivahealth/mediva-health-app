import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import ouraService from '../services/oura';
import DataCard from '../components/DataCard';
import ConnectPrompt from '../components/ConnectPrompt';
import PlatformBadge from '../components/PlatformBadge';

export default function OuraScreen() {
  const [connected, setConnected] = useState(false);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    readinessScore: null as number | null,
    sleepScore: null as number | null,
    activityScore: null as number | null,
    steps: 0,
    calories: 0,
    totalSleep: 0,
    deepSleep: 0,
    remSleep: 0,
    avgHR: null as number | null,
    hrv: null as number | null,
    tempDeviation: null as number | null,
  });

  const handleConnect = async (accessToken: string) => {
    try {
      setLoading(true);
      ouraService.configure({ accessToken });

      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const [readiness, sleep, activity] = await Promise.all([
        ouraService.getDailyReadiness(yesterday, today),
        ouraService.getDailySleep(yesterday, today),
        ouraService.getDailyActivity(yesterday, today),
      ]);

      const latestReadiness = readiness[readiness.length - 1];
      const latestSleep = sleep[sleep.length - 1];
      const latestActivity = activity[activity.length - 1];

      setData({
        readinessScore: latestReadiness?.score || null,
        sleepScore: latestSleep?.total_sleep_duration ? Math.round(latestSleep.total_sleep_duration / 3600) : null,
        activityScore: latestActivity?.score || null,
        steps: latestActivity?.steps || 0,
        calories: latestActivity?.total_calories || 0,
        totalSleep: latestSleep?.total_sleep_duration || 0,
        deepSleep: latestSleep?.deep_sleep_duration || 0,
        remSleep: latestSleep?.rem_sleep_duration || 0,
        avgHR: latestSleep?.average_heart_rate || null,
        hrv: latestSleep?.average_hrv || null,
        tempDeviation: latestReadiness?.temperature_deviation || null,
      });

      setConnected(true);
    } catch (error) {
      console.error('Oura connection error:', error);
      Alert.alert('Connection Error', 'Failed to connect to Oura. Check your API token and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>💍 Oura Ring</Text>
            <Text style={styles.subtitle}>Sleep, Readiness & Activity</Text>
          </View>
          <PlatformBadge available={true} connected={false} platformName="Oura" />
        </View>
        <ConnectPrompt
          platform="Oura"
          icon="💍"
          description="Connect your Oura Ring to track sleep quality, readiness scores, activity, heart rate, HRV, and body temperature."
          docsUrl="https://cloud.ouraring.com/v2/docs"
          onConnect={handleConnect}
          tokenValue={token}
          onTokenChange={setToken}
          color="#4A90E2"
        />

        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>Available Data Types</Text>
          {[
            { icon: '🏆', name: 'Daily Readiness Score' },
            { icon: '😴', name: 'Sleep Stages & Duration' },
            { icon: '🏃', name: 'Daily Activity & Steps' },
            { icon: '❤️', name: 'Heart Rate (HR)' },
            { icon: '📊', name: 'Heart Rate Variability (HRV)' },
            { icon: '🌡️', name: 'Body Temperature Deviation' },
            { icon: '🏋️', name: 'Workouts' },
          ].map((item, i) => (
            <View key={i} style={styles.featureRow}>
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
          <Text style={styles.title}>💍 Oura Ring</Text>
          <Text style={styles.subtitle}>Sleep, Readiness & Activity</Text>
        </View>
        <PlatformBadge available={true} connected={true} platformName="Oura" />
      </View>

      <Text style={styles.sectionTitle}>Scores</Text>
      <View style={styles.scoresRow}>
        <View style={[styles.scoreCard, { backgroundColor: '#E8F5E9' }]}>
          <Text style={styles.scoreValue}>{data.readinessScore || '--'}</Text>
          <Text style={styles.scoreLabel}>Readiness</Text>
        </View>
        <View style={[styles.scoreCard, { backgroundColor: '#E3F2FD' }]}>
          <Text style={styles.scoreValue}>{data.sleepScore || '--'}</Text>
          <Text style={styles.scoreLabel}>Sleep (hrs)</Text>
        </View>
        <View style={[styles.scoreCard, { backgroundColor: '#FFF3E0' }]}>
          <Text style={styles.scoreValue}>{data.activityScore || '--'}</Text>
          <Text style={styles.scoreLabel}>Activity</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Activity</Text>
      <DataCard icon="👣" title="Steps" value={data.steps} color="#4CAF50" />
      <DataCard icon="🔥" title="Calories" value={data.calories} unit="kcal" color="#FF5722" />

      <Text style={styles.sectionTitle}>Sleep</Text>
      <DataCard icon="😴" title="Total Sleep" value={`${(data.totalSleep / 3600).toFixed(1)}`} unit="hrs" color="#673AB7" />
      <DataCard icon="🛌" title="Deep Sleep" value={`${(data.deepSleep / 3600).toFixed(1)}`} unit="hrs" color="#3F51B5" />
      <DataCard icon="🌙" title="REM Sleep" value={`${(data.remSleep / 3600).toFixed(1)}`} unit="hrs" color="#9C27B0" />

      <Text style={styles.sectionTitle}>Vitals</Text>
      <DataCard icon="❤️" title="Avg Heart Rate" value={data.avgHR || '--'} unit="bpm" color="#E91E63" />
      <DataCard icon="📊" title="HRV" value={data.hrv || '--'} unit="ms" color="#2196F3" />
      <DataCard icon="🌡️" title="Temp Deviation" value={data.tempDeviation ? `${data.tempDeviation > 0 ? '+' : ''}${data.tempDeviation.toFixed(2)}` : '--'} unit="°C" color="#FF9800" />

      <TouchableOpacity style={styles.disconnectButton} onPress={() => { setConnected(false); setToken(''); }}>
        <Text style={styles.disconnectText}>Disconnect Oura</Text>
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
  scoresRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  scoreCard: { flex: 1, borderRadius: 16, padding: 20, alignItems: 'center', marginHorizontal: 4 },
  scoreValue: { fontSize: 32, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  scoreLabel: { fontSize: 12, color: '#666', fontWeight: '500' },
  featuresSection: { padding: 20, backgroundColor: '#F8F9FA', borderRadius: 16, marginTop: 10 },
  featuresTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  featureIcon: { fontSize: 22, marginRight: 12, width: 30 },
  featureName: { fontSize: 15, color: '#555' },
  disconnectButton: { alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, backgroundColor: '#FFE5E5', marginTop: 30, marginBottom: 30 },
  disconnectText: { color: '#E74C3C', fontSize: 14, fontWeight: '600' },
});
