import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setToken } from '../api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api.post('/auth/doctor/login', { email, password });
      setToken(result.accessToken);
      localStorage.setItem('dashboard_role', 'doctor');
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <img src="/logo_doctor.png" alt="Mediva" style={{ width: 80, height: 80, objectFit: 'contain', marginBottom: 8 }} />
          <h1 style={styles.title}>Mediva</h1>
          <p style={styles.subtitle}>Doctor Dashboard</p>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleLogin}>
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            type="email"
            placeholder="doctor@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label style={styles.label}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...styles.input, paddingRight: 48 }}
              type={showPw ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" style={styles.eyeBtn} onClick={() => setShowPw((v) => !v)}>
              {showPw ? '🙈' : '👁️'}
            </button>
          </div>

          <button style={{ ...styles.button, opacity: loading || !email || !password ? 0.5 : 1 }} disabled={loading || !email || !password} type="submit">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 8 }}>Are you a doctor?</p>
          <Link to="/join" style={styles.joinLink}>
            Join as a Mediva Doctor →
          </Link>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#000',
    padding: 24,
    fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
  },
  card: {
    background: '#050505',
    borderRadius: 20,
    padding: 40,
    width: '100%',
    maxWidth: 420,
    border: '1px solid #262626',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  header: { textAlign: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 400, color: '#fff', margin: '8px 0 4px' },
  subtitle: { fontSize: 15, color: '#9ca3af', margin: 0, fontWeight: 300 },
  error: {
    background: '#1a0b0b',
    color: '#ef4444',
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 14,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: 300,
    color: '#e5e7eb',
    marginBottom: 6,
    display: 'block',
    marginTop: 12,
  },
  input: {
    width: '100%',
    fontSize: 16,
    color: '#fff',
    background: '#0a0a0a',
    padding: '12px 16px',
    borderRadius: 10,
    border: '1px solid #262626',
    outline: 'none',
    marginBottom: 4,
    boxSizing: 'border-box' as any,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 10,
    background: 'none',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
  },
  button: {
    width: '100%',
    padding: '14px',
    borderRadius: 12,
    background: '#fff',
    color: '#000',
    fontSize: 16,
    fontWeight: 400,
    border: 'none',
    cursor: 'pointer',
    marginTop: 20,
  },
  joinLink: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 300,
    textDecoration: 'none',
  },
};
