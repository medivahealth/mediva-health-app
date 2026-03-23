import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { CaseSession, DashboardStats, CasesResponse, PatientInfo } from '../types';

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ ...cardStyle, borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 32, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 14, color: '#888', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity?: string }) {
  if (!severity) return null;
  const colors: Record<string, { bg: string; fg: string }> = {
    high: { bg: '#FFEBEE', fg: '#C62828' },
    medium: { bg: '#FFF3E0', fg: '#E65100' },
    low: { bg: '#E8F5E9', fg: '#2E7D32' },
  };
  const c = colors[severity] || colors.low;
  return (
    <span style={{
      background: c.bg,
      color: c.fg,
      padding: '2px 10px',
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
    }}>
      {severity.toUpperCase()}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    pending_review: { bg: '#FFF3E0', fg: '#E65100' },
    open: { bg: '#E3F2FD', fg: '#1565C0' },
    reviewed: { bg: '#E8F5E9', fg: '#2E7D32' },
    closed: { bg: '#F5F5F5', fg: '#616161' },
  };
  const c = colors[status] || colors.open;
  return (
    <span style={{
      background: c.bg,
      color: c.fg,
      padding: '2px 10px',
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
    }}>
      {status.replace('_', ' ').toUpperCase()}
    </span>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ pending: 0, reviewed: 0, total: 0 });
  const [cases, setCases] = useState<CaseSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPatientProfile, setSelectedPatientProfile] = useState<any | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadData();
  }, [page]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, casesData] = await Promise.all([
        api.get<DashboardStats>('/doctor/stats'),
        api.get<CasesResponse>(`/doctor/cases?page=${page}&limit=15`),
      ]);
      setStats(statsData);
      setCases(casesData.cases);
      setTotalPages(casesData.pages);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await api.get<any[]>(`/doctor/search-patient?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(results);
    } catch (err) {
      console.error('Failed to search patients', err);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedPatientProfile(null);
  };

  const loadPatientProfile = async (q: string) => {
    const role = localStorage.getItem('dashboard_role') || 'doctor';
    const endpoint = role === 'admin' ? '/admin/patient-profile' : '/doctor/patient-profile';
    const profile = await api.get<any>(`${endpoint}?q=${encodeURIComponent(q)}`);
    setSelectedPatientProfile(profile);
  };

  const getPatientName = (session: CaseSession): string => {
    if (typeof session.userId === 'object' && session.userId !== null) {
      const p = session.userId as PatientInfo;
      return p.name || `+91 ${p.phone}`;
    }
    return 'Unknown Patient';
  };

  const getLastUserMessage = (session: CaseSession): string => {
    const userMsgs = session.messages.filter(m => m.role === 'user');
    return userMsgs[userMsgs.length - 1]?.content?.slice(0, 100) || 'No message';
  };

  const getHighestSeverity = (session: CaseSession): string | undefined => {
    const severities = session.messages.filter(m => m.severity).map(m => m.severity!);
    if (severities.includes('high')) return 'high';
    if (severities.includes('medium')) return 'medium';
    if (severities.includes('low')) return 'low';
    return undefined;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 32 }}>⏳</div>
        <p style={{ color: '#888', marginTop: 12 }}>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>📋 Dashboard</h1>
        
        {/* Patient Search */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, position: 'relative' }}>
          <input
            type="text"
            placeholder="Search MedivaID or Phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #ddd', width: 250, outline: 'none' }}
          />
          <button type="submit" disabled={isSearching} style={{ padding: '8px 16px', borderRadius: 8, background: '#4A90E2', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {isSearching ? '...' : 'Search'}
          </button>
          {searchResults.length > 0 && (
            <button type="button" onClick={clearSearch} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
              ✕
            </button>
          )}
        </form>
      </div>

      {searchResults.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, marginBottom: 32, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>🔍 Search Results</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {searchResults.map(p => (
              <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, border: '1px solid #eee', borderRadius: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{p.name || 'Unknown'}</div>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                    {p.medivaid && <span style={{ background: '#E8F5E9', color: '#2E7D32', padding: '2px 6px', borderRadius: 4, marginRight: 8, fontWeight: 600 }}>{p.medivaid}</span>}
                    📞 +91 {p.phone} {p.email ? ` | ✉️ ${p.email}` : ''}
                  </div>
                </div>
                <span style={{ fontSize: 13, color: '#888' }}>Patient Found</span>
                <button
                  onClick={() => loadPatientProfile(p.medivaid || p.phone || p.email)}
                  style={{ marginLeft: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}
                >
                  View Full Profile
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedPatientProfile && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>🧾 Patient Full Profile</h2>
          <div style={{ fontSize: 14, lineHeight: 1.8 }}>
            <div><strong>Name:</strong> {selectedPatientProfile.name || '-'}</div>
            <div><strong>Mediva ID:</strong> {selectedPatientProfile.medivaid || '-'}</div>
            <div><strong>Phone:</strong> {selectedPatientProfile.phone || '-'}</div>
            <div><strong>Email:</strong> {selectedPatientProfile.email || '-'}</div>
            <div><strong>ABHA:</strong> {selectedPatientProfile.abhaAddress || '-'}</div>
            <div><strong>Chronic Conditions:</strong> {(selectedPatientProfile.healthHistory?.chronicConditions || []).join(', ') || 'None'}</div>
            <div><strong>Current Medications:</strong> {(selectedPatientProfile.healthHistory?.currentMedications || []).join(', ') || 'None'}</div>
            <div><strong>Allergies:</strong> {(selectedPatientProfile.healthHistory?.allergies || []).join(', ') || 'None'}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Pending Review" value={stats.pending} color="#F57C00" />
        <StatCard label="Reviewed" value={stats.reviewed} color="#2E7D32" />
        <StatCard label="Total Flagged" value={stats.total} color="#4A90E2" />
      </div>

      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #E0E0E0' }}>
              <th style={thStyle}>Patient</th>
              <th style={thStyle}>Last Query</th>
              <th style={thStyle}>Severity</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Updated</th>
              <th style={thStyle}>Action</th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#888' }}>
                  ✅ No pending cases. All caught up!
                </td>
              </tr>
            ) : (
              cases.map((c) => (
                <tr key={c._id} style={{ borderBottom: '1px solid #F0F0F0' }}>
                  <td style={tdStyle}>
                    <strong>{getPatientName(c)}</strong>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getLastUserMessage(c)}
                  </td>
                  <td style={tdStyle}>
                    <SeverityBadge severity={getHighestSeverity(c)} />
                  </td>
                  <td style={tdStyle}>
                    <StatusBadge status={c.status} />
                  </td>
                  <td style={{ ...tdStyle, fontSize: 13, color: '#888' }}>
                    {new Date(c.updatedAt).toLocaleDateString()} {new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={tdStyle}>
                    <Link
                      to={`/cases/${c._id}`}
                      style={{
                        display: 'inline-block',
                        padding: '6px 16px',
                        background: '#4A90E2',
                        color: '#fff',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ ...paginationBtn, opacity: page === 1 ? 0.4 : 1 }}
          >
            ← Previous
          </button>
          <span style={{ padding: '8px 16px', fontSize: 14, color: '#888' }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{ ...paginationBtn, opacity: page === totalPages ? 0.4 : 1 }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  padding: 24,
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
};

const thStyle: React.CSSProperties = {
  padding: '14px 16px',
  textAlign: 'left',
  fontSize: 13,
  fontWeight: 600,
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const tdStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: 14,
};

const paginationBtn: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: 8,
  background: '#fff',
  border: '1px solid #E0E0E0',
  fontSize: 14,
  fontWeight: 500,
};
