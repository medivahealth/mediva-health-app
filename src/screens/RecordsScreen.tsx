import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import type { MedicalDocument } from '../types';
import { SIZES } from '../theme';

interface RecordsScreenProps {
  onBack: () => void;
}

/* Group by date */
function groupByDate(docs: MedicalDocument[]): { label: string; items: MedicalDocument[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { [key: string]: MedicalDocument[] } = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    'This Month': [],
    Older: [],
  };

  docs.forEach((d) => {
    const date = new Date(d.createdAt);
    if (date >= today) groups.Today.push(d);
    else if (date >= yesterday) groups.Yesterday.push(d);
    else if (date >= weekAgo) groups['This Week'].push(d);
    else if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear())
      groups['This Month'].push(d);
    else groups.Older.push(d);
  });

  return Object.entries(groups)
    .filter(([_, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

export default function RecordsScreen({ onBack }: RecordsScreenProps) {
  const [records, setRecords] = useState<MedicalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<MedicalDocument | null>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      const data = await api.get('/records/list');
      setRecords(Array.isArray(data) ? data : data.records || []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed': return '#10b981';
      case 'processing': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return 'rgba(255,255,255,0.5)';
    }
  };

  const getFileIcon = (name: string) => {
    if (name?.endsWith('.pdf')) return 'document-outline';
    if (name?.match(/\.(jpg|jpeg|png|gif)/)) return 'image-outline';
    return 'document-text-outline';
  };

  /* ─── Record detail ─── */
  if (selectedRecord) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => setSelectedRecord(null)} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>Record Detail</Text>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView contentContainerStyle={s.detailContent} showsVerticalScrollIndicator={false}>
          <View style={s.detailHeader}>
            <View style={s.detailIconWrap}>
              <Ionicons name={getFileIcon(selectedRecord.fileName)} size={24} color="#000000" />
            </View>
            <Text style={s.detailFileName}>{selectedRecord.fileName}</Text>
            <View style={[s.statusDot, { backgroundColor: getStatusColor(selectedRecord.status) }]} />
            <Text style={s.detailStatus}>{selectedRecord.status}</Text>
          </View>

          <Text style={s.detailDate}>
            Uploaded {new Date(selectedRecord.createdAt).toLocaleDateString()} at{' '}
            {new Date(selectedRecord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>

          {selectedRecord.source && (
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Source</Text>
              <Text style={s.detailValue}>{selectedRecord.source}</Text>
            </View>
          )}

          {selectedRecord.extractedText && (
            <View style={s.detailSection}>
              <Text style={s.detailSectionTitle}>Extracted Text</Text>
              <Text style={s.detailText}>{selectedRecord.extractedText}</Text>
            </View>
          )}

          {selectedRecord.structuredData?.tests && selectedRecord.structuredData.tests.length > 0 && (
            <View style={s.detailSection}>
              <Text style={s.detailSectionTitle}>Test Results</Text>
              {selectedRecord.structuredData.tests.map((test, i) => (
                <View key={i} style={s.testRow}>
                  <Text style={s.testName}>{test.name}</Text>
                  <Text style={s.testValue}>{test.value} {test.unit || ''}</Text>
                  {test.referenceRange && (
                    <Text style={s.testRef}>Ref: {test.referenceRange}</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {selectedRecord.structuredData?.diagnosis && selectedRecord.structuredData.diagnosis.length > 0 && (
            <View style={s.detailSection}>
              <Text style={s.detailSectionTitle}>Diagnosis</Text>
              {selectedRecord.structuredData.diagnosis.map((d, i) => (
                <Text key={i} style={s.detailText}>• {d}</Text>
              ))}
            </View>
          )}

          {selectedRecord.structuredData?.medications && selectedRecord.structuredData.medications.length > 0 && (
            <View style={s.detailSection}>
              <Text style={s.detailSectionTitle}>Medications</Text>
              {selectedRecord.structuredData.medications.map((m, i) => (
                <Text key={i} style={s.detailText}>• {m}</Text>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  /* ─── Records list ─── */
  const grouped = groupByDate(records);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Records</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : records.length === 0 ? (
        <View style={s.emptyWrap}>
          <Ionicons name="folder-open-outline" size={48} color="#FFFFFF" />
          <Text style={s.emptyTitle}>No records yet</Text>
          <Text style={s.emptyDesc}>
            Upload documents in chat and they'll appear here, organized by date.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={s.list}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        >
          {grouped.map((group) => (
            <View key={group.label}>
              <Text style={s.groupLabel}>{group.label}</Text>
              {group.items.map((record) => (
                <TouchableOpacity
                  key={record._id}
                  style={s.recordItem}
                  onPress={() => setSelectedRecord(record)}
                  activeOpacity={0.7}
                >
                  <View style={s.recordIcon}>
                    <Ionicons name={getFileIcon(record.fileName)} size={18} color="#000000" />
                  </View>
                  <View style={s.recordInfo}>
                    <Text style={s.recordName} numberOfLines={1}>{record.fileName}</Text>
                    <Text style={s.recordMeta}>
                      {new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {record.source ? ` • ${record.source}` : ''}
                    </Text>
                  </View>
                  <View style={[s.statusDot, { backgroundColor: getStatusColor(record.status) }]} />
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 28,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: SIZES.xl, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue' },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: SIZES.xl, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue', marginTop: 16 },
  emptyDesc: { fontSize: SIZES.md, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 8, fontFamily: 'HelveticaNeue-Light' },

  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 40 },
  groupLabel: {
    fontSize: SIZES.sm,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'HelveticaNeue',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  recordIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recordInfo: { flex: 1 },
  recordName: { fontSize: SIZES.base, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue' },
  recordMeta: { fontSize: SIZES.xs, color: 'rgba(255,255,255,0.6)', fontFamily: 'HelveticaNeue-Light', marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  /* Detail */
  detailContent: { padding: 20, paddingBottom: 40 },
  detailHeader: { alignItems: 'center', marginBottom: 20 },
  detailIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  detailFileName: { fontSize: SIZES.lg, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue', textAlign: 'center' },
  detailStatus: { fontSize: SIZES.xs, color: 'rgba(255,255,255,0.6)', fontFamily: 'HelveticaNeue-Light', marginTop: 4 },
  detailDate: { fontSize: SIZES.sm, color: 'rgba(255,255,255,0.6)', fontFamily: 'HelveticaNeue-Light', textAlign: 'center', marginBottom: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  detailLabel: { fontSize: SIZES.md, color: 'rgba(255,255,255,0.7)', fontFamily: 'HelveticaNeue-Light' },
  detailValue: { fontSize: SIZES.md, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue' },
  detailSection: { marginTop: 20 },
  detailSectionTitle: { fontSize: SIZES.base, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue', marginBottom: 8 },
  detailText: { fontSize: SIZES.md, color: '#FFFFFF', lineHeight: 21, fontFamily: 'HelveticaNeue-Light', marginBottom: 4 },
  testRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  testName: { fontSize: SIZES.md, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue' },
  testValue: { fontSize: SIZES.md, color: 'rgba(255,255,255,0.9)', fontFamily: 'HelveticaNeue-Light', marginTop: 2 },
  testRef: { fontSize: SIZES.xs, color: 'rgba(255,255,255,0.6)', fontFamily: 'HelveticaNeue-Light', marginTop: 2 },
});
