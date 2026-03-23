import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Medication in a prescription
 */
export interface Medication {
  drugName: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  quantity?: number;
  refills?: number;
  isScheduleH: boolean;
  isScheduleH1: boolean;
}

/**
 * AI-generated prescription recommendation
 */
export interface AIRecommendation {
  medications: Medication[];
  diagnosis: string;
  icdCode?: string;
  reasoning: string;
  confidence: number;
  alternativeOptions?: string[];
  warnings?: string[];
}

/**
 * Doctor's decision on the prescription
 */
export interface DoctorDecision {
  medications: Medication[];
  diagnosis: string;
  notes: string;
  approvedAt: Date;
  digitalSignature?: string;
  modifiedFromAI?: boolean;
  modificationReason?: string;
}

/**
 * Prescription status
 */
export type PrescriptionStatus = 
  | 'pending_doctor_review'
  | 'approved'
  | 'rejected'
  | 'modified'
  | 'sent_to_pharmacy'
  | 'dispensed'
  | 'cancelled'
  | 'expired';

/**
 * Prescription urgency level
 */
export type PrescriptionUrgency = 'routine' | 'urgent' | 'emergency';

@Schema({ timestamps: true })
export class Prescription extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewingDoctorId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ChatSession' })
  chatSessionId?: Types.ObjectId;

  // Chief complaint / reason for prescription
  @Prop({ required: true })
  chiefComplaint!: string;

  // Diagnosis
  @Prop({ required: true })
  diagnosis!: string;

  @Prop()
  icdCode?: string;

  // AI-generated recommendation
  @Prop({
    type: {
      medications: [{ type: Object }],
      diagnosis: String,
      icdCode: String,
      reasoning: String,
      confidence: Number,
      alternativeOptions: [String],
      warnings: [String],
    },
  })
  aiRecommendation?: AIRecommendation;

  // Doctor's final decision
  @Prop({
    type: {
      medications: [{ type: Object }],
      diagnosis: String,
      notes: String,
      approvedAt: Date,
      digitalSignature: String,
      modifiedFromAI: Boolean,
      modificationReason: String,
    },
  })
  doctorDecision?: DoctorDecision;

  // Status tracking
  @Prop({ 
    enum: ['pending_doctor_review', 'approved', 'rejected', 'modified', 'sent_to_pharmacy', 'dispensed', 'cancelled', 'expired'],
    default: 'pending_doctor_review',
  })
  status!: PrescriptionStatus;

  @Prop({ enum: ['routine', 'urgent', 'emergency'], default: 'routine' })
  urgency!: PrescriptionUrgency;

  // Pharmacy details
  @Prop()
  pharmacyId?: string;

  @Prop()
  pharmacyName?: string;

  @Prop()
  trackingNumber?: string;

  @Prop()
  estimatedDelivery?: Date;

  // Validity
  @Prop({ required: true })
  validUntil!: Date;

  // Patient context snapshot (for audit and learning)
  @Prop({ type: Object })
  patientContextSnapshot?: any;

  // Review timestamps
  @Prop()
  submittedAt?: Date;

  @Prop()
  reviewedAt?: Date;

  // For doctor queue management
  @Prop({ default: 0 })
  waitTimeMinutes!: number;

  @Prop({ default: 0 })
  retryCount!: number;
}

export const PrescriptionSchema = SchemaFactory.createForClass(Prescription);

// Indexes for efficient querying
PrescriptionSchema.index({ patientId: 1, status: 1 });
PrescriptionSchema.index({ reviewingDoctorId: 1, status: 1 });
PrescriptionSchema.index({ status: 1, urgency: 1, createdAt: 1 });
PrescriptionSchema.index({ status: 1, createdAt: 1 });
