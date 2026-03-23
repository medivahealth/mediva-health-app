import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DataCardProps {
  icon: string;
  title: string;
  value: string | number;
  unit?: string;
  color?: string;
  subtitle?: string;
}

export default function DataCard({ icon, title, value, unit, color = '#4A90E2', subtitle }: DataCardProps) {
  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.info}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.value, { color }]}>{value}</Text>
          {unit && <Text style={styles.unit}>{unit}</Text>}
        </View>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  icon: {
    fontSize: 28,
    marginRight: 14,
    width: 36,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    color: '#888',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  unit: {
    fontSize: 14,
    color: '#888',
    marginLeft: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 2,
  },
});
