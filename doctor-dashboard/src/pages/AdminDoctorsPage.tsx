import { useState, useEffect, FormEvent } from 'react';
import { api } from '../api';

interface Doctor {
  _id: string;
  email: string;
  name: string;
  phone?: string;
  createdAt: string;
  pendingCases?: number;
  reviewedCases?: number;
}

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [assignCaseId, setAssignCaseId] = useState('');
  const [assignDoctorId, setAssignDoctorId] = useState('');

  useEffect(() => {
    loadDoctors();
  }, []);

  const loadDoctors = async () => {
    setLoading(true);
    try {
      const [data, monitoring] = await Promise.all([
        api.get<Doctor[]>('/admin/doctors'),
        api.get<any[]>('/admin/monitoring/doctors'),
      ]);
      const workloads = new Map(monitoring.map((m: any) => [m._id, m]));
      const merged = data.map((d) => ({
        ...d,
        pendingCases: workloads.get(d._id)?.pendingCases || 0,
        reviewedCases: workloads.get(d._id)?.reviewedCases || 0,
      }));
      setDoctors(merged);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!formEmail || !formName) return;
    setCreating(true);
    setMessage('');
    try {
      const result = await api.post('/admin/doctors', {
        email: formEmail,
        name: formName,
        phone: formPhone || undefined,
      });
      setMessage(
        `✅ Account created! Temp password: ${result.tempPassword} (also sent via email)`,
      );
      setFormEmail('');
      setFormName('');
      setFormPhone('');
      loadDoctors();
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (id: string) => {
    if (!confirm('Reset this doctor\'s password?')) return;
    try {
      const result = await api.post(`/admin/doctors/${id}/reset-password`);
      alert(`New temp password: ${result.tempPassword}\n\nAlso sent via email.`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this doctor account?'))
      return;
    try {
      await api.delete(`/admin/doctors/${id}`);
      loadDoctors();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAssignCase = async (e: FormEvent) => {
    e.preventDefault();
    if (!assignCaseId || !assignDoctorId) return;
    try {
      await api.post('/admin/assign-case', { caseId: assignCaseId.trim(), doctorId: assignDoctorId });
      setMessage('✅ Case assigned successfully');
      setAssignCaseId('');
      setAssignDoctorId('');
      loadDoctors();
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>👨‍⚕️ Doctor Management</h1>
        <button
          style={styles.primaryBtn}
          onClick={() => setShowCreate((v) => !v)}
        >
          {showCreate ? 'Cancel' : '+ Create Doctor Account'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={styles.createCard}>
          <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>
            Create Doctor Account
          </h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <input
              style={styles.formInput}
              placeholder="Doctor's Name *"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
            <input
              style={styles.formInput}
              placeholder="Email *"
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              required
            />
            <input
              style={styles.formInput}
              placeholder="Phone (optional)"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
            />
            <button
              style={{ ...styles.primaryBtn, opacity: creating ? 0.5 : 1 }}
              disabled={creating}
              type="submit"
            >
              {creating ? 'Creating...' : 'Create Account & Send Credentials'}
            </button>
          </form>
          {message && (
            <p
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                background: message.startsWith('✅') ? '#E8F5E9' : '#FFEBEE',
                color: message.startsWith('✅') ? '#2E7D32' : '#C62828',
                fontSize: 14,
              }}
            >
              {message}
            </p>
          )}
        </div>
      )}

      {/* Doctors table */}
      <div style={styles.createCard}>
        <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>Assign Case to Doctor</h3>
        <form onSubmit={handleAssignCase} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input style={styles.formInput} placeholder="Case ID" value={assignCaseId} onChange={(e) => setAssignCaseId(e.target.value)} />
          <select style={styles.formInput} value={assignDoctorId} onChange={(e) => setAssignDoctorId(e.target.value)}>
            <option value="">Select Doctor</option>
            {doctors.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} ({d.pendingCases || 0} pending)
              </option>
            ))}
          </select>
          <button type="submit" style={styles.primaryBtn}>Assign</button>
        </form>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#888', padding: 40 }}>
          Loading doctors...
        </p>
      ) : (
        <div style={styles.tableCard}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E0E0E0' }}>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Created</th>
                <th style={styles.th}>Queue</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {doctors.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: 'center',
                      padding: 40,
                      color: '#888',
                    }}
                  >
                    No doctor accounts yet. Create one above.
                  </td>
                </tr>
              ) : (
                doctors.map((d) => (
                  <tr
                    key={d._id}
                    style={{ borderBottom: '1px solid #F0F0F0' }}
                  >
                    <td style={styles.td}>
                      <strong>{d.name}</strong>
                    </td>
                    <td style={styles.td}>{d.email}</td>
                    <td style={styles.td}>{d.phone || '—'}</td>
                    <td style={{ ...styles.td, color: '#888', fontSize: 13 }}>
                      {new Date(d.createdAt).toLocaleDateString()}
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: 12, color: '#555' }}>
                        Pending: {d.pendingCases || 0} / Reviewed: {d.reviewedCases || 0}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button
                        style={styles.actionBtn}
                        onClick={() => handleResetPassword(d._id)}
                      >
                        🔑 Reset PW
                      </button>
                      <button
                        style={{ ...styles.actionBtn, color: '#D32F2F', borderColor: '#D32F2F' }}
                        onClick={() => handleDelete(d._id)}
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  primaryBtn: {
    padding: '10px 20px',
    borderRadius: 10,
    background: '#4A90E2',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
  },
  createCard: {
    background: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  formInput: {
    flex: '1 1 200px',
    padding: '12px 16px',
    borderRadius: 10,
    border: '1px solid #E0E0E0',
    fontSize: 14,
    outline: 'none',
  },
  tableCard: {
    background: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  th: {
    padding: '14px 16px',
    textAlign: 'left',
    fontSize: 13,
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  td: { padding: '14px 16px', fontSize: 14 },
  actionBtn: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid #E0E0E0',
    background: '#fff',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    marginRight: 8,
  },
};
