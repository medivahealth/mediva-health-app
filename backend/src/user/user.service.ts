import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id).select('-password -refreshToken');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(
    userId: string,
    data: { name?: string; email?: string; preferredLanguage?: string; profileImage?: string; dob?: string },
  ): Promise<User> {
    const user = await this.userModel.findByIdAndUpdate(userId, data, { new: true }).select('-password -refreshToken');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateConsent(
    userId: string,
    consent: {
      healthDataCollection?: boolean;
      aiAnalysis?: boolean;
      doctorSharing?: boolean;
      abdmAccess?: boolean;
    },
  ): Promise<User> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    user.consentStatus = {
      ...user.consentStatus,
      ...consent,
      grantedAt: new Date(),
    };
    return user.save();
  }

  async getConsent(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return {
      healthDataCollection: user.consentStatus?.healthDataCollection ?? true,
      aiAnalysis: user.consentStatus?.aiAnalysis ?? true,
      doctorSharing: user.consentStatus?.doctorSharing ?? true,
      abdmAccess: user.consentStatus?.abdmAccess ?? true,
      grantedAt: user.consentStatus?.grantedAt,
    };
  }

  /**
   * Soft delete: Mark user as deleted but keep data for AI improvement
   * User-facing data is cleared, but anonymized data is retained
   */
  async softDeleteAccount(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Clear personal data but keep anonymized health data
    user.name = 'Deleted User';
    user.email = `deleted_${userId}@mediva.ai`;
    user.phone = undefined;
    user.password = '';
    user.refreshToken = '';
    user.profileImage = '';
    user.googleId = '';
    user.appleId = '';
    user.abhaAddress = '';
    user.emailVerificationToken = '';
    user.resetPasswordToken = '';
    user.role = 'deleted' as any;
    await user.save();
  }

  /** Logout from all devices by clearing refresh token */
  async logoutAllDevices(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { refreshToken: '' });
  }

  async deleteAllData(userId: string): Promise<void> {
    // Soft delete — anonymize but keep for AI
    await this.softDeleteAccount(userId);
  }

  async exportData(userId: string): Promise<any> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return {
      profile: {
        medivaid: user.medivaid,
        phone: user.phone,
        name: user.name,
        email: user.email,
        preferredLanguage: user.preferredLanguage,
        abhaAddress: user.abhaAddress,
        profileImage: user.profileImage,
        dob: user.dob,
      },
      consent: user.consentStatus,
      devices: user.devices,
      healthHistory: user.healthHistory,
    };
  }

  async updateHealthHistory(
    userId: string,
    healthHistory: {
      allergies?: string[];
      chronicConditions?: string[];
      currentMedications?: string[];
      pastSurgeries?: string[];
      familyHistory?: string[];
      bloodType?: string;
      dob?: string;
      gender?: string;
      height?: string;
      weight?: string;
      lifestyleFactors?: {
        smoking?: boolean;
        alcohol?: boolean;
        exercise?: string;
      };
      completedAt?: Date;
    },
  ): Promise<User> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Merge with existing health history
    user.healthHistory = {
      ...user.healthHistory,
      ...healthHistory,
      lifestyleFactors: {
        ...user.healthHistory?.lifestyleFactors,
        ...healthHistory.lifestyleFactors,
      },
    };

    // Set completedAt if all major fields are filled
    if (!user.healthHistory.completedAt) {
      const hasData =
        (user.healthHistory.allergies && user.healthHistory.allergies.length > 0) ||
        (user.healthHistory.chronicConditions && user.healthHistory.chronicConditions.length > 0) ||
        (user.healthHistory.currentMedications && user.healthHistory.currentMedications.length > 0) ||
        user.healthHistory.bloodType;

      if (hasData && healthHistory.completedAt !== undefined) {
        user.healthHistory.completedAt = healthHistory.completedAt || new Date();
      }
    }

    return user.save();
  }

  async getHealthHistory(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return user.healthHistory || {};
  }

  async updateLocation(
    userId: string,
    data: {
      state?: string;
      country?: string;
      lat?: number | null;
      lng?: number | null;
      consent: boolean;
    },
  ): Promise<User> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    user.locationConsent = !!data.consent;
    if (data.consent) {
      if (typeof data.state === 'string') user.locationState = data.state;
      if (typeof data.country === 'string') user.locationCountry = data.country;
      if (typeof data.lat === 'number' || data.lat === null) user.locationLat = data.lat ?? null;
      if (typeof data.lng === 'number' || data.lng === null) user.locationLng = data.lng ?? null;
      user.locationUpdatedAt = new Date();
    }

    return user.save();
  }
}
