/**
 * Polar Accesslink API Service (V3)
 * Docs: https://www.polar.com/accesslink-api/
 *
 * Data types: Training/exercise sessions, daily activity,
 * sleep, heart rate, physical info, recharge (nightly recovery)
 *
 * Auth: OAuth 2.0
 * Base URL: https://www.polaraccesslink.com/v3
 */

const POLAR_API_BASE = 'https://www.polaraccesslink.com/v3';

export interface PolarConfig {
  accessToken: string;
  userId?: string;
}

export interface PolarExercise {
  id: string;
  upload_time: string;
  polar_user: string;
  device: string;
  start_time: string;
  duration: string; // ISO 8601 duration e.g. "PT1H30M"
  calories: number;
  distance: number;
  heart_rate: {
    average: number;
    maximum: number;
  };
  sport: string;
  has_route: boolean;
  detailed_sport_info: string;
}

export interface PolarActivitySummary {
  id: number;
  date: string;
  created: string;
  calories: number;
  active_calories: number;
  duration: string;
  active_steps: number;
  daily_activity_goal: number;
}

export interface PolarSleepData {
  date: string;
  sleep_start_time: string;
  sleep_end_time: string;
  device_id: string;
  continuity: number;
  continuity_class: number;
  light_sleep: number;     // seconds
  deep_sleep: number;      // seconds
  rem_sleep: number;       // seconds
  unrecognized_sleep_stage: number;
  sleep_score: number;
  total_interruption_duration: number;
  sleep_charge: number;    // Nightly Recharge sleep score
  sleep_rating: number;
  short_interruption_duration: number;
  long_interruption_duration: number;
  sleep_cycles: number;
  group_duration_score: number;
  group_solidity_score: number;
  group_regeneration_score: number;
}

export interface PolarPhysicalInfo {
  id: number;
  created: string;
  polar_user: string;
  weight: number;
  height: number;
  maximum_heart_rate: number;
  resting_heart_rate: number;
  aerobic_threshold: number;
  anaerobic_threshold: number;
  vo2_max: number;
  body_max_index: number;
}

export interface PolarRechargeData {
  date: string;
  heart_rate_avg: number;
  beat_to_beat_avg: number;
  heart_rate_variability_avg: number;
  breathing_rate_avg: number;
  nightly_recharge_status: number; // -7 to 7 scale
  ans_charge: number;
  ans_charge_status: number;
}

class PolarService {
  private config: PolarConfig | null = null;

  configure(config: PolarConfig) {
    this.config = config;
  }

  isConnected(): boolean {
    return this.config !== null && this.config.accessToken.length > 0;
  }

  private async fetchAPI(endpoint: string, method: string = 'GET'): Promise<any> {
    if (!this.config) throw new Error('Polar not configured');

    const response = await fetch(`${POLAR_API_BASE}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Polar API error: ${response.status} ${response.statusText}`);
    }

    // Some endpoints return 204 No Content
    if (response.status === 204) return null;
    return response.json();
  }

  // --- User Info ---

  async getUserInfo(): Promise<any> {
    try {
      return await this.fetchAPI('/users/current');
    } catch (error) {
      console.error('Polar user info error:', error);
      return null;
    }
  }

  async getPhysicalInfo(): Promise<PolarPhysicalInfo | null> {
    try {
      return await this.fetchAPI('/users/current/physical-information');
    } catch (error) {
      console.error('Polar physical info error:', error);
      return null;
    }
  }

  // --- Training / Exercises ---

  async listExercises(): Promise<PolarExercise[]> {
    try {
      // First create a transaction
      const txn = await this.fetchAPI('/users/current/exercise-transactions', 'POST');
      if (!txn || !txn['resource-uri']) return [];

      // Then list exercises from the transaction
      const data = await this.fetchAPI(txn['resource-uri'].replace(POLAR_API_BASE, ''));
      return data?.exercises || [];
    } catch (error) {
      console.error('Polar exercises error:', error);
      return [];
    }
  }

  async getExerciseSummary(exerciseUrl: string): Promise<PolarExercise | null> {
    try {
      return await this.fetchAPI(exerciseUrl.replace(POLAR_API_BASE, ''));
    } catch (error) {
      console.error('Polar exercise summary error:', error);
      return null;
    }
  }

  async getExerciseHeartRate(exerciseUrl: string): Promise<any> {
    try {
      return await this.fetchAPI(`${exerciseUrl.replace(POLAR_API_BASE, '')}/heart-rate-zones`);
    } catch (error) {
      console.error('Polar exercise HR error:', error);
      return null;
    }
  }

  // --- Daily Activity ---

  async listActivitySummaries(): Promise<PolarActivitySummary[]> {
    try {
      const txn = await this.fetchAPI('/users/current/activity-transactions', 'POST');
      if (!txn || !txn['resource-uri']) return [];

      const data = await this.fetchAPI(txn['resource-uri'].replace(POLAR_API_BASE, ''));
      return data?.['activity-log'] || [];
    } catch (error) {
      console.error('Polar activity error:', error);
      return [];
    }
  }

  async getActivitySummary(activityUrl: string): Promise<PolarActivitySummary | null> {
    try {
      return await this.fetchAPI(activityUrl.replace(POLAR_API_BASE, ''));
    } catch (error) {
      console.error('Polar activity summary error:', error);
      return null;
    }
  }

  async getActivityStepSamples(activityUrl: string): Promise<any> {
    try {
      return await this.fetchAPI(`${activityUrl.replace(POLAR_API_BASE, '')}/step-samples`);
    } catch (error) {
      console.error('Polar step samples error:', error);
      return null;
    }
  }

  // --- Sleep ---

  async getSleepData(date: string): Promise<PolarSleepData | null> {
    try {
      return await this.fetchAPI(`/users/current/sleep/${date}`);
    } catch (error) {
      console.error('Polar sleep error:', error);
      return null;
    }
  }

  async getSleepDataRange(startDate: string, endDate: string): Promise<PolarSleepData[]> {
    try {
      const data = await this.fetchAPI(
        `/users/current/sleep?start_date=${startDate}&end_date=${endDate}`
      );
      return data?.nights || [];
    } catch (error) {
      console.error('Polar sleep range error:', error);
      return [];
    }
  }

  // --- Nightly Recharge ---

  async getNightlyRecharge(date: string): Promise<PolarRechargeData | null> {
    try {
      return await this.fetchAPI(`/users/current/nightly-recharge/${date}`);
    } catch (error) {
      console.error('Polar nightly recharge error:', error);
      return null;
    }
  }

  async getNightlyRechargeRange(startDate: string, endDate: string): Promise<PolarRechargeData[]> {
    try {
      const data = await this.fetchAPI(
        `/users/current/nightly-recharge?start_date=${startDate}&end_date=${endDate}`
      );
      return data?.recharges || [];
    } catch (error) {
      console.error('Polar nightly recharge range error:', error);
      return [];
    }
  }

  // --- Commit Transactions ---
  // Polar uses a transaction model - you must commit after reading

  async commitTransaction(transactionUrl: string): Promise<void> {
    try {
      await this.fetchAPI(transactionUrl.replace(POLAR_API_BASE, ''), 'PUT');
    } catch (error) {
      console.error('Polar commit error:', error);
    }
  }

  async syncToBackend(api: any): Promise<void> {
    if (!this.isConnected()) return;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    try {
      const [physicalInfo, sleep, recharge] = await Promise.all([
        this.getPhysicalInfo(),
        this.getSleepData(today),
        this.getNightlyRecharge(today),
      ]);

      const records: any[] = [];

      if (physicalInfo) {
        records.push({ type: 'weight', value: physicalInfo.weight, unit: 'kg', timestamp: physicalInfo.created, source: 'polar' });
        records.push({ type: 'vo2_max', value: physicalInfo.vo2_max, unit: 'ml/kg/min', timestamp: physicalInfo.created, source: 'polar' });
        records.push({ type: 'resting_hr', value: physicalInfo.resting_heart_rate, unit: 'bpm', timestamp: physicalInfo.created, source: 'polar' });
      }

      if (sleep) {
        records.push({ type: 'sleep', value: sleep, unit: 'seconds', timestamp: sleep.sleep_start_time, source: 'polar' });
      }

      if (recharge) {
        records.push({ type: 'nightly_recharge', value: recharge, unit: '', timestamp: `${recharge.date}T00:00:00Z`, source: 'polar' });
        records.push({ type: 'hrv', value: recharge.heart_rate_variability_avg, unit: 'ms', timestamp: `${recharge.date}T00:00:00Z`, source: 'polar' });
      }

      if (records.length > 0) {
        await api.post('/health/batch', { records });
      }
    } catch (err) {
      console.error('Polar sync to backend error:', err);
    }
  }
}

export const polarService = new PolarService();
export default polarService;
