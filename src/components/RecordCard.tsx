import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { MedicalDocument } from '../types';

interface RecordCardProps {
  document: MedicalDocument;
  onPress: () => void;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  processing: { label: 'Processing', color: '#FFFFFF', bg: 'rgba(255,165,0,0.2)' },
  processed: { label: 'Ready', color: '#FFFFFF', bg: 'rgba(16,185,129,0.2)' },
  needs_review: { label: 'Needs Review', color: '#FFFFFF', bg: 'rgba(59,130,246,0.2)' },
  error: { label: 'Error', color: '#FFFFFF', bg: 'rgba(239,68,68,0.2)' },
};

export default function RecordCard({ document, onPress }: RecordCardProps) {
  const status = statusConfig[document.status] || statusConfig.processing;
  const testCount = document.structuredData?.tests?.length || 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.info}>
          <Text style={styles.fileName} numberOfLines={1}>
            {document.fileName}
          </Text>
          <Text style={styles.date}>
            {new Date(document.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {testCount > 0 && (
        <View style={styles.tests}>
          {document.structuredData.tests!.slice(0, 3).map((t, i) => (
            <Text key={i} style={styles.testItem}>
              {t.name}: <Text style={styles.testValue}>{t.value} {t.unit}</Text>
            </Text>
          ))}
          {testCount > 3 && (
            <Text style={styles.moreTests}>+{testCount - 3} more tests</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  info: { flex: 1 },
  fileName: { fontSize: 15, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue' },
  date: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2, fontFamily: 'HelveticaNeue-Light' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  statusText: { fontSize: 11, fontWeight: '400', fontFamily: 'HelveticaNeue-Light' },
  tests: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  testItem: { fontSize: 13, color: '#FFFFFF', marginBottom: 4, fontFamily: 'HelveticaNeue-Light' },
  testValue: { fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue' },
  moreTests: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontFamily: 'HelveticaNeue-Light' },
});
