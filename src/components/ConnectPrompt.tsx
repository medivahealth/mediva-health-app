import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Linking } from 'react-native';

interface ConnectPromptProps {
  platform: string;
  icon: string;
  description: string;
  docsUrl: string;
  onConnect: (token: string) => void;
  tokenValue: string;
  onTokenChange: (text: string) => void;
  color: string;
}

export default function ConnectPrompt({
  platform,
  icon,
  description,
  docsUrl,
  onConnect,
  tokenValue,
  onTokenChange,
  color,
}: ConnectPromptProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>Connect {platform}</Text>
      <Text style={styles.description}>{description}</Text>

      <View style={styles.steps}>
        <Text style={styles.stepTitle}>How to connect:</Text>
        <Text style={styles.step}>1. Create a developer account on {platform}</Text>
        <Text style={styles.step}>2. Generate a Personal Access Token</Text>
        <Text style={styles.step}>3. Paste it below</Text>
      </View>

      <TouchableOpacity
        style={[styles.docsButton, { borderColor: color }]}
        onPress={() => Linking.openURL(docsUrl)}
      >
        <Text style={[styles.docsButtonText, { color }]}>🔗 Open {platform} Developer Portal</Text>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder={`Paste ${platform} API token here...`}
        value={tokenValue}
        onChangeText={onTokenChange}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity
        style={[styles.connectButton, { backgroundColor: color }, !tokenValue && styles.connectButtonDisabled]}
        onPress={() => tokenValue && onConnect(tokenValue)}
        disabled={!tokenValue}
      >
        <Text style={styles.connectButtonText}>Connect {platform}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  icon: {
    fontSize: 56,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  steps: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  step: {
    fontSize: 13,
    color: '#666',
    lineHeight: 24,
  },
  docsButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  docsButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    backgroundColor: '#f9f9f9',
    width: '100%',
    marginBottom: 16,
  },
  connectButton: {
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
  },
  connectButtonDisabled: {
    opacity: 0.5,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
