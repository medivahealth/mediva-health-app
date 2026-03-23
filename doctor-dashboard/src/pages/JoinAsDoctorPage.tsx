import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function JoinAsDoctorPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [qualification, setQualification] = useState('');
  const [experience, setExperience] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone) {
      setError('Please fill in all required fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/admin/doctor-application', {
        name,
        email,
        phone,
        specialization,
        qualification,
        experience,
        bio,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center' }}>
            <img
              src="/logo_doctor.png"
              alt="Mediva"
              style={{ width: 80, height: 80, objectFit: 'contain', marginBottom: 12 }}
            />
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h2 style={{ fontSize: 24, color: '#fff', marginBottom: 8, fontWeight: 400 }}>
              Application Submitted!
            </h2>
            <p style={{ color: '#d1d5db', lineHeight: 1.6, marginBottom: 24, fontWeight: 300 }}>
              Thank you for your interest in joining Mediva, Dr. {name}!
              <br />
              <br />
              Our team will review your application and create your doctor
              account. You'll receive your login credentials via email at{' '}
              <strong>{email}</strong>.
            </p>
            <Link to="/login" style={styles.linkBtn}>
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={{ ...styles.card, maxWidth: 560 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src="/logo_doctor.png"
            alt="Mediva"
            style={{ width: 72, height: 72, objectFit: 'contain', marginBottom: 8 }}
          />
          <h1 style={{ fontSize: 26, fontWeight: 400, color: '#fff', margin: '0 0 4px' }}>
            Join as a Mediva Doctor
          </h1>
          <p style={{ fontSize: 14, color: '#9ca3af', fontWeight: 300 }}>
            Fill in your details to apply. We'll review your application and
            send you login credentials.
          </p>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>Full Name *</label>
              <input
                style={styles.input}
                placeholder="Dr. John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={styles.label}>Email *</label>
              <input
                style={styles.input}
                type="email"
                placeholder="doctor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={styles.label}>Phone *</label>
              <input
                style={styles.input}
                placeholder="+91 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={styles.label}>Specialization</label>
              <input
                style={styles.input}
                placeholder="e.g. General Medicine, Cardiology"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
              />
            </div>
            <div>
              <label style={styles.label}>Qualification</label>
              <input
                style={styles.input}
                placeholder="e.g. MBBS, MD"
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
              />
            </div>
            <div>
              <label style={styles.label}>Experience</label>
              <input
                style={styles.input}
                placeholder="e.g. 5 years"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={styles.label}>Brief Bio</label>
              <textarea
                style={{ ...styles.input, minHeight: 80, resize: 'vertical' }}
                placeholder="Tell us about your practice, areas of interest, etc."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
          </div>

          <button
            style={{
              ...styles.submitBtn,
              opacity: loading || !name || !email || !phone ? 0.5 : 1,
            }}
            disabled={loading || !name || !email || !phone}
            type="submit"
          >
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/login" style={{ color: '#fff', fontSize: 14, textDecoration: 'none', fontWeight: 300 }}>
            ← Back to Login
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
  error: {
    background: '#1a0b0b',
    color: '#ef4444',
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 14,
    marginBottom: 16,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: 300,
    color: '#e5e7eb',
    marginBottom: 6,
    display: 'block',
  },
  input: {
    width: '100%',
    fontSize: 14,
    color: '#fff',
    background: '#0a0a0a',
    padding: '12px 16px',
    borderRadius: 10,
    border: '1px solid #262626',
    outline: 'none',
    boxSizing: 'border-box' as any,
  },
  submitBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: 12,
    background: '#fff',
    color: '#000',
    fontSize: 16,
    fontWeight: 400,
    border: 'none',
    cursor: 'pointer',
    marginTop: 24,
  },
  linkBtn: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 300,
    textDecoration: 'none',
  },
};
