/**
 * Garmin Health & Activity API Service
 * Docs: https://developer.garmin.com/gc-developer-program/overview/
 * 
 * Health API: All-day metrics (steps, stress, sleep, Pulse Ox, Body Battery)
 * Activity API: Detailed fitness activity data and files
 */

const GARMIN_API_BASE = 'https://apis.garmin.com';

export interface GarminConfig {
  accessToken: string;
  tokenSecret: string;
}

export interface GarminDailySummary {
  summaryId: string;
  calendarDate: string;
  steps: number;
  distanceInMeters: number;
  activeTimeInSeconds: number;
  floorsClimbed: number;
  minHeartRateInBeatsPerMinute: number;
  maxHeartRateInBeatsPerMinute: number;
  averageHeartRateInBeatsPerMinute: number;
  restingHeartRateInBeatsPerMinute: number;
  averageStressLevel: number;
  maxStressLevel: number;
  bodyBatteryChargedValue: number;
  bodyBatteryDrainedValue: number;
}

export interface GarminSleepData {
  summaryId: string;
  calendarDate: string;
  durationInSeconds: number;
  deepSleepDurationInSeconds: number;
  lightSleepDurationInSeconds: number;
  remSleepInSeconds: number;
  awakeDurationInSeconds: number;
  startTimeInSeconds: number;
  validation: string;
}

export interface GarminActivityData {
  activityId: string;
  activityName: string;
  activityType: string;
  startTimeInSeconds: number;
  durationInSeconds: number;
  distanceInMeters: number;
  activeKilocalories: number;
  averageHeartRateInBeatsPerMinute: number;
  maxHeartRateInBeatsPerMinute: number;
  averageSpeedInMetersPerSecond: number;
}

export interface GarminPulseOx {
  calendarDate: string;
  averageSPO2: number;
  lowestSPO2: number;
  latestSPO2: number;
}

export interface GarminStressData {
  calendarDate: string;
  averageStressLevel: number;
  maxStressLevel: number;
  stressDurationInSeconds: number;
  restStressDurationInSeconds: number;
  lowStressDurationInSeconds: number;
  mediumStressDurationInSeconds: number;
  highStressDurationInSeconds: number;
}

class GarminService {
  private config: GarminConfig | null = null;

  configure(config: GarminConfig) {
    this.config = config;
  }

  isConnected(): boolean {
    return this.config !== null && this.config.accessToken.length > 0;
  }

  private async fetchAPI(endpoint: string): Promise<any> {
    if (!this.config) throw new Error('Garmin not configured');

    // Garmin uses OAuth 1.0a - in production, you'd sign requests
    const response = await fetch(`${GARMIN_API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Garmin API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getDailySummary(startDate: string, endDate: string): Promise<GarminDailySummary[]> {
    try {
      const data = await this.fetchAPI(
        `/wellness-api/rest/dailies?uploadStartTimeInSeconds=${new Date(startDate).getTime() / 1000}&uploadEndTimeInSeconds=${new Date(endDate).getTime() / 1000}`
      );
      return data || [];
    } catch (error) {
      console.error('Garmin daily summary error:', error);
      return [];
    }
  }

  async getSleepData(startDate: string, endDate: string): Promise<GarminSleepData[]> {
    try {
      const data = await this.fetchAPI(
        `/wellness-api/rest/epochs?uploadStartTimeInSeconds=${new Date(startDate).getTime() / 1000}&uploadEndTimeInSeconds=${new Date(endDate).getTime() / 1000}`
      );
      return data || [];
    } catch (error) {
      console.error('Garmin sleep error:', error);
      return [];
    }
  }

  async getActivities(startDate: string, endDate: string): Promise<GarminActivityData[]> {
    try {
      const data = await this.fetchAPI(
        `/wellness-api/rest/activities?uploadStartTimeInSeconds=${new Date(startDate).getTime() / 1000}&uploadEndTimeInSeconds=${new Date(endDate).getTime() / 1000}`
      );
      return data || [];
    } catch (error) {
      console.error('Garmin activities error:', error);
      return [];
    }
  }

  async getPulseOx(startDate: string, endDate: string): Promise<GarminPulseOx[]> {
    try {
      const data = await this.fetchAPI(
        `/wellness-api/rest/pulseOx?uploadStartTimeInSeconds=${new Date(startDate).getTime() / 1000}&uploadEndTimeInSeconds=${new Date(endDate).getTime() / 1000}`
      );
      return data || [];
    } catch (error) {
      console.error('Garmin Pulse Ox error:', error);
      return [];
    }
  }

  async getStressData(startDate: string, endDate: string): Promise<GarminStressData[]> {
    try {
      const data = await this.fetchAPI(
        `/wellness-api/rest/stressDetails?uploadStartTimeInSeconds=${new Date(startDate).getTime() / 1000}&uploadEndTimeInSeconds=${new Date(endDate).getTime() / 1000}`
      );
      return data || [];
    } catch (error) {
      console.error('Garmin stress error:', error);
      return [];
    }
  }

  async getBodyBattery(date: string): Promise<any> {
    try {
      return await this.fetchAPI(
        `/wellness-api/rest/bodyBattery?uploadStartTimeInSeconds=${new Date(date).getTime() / 1000}&uploadEndTimeInSeconds=${new Date(date).getTime() / 1000 + 86400}`
      );
    } catch (error) {
      console.error('Garmin Body Battery error:', error);
      return null;
    }
  }

  async syncToBackend(api: any): Promise<void> {
    if (!this.isConnected()) return;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    try {
      const [daily, sleep, activities] = await Promise.all([
        this.getDailySummary(yesterday, today),
        this.getSleepData(yesterday, today),
        this.getActivities(yesterday, today),
      ]);

      const records: any[] = [];

      daily.forEach((d) => {
        records.push({ type: 'steps', value: d.steps, unit: 'count', timestamp: `${d.calendarDate}T00:00:00Z`, source: 'garmin' });
        records.push({ type: 'heart_rate', value: d.averageHeartRateInBeatsPerMinute, unit: 'bpm', timestamp: `${d.calendarDate}T12:00:00Z`, source: 'garmin' });
        records.push({ type: 'stress', value: d.averageStressLevel, unit: 'level', timestamp: `${d.calendarDate}T12:00:00Z`, source: 'garmin' });
      });

      sleep.forEach((s) => {
        records.push({ type: 'sleep', value: s, unit: 'seconds', timestamp: `${s.calendarDate}T00:00:00Z`, source: 'garmin' });
      });

      activities.forEach((a) => {
        records.push({ type: 'workout', value: a, unit: '', timestamp: new Date(a.startTimeInSeconds * 1000).toISOString(), source: 'garmin' });
      });

      if (records.length > 0) {
        await api.post('/health/batch', { records });
      }
    } catch (err) {
      console.error('Garmin sync to backend error:', err);
    }
  }
}

export const garminService = new GarminService();
export default garminService;
