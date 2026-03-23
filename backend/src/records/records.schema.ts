import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class MedicalDocument extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ default: '' })
  s3Key!: string;

  @Prop({ default: '' })
  s3Url!: string;

  @Prop({ default: '' })
  fileName!: string;

  @Prop({ default: '' })
  extractedText!: string;

  @Prop({
    type: {
      modality: String, // xray | ct | mri | ecg | eeg | pathology | report | prescription | other
      bodyPart: String,
      laterality: String,
      studyDate: String,
      summary: String,
      keyFindings: [String],
      recommendations: [String],
      redFlags: [String],
      measurements: { type: Object },
      imageSummary: String,
      imageFindings: [String],
      imageLimitations: [String],
      imageConfidence: Number,
      tests: [
        {
          name: String,
          value: String,
          unit: String,
          referenceRange: String,
          date: String,
        },
      ],
      diagnosis: [String],
      medications: [String],
      notes: String,
    },
    default: {},
  })
  structuredData!: {
    modality?: string;
    bodyPart?: string;
    laterality?: string;
    studyDate?: string;
    summary?: string;
    keyFindings?: string[];
    recommendations?: string[];
    redFlags?: string[];
    measurements?: Record<string, any>;
    imageSummary?: string;
    imageFindings?: string[];
    imageLimitations?: string[];
    imageConfidence?: number;
    tests?: { name: string; value: string; unit: string; referenceRange?: string; date?: string }[];
    diagnosis?: string[];
    medications?: string[];
    notes?: string;
  };

  @Prop({ default: 'processing' })
  status!: string; // 'processing' | 'processed' | 'needs_review' | 'error'

  @Prop({ default: 'upload' })
  source!: string; // 'upload' | 'abdm' | 'chat'

  /* ─── User-provided metadata ─── */
  @Prop({ default: '' })
  description!: string; // Brief about the doc

  @Prop({ default: '' })
  documentMonth!: string; // e.g. '2025-12' or 'December 2025'

  @Prop({ default: '' })
  documentYear!: string; // e.g. '2025'

  @Prop({ default: '' })
  documentType!: string; // used as modality hint from client (xray/ct/mri/ecg/eeg/pathology/report/prescription)

  @Prop({ default: false })
  isRecord!: boolean; // true = permanent medical record for AI training, false = temporary for current question
}

export const MedicalDocumentSchema = SchemaFactory.createForClass(MedicalDocument);
MedicalDocumentSchema.index({ userId: 1, status: 1 });
MedicalDocumentSchema.index({ userId: 1, createdAt: -1 });