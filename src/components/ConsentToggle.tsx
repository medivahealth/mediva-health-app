import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';

interface ConsentToggleProps {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon: string;
}

export default function ConsentToggle({ label, description, value, onValueChange, icon }: ConsentToggleProps) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text style={styles.icon}>{icon}</Text>
        <View style={styles.textContainer}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E0E0E0', true: '#81C784' }}
        thumbColor={value ? '#4CAF50' : '#BDBDBD'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  icon: { fontSize: 24, marginRight: 12 },
  textContainer: { flex: 1 },
  label: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 2 },
  description: { fontSize: 12, color: '#888', lineHeight: 17 },
});
