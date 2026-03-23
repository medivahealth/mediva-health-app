import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import api from '../services/api';

const logoImg = require('../../assets/applogo.png');

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

interface HealthSummary {
  latest: {
    heartRate: number | null;
    steps: number | null;
    sleep: any;
    spo2: number | null;
    weight: number | null;
    hrv: number | null;
  };
  averages: { heartRate7d: number | null };
  sources: string[];
}

/** Check if any data comes from a real source vs demo */
const isDemoSource = (sources: string[]) =>
  sources.length === 0 || sources.every((s) => s.startsWith('demo:'));

interface ConnectionInfo {
  key: string;
  name: string;
  icon: string;
  color: string;
  connected: boolean;
}

const SOURCE_COLORS = ['#4A90E2', '#43A047', '#8E24AA', '#FB8C00', '#00897B', '#E53935'];

function sourceDisplayName(source: string): string {
  const s = String(source).toLowerCase();
  if (s === 'healthkit' || s.includes('healthkit')) return 'Apple Health';
  if (s === 'healthconnect' || s.includes('health_connect') || s.includes('healthconnect'))
    return 'Health Connect';
  if (s.startsWith('demo:') || s === 'demo') return 'Demo sample';
  if (s === 'manual') return 'Manual entry';
  if (s === 'abdm') return 'ABDM';
  return String(source)
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function sourceIcon(source: string): string {
  const s = String(source).toLowerCase();
  if (s.includes('healthkit')) return '🍎';
  if (s.includes('healthconnect')) return '📱';
  if (s.startsWith('demo')) return '🧪';
  if (s === 'manual') return '✏️';
  if (s === 'abdm') return '🏥';
  return '●';
}

/** Active data sources from Mongo health records (HealthKit sync, manual, etc.) — Rook removed */
function connectionsFromHealthSources(sources: string[]): ConnectionInfo[] {
  const uniq = [...new Set((sources || []).filter(Boolean))];
  return uniq.map((key, i) => ({
    key,
    name: sourceDisplayName(key),
    icon: sourceIcon(key),
    color: SOURCE_COLORS[i % SOURCE_COLORS.length],
    connected: true,
  }));
}

export default function DashboardScreen({ onNavigate }: DashboardProps) {
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isDemo = summary ? isDemoSource(summary.sources) : true;

  const loadData = async () => {
    try {
      const s = await api.get<HealthSummary>('/health/summary');
      setSummary(s);
      setConnections(connectionsFromHealthSources(s.sources || []));
    } catch {
      setSummary(null);
      setConnections([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const healthCards = [
    {
      label: 'Heart Rate',
      value: summary?.latest?.heartRate,
      unit: 'bpm',
      icon: '❤️',
      color: '#E53935',
    },
    {
      label: 'Steps',
      value: summary?.latest?.steps,
      unit: '',
      icon: '👟',
      color: '#43A047',
    },
    {
      label: 'Sleep',
      value: summary?.latest?.sleep?.durationHours
        ?? (typeof summary?.latest?.sleep === 'number' ? summary.latest.sleep : null),
      unit: 'hrs',
      icon: '😴',
      color: '#5E35B1',
    },
    {
      label: 'SpO2',
      value: summary?.latest?.spo2,
      unit: '%',
      icon: '🫁',
      color: '#1E88E5',
    },
    {
      label: 'HRV',
      value: summary?.latest?.hrv,
      unit: 'ms',
      icon: '📊',
      color: '#FB8C00',
    },
    {
      label: 'Weight',
      value: summary?.latest?.weight,
      unit: 'kg',
      icon: '⚖️',
      color: '#00897B',
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
        />
      }
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Image source={logoImg} style={styles.heroLogo} resizeMode="contain" />
        <Text style={styles.heroTitle}>Welcome to Mediva</Text>
        <Text style={styles.heroSubtitle}>
          Your unified health tracking hub
        </Text>
        <View style={styles.platformBadge}>
          <Text style={styles.platformText}>
            {Platform.OS === 'ios' ? '🍎 iOS' : '🤖 Android'} • Apple Health · wearables · records
          </Text>
        </View>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {summary?.sources?.filter((x) => !String(x).startsWith('demo:')).length ?? 0}
            </Text>
            <Text style={styles.statLabel}>Data sources</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{summary?.sources?.length ?? 0}</Text>
            <Text style={styles.statLabel}>Total streams</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>50+</Text>
            <Text style={styles.statLabel}>Data Types</Text>
          </View>
        </View>
      </View>

      {/* Demo mode banner */}
      {isDemo && !loading && summary && (
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>
            ⚠️ Showing <Text style={{ fontWeight: '700' }}>DEMO DATA</Text> — not from Apple Health yet.
            {'\n'}Menu → Devices → allow Apple Health (iOS) and tap Sync.
          </Text>
        </View>
      )}

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.quickBtn, { backgroundColor: '#E8F5E9' }]}
          onPress={() => onNavigate('devices')}
        >
          <Text style={styles.quickBtnIcon}>🔗</Text>
          <Text style={[styles.quickBtnText, { color: '#2E7D32' }]}>
            Apple Health & sync
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickBtn, { backgroundColor: '#E3F2FD' }]}
          onPress={() => onNavigate('chat')}
        >
          <Text style={styles.quickBtnIcon}>🤖</Text>
          <Text style={[styles.quickBtnText, { color: '#1565C0' }]}>
            AI Chat
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickBtn, { backgroundColor: '#FFF3E0' }]}
          onPress={() => onNavigate('records')}
        >
          <Text style={styles.quickBtnIcon}>📋</Text>
          <Text style={[styles.quickBtnText, { color: '#E65100' }]}>
            Records
          </Text>
        </TouchableOpacity>
      </View>

      {/* Connected sources */}
      {connections.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Sources</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {connections.map((c) => (
              <View
                key={c.key}
                style={[styles.sourceChip, { borderColor: c.color + '50' }]}
              >
                <Text style={styles.sourceChipIcon}>{c.icon}</Text>
                <Text style={[styles.sourceChipText, { color: c.color }]}>
                  {c.name}
                </Text>
                <View style={[styles.connDot, { backgroundColor: '#4CAF50' }]} />
              </View>
            ))}
            <TouchableOpacity
              style={styles.addSourceChip}
              onPress={() => onNavigate('devices')}
            >
              <Text style={styles.addSourceText}>+ Add</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {connections.length === 0 && !loading && (
        <TouchableOpacity
          style={styles.emptyCard}
          onPress={() => onNavigate('devices')}
        >
          <Text style={styles.emptyIcon}>🔗</Text>
          <Text style={styles.emptyTitle}>No health data sources yet</Text>
          <Text style={styles.emptyText}>
            {Platform.OS === 'ios'
              ? 'Open Devices, allow Apple Health, then Sync — your iPhone and Apple Watch data flow into Mediva.'
              : 'Open Devices and sync Health Connect (Android) so vitals appear here.'}
          </Text>
          <View style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>Connect Devices →</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Health metrics grid */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Health Snapshot</Text>
        {loading ? (
          <ActivityIndicator
            size="small"
            color="#4A90E2"
            style={{ marginVertical: 20 }}
          />
        ) : (
          <View style={styles.metricsGrid}>
            {healthCards.map((card) => (
              <View key={card.label} style={styles.metricCard}>
                <Text style={styles.metricIcon}>{card.icon}</Text>
                <Text style={styles.metricLabel}>{card.label}</Text>
                <Text style={[styles.metricValue, { color: card.color }]}>
                  {card.value != null ? card.value : '--'}
                </Text>
                {card.unit ? (
                  <Text style={styles.metricUnit}>{card.unit}</Text>
                ) : null}
                {card.value != null && isDemo && (
                  <Text style={styles.demoTag}>demo</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {summary?.averages?.heartRate7d && (
        <View style={styles.insightCard}>
          <Text style={styles.insightIcon}>📈</Text>
          <View style={styles.insightContent}>
            <Text style={styles.insightTitle}>7-Day Avg Heart Rate</Text>
            <Text style={styles.insightValue}>
              {Math.round(summary.averages.heartRate7d)} bpm
            </Text>
          </View>
        </View>
      )}

      {/* Data flow diagram */}
      <View style={styles.flowCard}>
        <Text style={styles.flowTitle}>🔄 How Your Data Flows</Text>
        <View style={styles.flowDiagram}>
          <View style={styles.flowItem}>
            <Text style={styles.flowEmoji}>⌚</Text>
            <Text style={styles.flowLabel}>Wearable</Text>
          </View>
          <Text style={styles.flowArrow}>→</Text>
          <View style={styles.flowItem}>
            <Text style={styles.flowEmoji}>🔗</Text>
            <Text style={styles.flowLabel}>Health sync</Text>
          </View>
          <Text style={styles.flowArrow}>→</Text>
          <View style={styles.flowItem}>
            <Text style={styles.flowEmoji}>🏥</Text>
            <Text style={styles.flowLabel}>Mediva</Text>
          </View>
          <Text style={styles.flowArrow}>→</Text>
          <View style={styles.flowItem}>
            <Text style={styles.flowEmoji}>🤖</Text>
            <Text style={styles.flowLabel}>AI Insights</Text>
          </View>
        </View>
        <Text style={styles.flowHint}>
          iOS: Apple Health (iPhone / Watch) · Android: Health Connect — sync in Devices, then see sources above
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Mediva Health • unified monitoring</Text>
        <Text style={styles.footerText}>8 Sources • {Platform.OS === 'ios' ? 'iOS' : 'Android'}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },

  hero: {
    backgroundColor: '#4A90E2',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  heroLogo: {
    width: 60,
    height: 60,
    marginBottom: 10,
    borderRadius: 12,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  heroSubtitle: { fontSize: 15, color: '#D0E3FF', marginBottom: 10 },
  platformBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 15,
    marginBottom: 14,
  },
  platformText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },

  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    marginHorizontal: 4,
  },
  quickBtnIcon: { fontSize: 22, marginBottom: 4 },
  quickBtnText: { fontSize: 12, fontWeight: '600' },

  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
  },

  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sourceChipIcon: { fontSize: 18, marginRight: 6 },
  sourceChipText: { fontSize: 13, fontWeight: '600', marginRight: 6 },
  connDot: { width: 8, height: 8, borderRadius: 4 },
  addSourceChip: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
  },
  addSourceText: { fontSize: 13, color: '#888', fontWeight: '500' },

  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 6 },
  emptyText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyBtn: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  metricIcon: { fontSize: 26, marginBottom: 6 },
  metricLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  metricValue: { fontSize: 24, fontWeight: 'bold' },
  metricUnit: { fontSize: 11, color: '#aaa', marginTop: 2 },

  insightCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  insightIcon: { fontSize: 28, marginRight: 14 },
  insightContent: { flex: 1 },
  insightTitle: { fontSize: 14, fontWeight: '600', color: '#E65100' },
  insightValue: { fontSize: 22, fontWeight: 'bold', color: '#BF360C', marginTop: 2 },

  flowCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  flowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 14,
  },
  flowDiagram: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  flowItem: { alignItems: 'center', width: 60 },
  flowEmoji: { fontSize: 26, marginBottom: 4 },
  flowLabel: {
    fontSize: 10,
    color: '#555',
    fontWeight: '500',
    textAlign: 'center',
  },
  flowArrow: { fontSize: 18, color: '#999', marginHorizontal: 4 },
  flowHint: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
    lineHeight: 16,
  },

  demoBanner: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  demoBannerText: {
    fontSize: 12,
    color: '#E65100',
    textAlign: 'center',
    lineHeight: 18,
  },
  demoTag: {
    fontSize: 8,
    color: '#FF6F00',
    fontWeight: '700',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 3,
    overflow: 'hidden',
  },

  footer: { alignItems: 'center', paddingVertical: 30 },
  footerText: { fontSize: 12, color: '#ccc' },
});
