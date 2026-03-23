import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api.post('/auth/admin/login', { email, password });
      setToken(result.accessToken);
      localStorage.setItem('dashboard_role', 'admin');
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Invalid admin credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif' }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 420, background: '#050505', border: '1px solid #262626', borderRadius: 16, padding: 28 }}>
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <img src="/logo_doctor.png" alt="Mediva" style={{ width: 72, height: 72, objectFit: 'contain', marginBottom: 6 }} />
        </div>
        <h1 style={{ color: '#fff', fontWeight: 400, marginBottom: 4 }}>Admin Access</h1>
        <p style={{ color: '#9ca3af', marginBottom: 18, fontWeight: 300 }}>Restricted route login</p>
        {error && <div style={{ color: '#ef4444', background: '#1a0b0b', borderRadius: 8, padding: 10, marginBottom: 12 }}>{error}</div>}
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Admin email" style={inputStyle} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Admin password" style={inputStyle} />
        <button disabled={loading || !email || !password} style={{ width: '100%', marginTop: 12, borderRadius: 10, border: 'none', padding: '12px 14px', background: '#fff', color: '#000', fontWeight: 400 }}>
          {loading ? 'Logging in...' : 'Login as Admin'}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  marginBottom: 10,
  borderRadius: 10,
  border: '1px solid #262626',
  background: '#0a0a0a',
  color: '#fff',
  padding: '12px 14px',
  fontSize: 15,
};

