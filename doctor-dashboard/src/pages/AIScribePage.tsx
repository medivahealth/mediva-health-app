import { useState } from 'react';
import { api } from '../api';

export default function AIScribePage() {
  const role = localStorage.getItem('dashboard_role') || 'doctor';
  const patientQueryEndpoint = role === 'admin' ? '/admin/patient-profile' : '/doctor/patient-profile';
  const [patientQuery, setPatientQuery] = useState('');
  const [patient, setPatient] = useState<any>(null);
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const loadPatient = async () => {
    if (!patientQuery.trim()) return;
    const data = await api.get<any>(`${patientQueryEndpoint}?q=${encodeURIComponent(patientQuery.trim())}`);
    setPatient(data || null);
  };

  const runScribe = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const pref = `You are assisting a ${role}. Use evidence-based medical reasoning and include citations when available.\n\nPatient context: ${JSON.stringify(patient || {})}`;
      const result = await api.post<any>('/chat/message', {
        message: `${pref}\n\nClinician request: ${prompt}`,
        preferredLanguage: 'en',
      });
      setAnswer(result.response || '');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 400 }}>AI Scribe</h1>
      <div style={cardStyle}>
        <h3 style={titleStyle}>Patient Lookup (Mediva ID / phone / email)</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} placeholder="Enter patient unique ID..." style={inputStyle} />
          <button style={btnStyle} onClick={loadPatient}>Load</button>
        </div>
        {patient && (
          <div style={{ marginTop: 10, color: '#d1d5db', fontSize: 13 }}>
            <div><strong>Name:</strong> {patient.name || '-'}</div>
            <div><strong>Mediva ID:</strong> {patient.medivaid || '-'}</div>
            <div><strong>Phone:</strong> {patient.phone || '-'}</div>
            <div><strong>History:</strong> {(patient.healthHistory?.chronicConditions || []).join(', ') || 'None'}</div>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={titleStyle}>Clinical Prompt</h3>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} style={{ ...inputStyle, width: '100%' }} placeholder="Ask for patient analysis, treatment options, medical citations..." />
        <button style={{ ...btnStyle, marginTop: 8 }} onClick={runScribe} disabled={loading || !prompt.trim()}>
          {loading ? 'Analyzing...' : 'Run AI Scribe'}
        </button>
      </div>

      <div style={cardStyle}>
        <h3 style={titleStyle}>AI Output</h3>
        <pre style={{ whiteSpace: 'pre-wrap', color: '#e5e7eb', fontSize: 14, margin: 0 }}>{answer || 'No output yet.'}</pre>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#050505',
  border: '1px solid #262626',
  borderRadius: 14,
  padding: 16,
};
const titleStyle: React.CSSProperties = { margin: '0 0 10px', fontWeight: 400 };
const inputStyle: React.CSSProperties = {
  border: '1px solid #262626',
  background: '#0a0a0a',
  color: '#fff',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  flex: 1,
};
const btnStyle: React.CSSProperties = {
  border: '1px solid #404040',
  borderRadius: 10,
  background: '#fff',
  color: '#000',
  padding: '10px 14px',
  fontWeight: 400,
};

