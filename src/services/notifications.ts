/**
 * Push Notification Service for Mediva Health App
 * Handles push notifications for health alerts, reminders, and updates
 * Uses Expo Notifications for cross-platform support
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api } from './api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface HealthAlertNotification {
  id: string;
  title: string;
  body: string;
  data?: {
    type: 'health_alert' | 'medication_reminder' | 'appointment' | 'health_tip' | 'emergency';
    severity?: 'low' | 'medium' | 'high' | 'critical';
    action?: string;
    screen?: string;
    payload?: Record<string, any>;
  };
}

// Register for push notifications
export const registerForPushNotifications = async (): Promise<string | null> => {
  try {
    // Check if device is physical (not simulator)
    if (!Device.isDevice) {
      console.log('Push notifications not available on simulator');
      return null;
    }

    // Request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // Get push token
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    
    // Store token locally
    await SecureStore.setItemAsync('pushToken', token);
    
    // Register with backend
    await registerTokenWithBackend(token);
    
    // Configure Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('health-alerts', {
        name: 'Health Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
      
      await Notifications.setNotificationChannelAsync('medication-reminders', {
        name: 'Medication Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
      
      await Notifications.setNotificationChannelAsync('health-tips', {
        name: 'Health Tips',
        importance: Notifications.AndroidImportance.LOW,
      });
    }

    return token;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
};

// Register push token with backend
const registerTokenWithBackend = async (token: string): Promise<void> => {
  try {
    await api.post('/notifications/register-token', { 
      token,
      platform: Platform.OS,
      deviceType: Device.deviceType,
    });
  } catch (error) {
    console.error('Error registering token with backend:', error);
  }
};

// Get stored push token
export const getStoredPushToken = async (): Promise<string | null> => {
  return SecureStore.getItemAsync('pushToken');
};

// Schedule a local notification
export const scheduleLocalNotification = async (
  title: string,
  body: string,
  trigger: Notifications.NotificationTriggerInput,
  data?: Record<string, any>
): Promise<string | null> => {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
        priority: Notifications.AndroidPriority.HIGH,
      },
      trigger,
    });
    return id;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
};

// Schedule medication reminder
export const scheduleMedicationReminder = async (
  medicationName: string,
  dosage: string,
  time: Date,
  repeatDaily: boolean = true
): Promise<string | null> => {
  const title = `Medication Reminder: ${medicationName}`;
  const body = `Time to take ${dosage} of ${medicationName}`;
  
  const trigger: Notifications.DailyTriggerInput = {
    type: SchedulableTriggerInputTypes.DAILY,
    hour: time.getHours(),
    minute: time.getMinutes(),
  };
  
  return scheduleLocalNotification(title, body, trigger, {
    type: 'medication_reminder',
    medicationName,
    dosage,
    screen: 'medications',
  });
};

// Schedule health tip
export const scheduleHealthTip = async (tip: string): Promise<void> => {
  // Schedule for 9 AM next day
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  
  await scheduleLocalNotification(
    'Daily Health Tip',
    tip,
    { date: tomorrow },
    { type: 'health_tip', screen: 'discover' }
  );
};

// Cancel scheduled notification
export const cancelScheduledNotification = async (identifier: string): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    console.error('Error canceling notification:', error);
  }
};

// Cancel all scheduled notifications
export const cancelAllNotifications = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error canceling all notifications:', error);
  }
};

// Get all scheduled notifications
export const getScheduledNotifications = async (): Promise<Notifications.NotificationRequest[]> => {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return [];
  }
};

// Show immediate local notification
export const showLocalNotification = async (
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
        priority: Notifications.AndroidPriority.HIGH,
      },
      trigger: null, // Immediate
    });
  } catch (error) {
    console.error('Error showing notification:', error);
  }
};

// Show health alert notification
export const showHealthAlert = async (
  alert: {
    title: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    action?: string;
  }
): Promise<void> => {
  const { title, message, severity, action } = alert;
  
  // Determine notification settings based on severity
  const isCritical = severity === 'critical' || severity === 'high';
  
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: isCritical ? `⚠️ ${title}` : title,
        body: message,
        data: {
          type: 'health_alert',
          severity,
          action,
          screen: 'chat',
        },
        sound: isCritical ? 'default' : undefined,
        priority: isCritical ? Notifications.AndroidPriority.MAX : Notifications.AndroidPriority.HIGH,
        badge: isCritical ? 1 : undefined,
      },
      trigger: null,
    });
  } catch (error) {
    console.error('Error showing health alert:', error);
  }
};

// Show emergency notification
export const showEmergencyNotification = async (message: string): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 Health Emergency Detected',
        body: message,
        data: {
          type: 'emergency',
          severity: 'critical',
          screen: 'chat',
        },
        sound: 'default',
        priority: Notifications.AndroidPriority.MAX,
        badge: 1,
      },
      trigger: null,
    });
  } catch (error) {
    console.error('Error showing emergency notification:', error);
  }
};

// Notification response handler
export const setupNotificationResponseHandler = (
  onNotificationResponse: (response: Notifications.NotificationResponse) => void
): void => {
  Notifications.addNotificationResponseReceivedListener((response) => {
    onNotificationResponse(response);
  });
};

// Notification received handler
export const setupNotificationReceivedHandler = (
  onNotificationReceived: (notification: Notifications.Notification) => void
): void => {
  Notifications.addNotificationReceivedListener((notification) => {
    onNotificationReceived(notification);
  });
};

// Remove notification listeners
export const removeNotificationListeners = (
  subscription: Notifications.Subscription
): void => {
  Notifications.removeNotificationSubscription(subscription);
};

// Check notification permissions
export const checkNotificationPermissions = async (): Promise<{
  granted: boolean;
  canAskAgain: boolean;
}> => {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  return {
    granted: status === 'granted',
    canAskAgain,
  };
};

// Request notification permissions
export const requestNotificationPermissions = async (): Promise<boolean> => {
  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowAnnouncements: true,
    },
  });
  return status === 'granted';
};

// Get badge count
export const getBadgeCount = async (): Promise<number> => {
  try {
    return await Notifications.getBadgeCountAsync();
  } catch {
    return 0;
  }
};

// Set badge count
export const setBadgeCount = async (count: number): Promise<void> => {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('Error setting badge count:', error);
  }
};

// Clear badge
export const clearBadge = async (): Promise<void> => {
  await setBadgeCount(0);
};

// Increment badge
export const incrementBadge = async (): Promise<void> => {
  const current = await getBadgeCount();
  await setBadgeCount(current + 1);
};

// Health monitoring notifications based on thresholds
export const checkAndNotifyHealthThresholds = async (
  healthData: {
    type: string;
    value: number;
    unit: string;
  }
): Promise<void> => {
  const { type, value, unit } = healthData;
  
  switch (type) {
    case 'heart_rate':
      if (value > 120) {
        await showHealthAlert({
          title: 'High Heart Rate Detected',
          message: `Your heart rate is ${value} ${unit}. If you feel unwell, please consult a doctor.`,
          severity: 'medium',
          action: 'Check your vitals',
        });
      }
      break;
      
    case 'spo2':
      if (value < 94) {
        await showHealthAlert({
          title: 'Low Oxygen Level',
          message: `Your SpO2 is ${value}%. Please take deep breaths and rest. If symptoms persist, seek medical help.`,
          severity: value < 90 ? 'critical' : 'high',
          action: 'Monitor closely',
        });
      }
      break;
      
    case 'blood_pressure_systolic':
      if (value > 140) {
        await showHealthAlert({
          title: 'High Blood Pressure',
          message: `Your BP is ${value} ${unit}. Please rest and recheck after 15 minutes.`,
          severity: value > 180 ? 'critical' : 'high',
          action: 'Rest and recheck',
        });
      }
      break;
      
    case 'blood_glucose':
      if (value > 180) {
        await showHealthAlert({
          title: 'High Blood Sugar',
          message: `Your glucose is ${value} ${unit}. Consider checking your diet and medication.`,
          severity: value > 250 ? 'high' : 'medium',
          action: 'Review diet',
        });
      }
      break;
      
    case 'body_temperature':
      if (value > 38) {
        await showHealthAlert({
          title: 'Fever Detected',
          message: `Your temperature is ${value}°C. Rest, hydrate, and monitor symptoms.`,
          severity: value > 39 ? 'high' : 'medium',
          action: 'Rest and hydrate',
        });
      }
      break;
  }
};

// Schedule health data sync reminder
export const scheduleHealthSyncReminder = async (): Promise<void> => {
  // Schedule weekly reminder on Sunday at 10 AM
  const now = new Date();
  const daysUntilSunday = 7 - now.getDay();
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + daysUntilSunday);
  nextSunday.setHours(10, 0, 0, 0);
  
  await scheduleLocalNotification(
    'Sync Your Health Data',
    'Connect your Apple Health or Health Connect to keep your health records up to date.',
    { date: nextSunday },
    { type: 'health_tip', screen: 'settings' }
  );
};

export default {
  registerForPushNotifications,
  getStoredPushToken,
  scheduleLocalNotification,
  scheduleMedicationReminder,
  scheduleHealthTip,
  cancelScheduledNotification,
  cancelAllNotifications,
  getScheduledNotifications,
  showLocalNotification,
  showHealthAlert,
  showEmergencyNotification,
  setupNotificationResponseHandler,
  setupNotificationReceivedHandler,
  removeNotificationListeners,
  checkNotificationPermissions,
  requestNotificationPermissions,
  getBadgeCount,
  setBadgeCount,
  clearBadge,
  incrementBadge,
  checkAndNotifyHealthThresholds,
  scheduleHealthSyncReminder,
};
