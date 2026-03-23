import { useState, useEffect } from 'react';
import { api } from '../api';

interface Application {
  _id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  qualification: string;
  experience: string;
  registrationNumber: string;
  bio: string;
  status: string;
  adminNotes: string;
  createdAt: string;
}

export default function AdminApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    loadApps();
  }, [filter]);

  const loadApps = async () => {
    setLoading(true);
    try {
      const url = filter
        ? `/admin/applications?status=${filter}`
        : '/admin/applications';
      const data = await api.get<Application[]>(url);
      setApps(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (app: Application) => {
    if (
      !confirm(
        `Approve ${app.name}'s application and create a doctor account for ${app.email}?`,
      )
    )
      return;
    try {
      // Update status
      await api.post(`/admin/applications/${app._id}/status`, {
        status: 'approved',
      });
      // Create doctor account
      const result = await api.post('/admin/doctors', {
        email: app.email,
        name: app.name,
        phone: app.phone,
      });
      alert(
        `Doctor account created!\nTemp password: ${result.tempPassword}\n\nCredentials also sent via email.`,
      );
      loadApps();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReject = async (id: string) => {
    const notes = prompt('Rejection reason (optional):');
    try {
      await api.post(`/admin/applications/${id}/status`, {
        status: 'rejected',
        notes: notes || '',
      });
      loadApps();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return { bg: '#FFF3E0', fg: '#E65100' };
      case 'approved':
        return { bg: '#E8F5E9', fg: '#2E7D32' };
      case 'rejected':
        return { bg: '#FFEBEE', fg: '#C62828' };
      default:
        return { bg: '#F5F5F5', fg: '#666' };
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        📋 Doctor Applications
      </h1>
      <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
        Review and approve doctors who want to join Mediva.
      </p>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['', 'pending', 'approved', 'rejected'].map((f) => (
          <button
            key={f}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #E0E0E0',
              background: filter === f ? '#4A90E2' : '#fff',
              color: filter === f ? '#fff' : '#555',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={() => setFilter(f)}
          >
            {f || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#888', padding: 40 }}>
          Loading...
        </p>
      ) : apps.length === 0 ? (
        <div
          style={{
            background: '#fff',
            borderRadius: 16,
            padding: 40,
            textAlign: 'center',
            color: '#888',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          No applications found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {apps.map((app) => {
            const sc = statusColor(app.status);
            const isExpanded = expanded === app._id;
            return (
              <div
                key={app._id}
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  padding: 20,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  cursor: 'pointer',
                }}
                onClick={() =>
                  setExpanded(isExpanded ? null : app._id)
                }
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 16 }}>{app.name}</strong>
                    <span style={{ color: '#888', marginLeft: 12, fontSize: 13 }}>
                      {app.email}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        background: sc.bg,
                        color: sc.fg,
                        padding: '2px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {app.status.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 13, color: '#aaa' }}>
                      {new Date(app.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div
                    style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 16 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={styles.detailGrid}>
                      <Detail label="Phone" value={app.phone} />
                      <Detail label="Specialization" value={app.specialization} />
                      <Detail label="Qualification" value={app.qualification} />
                      <Detail label="Experience" value={app.experience} />
                      <Detail label="Reg. Number" value={app.registrationNumber} />
                    </div>
                    {app.bio && (
                      <div style={{ marginTop: 12 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 4 }}>Bio</p>
                        <p style={{ fontSize: 14, color: '#555', lineHeight: 1.5 }}>{app.bio}</p>
                      </div>
                    )}
                    {app.adminNotes && (
                      <p style={{ fontSize: 13, color: '#888', marginTop: 12, fontStyle: 'italic' }}>
                        Admin notes: {app.adminNotes}
                      </p>
                    )}

                    {app.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                        <button
                          style={{ ...styles.btn, background: '#4CAF50' }}
                          onClick={() => handleApprove(app)}
                        >
                          ✅ Approve & Create Account
                        </button>
                        <button
                          style={{ ...styles.btn, background: '#D32F2F' }}
                          onClick={() => handleReject(app._id)}
                        >
                          ❌ Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 14, color: '#333', fontWeight: 500 }}>{value}</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 12,
  },
  btn: {
    padding: '10px 20px',
    borderRadius: 10,
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
  },
};
