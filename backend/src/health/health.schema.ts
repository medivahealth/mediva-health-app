import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class HealthData extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  type!: string; // 'steps', 'heart_rate', 'sleep', 'spo2', 'workout', etc.

  @Prop({ type: Object, required: true })
  value!: any; // number or object

  @Prop({ default: '' })
  unit!: string;

  @Prop({ required: true, index: true })
  timestamp!: Date;

  @Prop({ required: true })
  source!: string; // 'healthkit', 'oura', 'garmin', 'fitbit', 'polar', 'healthconnect', 'manual', 'abdm'
}

export const HealthDataSchema = SchemaFactory.createForClass(HealthData);

// Compound index for efficient querying
HealthDataSchema.index({ userId: 1, type: 1, timestamp: -1 });
HealthDataSchema.index({ userId: 1, source: 1, timestamp: -1 });
