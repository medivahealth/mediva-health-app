import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class ChatMessage {
  @Prop({ required: true })
  role!: string; // 'user' | 'assistant' | 'doctor'

  @Prop({ required: true })
  content!: string;

  @Prop({ default: '' })
  modelUsed!: string;

  @Prop({ type: [String], default: [] })
  citations!: string[];

  @Prop({ default: '' })
  severity!: string; // '' | 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY'

  @Prop({ default: '' })
  feedback!: string; // '' | 'like' | 'dislike'

  @Prop({ default: Date.now })
  timestamp!: Date;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

@Schema({ timestamps: true })
export class ChatSession extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: [ChatMessageSchema], default: [] })
  messages!: ChatMessage[];

  @Prop({ default: false })
  requiresDoctorReview!: boolean;

  @Prop({ default: false })
  doctorApproved!: boolean;

  @Prop({ default: '' })
  doctorNotes!: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedDoctorId?: Types.ObjectId;

  @Prop({ default: '' })
  summary!: string;

  @Prop({ default: false })
  pinned!: boolean;

  @Prop({ default: 'open' })
  status!: string; // 'open' | 'pending_review' | 'reviewed' | 'closed'

  @Prop({ default: false })
  deletedByUser!: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop({ type: Object, default: null })
  location?: { lat: number; lng: number; city?: string; country?: string };

  @Prop({ type: [Object], default: [] })
  proposedPrescription!: Array<{
    medication: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
  }>;

  @Prop({ type: [Object], default: [] })
  finalPrescription!: Array<{
    medication: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
    signedBy: Types.ObjectId;
    signedAt: Date;
  }>;

  @Prop({
    type: {
      responseLength: Number,
      citationCount: Number,
      userFeedback: String,
      qualityScore: Number,
      evaluation: {
        type: {
          accuracy: Number,
          completeness: Number,
          empathy: Number,
          evidenceQuality: Number,
          safety: Number,
          overallScore: Number,
          issues: [String],
          strengths: [String],
          evaluatedAt: Date,
          evaluatorType: String,
        },
        _id: false,
      },
      abTest: {
        type: {
          variantId: String,
          responseTime: Number,
          recordedAt: Date,
        },
        _id: false,
      },
    },
    default: {},
  })
  qualityMetrics!: {
    responseLength?: number;
    citationCount?: number;
    userFeedback?: string;
    qualityScore?: number;
    evaluation?: {
      accuracy: number;
      completeness: number;
      empathy: number;
      evidenceQuality: number;
      safety: number;
      overallScore: number;
      issues: string[];
      strengths: string[];
      evaluatedAt: Date;
      evaluatorType: 'auto' | 'doctor' | 'user_feedback';
    };
    abTest?: {
      variantId: string;
      responseTime: number;
      recordedAt: Date;
    };
  };
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);
ChatSessionSchema.index({ userId: 1, status: 1 });
ChatSessionSchema.index({ requiresDoctorReview: 1, status: 1 });
