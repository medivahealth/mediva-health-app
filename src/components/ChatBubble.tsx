import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SIZES } from '../theme';

interface ChatBubbleProps {
  role: 'user' | 'assistant' | 'doctor';
  content: string;
  severity?: string;
  timestamp?: string;
}

export default function ChatBubble({ role, content, severity, timestamp }: ChatBubbleProps) {
  const isUser = role === 'user';
  const isDoctor = role === 'doctor';

  return (
    <View style={[styles.container, isUser && styles.userContainer]}>
      {!isUser && (
        <View style={styles.roleTag}>
          <Text style={styles.roleText}>
            {isDoctor ? 'DOCTOR' : 'DR. MEDIVA'}
          </Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.userBubble : isDoctor ? styles.doctorBubble : styles.aiBubble]}>
        <Text style={[styles.bubbleText, isUser && styles.userText]}>{content}</Text>
        {severity && severity !== 'LOW' && (
          <View style={[styles.severityBadge, severity === 'EMERGENCY' && styles.emergencyBadge, severity === 'HIGH' && styles.highBadge]}>
            <Text style={styles.severityText}>
              {severity === 'EMERGENCY' ? '🚨 EMERGENCY' : severity === 'HIGH' ? '⚠️ HIGH' : `ℹ️ ${severity}`}
            </Text>
          </View>
        )}
      </View>
      {timestamp && (
        <Text style={[styles.time, isUser && styles.userTime]}>
          {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16, maxWidth: '85%' },
  userContainer: { alignSelf: 'flex-end' },
  roleTag: { marginBottom: 6 },
  roleText: { 
    fontSize: 10, 
    color: COLORS.primary, 
    fontWeight: '800',
    fontFamily: FONTS.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  bubble: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12 },
  userBubble: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: COLORS.inputBg, borderBottomLeftRadius: 4 },
  doctorBubble: { backgroundColor: '#E8F5E9', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#81C784' },
  bubbleText: { color: COLORS.primaryLight, fontSize: SIZES.base, lineHeight: 22, fontFamily: FONTS.regular },
  userText: { color: COLORS.white },
  severityBadge: {
    marginTop: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  highBadge: { backgroundColor: '#FFF3E0' },
  emergencyBadge: { backgroundColor: '#FFEBEE' },
  severityText: { fontSize: 12, fontWeight: '600', color: '#E65100', fontFamily: FONTS.regular },
  time: { fontSize: 10, color: COLORS.tertiary, marginTop: 4, fontFamily: FONTS.regular },
  userTime: { textAlign: 'right' },
});
