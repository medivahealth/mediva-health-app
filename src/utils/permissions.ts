import { Audio } from 'expo-av';
import { Platform, Alert, Linking } from 'react-native';

export interface PermissionResult {
  granted: boolean;
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
}

/**
 * Check and request microphone permission with proper user guidance
 */
export async function requestMicrophonePermission(): Promise<PermissionResult> {
  try {
    // First check current permission status
    const { status, canAskAgain } = await Audio.getPermissionsAsync();
    
    if (status === 'granted') {
      return { granted: true, status: 'granted', canAskAgain: true };
    }
    
    // If denied and can't ask again, we need to guide user to settings
    if (status === 'denied' && !canAskAgain) {
      showPermissionDeniedAlert('microphone');
      return { granted: false, status: 'denied', canAskAgain: false };
    }
    
    // Request permission
    const result = await Audio.requestPermissionsAsync();
    
    if (result.status === 'granted') {
      return { granted: true, status: 'granted', canAskAgain: true };
    }
    
    // Permission denied
    if (!result.canAskAgain) {
      showPermissionDeniedAlert('microphone');
    }
    
    return {
      granted: false,
      status: result.status as 'denied' | 'undetermined',
      canAskAgain: result.canAskAgain,
    };
  } catch (error) {
    console.error('Error requesting microphone permission:', error);
    return { granted: false, status: 'denied', canAskAgain: false };
  }
}

/**
 * Check microphone permission status without requesting
 */
export async function checkMicrophonePermission(): Promise<PermissionResult> {
  try {
    const { status, canAskAgain } = await Audio.getPermissionsAsync();
    return {
      granted: status === 'granted',
      status: status as 'granted' | 'denied' | 'undetermined',
      canAskAgain,
    };
  } catch (error) {
    console.error('Error checking microphone permission:', error);
    return { granted: false, status: 'denied', canAskAgain: false };
  }
}

/**
 * Show alert guiding user to app settings when permission is permanently denied
 */
function showPermissionDeniedAlert(permissionType: 'microphone' | 'audio'): void {
  const title = permissionType === 'microphone' 
    ? 'Microphone Access Required'
    : 'Audio Access Required';
    
  const message = permissionType === 'microphone'
    ? 'Mediva Voice Doctor needs microphone access to hear you. Please enable it in your device settings.'
    : 'Mediva needs audio access to play voice responses. Please enable it in your device settings.';

  Alert.alert(
    title,
    message,
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Open Settings',
        onPress: () => openAppSettings(),
      },
    ],
    { cancelable: false }
  );
}

/**
 * Open app settings
 */
export function openAppSettings(): void {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:');
  } else {
    // Android - open app details settings
    const packageName = 'com.mediva.healthapp'; // Replace with your actual package name
    Linking.openSettings().catch(() => {
      // Fallback to app details
      Linking.openURL(`package:${packageName}`).catch(() => {});
    });
  }
}

/**
 * Show permission rationale dialog before requesting
 */
export function showPermissionRationale(
  permissionType: 'microphone',
  onAccept: () => void,
  onDecline: () => void
): void {
  const title = permissionType === 'microphone' 
    ? 'Allow Microphone Access?'
    : 'Allow Audio Access?';
    
  const message = permissionType === 'microphone'
    ? 'Mediva Voice Doctor needs access to your microphone so you can talk with Dr. Mediva. Your voice is only used for the conversation and is not stored.'
    : 'Mediva needs access to play audio for voice responses.';

  Alert.alert(
    title,
    message,
    [
      {
        text: 'Not Now',
        style: 'cancel',
        onPress: onDecline,
      },
      {
        text: 'Allow',
        onPress: onAccept,
      },
    ],
    { cancelable: true }
  );
}
