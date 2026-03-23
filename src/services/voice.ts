/**
 * Voice recording service using expo-av
 */
import { Audio } from 'expo-av';

class VoiceService {
  private recording: Audio.Recording | null = null;

  async startRecording(): Promise<void> {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      this.recording = recording;
    } catch (err) {
      console.error('Failed to start recording:', err);
      throw err;
    }
  }

  async stopRecording(): Promise<string | null> {
    if (!this.recording) return null;

    try {
      await this.recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = this.recording.getURI();
      this.recording = null;
      return uri;
    } catch (err) {
      console.error('Failed to stop recording:', err);
      this.recording = null;
      return null;
    }
  }

  isRecording(): boolean {
    return this.recording !== null;
  }
}

export const voiceService = new VoiceService();
export default voiceService;
