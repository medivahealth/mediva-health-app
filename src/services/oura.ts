/**
 * Oura Ring API Service (V2)
 * Docs: https://cloud.ouraring.com/v2/docs
 * 
 * Data types: Daily readiness, sleep, activity scores,
 * heart rate, HRV, body temperature, workouts
 */

const OURA_API_BASE = 'https://api.ouraring.com/v2';

export interface OuraConfig {
  accessToken: string;
}

export interface OuraSleepData {
  id: string;
  day: string;
  bedtime_start: string;
  bedtime_end: string;
  duration: number;
  total_sleep_duration: number;
  rem_sleep_duration: number;
  deep_sleep_duration: number;
  light_sleep_duration: number;
  efficiency: number;
  average_heart_rate: number;
  lowest_heart_rate: number;
  average_hrv: number;
}

export interface OuraActivityData {
  id: string;
  day: string;
  steps: number;
  active_calories: number;
  total_calories: number;
  equivalent_walking_distance: number;
  high_activity_time: number;
  medium_activity_time: number;
  low_activity_time: number;
  sedentary_time: number;
  score: number;
}

export interface OuraReadinessData {
  id: string;
  day: string;
  score: number;
  temperature_deviation: number;
  contributors: {
    activity_balance: number;
    body_temperature: number;
    hrv_balance: number;
    previous_day_activity: number;
    previous_night: number;
    recovery_index: number;
    resting_heart_rate: number;
    sleep_balance: number;
  };
}

export interface OuraHeartRateData {
  bpm: number;
  source: string;
  timestamp: string;
}

class OuraService {
  private config: OuraConfig | null = null;

  configure(config: OuraConfig) {
    this.config = config;
  }

  isConnected(): boolean {
    return this.config !== null && this.config.accessToken.length > 0;
  }

  private async fetchAPI(endpoint: string, params?: Record<string, string>): Promise<any> {
    if (!this.config) throw new Error('Oura not configured');

    const url = new URL(`${OURA_API_BASE}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Oura API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getDailySleep(startDate: string, endDate: string): Promise<OuraSleepData[]> {
    try {
      const data = await this.fetchAPI('/usercollection/daily_sleep', {
        start_date: startDate,
        end_date: endDate,
      });
      return data.data || [];
    } catch (error) {
      console.error('Oura sleep error:', error);
      return [];
    }
  }

  async getDailyActivity(startDate: string, endDate: string): Promise<OuraActivityData[]> {
    try {
      const data = await this.fetchAPI('/usercollection/daily_activity', {
        start_date: startDate,
        end_date: endDate,
      });
      return data.data || [];
    } catch (error) {
      console.error('Oura activity error:', error);
      return [];
    }
  }

  async getDailyReadiness(startDate: string, endDate: string): Promise<OuraReadinessData[]> {
    try {
      const data = await this.fetchAPI('/usercollection/daily_readiness', {
        start_date: startDate,
        end_date: endDate,
      });
      return data.data || [];
    } catch (error) {
      console.error('Oura readiness error:', error);
      return [];
    }
  }

  async getHeartRate(startDate: string, endDate: string): Promise<OuraHeartRateData[]> {
    try {
      const data = await this.fetchAPI('/usercollection/heartrate', {
        start_datetime: `${startDate}T00:00:00+00:00`,
        end_datetime: `${endDate}T23:59:59+00:00`,
      });
      return data.data || [];
    } catch (error) {
      console.error('Oura heart rate error:', error);
      return [];
    }
  }

  async getPersonalInfo(): Promise<any> {
    try {
      return await this.fetchAPI('/usercollection/personal_info');
    } catch (error) {
      console.error('Oura personal info error:', error);
      return null;
    }
  }

  async getWorkouts(startDate: string, endDate: string): Promise<any[]> {
    try {
      const data = await this.fetchAPI('/usercollection/workout', {
        start_date: startDate,
        end_date: endDate,
      });
      return data.data || [];
    } catch (error) {
      console.error('Oura workouts error:', error);
      return [];
    }
  }

  // Sync data to backend
  async syncToBackend(api: any): Promise<void> {
    if (!this.isConnected()) return;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    try {
      const [sleep, activity, heartRate] = await Promise.all([
        this.getDailySleep(yesterday, today),
        this.getDailyActivity(yesterday, today),
        this.getHeartRate(yesterday, today),
      ]);

      const records: any[] = [];

      sleep.forEach((s) => {
        records.push({ type: 'sleep', value: s, unit: 'seconds', timestamp: s.bedtime_start, source: 'oura' });
      });
      activity.forEach((a) => {
        records.push({ type: 'steps', value: a.steps, unit: 'count', timestamp: `${a.day}T00:00:00Z`, source: 'oura' });
        records.push({ type: 'active_calories', value: a.active_calories, unit: 'kcal', timestamp: `${a.day}T00:00:00Z`, source: 'oura' });
      });
      heartRate.forEach((hr) => {
        records.push({ type: 'heart_rate', value: hr.bpm, unit: 'bpm', timestamp: hr.timestamp, source: 'oura' });
      });

      if (records.length > 0) {
        await api.post('/health/batch', { records });
      }
    } catch (err) {
      console.error('Oura sync to backend error:', err);
    }
  }
}

export const ouraService = new OuraService();
export default ouraService;
