import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationLogDocument = NotificationLog & Document;

@Schema({ timestamps: true })
export class NotificationLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  token!: string;

  @Prop({ type: String, enum: ['ios', 'android', 'web'], required: true })
  platform!: 'ios' | 'android' | 'web';

  @Prop({ type: String, required: true })
  title!: string;

  @Prop({ type: String, required: true })
  body!: string;

  @Prop({ type: String, enum: ['health_alert', 'medication_reminder', 'appointment', 'general', 'emergency'], default: 'general' })
  category!: 'health_alert' | 'medication_reminder' | 'appointment' | 'general' | 'emergency';

  @Prop({ type: Object, required: false })
  data?: Record<string, any>;

  @Prop({ type: String, enum: ['pending', 'sent', 'delivered', 'failed', 'opened'], default: 'pending' })
  status!: 'pending' | 'sent' | 'delivered' | 'failed' | 'opened';

  @Prop({ type: String, required: false })
  errorMessage?: string;

  @Prop({ type: Date, required: false })
  sentAt?: Date;

  @Prop({ type: Date, required: false })
  deliveredAt?: Date;

  @Prop({ type: Date, required: false })
  openedAt?: Date;
}

export const NotificationLogSchema = SchemaFactory.createForClass(NotificationLog);

// Indexes for analytics
NotificationLogSchema.index({ userId: 1, createdAt: -1 });
NotificationLogSchema.index({ category: 1, status: 1 });
NotificationLogSchema.index({ createdAt: -1 });
