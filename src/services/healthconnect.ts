/**
 * Safe Health Connect wrapper for Android
 * Health Connect API provides access to health data on Android devices
 * Docs: https://developer.android.com/health-and-fitness/guides/health-connect
 */
import { Platform } from 'react-native';

// Health Connect is only available on Android
// In a full implementation, you would use react-native-health-connect
// For now, we provide a safe wrapper with the same interface

let HealthConnect: any = null;
let moduleAvailable = false;

try {
  if (Platform.OS === 'android') {
    // Would use: require('react-native-health-connect')
    // For Expo Go compatibility, we detect availability
    moduleAvailable = false; // Set to true when native module is available
  }
} catch (e) {
  moduleAvailable = false;
}

export const isModuleAvailable = (): boolean => Platform.OS === 'android' && moduleAvailable;

export const isHealthConnectAvailable = (): boolean => {
  if (Platform.OS !== 'android') return false;
  if (!moduleAvailable) return false;
  try {
    return true;
  } catch {
    return false;
  }
};

export const requestPermissions = async (): Promise<boolean> => {
  if (!isHealthConnectAvailable()) return false;
  try {
    // Would call Health Connect permission request
    return true;
  } catch {
    return false;
  }
};

export const getSteps = async (start: Date, end: Date): Promise<number> => {
  if (!isHealthConnectAvailable()) return 0;
  try {
    // Would read from Health Connect
    return 0;
  } catch {
    return 0;
  }
};

export const getHeartRate = async (start: Date, end: Date): Promise<any[]> => {
  if (!isHealthConnectAvailable()) return [];
  try {
    return [];
  } catch {
    return [];
  }
};

export const getSleep = async (start: Date, end: Date): Promise<any[]> => {
  if (!isHealthConnectAvailable()) return [];
  try {
    return [];
  } catch {
    return [];
  }
};

export const getExerciseSessions = async (start: Date, end: Date): Promise<any[]> => {
  if (!isHealthConnectAvailable()) return [];
  try {
    return [];
  } catch {
    return [];
  }
};

export const getDistance = async (start: Date, end: Date): Promise<number> => {
  if (!isHealthConnectAvailable()) return 0;
  try {
    return 0;
  } catch {
    return 0;
  }
};

export const getActiveCalories = async (start: Date, end: Date): Promise<number> => {
  if (!isHealthConnectAvailable()) return 0;
  try {
    return 0;
  } catch {
    return 0;
  }
};

export const getWeight = async (start: Date, end: Date): Promise<number | null> => {
  if (!isHealthConnectAvailable()) return null;
  try {
    return null;
  } catch {
    return null;
  }
};

export const getVO2Max = async (start: Date, end: Date): Promise<number | null> => {
  if (!isHealthConnectAvailable()) return null;
  try {
    return null;
  } catch {
    return null;
  }
};

export const getRespiratoryRate = async (start: Date, end: Date): Promise<number | null> => {
  if (!isHealthConnectAvailable()) return null;
  try {
    return null;
  } catch {
    return null;
  }
};

export const getOxygenSaturation = async (start: Date, end: Date): Promise<number | null> => {
  if (!isHealthConnectAvailable()) return null;
  try {
    return null;
  } catch {
    return null;
  }
};

export const getBodyTemperature = async (start: Date, end: Date): Promise<number | null> => {
  if (!isHealthConnectAvailable()) return null;
  try {
    return null;
  } catch {
    return null;
  }
};

// Supported data types for Health Connect
export const SUPPORTED_TYPES = [
  'Steps',
  'HeartRate',
  'Sleep',
  'ExerciseSession',
  'Distance',
  'ActiveCalories',
  'Weight',
  'Height',
  'BloodPressure',
  'OxygenSaturation',
  'RespiratoryRate',
  'BodyTemperature',
  'BloodGlucose',
  'MindfulnessSession',
  'Vo2Max',
  'RestingHeartRate',
  'FloorsClimbed',
  'Hydration',
  'Nutrition',
];

/**
 * Data Sources that sync to Android Health Connect:
 * - Polar Flow app (steps, HR, workouts, sleep, VO2 Max, calories)
 * - Samsung Health (steps, HR, workouts, sleep, SpO2, stress)
 * - Google Fit (steps, HR, workouts, sleep, weight)
 * - Oura Ring app (sleep, HR, HRV, activity, temperature)
 * - Garmin Connect app (steps, HR, workouts, sleep, SpO2)
 * - Fitbit app (steps, HR, workouts, sleep, weight)
 *
 * When Polar Flow is installed on Android and Health Connect sync is enabled,
 * training sessions, daily activity, sleep, and heart rate data from
 * Polar devices are automatically written to Health Connect.
 */
// Sync Health Connect data to backend
export const syncToBackend = async (api: any): Promise<void> => {
  if (!isHealthConnectAvailable()) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date();

  try {
    const [steps, heartRates, sleep] = await Promise.all([
      getSteps(today, now),
      getHeartRate(today, now),
      getSleep(new Date(Date.now() - 86400000), now),
    ]);

    const records: any[] = [];
    const ts = now.toISOString();

    if (steps > 0) records.push({ type: 'steps', value: steps, unit: 'count', timestamp: ts, source: 'healthconnect' });
    heartRates.forEach((hr: any) => {
      records.push({ type: 'heart_rate', value: hr.bpm, unit: 'bpm', timestamp: ts, source: 'healthconnect' });
    });
    sleep.forEach((s: any) => {
      records.push({ type: 'sleep', value: s, unit: '', timestamp: ts, source: 'healthconnect' });
    });

    if (records.length > 0) {
      await api.post('/health/batch', { records });
    }
  } catch (err) {
    console.error('Health Connect sync to backend error:', err);
  }
};

export const HEALTH_CONNECT_DATA_SOURCES = [
  { name: 'Polar Flow', icon: '🐻‍❄️', types: ['Steps', 'HR', 'Workouts', 'Sleep', 'VO2 Max', 'Calories'] },
  { name: 'Samsung Health', icon: '📱', types: ['Steps', 'HR', 'Workouts', 'Sleep', 'SpO2', 'Stress'] },
  { name: 'Google Fit', icon: '🏃', types: ['Steps', 'HR', 'Workouts', 'Sleep', 'Weight'] },
  { name: 'Oura Ring', icon: '💍', types: ['Sleep', 'HR', 'HRV', 'Activity', 'Temperature'] },
  { name: 'Garmin Connect', icon: '⌚', types: ['Steps', 'HR', 'Workouts', 'Sleep', 'SpO2'] },
  { name: 'Fitbit', icon: '📱', types: ['Steps', 'HR', 'Workouts', 'Sleep', 'Weight'] },
];
