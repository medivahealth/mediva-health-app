/**
 * Unified Health Service - Bridges Apple HealthKit and Android Health Connect
 * Provides a single interface for health data across both platforms
 * Handles continuous monitoring, alerts, and data synchronization
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api } from './api';
import * as healthkit from './healthkit';
import * as healthconnect from './healthconnect';
import * as notifications from './notifications';

// Health data types
export type HealthDataType = 
  | 'steps'
  | 'heart_rate'
  | 'resting_heart_rate'
  | 'hrv'
  | 'sleep'
  | 'spo2'
  | 'blood_pressure'
  | 'blood_glucose'
  | 'body_temperature'
  | 'respiratory_rate'
  | 'weight'
  | 'height'
  | 'bmi'
  | 'body_fat'
  | 'vo2max'
  | 'distance'
  | 'active_calories'
  | 'workout'
  | 'mindfulness';

export interface UnifiedHealthRecord {
  type: HealthDataType;
  value: number | object;
  unit: string;
  timestamp: string;
  source: string;
  metadata?: Record<string, any>;
}

export interface UserHealthProfile {
  hasHealthKit: boolean;
  hasHealthConnect: boolean;
  hasPermissions: boolean;
  lastSync: string | null;
  dataSources: string[];
  connectedWearables: string[];
}

// Check which health platform is available
export const getAvailableHealthPlatform = async (): Promise<'healthkit' | 'healthconnect' | null> => {
  if (Platform.OS === 'ios') {
    const available = healthkit.isHealthKitAvailable();
    return available ? 'healthkit' : null;
  } else if (Platform.OS === 'android') {
    const available = await healthconnect.isHealthConnectAvailable();
    return available ? 'healthconnect' : null;
  }
  return null;
};

// Get user health profile
export const getUserHealthProfile = async (): Promise<UserHealthProfile> => {
  const platform = await getAvailableHealthPlatform();
  const lastSync = await SecureStore.getItemAsync('lastHealthSync');
  
  let dataSources: string[] = [];
  let connectedWearables: string[] = [];
  
  if (platform === 'healthkit') {
    dataSources = ['Apple Health', 'Apple Watch'];
    const wearables = await SecureStore.getItemAsync('connectedWearables');
    if (wearables) {
      connectedWearables = JSON.parse(wearables);
    }
  } else if (platform === 'healthconnect') {
    dataSources = ['Health Connect'];
    const sources = await SecureStore.getItemAsync('healthConnectSources');
    if (sources) {
      dataSources = [...dataSources, ...JSON.parse(sources)];
    }
  }
  
  return {
    hasHealthKit: platform === 'healthkit',
    hasHealthConnect: platform === 'healthconnect',
    hasPermissions: platform !== null,
    lastSync: lastSync,
    dataSources,
    connectedWearables,
  };
};

// Request health permissions based on platform
export const requestHealthPermissions = async (): Promise<boolean> => {
  const platform = await getAvailableHealthPlatform();
  
  if (platform === 'healthkit') {
    return healthkit.requestAuthorization(
      [
        'Steps',
        'HeartRate',
        'RestingHeartRate',
        'HeartRateVariabilitySDNN',
        'SleepAnalysis',
        'OxygenSaturation',
        'BloodPressure',
        'BodyTemperature',
        'RespiratoryRate',
        'Weight',
        'Height',
        'BodyMass',
        'BodyFatPercentage',
        'VO2Max',
        'DistanceWalkingRunning',
        'ActiveEnergyBurned',
        'Workout',
      ],
      ['Weight', 'Height', 'BloodPressure', 'Workout']
    );
  } else if (platform === 'healthconnect') {
    return healthconnect.requestHealthConnectPermissions();
  }
  
  return false;
};

// Sync all health data to backend
export const syncAllHealthData = async (): Promise<{
  success: boolean;
  recordsSynced: number;
  errors: string[];
}> => {
  const platform = await getAvailableHealthPlatform();
  const errors: string[] = [];
  let recordsSynced = 0;
  
  if (!platform) {
    return { success: false, recordsSynced: 0, errors: ['No health platform available'] };
  }
  
  try {
    // Sync based on platform
    if (platform === 'healthkit') {
      await healthkit.syncToBackend(api);
    } else if (platform === 'healthconnect') {
      await healthconnect.syncHealthConnectToBackend(api);
    }
    
    // Update last sync time
    const timestamp = new Date().toISOString();
    await SecureStore.setItemAsync('lastHealthSync', timestamp);
    
    // Check for health alerts after sync
    await checkHealthAlerts();
    
    return { success: true, recordsSynced, errors };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMsg);
    return { success: false, recordsSynced, errors };
  }
};

// Get comprehensive health summary
export const getHealthSummary = async (): Promise<{
  today: {
    steps: number;
    heartRate: number | null;
    activeCalories: number;
    sleepHours: number;
  };
  trends: {
    stepsTrend: 'up' | 'down' | 'stable';
    heartRateTrend: 'up' | 'down' | 'stable';
    sleepTrend: 'up' | 'down' | 'stable';
  };
  vitals: {
    restingHeartRate: number | null;
    hrv: number | null;
    spo2: number | null;
    bloodPressure: { systolic: number; diastolic: number } | null;
    weight: number | null;
  };
}> => {
  const platform = await getAvailableHealthPlatform();
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  
  const summary = {
    today: {
      steps: 0,
      heartRate: null as number | null,
      activeCalories: 0,
      sleepHours: 0,
    },
    trends: {
      stepsTrend: 'stable' as 'up' | 'down' | 'stable',
      heartRateTrend: 'stable' as 'up' | 'down' | 'stable',
      sleepTrend: 'stable' as 'up' | 'down' | 'stable',
    },
    vitals: {
      restingHeartRate: null as number | null,
      hrv: null as number | null,
      spo2: null as number | null,
      bloodPressure: null as { systolic: number; diastolic: number } | null,
      weight: null as number | null,
    },
  };
  
  if (platform === 'healthkit') {
    // Get today's data
    summary.today.steps = await healthkit.getSteps(today, now);
    summary.today.heartRate = await healthkit.getLatestHeartRate();
    summary.today.activeCalories = await healthkit.getActiveEnergy(today, now);
    
    // Get sleep from last night
    const sleepData = await healthkit.getSleepSamples(yesterday, now);
    summary.today.sleepHours = sleepData.reduce((total, session) => {
      const duration = session.endDate ? 
        (new Date(session.endDate).getTime() - new Date(session.startDate).getTime()) / 3600000 : 0;
      return total + duration;
    }, 0);
    
    // Get vitals
    summary.vitals.restingHeartRate = await healthkit.getLatestRestingHeartRate();
    summary.vitals.hrv = await healthkit.getLatestHRV();
    summary.vitals.spo2 = await healthkit.getOxygenSaturation();
    summary.vitals.bloodPressure = await healthkit.getLatestBloodPressure();
    summary.vitals.weight = await healthkit.getLatestWeight();
    
  } else if (platform === 'healthconnect') {
    // Get today's data
    summary.today.steps = await healthconnect.getSteps(today, now);
    summary.today.heartRate = await healthconnect.getLatestHeartRate();
    summary.today.activeCalories = await healthconnect.getActiveCalories(today, now);
    
    // Get sleep from last night
    const sleepData = await healthconnect.getSleepSessions(yesterday, now);
    summary.today.sleepHours = sleepData.reduce((total, session) => total + session.durationHours, 0);
    
    // Get vitals
    summary.vitals.restingHeartRate = await healthconnect.getLatestHeartRate();
    summary.vitals.spo2 = await healthconnect.getOxygenSaturation();
    summary.vitals.bloodPressure = await healthconnect.getLatestBloodPressure();
    summary.vitals.weight = await healthconnect.getLatestWeight();
  }
  
  // Get trends from backend
  try {
    const trendsData = await api.get('/health/trends');
    if (trendsData) {
      summary.trends = {
        stepsTrend: trendsData.steps || 'stable',
        heartRateTrend: trendsData.heartRate || 'stable',
        sleepTrend: trendsData.sleep || 'stable',
      };
    }
  } catch {
    // Trends not available, keep defaults
  }
  
  return summary;
};

// Check for health alerts and send notifications
export const checkHealthAlerts = async (): Promise<void> => {
  try {
    // Get latest alerts from backend
    const alerts = await api.get('/health/alerts');
    
    if (alerts && alerts.length > 0) {
      for (const alert of alerts) {
        await notifications.showHealthAlert({
          title: alert.title,
          message: alert.message,
          severity: alert.severity,
          action: alert.recommendedAction,
        });
      }
    }
  } catch (error) {
    console.error('Error checking health alerts:', error);
  }
};

// Setup continuous health monitoring
export const setupContinuousMonitoring = async (): Promise<void> => {
  // Check permissions first
  const hasPermissions = await requestHealthPermissions();
  if (!hasPermissions) {
    console.log('Health permissions not granted');
    return;
  }
  
  // Register for push notifications
  await notifications.registerForPushNotifications();
  
  // Initial sync
  await syncAllHealthData();
  
  // Setup periodic sync (every 4 hours)
  // Note: Background sync requires additional setup with expo-task-manager
  
  console.log('Continuous health monitoring setup complete');
};

// Get platform-specific setup instructions
export const getPlatformSetupInstructions = (): string => {
  if (Platform.OS === 'ios') {
    return `
📱 Apple Health Setup

1. Open the Health app on your iPhone
2. Tap your profile picture (top right)
3. Tap "Apps" under Privacy
4. Find and enable Mediva
5. Allow access to all health categories

Your Apple Watch data will automatically sync through Apple Health.
    `.trim();
  } else if (Platform.OS === 'android') {
    return healthconnect.getHealthConnectSetupInstructions();
  }
  
  return 'Platform not supported for health integration.';
};

// Save wearable connection
export const saveWearableConnection = async (wearable: string): Promise<void> => {
  const existing = await SecureStore.getItemAsync('connectedWearables');
  const wearables = existing ? JSON.parse(existing) : [];
  
  if (!wearables.includes(wearable)) {
    wearables.push(wearable);
    await SecureStore.setItemAsync('connectedWearables', JSON.stringify(wearables));
  }
};

// Get connected wearables
export const getConnectedWearables = async (): Promise<string[]> => {
  const wearables = await SecureStore.getItemAsync('connectedWearables');
  return wearables ? JSON.parse(wearables) : [];
};

// Remove wearable connection
export const removeWearableConnection = async (wearable: string): Promise<void> => {
  const existing = await SecureStore.getItemAsync('connectedWearables');
  if (existing) {
    const wearables = JSON.parse(existing).filter((w: string) => w !== wearable);
    await SecureStore.setItemAsync('connectedWearables', JSON.stringify(wearables));
  }
};

// Health data insights
export const getHealthInsights = async (): Promise<string[]> => {
  try {
    const insights = await api.get('/health/insights');
    return insights || [];
  } catch {
    return [];
  }
};

// Check if user should connect health platform
export const shouldPromptHealthConnection = async (): Promise<boolean> => {
  const profile = await getUserHealthProfile();
  
  // If already connected, don't prompt
  if (profile.hasPermissions) return false;
  
  // Check if we asked recently (don't ask more than once per week)
  const lastPrompt = await SecureStore.getItemAsync('lastHealthPrompt');
  if (lastPrompt) {
    const daysSincePrompt = (Date.now() - new Date(lastPrompt).getTime()) / 86400000;
    if (daysSincePrompt < 7) return false;
  }
  
  return true;
};

// Record that we prompted user
export const recordHealthPrompt = async (): Promise<void> => {
  await SecureStore.setItemAsync('lastHealthPrompt', new Date().toISOString());
};

export default {
  getAvailableHealthPlatform,
  getUserHealthProfile,
  requestHealthPermissions,
  syncAllHealthData,
  getHealthSummary,
  checkHealthAlerts,
  setupContinuousMonitoring,
  getPlatformSetupInstructions,
  saveWearableConnection,
  getConnectedWearables,
  removeWearableConnection,
  getHealthInsights,
  shouldPromptHealthConnection,
  recordHealthPrompt,
};
