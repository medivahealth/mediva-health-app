import { Outlet, Link, useNavigate } from 'react-router-dom';
import { clearToken } from '../api';

export default function Layout() {
  const navigate = useNavigate();
  const role = localStorage.getItem('dashboard_role') || 'doctor';

  const handleLogout = () => {
    clearToken();
    localStorage.removeItem('dashboard_role');
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#000', color: '#fff' }}>
      <aside style={styles.sidebar}>
        <Link to="/" style={styles.logo}>
          <img src="/logo_doctor.png" alt="Mediva" style={{ width: 34, height: 34, objectFit: 'contain', borderRadius: 6 }} />
          <div>
            <div style={styles.logoText}>Mediva</div>
            <div style={styles.roleText}>{role === 'admin' ? 'Admin Panel' : 'Doctor Panel'}</div>
          </div>
        </Link>
        <nav style={styles.nav}>
          <Link to="/" style={styles.navLink}>Dashboard</Link>
          <Link to="/prescriptions" style={styles.navLink}>Prescriptions</Link>
          <Link to="/ai-scribe" style={styles.navLink}>AI Scribe</Link>
          {role === 'admin' && (
            <>
              <Link to="/admin/doctors" style={styles.navLink}>Doctors</Link>
              <Link to="/admin/applications" style={styles.navLink}>Applications</Link>
              <Link to="/admin/articles" style={styles.navLink}>Articles</Link>
              <Link to="/admin/feedback" style={styles.navLink}>Feedback</Link>
            </>
          )}
          <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
        </nav>
      </aside>
      <main style={styles.main}>
        <div style={styles.mainInner}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 240,
    borderRight: '1px solid #262626',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 22,
    background: '#050505',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textDecoration: 'none',
  },
  logoText: {
    fontSize: 18,
    fontWeight: 400,
    color: '#fff',
  },
  roleText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: 300,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    width: '100%',
  },
  navLink: {
    fontSize: 14,
    color: '#fff',
    textDecoration: 'none',
    fontWeight: 300,
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #262626',
    background: '#0a0a0a',
  },
  logoutBtn: {
    fontSize: 14,
    color: '#fff',
    background: '#111',
    border: '1px solid #404040',
    padding: '10px 12px',
    borderRadius: 8,
    fontWeight: 300,
    cursor: 'pointer',
    textAlign: 'left',
    marginTop: 10,
  },
  main: {
    flex: 1,
    padding: 24,
    background: '#000',
  },
  mainInner: {
    maxWidth: 1300,
    margin: '0 auto',
    width: '100%',
    flex: 1,
  },
};
