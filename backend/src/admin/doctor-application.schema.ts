import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class DoctorApplication extends Document {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  email!: string;

  @Prop({ required: true })
  phone!: string;

  @Prop({ default: '' })
  specialization!: string;

  @Prop({ default: '' })
  qualification!: string;

  @Prop({ default: '' })
  experience!: string; // e.g. "5 years"

  @Prop({ default: '' })
  registrationNumber!: string; // medical registration number

  @Prop({ default: '' })
  bio!: string;

  @Prop({ default: 'pending' })
  status!: string; // 'pending' | 'approved' | 'rejected'

  @Prop({ default: '' })
  adminNotes!: string;
}

export const DoctorApplicationSchema =
  SchemaFactory.createForClass(DoctorApplication);
