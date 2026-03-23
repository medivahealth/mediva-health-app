/**
 * Safe HealthKit wrapper - gracefully handles when module is not available
 * (Expo Go, Android, or missing native module)
 */
import { Platform } from 'react-native';

let ExpoHealthKit: any = null;
let moduleAvailable = false;

try {
  if (Platform.OS === 'ios') {
    ExpoHealthKit = require('@kayzmann/expo-healthkit');
    moduleAvailable = true;
  }
} catch (e) {
  moduleAvailable = false;
}

export const isModuleAvailable = (): boolean => moduleAvailable;

export const isHealthKitAvailable = (): boolean => {
  if (!moduleAvailable || !ExpoHealthKit) return false;
  try {
    return ExpoHealthKit.isAvailable();
  } catch {
    return false;
  }
};

export const requestAuthorization = async (
  readTypes: string[],
  writeTypes: string[]
): Promise<boolean> => {
  if (!isHealthKitAvailable()) return false;
  try {
    await ExpoHealthKit.requestAuthorization(readTypes, writeTypes);
    return true;
  } catch (error) {
    console.error('HealthKit authorization error:', error);
    return false;
  }
};

export const getSteps = async (start: Date, end: Date): Promise<number> => {
  if (!isHealthKitAvailable()) return 0;
  try {
    return await ExpoHealthKit.getSteps(start, end);
  } catch {
    return 0;
  }
};

export const getTotalDistance = async (start: Date, end: Date): Promise<number> => {
  if (!isHealthKitAvailable()) return 0;
  try {
    return await ExpoHealthKit.getTotalDistance(start, end);
  } catch {
    return 0;
  }
};

export const getFlightsClimbed = async (start: Date, end: Date): Promise<number> => {
  if (!isHealthKitAvailable()) return 0;
  try {
    return await ExpoHealthKit.getFlightsClimbed(start, end);
  } catch {
    return 0;
  }
};

export const getActiveEnergy = async (start: Date, end: Date): Promise<number> => {
  if (!isHealthKitAvailable()) return 0;
  try {
    return await ExpoHealthKit.getActiveEnergy(start, end);
  } catch {
    return 0;
  }
};

export const getBasalEnergy = async (start: Date, end: Date): Promise<number> => {
  if (!isHealthKitAvailable()) return 0;
  try {
    return await ExpoHealthKit.getBasalEnergy(start, end);
  } catch {
    return 0;
  }
};

export const getLatestHeartRate = async (): Promise<number | null> => {
  if (!isHealthKitAvailable()) return null;
  try {
    return await ExpoHealthKit.getLatestHeartRate();
  } catch {
    return null;
  }
};

export const getLatestRestingHeartRate = async (): Promise<number | null> => {
  if (!isHealthKitAvailable()) return null;
  try {
    return await ExpoHealthKit.getLatestRestingHeartRate();
  } catch {
    return null;
  }
};

export const getLatestHRV = async (): Promise<number | null> => {
  if (!isHealthKitAvailable()) return null;
  try {
    return await ExpoHealthKit.getLatestHRV();
  } catch {
    return null;
  }
};

export const getHeartRateSamples = async (start: Date, end: Date, limit: number): Promise<any[]> => {
  if (!isHealthKitAvailable()) return [];
  try {
    return await ExpoHealthKit.getHeartRateSamples(start, end, limit);
  } catch {
    return [];
  }
};

export const getLatestWeight = async (): Promise<number | null> => {
  if (!isHealthKitAvailable()) return null;
  try {
    return await ExpoHealthKit.getLatestWeight();
  } catch {
    return null;
  }
};

export const getLatestHeight = async (): Promise<number | null> => {
  if (!isHealthKitAvailable()) return null;
  try {
    return await ExpoHealthKit.getLatestHeight();
  } catch {
    return null;
  }
};

export const getLatestBMI = async (): Promise<number | null> => {
  if (!isHealthKitAvailable()) return null;
  try {
    return await ExpoHealthKit.getLatestBMI();
  } catch {
    return null;
  }
};

export const getLatestBodyFat = async (): Promise<number | null> => {
  if (!isHealthKitAvailable()) return null;
  try {
    return await ExpoHealthKit.getLatestBodyFat();
  } catch {
    return null;
  }
};

export const getSleepSamples = async (start: Date, end: Date): Promise<any[]> => {
  if (!isHealthKitAvailable()) return [];
  try {
    return await ExpoHealthKit.getSleepSamples(start, end);
  } catch {
    return [];
  }
};

export const getWaterIntake = async (start: Date, end: Date): Promise<number> => {
  if (!isHealthKitAvailable()) return 0;
  try {
    return await ExpoHealthKit.getWaterIntake(start, end);
  } catch {
    return 0;
  }
};

export const queryWorkouts = async (params: any): Promise<any[]> => {
  if (!isHealthKitAvailable()) return [];
  try {
    return await ExpoHealthKit.queryWorkouts(params);
  } catch {
    return [];
  }
};

export const saveWorkout = async (params: any): Promise<string | null> => {
  if (!isHealthKitAvailable()) return null;
  try {
    return await ExpoHealthKit.saveWorkout(params);
  } catch {
    return null;
  }
};

export const saveWeight = async (value: number): Promise<boolean> => {
  if (!isHealthKitAvailable()) return false;
  try {
    await ExpoHealthKit.saveWeight(value);
    return true;
  } catch {
    return false;
  }
};

export const saveHeight = async (value: number): Promise<boolean> => {
  if (!isHealthKitAvailable()) return false;
  try {
    await ExpoHealthKit.saveHeight(value);
    return true;
  } catch {
    return false;
  }
};

export const saveWater = async (value: number): Promise<boolean> => {
  if (!isHealthKitAvailable()) return false;
  try {
    await ExpoHealthKit.saveWater(value);
    return true;
  } catch {
    return false;
  }
};

export const saveBloodPressure = async (systolic: number, diastolic: number): Promise<boolean> => {
  if (!isHealthKitAvailable()) return false;
  try {
    await ExpoHealthKit.saveBloodPressure(systolic, diastolic);
    return true;
  } catch {
    return false;
  }
};

// --- Polar-synced data types (via Polar Flow → HealthKit) ---

export const getVO2Max = async (): Promise<number | null> => {
  if (!isHealthKitAvailable()) return null;
  try {
    return await ExpoHealthKit.getVO2Max();
  } catch {
    return null;
  }
};

export const getRespiratoryRate = async (): Promise<number | null> => {
  if (!isHealthKitAvailable()) return null;
  try {
    return await ExpoHealthKit.getRespiratoryRate();
  } catch {
    return null;
  }
};

export const getOxygenSaturation = async (): Promise<number | null> => {
  if (!isHealthKitAvailable()) return null;
  try {
    return await ExpoHealthKit.getOxygenSaturation();
  } catch {
    return null;
  }
};

export const getLatestBloodPressure = async (): Promise<{ systolic: number; diastolic: number } | null> => {
  if (!isHealthKitAvailable()) return null;
  try {
    return await ExpoHealthKit.getLatestBloodPressure();
  } catch {
    return null;
  }
};

/**
 * Data Sources that sync to Apple HealthKit:
 * - Apple Watch (native)
 * - Polar Flow app (steps, HR, workouts, sleep, VO2Max)
 * - Oura Ring app (sleep, HR, HRV, activity)
 * - Garmin Connect app (steps, HR, workouts, sleep, SpO2)
 * - Fitbit app (steps, HR, workouts, sleep)
 * - Samsung Health (if on iOS)
 *
 * All data from these sources appears unified in HealthKit.
 * When Polar Flow is installed and syncing is enabled,
 * training sessions, daily activity, sleep, and heart rate
 * from Polar devices are automatically written to HealthKit.
 */
// Sync HealthKit data to backend
export const syncToBackend = async (api: any): Promise<void> => {
  if (!isHealthKitAvailable()) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date();

  try {
    const [
      steps,
      heartRate,
      restingHeartRate,
      hrv,
      weight,
      sleep,
      spo2,
      respiratoryRate,
      vo2max,
      bloodPressure,
    ] = await Promise.all([
      getSteps(today, now),
      getLatestHeartRate(),
      getLatestRestingHeartRate(),
      getLatestHRV(),
      getLatestWeight(),
      getSleepSamples(new Date(Date.now() - 86400000), now),
      getOxygenSaturation(),
      getRespiratoryRate(),
      getVO2Max(),
      getLatestBloodPressure(),
    ]);

    const records: any[] = [];
    const ts = now.toISOString();

    if (steps > 0) records.push({ type: 'steps', value: steps, unit: 'count', timestamp: ts, source: 'healthkit' });
    if (heartRate) records.push({ type: 'heart_rate', value: heartRate, unit: 'bpm', timestamp: ts, source: 'healthkit' });
    if (restingHeartRate) records.push({ type: 'resting_heart_rate', value: restingHeartRate, unit: 'bpm', timestamp: ts, source: 'healthkit' });
    if (hrv) records.push({ type: 'hrv', value: hrv, unit: 'ms', timestamp: ts, source: 'healthkit' });
    if (weight) records.push({ type: 'weight', value: weight, unit: 'kg', timestamp: ts, source: 'healthkit' });
    if (spo2) records.push({ type: 'spo2', value: spo2, unit: '%', timestamp: ts, source: 'healthkit' });
    if (respiratoryRate) records.push({ type: 'respiratory_rate', value: respiratoryRate, unit: 'breaths/min', timestamp: ts, source: 'healthkit' });
    if (vo2max) records.push({ type: 'vo2max', value: vo2max, unit: 'ml/kg/min', timestamp: ts, source: 'healthkit' });
    if (bloodPressure) {
      records.push({
        type: 'blood_pressure',
        value: bloodPressure,
        unit: 'mmHg',
        timestamp: ts,
        source: 'healthkit',
      });
    }
    sleep.forEach((s: any) => {
      records.push({ type: 'sleep', value: s, unit: '', timestamp: ts, source: 'healthkit' });
    });

    if (records.length > 0) {
      await api.post('/health/batch', { records });
    }
  } catch (err) {
    console.error('HealthKit sync to backend error:', err);
  }
};

export const HEALTHKIT_DATA_SOURCES = [
  { name: 'Apple Watch / Apple Health', icon: '⌚', types: ['Steps', 'Heart Rate', 'Resting HR', 'HRV', 'Sleep', 'SpO₂', 'Weight', 'Blood Pressure'] },
];
