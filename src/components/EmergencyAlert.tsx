import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES } from '../theme';

interface EmergencyAlertProps {
  onDismiss?: () => void;
  severity?: 'EMERGENCY' | 'HIGH';
}

export default function EmergencyAlert({ onDismiss, severity = 'EMERGENCY' }: EmergencyAlertProps) {
  const [showFirstAid, setShowFirstAid] = useState(false);

  const handleCall108 = () => {
    Linking.openURL('tel:108').catch((err) => {
      console.error('Failed to open phone dialer:', err);
    });
  };

  const firstAidTips = [
    'Stay calm and assess the situation',
    'Call 108 immediately if not already done',
    'Do not move the person if they have a spinal injury',
    'If unconscious, check for breathing and pulse',
    'If not breathing, begin CPR if trained',
    'Control bleeding by applying direct pressure',
    'Keep the person warm and comfortable',
    'Do not give food or water to an unconscious person',
  ];

  return (
    <View style={styles.container}>
      <View style={styles.alertHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name="warning" size={24} color={COLORS.white} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.alertTitle}>Medical Emergency Detected</Text>
          <Text style={styles.alertSubtitle}>Please seek immediate medical attention</Text>
        </View>
      </View>

      <View style={styles.content}>
        <TouchableOpacity style={styles.callButton} onPress={handleCall108} activeOpacity={0.8}>
          <Ionicons name="call" size={24} color={COLORS.white} />
          <Text style={styles.callButtonText}>Call 108 (Emergency)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.firstAidButton}
          onPress={() => setShowFirstAid(!showFirstAid)}
          activeOpacity={0.7}
        >
          <Ionicons name={showFirstAid ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.primary} />
          <Text style={styles.firstAidButtonText}>First Aid Instructions</Text>
        </TouchableOpacity>

        {showFirstAid && (
          <View style={styles.firstAidContainer}>
            {firstAidTips.map((tip, index) => (
              <View key={index} style={styles.tipRow}>
                <View style={styles.tipBullet} />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        )}

        {onDismiss && (
          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss} activeOpacity={0.7}>
            <Text style={styles.dismissButtonText}>I've called 108</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.error,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: SIZES.radiusLg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  alertTitle: {
    fontSize: SIZES.lg,
    fontWeight: '700',
    color: COLORS.white,
    fontFamily: FONTS.bold,
    marginBottom: 4,
  },
  alertSubtitle: {
    fontSize: SIZES.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: FONTS.regular,
  },
  content: {
    padding: 16,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: SIZES.radius,
    gap: 8,
    marginBottom: 12,
  },
  callButtonText: {
    fontSize: SIZES.lg,
    fontWeight: '700',
    color: COLORS.error,
    fontFamily: FONTS.bold,
  },
  firstAidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 8,
  },
  firstAidButtonText: {
    fontSize: SIZES.base,
    color: COLORS.white,
    fontFamily: FONTS.regular,
  },
  firstAidContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: SIZES.radius,
    padding: 12,
    marginBottom: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.white,
    marginTop: 6,
    marginRight: 10,
  },
  tipText: {
    flex: 1,
    fontSize: SIZES.sm,
    color: COLORS.white,
    fontFamily: FONTS.regular,
    lineHeight: 20,
  },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    marginTop: 8,
  },
  dismissButtonText: {
    fontSize: SIZES.base,
    color: COLORS.white,
    fontFamily: FONTS.regular,
    textDecorationLine: 'underline',
  },
});
