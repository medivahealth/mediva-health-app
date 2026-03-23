/**
 * Fitbit Web API Service
 * Docs: https://dev.fitbit.com/build/reference/web-api/
 * 
 * Data types: Fitness activity, sleep, heart rate,
 * nutrition, weight, SpO2, breathing rate
 */

const FITBIT_API_BASE = 'https://api.fitbit.com';

export interface FitbitConfig {
  accessToken: string;
  userId?: string; // '-' for current user
}

export interface FitbitActivitySummary {
  steps: number;
  distances: { activity: string; distance: number }[];
  caloriesOut: number;
  activeMinutes: number;
  sedentaryMinutes: number;
  lightlyActiveMinutes: number;
  fairlyActiveMinutes: number;
  veryActiveMinutes: number;
  floorsClimbed: number;
}

export interface FitbitSleepData {
  dateOfSleep: string;
  duration: number;
  efficiency: number;
  minutesAsleep: number;
  minutesAwake: number;
  startTime: string;
  endTime: string;
  levels: {
    summary: {
      deep: { count: number; minutes: number };
      light: { count: number; minutes: number };
      rem: { count: number; minutes: number };
      wake: { count: number; minutes: number };
    };
  };
}

export interface FitbitHeartRateData {
  dateTime: string;
  restingHeartRate: number;
  zones: {
    name: string;
    min: number;
    max: number;
    minutes: number;
    caloriesOut: number;
  }[];
}

export interface FitbitWeightData {
  date: string;
  weight: number;
  bmi: number;
  fat: number;
}

export interface FitbitNutritionData {
  dateTime: string;
  calories: number;
  carbs: number;
  fat: number;
  fiber: number;
  protein: number;
  sodium: number;
  water: number;
}

class FitbitService {
  private config: FitbitConfig | null = null;

  configure(config: FitbitConfig) {
    this.config = { ...config, userId: config.userId || '-' };
  }

  isConnected(): boolean {
    return this.config !== null && this.config.accessToken.length > 0;
  }

  private async fetchAPI(endpoint: string): Promise<any> {
    if (!this.config) throw new Error('Fitbit not configured');

    const response = await fetch(`${FITBIT_API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Fitbit API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getActivitySummary(date: string): Promise<FitbitActivitySummary | null> {
    try {
      const data = await this.fetchAPI(
        `/1/user/${this.config?.userId}/activities/date/${date}.json`
      );
      return data.summary || null;
    } catch (error) {
      console.error('Fitbit activity error:', error);
      return null;
    }
  }

  async getSleep(date: string): Promise<FitbitSleepData[]> {
    try {
      const data = await this.fetchAPI(
        `/1.2/user/${this.config?.userId}/sleep/date/${date}.json`
      );
      return data.sleep || [];
    } catch (error) {
      console.error('Fitbit sleep error:', error);
      return [];
    }
  }

  async getHeartRate(date: string): Promise<FitbitHeartRateData | null> {
    try {
      const data = await this.fetchAPI(
        `/1/user/${this.config?.userId}/activities/heart/date/${date}/1d.json`
      );
      return data['activities-heart']?.[0]?.value || null;
    } catch (error) {
      console.error('Fitbit heart rate error:', error);
      return null;
    }
  }

  async getHeartRateIntraday(date: string, detailLevel: '1sec' | '1min' | '5min' | '15min' = '1min'): Promise<any[]> {
    try {
      const data = await this.fetchAPI(
        `/1/user/${this.config?.userId}/activities/heart/date/${date}/1d/${detailLevel}.json`
      );
      return data['activities-heart-intraday']?.dataset || [];
    } catch (error) {
      console.error('Fitbit heart rate intraday error:', error);
      return [];
    }
  }

  async getWeight(startDate: string, endDate: string): Promise<FitbitWeightData[]> {
    try {
      const data = await this.fetchAPI(
        `/1/user/${this.config?.userId}/body/log/weight/date/${startDate}/${endDate}.json`
      );
      return data.weight || [];
    } catch (error) {
      console.error('Fitbit weight error:', error);
      return [];
    }
  }

  async getNutrition(date: string): Promise<FitbitNutritionData | null> {
    try {
      const data = await this.fetchAPI(
        `/1/user/${this.config?.userId}/foods/log/date/${date}.json`
      );
      return data.summary || null;
    } catch (error) {
      console.error('Fitbit nutrition error:', error);
      return null;
    }
  }

  async getSpO2(date: string): Promise<any> {
    try {
      return await this.fetchAPI(
        `/1/user/${this.config?.userId}/spo2/date/${date}.json`
      );
    } catch (error) {
      console.error('Fitbit SpO2 error:', error);
      return null;
    }
  }

  async getBreathingRate(date: string): Promise<any> {
    try {
      return await this.fetchAPI(
        `/1/user/${this.config?.userId}/br/date/${date}.json`
      );
    } catch (error) {
      console.error('Fitbit breathing rate error:', error);
      return null;
    }
  }

  async getProfile(): Promise<any> {
    try {
      const data = await this.fetchAPI(`/1/user/${this.config?.userId}/profile.json`);
      return data.user || null;
    } catch (error) {
      console.error('Fitbit profile error:', error);
      return null;
    }
  }

  async syncToBackend(api: any): Promise<void> {
    if (!this.isConnected()) return;

    const today = new Date().toISOString().split('T')[0];

    try {
      const [activity, sleep, heartRate] = await Promise.all([
        this.getActivitySummary(today),
        this.getSleep(today),
        this.getHeartRate(today),
      ]);

      const records: any[] = [];

      if (activity) {
        records.push({ type: 'steps', value: activity.steps, unit: 'count', timestamp: `${today}T00:00:00Z`, source: 'fitbit' });
        records.push({ type: 'active_calories', value: activity.caloriesOut, unit: 'kcal', timestamp: `${today}T00:00:00Z`, source: 'fitbit' });
      }

      sleep.forEach((s) => {
        records.push({ type: 'sleep', value: s, unit: 'minutes', timestamp: s.startTime, source: 'fitbit' });
      });

      if (heartRate) {
        records.push({ type: 'heart_rate', value: heartRate.restingHeartRate, unit: 'bpm', timestamp: `${today}T12:00:00Z`, source: 'fitbit' });
      }

      if (records.length > 0) {
        await api.post('/health/batch', { records });
      }
    } catch (err) {
      console.error('Fitbit sync to backend error:', err);
    }
  }
}

export const fitbitService = new FitbitService();
export default fitbitService;
