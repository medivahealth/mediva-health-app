import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PushToken, PushTokenDocument } from './schemas/push-token.schema';
import { NotificationLog, NotificationLogDocument } from './schemas/notification-log.schema';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  category?: 'health_alert' | 'medication_reminder' | 'appointment' | 'general' | 'emergency';
  priority?: 'normal' | 'high';
  sound?: string;
  badge?: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private fcmServerKey: string | null = null;
  private apnsKeyId: string | null = null;
  private apnsTeamId: string | null = null;
  private apnsBundleId: string | null = null;
  private apnsPrivateKey: string | null = null;

  constructor(
    @InjectModel(PushToken.name) private pushTokenModel: Model<PushTokenDocument>,
    @InjectModel(NotificationLog.name) private notificationLogModel: Model<NotificationLogDocument>,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.initializePushCredentials();
  }

  private initializePushCredentials() {
    // FCM (Firebase Cloud Messaging) for Android
    this.fcmServerKey = this.configService.get<string>('FCM_SERVER_KEY') || null;
    
    // APNS (Apple Push Notification Service) for iOS
    this.apnsKeyId = this.configService.get<string>('APNS_KEY_ID') || null;
    this.apnsTeamId = this.configService.get<string>('APNS_TEAM_ID') || null;
    this.apnsBundleId = this.configService.get<string>('APNS_BUNDLE_ID') || null;
    this.apnsPrivateKey = this.configService.get<string>('APNS_PRIVATE_KEY') || null;

    if (!this.fcmServerKey) {
      this.logger.warn('FCM_SERVER_KEY not configured. Android push notifications will not work.');
    }
    if (!this.apnsKeyId || !this.apnsTeamId || !this.apnsBundleId) {
      this.logger.warn('APNS credentials not fully configured. iOS push notifications will not work.');
    }
  }

  /**
   * Register a push token for a user
   */
  async registerPushToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android' | 'web',
    deviceInfo?: { deviceId?: string; deviceName?: string; appVersion?: string },
  ): Promise<PushToken> {
    // Deactivate any existing tokens for this device
    if (deviceInfo?.deviceId) {
      await this.pushTokenModel.updateMany(
        { userId: new Types.ObjectId(userId), deviceId: deviceInfo.deviceId },
        { isActive: false },
      );
    }

    // Create or update the token
    const pushToken = await this.pushTokenModel.findOneAndUpdate(
      { token },
      {
        userId: new Types.ObjectId(userId),
        token,
        platform,
        deviceId: deviceInfo?.deviceId,
        deviceName: deviceInfo?.deviceName,
        appVersion: deviceInfo?.appVersion,
        isActive: true,
        lastUsedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    this.logger.log(`Registered push token for user ${userId} on ${platform}`);
    return pushToken;
  }

  /**
   * Unregister a push token
   */
  async unregisterPushToken(token: string): Promise<void> {
    await this.pushTokenModel.updateOne(
      { token },
      { isActive: false },
    );
    this.logger.log(`Unregistered push token: ${token.slice(0, 20)}...`);
  }

  /**
   * Get active push tokens for a user
   */
  async getUserPushTokens(userId: string): Promise<PushToken[]> {
    return this.pushTokenModel.find({
      userId: new Types.ObjectId(userId),
      isActive: true,
    });
  }

  /**
   * Send push notification to a specific user
   */
  async sendNotificationToUser(
    userId: string,
    payload: PushNotificationPayload,
  ): Promise<{ success: boolean; sent: number; failed: number }> {
    const tokens = await this.getUserPushTokens(userId);
    
    if (tokens.length === 0) {
      this.logger.warn(`No active push tokens found for user ${userId}`);
      return { success: false, sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const token of tokens) {
      try {
        if (token.platform === 'android') {
          await this.sendFCMNotification(token.token, payload);
        } else if (token.platform === 'ios') {
          await this.sendAPNSNotification(token.token, payload);
        }
        
        // Log successful notification
        await this.logNotification(userId, token, payload, 'sent');
        sent++;
      } catch (error) {
        this.logger.error(`Failed to send notification to ${token.platform}: ${error.message}`);
        
        // Log failed notification
        await this.logNotification(userId, token, payload, 'failed', error.message);
        
        // Mark token as inactive if it's invalid
        if (this.isInvalidTokenError(error)) {
          await this.unregisterPushToken(token.token);
        }
        failed++;
      }
    }

    return { success: failed === 0, sent, failed };
  }

  /**
   * Send FCM (Firebase) notification to Android
   */
  private async sendFCMNotification(
    token: string,
    payload: PushNotificationPayload,
  ): Promise<void> {
    if (!this.fcmServerKey) {
      throw new Error('FCM server key not configured');
    }

    const fcmPayload = {
      to: token,
      priority: payload.priority || 'normal',
      notification: {
        title: payload.title,
        body: payload.body,
        sound: payload.sound || 'default',
        badge: payload.badge?.toString(),
      },
      data: {
        ...payload.data,
        category: payload.category || 'general',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post('https://fcm.googleapis.com/fcm/send', fcmPayload, {
          headers: {
            'Authorization': `key=${this.fcmServerKey}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      if (response.data.failure > 0) {
        throw new Error(response.data.results?.[0]?.error || 'FCM delivery failed');
      }
    } catch (error) {
      throw new Error(`FCM error: ${error.message}`);
    }
  }

  /**
   * Send APNS notification to iOS
   */
  private async sendAPNSNotification(
    token: string,
    payload: PushNotificationPayload,
  ): Promise<void> {
    // For production, use the APNS HTTP/2 API with JWT authentication
    // This is a simplified implementation using Expo Push Service as a proxy
    // In production, implement direct APNS with JWT
    
    const expoPayload = {
      to: token,
      title: payload.title,
      body: payload.body,
      sound: payload.sound || 'default',
      badge: payload.badge,
      priority: payload.priority === 'high' ? 'high' : 'default',
      data: {
        ...payload.data,
        category: payload.category || 'general',
      },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post('https://exp.host/--/api/v2/push/send', expoPayload, {
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      if (response.data.data?.status === 'error') {
        throw new Error(response.data.data?.message || 'Expo push delivery failed');
      }
    } catch (error) {
      throw new Error(`Push notification error: ${error.message}`);
    }
  }

  /**
   * Log notification for analytics
   */
  private async logNotification(
    userId: string,
    token: PushToken,
    payload: PushNotificationPayload,
    status: 'pending' | 'sent' | 'delivered' | 'failed' | 'opened',
    errorMessage?: string,
  ): Promise<void> {
    try {
      await this.notificationLogModel.create({
        userId: new Types.ObjectId(userId),
        token: token.token,
        platform: token.platform,
        title: payload.title,
        body: payload.body,
        category: payload.category || 'general',
        data: payload.data,
        status,
        errorMessage,
        sentAt: status === 'sent' ? new Date() : undefined,
      });
    } catch (error) {
      this.logger.error(`Failed to log notification: ${error.message}`);
    }
  }

  /**
   * Check if error indicates invalid token
   */
  private isInvalidTokenError(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    return (
      errorMessage.includes('invalid token') ||
      errorMessage.includes('not registered') ||
      errorMessage.includes('unregistered') ||
      errorMessage.includes('invalid registration')
    );
  }

  /**
   * Send health alert notification
   */
  async sendHealthAlert(
    userId: string,
    alertType: string,
    message: string,
    severity: 'low' | 'medium' | 'high',
    data?: Record<string, any>,
  ): Promise<{ success: boolean; sent: number; failed: number }> {
    const title = this.getHealthAlertTitle(alertType, severity);
    const body = this.formatHealthAlertMessage(message, severity);
    
    return this.sendNotificationToUser(userId, {
      title,
      body,
      category: severity === 'high' ? 'emergency' : 'health_alert',
      priority: severity === 'high' ? 'high' : 'normal',
      data: {
        type: 'health_alert',
        alertType,
        severity,
        ...data,
      },
    });
  }

  /**
   * Send medication reminder
   */
  async sendMedicationReminder(
    userId: string,
    medicationName: string,
    dosage: string,
    time: string,
  ): Promise<{ success: boolean; sent: number; failed: number }> {
    return this.sendNotificationToUser(userId, {
      title: 'Medication Reminder',
      body: `Time to take ${medicationName} ${dosage}`,
      category: 'medication_reminder',
      data: {
        type: 'medication_reminder',
        medicationName,
        dosage,
        time,
      },
    });
  }

  /**
   * Send appointment reminder
   */
  async sendAppointmentReminder(
    userId: string,
    doctorName: string,
    appointmentTime: string,
    location?: string,
  ): Promise<{ success: boolean; sent: number; failed: number }> {
    const body = location 
      ? `Your appointment with Dr. ${doctorName} is at ${appointmentTime} at ${location}`
      : `Your appointment with Dr. ${doctorName} is at ${appointmentTime}`;
    
    return this.sendNotificationToUser(userId, {
      title: 'Appointment Reminder',
      body,
      category: 'appointment',
      data: {
        type: 'appointment_reminder',
        doctorName,
        appointmentTime,
        location,
      },
    });
  }

  /**
   * Get health alert title based on type and severity
   */
  private getHealthAlertTitle(alertType: string, severity: 'low' | 'medium' | 'high'): string {
    const titles: Record<string, Record<string, string>> = {
      'heart_rate': {
        high: 'Heart Rate Alert - Attention Needed',
        medium: 'Unusual Heart Rate Pattern',
        low: 'Heart Rate Update',
      },
      'blood_pressure': {
        high: 'Blood Pressure Alert',
        medium: 'Blood Pressure Notice',
        low: 'Blood Pressure Reading',
      },
      'sleep': {
        high: 'Sleep Pattern Alert',
        medium: 'Sleep Quality Notice',
        low: 'Sleep Insights',
      },
      'activity': {
        high: 'Activity Level Alert',
        medium: 'Activity Reminder',
        low: 'Activity Update',
      },
      'glucose': {
        high: 'Blood Sugar Alert',
        medium: 'Glucose Level Notice',
        low: 'Glucose Reading',
      },
      'oxygen': {
        high: 'Oxygen Level Alert',
        medium: 'Oxygen Saturation Notice',
        low: 'Oxygen Reading',
      },
      'general': {
        high: 'Health Alert',
        medium: 'Health Notice',
        low: 'Health Update',
      },
    };

    return titles[alertType]?.[severity] || titles['general'][severity];
  }

  /**
   * Format health alert message
   */
  private formatHealthAlertMessage(message: string, severity: 'low' | 'medium' | 'high'): string {
    // Keep it concise for push notification
    const maxLength = 150;
    let formatted = message;
    
    if (formatted.length > maxLength) {
      formatted = formatted.substring(0, maxLength - 3) + '...';
    }
    
    return formatted;
  }

  /**
   * Get notification analytics for a user
   */
  async getUserNotificationStats(userId: string): Promise<{
    total: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const notifications = await this.notificationLogModel.find({
      userId: new Types.ObjectId(userId),
    });

    const stats = {
      total: notifications.length,
      byCategory: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
    };

    for (const notification of notifications) {
      stats.byCategory[notification.category] = (stats.byCategory[notification.category] || 0) + 1;
      stats.byStatus[notification.status] = (stats.byStatus[notification.status] || 0) + 1;
    }

    return stats;
  }
}
