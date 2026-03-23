import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ unique: true, sparse: true })
  medivaid?: string;

  @Prop({ sparse: true, default: undefined })
  phone?: string;

  @Prop({ default: '' })
  name!: string;

  @Prop({ default: '' })
  dob!: string; // Date of birth

  @Prop({ sparse: true })
  email!: string;

  @Prop({ default: '' })
  password!: string; // bcrypt hash – empty for OAuth users

  @Prop({ default: 'local' })
  authProvider!: string; // 'local' | 'google' | 'apple'

  @Prop({ default: '' })
  googleId!: string;

  @Prop({ default: '' })
  appleId!: string;

  @Prop({ default: false })
  emailVerified!: boolean;

  @Prop({ default: '' })
  emailVerificationToken!: string;

  @Prop({ default: '' })
  resetPasswordToken!: string;

  @Prop({ type: Date })
  resetPasswordExpires!: Date | null;

  @Prop({ type: Date })
  termsAcceptedAt!: Date | null;

  @Prop({ default: '' })
  abhaAddress!: string;

  @Prop({ default: 'en' })
  preferredLanguage!: string;

  @Prop({
    type: [{ type: { type: String }, lastSynced: Date, token: String }],
    default: [],
  })
  devices!: { type: string; lastSynced: Date; token?: string }[];

  @Prop({
    type: {
      healthDataCollection: { type: Boolean, default: true },
      aiAnalysis: { type: Boolean, default: true },
      doctorSharing: { type: Boolean, default: true },
      abdmAccess: { type: Boolean, default: true },
      grantedAt: { type: Date },
    },
    default: {},
  })
  consentStatus!: {
    healthDataCollection: boolean;
    aiAnalysis: boolean;
    doctorSharing: boolean;
    abdmAccess: boolean;
    grantedAt?: Date;
  };

  @Prop({ default: 'user' })
  role!: string; // 'user' | 'doctor' | 'admin'

  @Prop({ default: '' })
  profileImage!: string; // URL to profile image (S3/CloudFront)

  @Prop({ default: '' })
  refreshToken!: string;

  @Prop({
    type: {
      allergies: { type: [String], default: [] },
      chronicConditions: { type: [String], default: [] },
      currentMedications: { type: [String], default: [] },
      pastSurgeries: { type: [String], default: [] },
      familyHistory: { type: [String], default: [] },
      bloodType: { type: String, default: '' },
      dob: { type: String, default: '' },
      gender: { type: String, default: '' },
      height: { type: String, default: '' },
      weight: { type: String, default: '' },
      lifestyleFactors: {
        smoking: { type: Boolean, default: false },
        alcohol: { type: Boolean, default: false },
        exercise: { type: String, default: '' }, // 'none', 'light', 'moderate', 'intense'
      },
      completedAt: { type: Date },
    },
    default: {},
  })
  healthHistory!: {
    allergies: string[];
    chronicConditions: string[];
    currentMedications: string[];
    pastSurgeries: string[];
    familyHistory: string[];
    bloodType: string;
    dob: string;
    gender: string;
    height: string;
    weight: string;
    lifestyleFactors: {
      smoking: boolean;
      alcohol: boolean;
      exercise: string;
    };
    completedAt?: Date;
  };

  // Location/jurisdiction (used for licensing/compliance gating)
  @Prop({ default: '' })
  locationState!: string; // e.g. 'Telangana'

  @Prop({ default: '' })
  locationCountry!: string; // e.g. 'IN'

  @Prop({ type: Number, default: null })
  locationLat!: number | null;

  @Prop({ type: Number, default: null })
  locationLng!: number | null;

  @Prop({ type: Date, default: null })
  locationUpdatedAt!: Date | null;

  @Prop({ default: false })
  locationConsent!: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre('save', function (next) {
  if (!this.medivaid) {
    // Generate a 10-digit random number prefixed with MV
    const randomNum = Math.floor(1000000000 + Math.random() * 9000000000);
    this.medivaid = `MV${randomNum}`;
  }
  next();
});
