import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface PlatformBadgeProps {
  available: boolean;
  connected?: boolean;
  platformName: string;
}

export default function PlatformBadge({ available, connected, platformName }: PlatformBadgeProps) {
  const getStatus = () => {
    if (!available) return { text: 'Not Available', color: '#E74C3C', bg: '#FFE5E5' };
    if (connected) return { text: 'Connected', color: '#27AE60', bg: '#E5FFE5' };
    return { text: 'Available', color: '#F39C12', bg: '#FFF5E5' };
  };

  const status = getStatus();

  return (
    <View style={[styles.badge, { backgroundColor: status.bg }]}>
      <View style={[styles.dot, { backgroundColor: status.color }]} />
      <Text style={[styles.text, { color: status.color }]}>{status.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
