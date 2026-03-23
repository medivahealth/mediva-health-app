import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';

interface NotAvailableProps {
  platform: string;
  reason: string;
  icon: string;
  docsUrl?: string;
  instructions?: string;
}

export default function NotAvailable({ platform, reason, icon, docsUrl, instructions }: NotAvailableProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{platform}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Not Available</Text>
      </View>
      <Text style={styles.reason}>{reason}</Text>
      {instructions && <Text style={styles.instructions}>{instructions}</Text>}
      {docsUrl && (
        <TouchableOpacity
          style={styles.docsButton}
          onPress={() => Linking.openURL(docsUrl)}
        >
          <Text style={styles.docsButtonText}>📖 View Documentation</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  badgeText: {
    color: '#E74C3C',
    fontSize: 14,
    fontWeight: '600',
  },
  reason: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  instructions: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  docsButton: {
    backgroundColor: '#F0F7FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  docsButtonText: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '600',
  },
});
