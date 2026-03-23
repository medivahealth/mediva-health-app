import { useState, useEffect } from 'react';
import { api } from '../api';

interface Medication {
  drugName: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  isScheduleH: boolean;
  isScheduleH1: boolean;
}

interface AIRecommendation {
  medications: Medication[];
  diagnosis: string;
  icdCode?: string;
  reasoning: string;
  confidence: number;
  warnings?: string[];
}

interface PatientInfo {
  _id: string;
  name?: string;
  phone?: string;
  email?: string;
}

interface Prescription {
  _id: string;
  patientId: PatientInfo;
  chiefComplaint: string;
  diagnosis: string;
  aiRecommendation: AIRecommendation;
  status: 'pending_doctor_review' | 'approved' | 'rejected' | 'modified';
  urgency: 'routine' | 'urgent' | 'emergency';
  waitTimeMinutes: number;
  createdAt: string;
  patientContextSnapshot?: {
    chronicConditions: string[];
    currentMedications: string[];
    allergies: string[];
  };
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    emergency: { bg: '#FFEBEE', fg: '#C62828' },
    urgent: { bg: '#FFF3E0', fg: '#E65100' },
    routine: { bg: '#E8F5E9', fg: '#2E7D32' },
  };
  const c = colors[urgency] || colors.routine;
  return (
    <span style={{
      background: c.bg,
      color: c.fg,
      padding: '4px 12px',
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
      textTransform: 'uppercase',
    }}>
      {urgency}
    </span>
  );
}

function ScheduleBadge({ isH, isH1 }: { isH: boolean; isH1: boolean }) {
  if (isH1) return <span style={{ background: '#C62828', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>H1</span>;
  if (isH) return <span style={{ background: '#E65100', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>H</span>;
  return null;
}

export default function PrescriptionQueuePage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [selected, setSelected] = useState<Prescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, emergency: 0, urgent: 0, routine: 0 });
  const [filter, setFilter] = useState<'all' | 'emergency' | 'urgent' | 'routine'>('all');
  const [modifications, setModifications] = useState<{
    medications?: Medication[];
    diagnosis?: string;
    notes?: string;
    reason?: string;
  }>({});

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [filter]);

  const loadQueue = async () => {
    try {
      const urgency = filter === 'all' ? undefined : filter;
      const response = await api.get<{ prescriptions: Prescription[]; total: number }>(
        `/prescription/queue?${urgency ? `urgency=${urgency}&` : ''}limit=50`
      );
      setPrescriptions(response.prescriptions);
      setStats({
        total: response.total,
        emergency: response.prescriptions.filter(p => p.urgency === 'emergency').length,
        urgent: response.prescriptions.filter(p => p.urgency === 'urgent').length,
        routine: response.prescriptions.filter(p => p.urgency === 'routine').length,
      });
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string, notes?: string) => {
    try {
      await api.post(`/prescription/${id}/approve`, { notes });
      loadQueue();
      setSelected(null);
    } catch (err) {
      alert('Failed to approve prescription');
    }
  };

  const handleModify = async (id: string) => {
    try {
      await api.post(`/prescription/${id}/modify`, modifications);
      loadQueue();
      setSelected(null);
      setModifications({});
    } catch (err) {
      alert('Failed to modify prescription');
    }
  };

  const handleReject = async (id: string, reason: string) => {
    try {
      await api.post(`/prescription/${id}/reject`, { reason });
      loadQueue();
      setSelected(null);
    } catch (err) {
      alert('Failed to reject prescription');
    }
  };

  const formatWaitTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 32 }}>⏳</div>
        <p style={{ color: '#888', marginTop: 12 }}>Loading prescription queue...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 100px)' }}>
      {/* Left Panel - Queue List */}
      <div style={{ width: 400, display: 'flex', flexDirection: 'column' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
          📝 Prescription Queue
          <span style={{ 
            background: '#4A90E2', 
            color: '#fff', 
            padding: '4px 12px', 
            borderRadius: 20,
            fontSize: 14,
            marginLeft: 12,
          }}>
            {stats.total} pending
          </span>
        </h1>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 8,
              border: 'none',
              background: filter === 'all' ? '#4A90E2' : '#f5f5f5',
              color: filter === 'all' ? '#fff' : '#333',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setFilter('emergency')}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 8,
              border: 'none',
              background: filter === 'emergency' ? '#C62828' : '#f5f5f5',
              color: filter === 'emergency' ? '#fff' : '#C62828',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🚨 {stats.emergency}
          </button>
          <button
            onClick={() => setFilter('urgent')}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 8,
              border: 'none',
              background: filter === 'urgent' ? '#E65100' : '#f5f5f5',
              color: filter === 'urgent' ? '#fff' : '#E65100',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ⚡ {stats.urgent}
          </button>
        </div>

        {/* Queue List */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto', 
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          {prescriptions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
              ✅ No pending prescriptions
            </div>
          ) : (
            prescriptions.map((p) => (
              <div
                key={p._id}
                onClick={() => {
                  setSelected(p);
                  setModifications({
                    medications: p.aiRecommendation?.medications,
                    diagnosis: p.aiRecommendation?.diagnosis,
                  });
                }}
                style={{
                  padding: 16,
                  borderBottom: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  background: selected?._id === p._id ? '#E3F2FD' : '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: 15 }}>
                    {p.patientId?.name || `Patient ${p.patientId?._id?.slice(-6)}`}
                  </strong>
                  <UrgencyBadge urgency={p.urgency} />
                </div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                  {p.chiefComplaint.slice(0, 60)}...
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#888' }}>
                  <span>⏱️ {formatWaitTime(p.waitTimeMinutes)}</span>
                  <span>🤖 {Math.round((p.aiRecommendation?.confidence || 0) * 100)}% confidence</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Review Details */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {selected ? (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                  {selected.patientId?.name || 'Unknown Patient'}
                </h2>
                <p style={{ color: '#888', fontSize: 14 }}>
                  📱 {selected.patientId?.phone || 'No phone'} • 
                  ⏱️ Waiting: {formatWaitTime(selected.waitTimeMinutes)}
                </p>
              </div>
              <UrgencyBadge urgency={selected.urgency} />
            </div>

            {/* Patient Context */}
            {selected.patientContextSnapshot && (
              <div style={{ 
                background: '#f8f9fa', 
                padding: 16, 
                borderRadius: 8, 
                marginBottom: 24,
                borderLeft: '4px solid #4A90E2',
              }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>📋 Patient Context</h4>
                {selected.patientContextSnapshot.chronicConditions?.length > 0 && (
                  <p style={{ fontSize: 13, marginBottom: 4 }}>
                    <strong>Conditions:</strong> {selected.patientContextSnapshot.chronicConditions.join(', ')}
                  </p>
                )}
                {selected.patientContextSnapshot.currentMedications?.length > 0 && (
                  <p style={{ fontSize: 13, marginBottom: 4 }}>
                    <strong>Current Meds:</strong> {selected.patientContextSnapshot.currentMedications.join(', ')}
                  </p>
                )}
                {selected.patientContextSnapshot.allergies?.length > 0 && (
                  <p style={{ fontSize: 13, color: '#C62828' }}>
                    <strong>⚠️ Allergies:</strong> {selected.patientContextSnapshot.allergies.join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Chief Complaint */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#666' }}>Chief Complaint</h4>
              <p style={{ fontSize: 16, padding: 12, background: '#fff3e0', borderRadius: 8 }}>
                {selected.chiefComplaint}
              </p>
            </div>

            {/* AI Recommendation */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#666' }}>
                🤖 AI Recommendation 
                <span style={{ fontWeight: 400, color: '#888' }}>
                  ({Math.round((selected.aiRecommendation?.confidence || 0) * 100)}% confidence)
                </span>
              </h4>
              
              <div style={{ background: '#E3F2FD', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <p style={{ fontSize: 14, marginBottom: 8 }}>
                  <strong>Diagnosis:</strong> {selected.aiRecommendation?.diagnosis}
                  {selected.aiRecommendation?.icdCode && (
                    <span style={{ color: '#888', marginLeft: 8 }}>({selected.aiRecommendation.icdCode})</span>
                  )}
                </p>
                <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
                  <strong>Reasoning:</strong> {selected.aiRecommendation?.reasoning}
                </p>

                {/* Medications */}
                <h5 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Recommended Medications:</h5>
                {(modifications.medications || selected.aiRecommendation?.medications || []).map((med, idx) => (
                  <div 
                    key={idx}
                    style={{ 
                      background: '#fff', 
                      padding: 12, 
                      borderRadius: 6, 
                      marginBottom: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        {med.drugName}
                        <ScheduleBadge isH={med.isScheduleH} isH1={med.isScheduleH1} />
                      </div>
                      <div style={{ fontSize: 13, color: '#666' }}>
                        {med.dosage} • {med.frequency} • {med.duration}
                      </div>
                      {med.instructions && (
                        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                          💡 {med.instructions}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {selected.aiRecommendation?.warnings && selected.aiRecommendation.warnings.length > 0 && (
                  <div style={{ marginTop: 12, padding: 12, background: '#FFEBEE', borderRadius: 6 }}>
                    <strong style={{ color: '#C62828', fontSize: 13 }}>⚠️ Warnings:</strong>
                    {selected.aiRecommendation.warnings.map((w, i) => (
                      <p key={i} style={{ fontSize: 12, color: '#C62828', marginTop: 4 }}>• {w}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Doctor Actions */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => handleApprove(selected._id, 'Approved as recommended')}
                style={{
                  padding: '12px 24px',
                  background: '#2E7D32',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                ✅ Approve as Recommended
              </button>
              <button
                onClick={() => handleModify(selected._id)}
                style={{
                  padding: '12px 24px',
                  background: '#F57C00',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                ✏️ Modify & Approve
              </button>
              <button
                onClick={() => {
                  const reason = prompt('Reason for rejection:');
                  if (reason) handleReject(selected._id, reason);
                }}
                style={{
                  padding: '12px 24px',
                  background: '#C62828',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                ❌ Reject
              </button>
              <button
                style={{
                  padding: '12px 24px',
                  background: '#f5f5f5',
                  color: '#333',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                📞 Call Patient
              </button>
            </div>

            {/* Modification Notes */}
            <div style={{ marginTop: 24 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Doctor Notes (Optional)</h4>
              <textarea
                value={modifications.notes || ''}
                onChange={(e) => setModifications({ ...modifications, notes: e.target.value })}
                placeholder="Add notes for patient or record modification reason..."
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid #ddd',
                  minHeight: 80,
                  fontSize: 14,
                  resize: 'vertical',
                }}
              />
            </div>
          </div>
        ) : (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            color: '#888',
          }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>👨‍⚕️</div>
            <p>Select a prescription from the queue to review</p>
          </div>
        )}
      </div>
    </div>
  );
}
