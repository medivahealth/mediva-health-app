import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import fitbitService from '../services/fitbit';
import DataCard from '../components/DataCard';
import ConnectPrompt from '../components/ConnectPrompt';
import PlatformBadge from '../components/PlatformBadge';

export default function FitbitScreen() {
  const [connected, setConnected] = useState(false);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    steps: 0,
    calories: 0,
    activeMinutes: 0,
    floors: 0,
    distance: 0,
    restingHR: null as number | null,
    sleepDuration: 0,
    sleepEfficiency: null as number | null,
    deepSleep: 0,
    remSleep: 0,
    weight: null as number | null,
    bmi: null as number | null,
  });

  const handleConnect = async (accessToken: string) => {
    try {
      setLoading(true);
      fitbitService.configure({ accessToken });

      const today = new Date().toISOString().split('T')[0];

      const [activity, sleep, heartRate, weight] = await Promise.all([
        fitbitService.getActivitySummary(today),
        fitbitService.getSleep(today),
        fitbitService.getHeartRate(today),
        fitbitService.getWeight(today, today),
      ]);

      const latestSleep = sleep[sleep.length - 1];
      const latestWeight = weight[weight.length - 1];

      setData({
        steps: activity?.steps || 0,
        calories: activity?.caloriesOut || 0,
        activeMinutes: (activity?.fairlyActiveMinutes || 0) + (activity?.veryActiveMinutes || 0),
        floors: activity?.floorsClimbed || 0,
        distance: activity?.distances?.find((d: any) => d.activity === 'total')?.distance || 0,
        restingHR: heartRate?.restingHeartRate || null,
        sleepDuration: latestSleep?.duration ? latestSleep.duration / 60000 : 0, // ms to min
        sleepEfficiency: latestSleep?.efficiency || null,
        deepSleep: latestSleep?.levels?.summary?.deep?.minutes || 0,
        remSleep: latestSleep?.levels?.summary?.rem?.minutes || 0,
        weight: latestWeight?.weight || null,
        bmi: latestWeight?.bmi || null,
      });

      setConnected(true);
    } catch (error) {
      console.error('Fitbit connection error:', error);
      Alert.alert('Connection Error', 'Failed to connect to Fitbit. Check your API token and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>📱 Fitbit</Text>
            <Text style={styles.subtitle}>Activity, Sleep & Heart Rate</Text>
          </View>
          <PlatformBadge available={true} connected={false} platformName="Fitbit" />
        </View>
        <ConnectPrompt
          platform="Fitbit"
          icon="📱"
          description="Connect your Fitbit device to track fitness activity, sleep patterns, heart rate, nutrition, and weight."
          docsUrl="https://dev.fitbit.com/build/reference/web-api/"
          onConnect={handleConnect}
          tokenValue={token}
          onTokenChange={setToken}
          color="#00B0B9"
        />

        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>Available Data Types</Text>
          {[
            { icon: '🏃', name: 'Fitness Activity & Steps' },
            { icon: '😴', name: 'Sleep Stages & Duration' },
            { icon: '❤️', name: 'Heart Rate & Zones' },
            { icon: '🍎', name: 'Nutrition & Calories' },
            { icon: '⚖️', name: 'Weight & BMI' },
            { icon: '🫁', name: 'SpO2 (Oxygen Saturation)' },
            { icon: '🌬️', name: 'Breathing Rate' },
            { icon: '🏆', name: 'Activity Goals' },
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
          <Text style={styles.title}>📱 Fitbit</Text>
          <Text style={styles.subtitle}>Activity, Sleep & Heart Rate</Text>
        </View>
        <PlatformBadge available={true} connected={true} platformName="Fitbit" />
      </View>

      <Text style={styles.sectionTitle}>Activity</Text>
      <DataCard icon="👣" title="Steps" value={data.steps} color="#00B0B9" />
      <DataCard icon="🔥" title="Calories" value={data.calories} unit="kcal" color="#FF5722" />
      <DataCard icon="⏱️" title="Active Minutes" value={data.activeMinutes} unit="min" color="#4CAF50" />
      <DataCard icon="🪜" title="Floors" value={data.floors} color="#8E44AD" />
      <DataCard icon="📍" title="Distance" value={data.distance.toFixed(1)} unit="km" color="#2196F3" />

      <Text style={styles.sectionTitle}>Heart</Text>
      <DataCard icon="💓" title="Resting HR" value={data.restingHR || '--'} unit="bpm" color="#E91E63" />

      <Text style={styles.sectionTitle}>Sleep</Text>
      <DataCard icon="😴" title="Sleep Duration" value={`${(data.sleepDuration / 60).toFixed(1)}`} unit="hrs" color="#673AB7" />
      <DataCard icon="✨" title="Sleep Efficiency" value={data.sleepEfficiency || '--'} unit="%" color="#9C27B0" />
      <DataCard icon="🛌" title="Deep Sleep" value={data.deepSleep} unit="min" color="#3F51B5" />
      <DataCard icon="🌙" title="REM Sleep" value={data.remSleep} unit="min" color="#7C4DFF" />

      <Text style={styles.sectionTitle}>Body</Text>
      <DataCard icon="⚖️" title="Weight" value={data.weight ? data.weight.toFixed(1) : '--'} unit="kg" color="#795548" />
      <DataCard icon="📐" title="BMI" value={data.bmi ? data.bmi.toFixed(1) : '--'} color="#607D8B" />

      <TouchableOpacity style={styles.disconnectButton} onPress={() => { setConnected(false); setToken(''); }}>
        <Text style={styles.disconnectText}>Disconnect Fitbit</Text>
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
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  featureIcon: { fontSize: 22, marginRight: 12, width: 30 },
  featureName: { fontSize: 15, color: '#555' },
  disconnectButton: { alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, backgroundColor: '#FFE5E5', marginTop: 30, marginBottom: 30 },
  disconnectText: { color: '#E74C3C', fontSize: 14, fontWeight: '600' },
});
