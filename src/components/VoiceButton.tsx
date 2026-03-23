import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import voiceService from '../services/voice';

interface VoiceButtonProps {
  onRecordingComplete: (uri: string) => void;
  disabled?: boolean;
}

export default function VoiceButton({ onRecordingComplete, disabled }: VoiceButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const scale = new Animated.Value(1);

  const handlePressIn = async () => {
    if (disabled) return;
    try {
      setIsRecording(true);
      Animated.spring(scale, { toValue: 1.2, useNativeDriver: true }).start();
      await voiceService.startRecording();
    } catch (err) {
      setIsRecording(false);
      console.error('Recording start error:', err);
    }
  };

  const handlePressOut = async () => {
    if (!isRecording) return;
    try {
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
      const uri = await voiceService.stopRecording();
      setIsRecording(false);
      if (uri) {
        onRecordingComplete(uri);
      }
    } catch (err) {
      setIsRecording(false);
      console.error('Recording stop error:', err);
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.button, isRecording && styles.recording, disabled && styles.disabled]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <Text style={styles.icon}>{isRecording ? '🔴' : '🎤'}</Text>
        <Text style={[styles.label, isRecording && styles.recordingLabel]}>
          {isRecording ? 'Release to send' : 'Hold to talk'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  recording: { backgroundColor: '#FFEBEE', borderColor: '#EF9A9A' },
  disabled: { opacity: 0.5 },
  icon: { fontSize: 20, marginRight: 8 },
  label: { fontSize: 13, color: '#666' },
  recordingLabel: { color: '#D32F2F' },
});
