import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { CaseSession, ChatMessage, PatientInfo } from '../types';

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  const isDoctor = msg.role === 'doctor';

  const bgColor = isUser ? '#E3F2FD' : isDoctor ? '#E8F5E9' : '#F5F5F5';
  const labelColor = isUser ? '#1565C0' : isDoctor ? '#2E7D32' : '#616161';
  const label = isUser ? '🧑 Patient' : isDoctor ? '👨‍⚕️ Doctor' : '🤖 AI Assistant';

  return (
    <div style={{
      padding: 16,
      background: bgColor,
      borderRadius: 14,
      marginBottom: 10,
      maxWidth: '85%',
      alignSelf: isUser ? 'flex-end' : 'flex-start',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: labelColor }}>{label}</span>
        {msg.severity && (
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '1px 8px',
            borderRadius: 4,
            background: msg.severity === 'high' ? '#FFCDD2' : msg.severity === 'medium' ? '#FFE0B2' : '#C8E6C9',
            color: msg.severity === 'high' ? '#C62828' : msg.severity === 'medium' ? '#E65100' : '#2E7D32',
          }}>
            {msg.severity.toUpperCase()}
          </span>
        )}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.content}</div>
      {msg.citations && msg.citations.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          <span style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>📚 Sources:</span>
          {msg.citations.map((c, i) => (
            <span key={i} style={{ fontSize: 11, color: '#4A90E2', marginLeft: 6 }}>{c}</span>
          ))}
        </div>
      )}
      <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>
        {new Date(msg.timestamp).toLocaleString()}
        {msg.modelUsed ? ` • ${msg.modelUsed}` : ''}
      </div>
    </div>
  );
}

interface AiCaseSummary {
  insights: {
    hiddenDiagnoses: { condition: string; evidence: string; severity: string }[];
    careGaps: { type: string; description: string; recommendation: string; urgency: string }[];
    riskFactors: { factor: string; level: string; evidence: string }[];
  };
  demographics: any;
  healthHistory: any;
  wearableData: {
    recentVitals: {
      heartRate: number | null;
      spo2: number | null;
      weight: number | null;
      steps: number | null;
    };
  };
  dataCompleteness: number;
  chatSummary: any[];
}

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<CaseSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [doctorMessage, setDoctorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [timeline, setTimeline] = useState<AiCaseSummary | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [showPrescriptionPanel, setShowPrescriptionPanel] = useState(false);

  useEffect(() => {
    loadCase();
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages]);

  const loadCase = async () => {
    setLoading(true);
    try {
      const data = await api.get<CaseSession>(`/doctor/cases/${id}`);
      setSession(data);
      if (data.doctorNotes) setNotes(data.doctorNotes);
      if (data.status === 'reviewed' && data.finalPrescription) {
        setPrescriptions(data.finalPrescription);
      } else if (data.proposedPrescription && data.proposedPrescription.length > 0) {
        setPrescriptions(data.proposedPrescription);
      }
      const patient = typeof data.userId === 'object' ? (data.userId as PatientInfo) : null;
      if (patient?._id) {
        setTimelineLoading(true);
        try {
          const t = await api.get<AiCaseSummary>(`/doctor/cases/${data._id}/ai-summary`);
          setTimeline(t);
        } catch (e) {
          console.error('Failed to load patient timeline', e);
        } finally {
          setTimelineLoading(false);
        }
      } else {
        setTimeline(null);
      }
    } catch (err) {
      console.error('Failed to load case:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approved: boolean) => {
    if (!notes.trim()) {
      alert('Please add notes before signing off');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/doctor/cases/${id}/approve`, { notes, approved });
      alert(approved ? 'Case approved!' : 'Case reviewed with corrections');
      navigate('/');
    } catch (err: any) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignPrescription = async () => {
    if (prescriptions.length === 0) {
      alert('Add at least one medication');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/doctor/cases/${id}/prescribe`, { prescription: prescriptions });
      alert('Prescription Digitally Signed & Issued');
      await loadCase();
    } catch (err: any) {
      alert(err.message || 'Failed to issue prescription');
    } finally {
      setSubmitting(false);
    }
  };

  const updateMed = (index: number, field: string, value: string) => {
    const newMeds = [...prescriptions];
    newMeds[index] = { ...newMeds[index], [field]: value };
    setPrescriptions(newMeds);
  };

  const removeMed = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if (!doctorMessage.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/doctor/cases/${id}/message`, { message: doctorMessage });
      setDoctorMessage('');
      await loadCase();
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setSubmitting(false);
    }
  };

  const getPatient = (): PatientInfo | null => {
    if (!session) return null;
    if (typeof session.userId === 'object') return session.userId as PatientInfo;
    return null;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 32 }}>⏳</div>
        <p style={{ color: '#888', marginTop: 12 }}>Loading case...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <p style={{ color: '#D32F2F' }}>Case not found</p>
        <button onClick={() => navigate('/')} style={{ marginTop: 12, color: '#4A90E2', background: 'none', border: 'none', fontSize: 14 }}>
          ← Back to dashboard
        </button>
      </div>
    );
  }

  const patient = getPatient();
  const isReviewed = session.status === 'reviewed' || session.status === 'closed';

  return (
    <div>
      <button
        onClick={() => navigate('/')}
        style={{ color: '#4A90E2', background: 'none', border: 'none', fontSize: 14, marginBottom: 20 }}
      >
        ← Back to case queue
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* Left: Chat history */}
        <div>
          <div style={panelStyle}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>💬 Chat History</h2>
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 500, overflowY: 'auto', padding: '0 4px' }}>
              {session.messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Doctor message input */}
          {!isReviewed && (
            <div style={{ ...panelStyle, marginTop: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Send Message to Patient</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={inputStyle}
                  placeholder="Type a message to the patient..."
                  value={doctorMessage}
                  onChange={(e) => setDoctorMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button
                  style={{ ...btnPrimary, whiteSpace: 'nowrap' }}
                  onClick={handleSendMessage}
                  disabled={submitting || !doctorMessage.trim()}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Patient info + sign-off */}
        <div>
          {/* Patient info */}
          <div style={panelStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>👤 Patient Info</h3>
            {patient ? (
              <div style={{ fontSize: 14, lineHeight: 2 }}>
                <div><strong>Name:</strong> {patient.name || '—'}</div>
                <div><strong>Phone:</strong> +91 {patient.phone}</div>
                {patient.email && <div><strong>Email:</strong> {patient.email}</div>}
                {patient.abhaAddress && <div><strong>ABHA:</strong> {patient.abhaAddress}</div>}
                {patient.devices && patient.devices.length > 0 && (
                  <div>
                    <strong>Devices:</strong>{' '}
                    {patient.devices.map(d => d.type).join(', ')}
                  </div>
                )}
                {patient.consentStatus && (
                  <div style={{ marginTop: 8 }}>
                    <strong>Consent:</strong>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      Data: {patient.consentStatus.healthDataCollection ? '✅' : '❌'} |
                      AI: {patient.consentStatus.aiAnalysis ? '✅' : '❌'} |
                      Sharing: {patient.consentStatus.doctorSharing ? '✅' : '❌'}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: '#888', fontSize: 13 }}>Patient info not available</p>
            )}
          </div>

          {/* Patient timeline & insights */}
          {patient && (
            <div style={{ ...panelStyle, marginTop: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>🩺 Lotus-style Health Summary</h3>
              {timelineLoading && (
                <p style={{ fontSize: 13, color: '#888' }}>Loading unified health context…</p>
              )}
              {!timelineLoading && timeline && (
                <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                  <div style={{ marginBottom: 8 }}>
                    <strong>Data completeness:</strong> {timeline.dataCompleteness}%
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>Recent vitals:</strong>{' '}
                    HR {timeline.wearableData?.recentVitals?.heartRate ?? '—'} bpm •
                    SpO₂ {timeline.wearableData?.recentVitals?.spo2 ?? '—'}% •
                    Steps {timeline.wearableData?.recentVitals?.steps ?? '—'} •
                    Weight {timeline.wearableData?.recentVitals?.weight ?? '—'} kg
                  </div>
                  {timeline.insights.hiddenDiagnoses.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <strong>Potential hidden diagnoses:</strong>
                      <ul style={{ marginTop: 4, paddingLeft: 18 }}>
                        {timeline.insights.hiddenDiagnoses.map((d, i) => (
                          <li key={i}>
                            {d.condition} ({d.severity}) – {d.evidence}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {timeline.insights.careGaps.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <strong>Care gaps:</strong>
                      <ul style={{ marginTop: 4, paddingLeft: 18 }}>
                        {timeline.insights.careGaps.map((g, i) => (
                          <li key={i}>
                            {g.description} – <em>{g.recommendation}</em> ({g.urgency})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {!timelineLoading && !timeline && (
                <p style={{ fontSize: 13, color: '#888' }}>
                  No unified health context available yet for this patient.
                </p>
              )}
            </div>
          )}

          {/* Prescription Review Loop */}
          <div style={{ ...panelStyle, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>💊 Prescription (FDA Compliance)</h3>
              {!isReviewed && (
                <button 
                  onClick={() => setPrescriptions([...prescriptions, { medication: '', dosage: '', frequency: '', duration: '', instructions: '' }])}
                  style={{ background: '#E8F5E9', border: 'none', color: '#2E7D32', fontSize: 12, fontWeight: 600, padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }}
                >
                  + Add Medication
                </button>
              )}
            </div>

            {prescriptions.length === 0 ? (
              <p style={{ fontSize: 13, color: '#888' }}>No medications proposed.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {prescriptions.map((p, i) => (
                  <div key={i} style={{ padding: 12, border: '1px solid #eee', borderRadius: 10, position: 'relative' }}>
                    {!isReviewed && <button onClick={() => removeMed(i)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#888' }}>✕</button>}
                    <input 
                      disabled={isReviewed}
                      placeholder="Medication Name" 
                      value={p.medication} 
                      onChange={e => updateMed(i, 'medication', e.target.value)} 
                      style={{ ...inputStyle, width: '100%', marginBottom: 6, fontWeight: 600 }} 
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <input disabled={isReviewed} placeholder="Dosage" value={p.dosage} onChange={e => updateMed(i, 'dosage', e.target.value)} style={inputStyle} />
                      <input disabled={isReviewed} placeholder="Frequency" value={p.frequency} onChange={e => updateMed(i, 'frequency', e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                ))}
                {!isReviewed && (
                  <button 
                    onClick={handleSignPrescription} 
                    disabled={submitting}
                    style={{ ...btnPrimary, background: '#10b981', marginTop: 8 }}
                  >
                    🖊️ Digitally Sign & Issue
                  </button>
                )}
              </div>
            )}
            {isReviewed && session?.finalPrescription?.length && (
              <div style={{ marginTop: 12, padding: 8, background: '#f0f9ff', borderRadius: 8, fontSize: 12, color: '#0369a1' }}>
                ✅ Digitally signed by Dr. {localStorage.getItem('doctor_name') || 'Mediva'} 
              </div>
            )}
          </div>

          {/* Case status */}
          <div style={{ ...panelStyle, marginTop: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>📊 Case Status</h3>
            <div style={{ fontSize: 14, lineHeight: 2 }}>
              <div><strong>Status:</strong> {session.status.replace('_', ' ').toUpperCase()}</div>
              <div><strong>Messages:</strong> {session.messages.length}</div>
              <div><strong>Created:</strong> {new Date(session.createdAt).toLocaleDateString()}</div>
              <div><strong>Updated:</strong> {new Date(session.updatedAt).toLocaleString()}</div>
              {session.summary && <div><strong>Summary:</strong> {session.summary}</div>}
            </div>
          </div>

          {/* Sign-off panel */}
          {!isReviewed ? (
            <div style={{ ...panelStyle, marginTop: 16, border: '2px solid #E0E0E0' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>✍️ Sign Off</h3>
              <textarea
                style={textareaStyle}
                placeholder="Doctor's notes (corrections, approvals, additional guidance)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button
                  style={{ ...btnPrimary, flex: 1, background: '#2E7D32' }}
                  onClick={() => handleApprove(true)}
                  disabled={submitting}
                >
                  ✅ Approve AI Response
                </button>
                <button
                  style={{ ...btnPrimary, flex: 1, background: '#F57C00' }}
                  onClick={() => handleApprove(false)}
                  disabled={submitting}
                >
                  ✏️ Correct & Send
                </button>
              </div>
              <p style={{ fontSize: 11, color: '#aaa', marginTop: 10, lineHeight: 1.5 }}>
                Approve: confirms AI's response was accurate. Correct: sends your notes as a correction to the patient along with the AI response.
              </p>
            </div>
          ) : (
            <div style={{ ...panelStyle, marginTop: 16, background: '#E8F5E9', border: '2px solid #C8E6C9' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#2E7D32', marginBottom: 8 }}>
                {session.doctorApproved ? '✅ Approved' : '✏️ Corrected'}
              </h3>
              {session.doctorNotes && (
                <p style={{ fontSize: 14, color: '#333', lineHeight: 1.6 }}>{session.doctorNotes}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  padding: 20,
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 14,
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #E0E0E0',
  outline: 'none',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 14,
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid #E0E0E0',
  outline: 'none',
  resize: 'vertical',
  lineHeight: 1.5,
};

const btnPrimary: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 10,
  background: '#4A90E2',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  border: 'none',
};
