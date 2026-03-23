import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HealthData } from './health.schema';

export interface HealthRecord {
  type: string;
  value: any;
  unit?: string;
  timestamp: string | Date;
  source: string;
}

@Injectable()
export class HealthService {
  constructor(
    @InjectModel(HealthData.name) private healthModel: Model<HealthData>,
  ) {}

  async storeBatch(userId: string, records: HealthRecord[]): Promise<number> {
    const docs = records.map((r) => ({
      userId: new Types.ObjectId(userId),
      type: r.type,
      value: r.value,
      unit: r.unit || '',
      timestamp: new Date(r.timestamp),
      source: r.source,
    }));

    const result = await this.healthModel.insertMany(docs, { ordered: false });
    return result.length;
  }

  async getTimeline(
    userId: string,
    options?: {
      type?: string;
      source?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    },
  ): Promise<HealthData[]> {
    const query: any = { userId: new Types.ObjectId(userId) };

    if (options?.type) query.type = options.type;
    if (options?.source) query.source = options.source;
    if (options?.startDate || options?.endDate) {
      query.timestamp = {};
      if (options.startDate) query.timestamp.$gte = options.startDate;
      if (options.endDate) query.timestamp.$lte = options.endDate;
    }

    return this.healthModel
      .find(query)
      .sort({ timestamp: -1 })
      .limit(options?.limit || 100)
      .exec();
  }

  async getLatestByType(userId: string, type: string): Promise<HealthData | null> {
    return this.healthModel
      .findOne({ userId: new Types.ObjectId(userId), type })
      .sort({ timestamp: -1 })
      .exec();
  }

  async getUserHealthSummary(userId: string): Promise<Record<string, any>> {
    const oid = new Types.ObjectId(userId);
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get latest values for key metrics
    const [heartRate, steps, sleep, spo2, weight, hrv] = await Promise.all([
      this.healthModel.findOne({ userId: oid, type: 'heart_rate' }).sort({ timestamp: -1 }),
      this.healthModel.findOne({ userId: oid, type: 'steps' }).sort({ timestamp: -1 }),
      this.healthModel.findOne({ userId: oid, type: 'sleep' }).sort({ timestamp: -1 }),
      this.healthModel.findOne({ userId: oid, type: 'spo2' }).sort({ timestamp: -1 }),
      this.healthModel.findOne({ userId: oid, type: 'weight' }).sort({ timestamp: -1 }),
      this.healthModel.findOne({ userId: oid, type: 'hrv' }).sort({ timestamp: -1 }),
    ]);

    // Get 7-day averages
    const recentHR = await this.healthModel.aggregate([
      {
        $match: {
          userId: oid,
          type: 'heart_rate',
          timestamp: { $gte: sevenDaysAgo },
        },
      },
      { $group: { _id: null, avg: { $avg: '$value' }, count: { $sum: 1 } } },
    ]);

    return {
      latest: {
        heartRate: heartRate?.value ?? null,
        steps: steps?.value ?? null,
        sleep: sleep?.value ?? null,
        spo2: spo2?.value ?? null,
        weight: weight?.value ?? null,
        hrv: hrv?.value ?? null,
      },
      averages: {
        heartRate7d: recentHR[0]?.avg ?? null,
      },
      sources: await this.healthModel.distinct('source', { userId: oid }),
    };
  }

  async deleteUserData(userId: string): Promise<void> {
    await this.healthModel.deleteMany({ userId: new Types.ObjectId(userId) });
  }
}
