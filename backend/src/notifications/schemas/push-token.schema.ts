import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PushTokenDocument = PushToken & Document;

@Schema({ timestamps: true })
export class PushToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  token!: string;

  @Prop({ type: String, enum: ['ios', 'android', 'web'], required: true })
  platform!: 'ios' | 'android' | 'web';

  @Prop({ type: String, required: false })
  deviceId?: string;

  @Prop({ type: String, required: false })
  deviceName?: string;

  @Prop({ type: String, required: false })
  appVersion?: string;

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  @Prop({ type: Date, default: Date.now })
  lastUsedAt!: Date;
}

export const PushTokenSchema = SchemaFactory.createForClass(PushToken);

// Index for faster lookups
PushTokenSchema.index({ userId: 1, platform: 1 });
PushTokenSchema.index({ token: 1 }, { unique: true });
