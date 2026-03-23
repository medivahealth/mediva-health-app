import { Routes, Route, Navigate } from 'react-router-dom';
import { getToken } from './api';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import DashboardPage from './pages/DashboardPage';
import PrescriptionQueuePage from './pages/PrescriptionQueuePage';
import CaseDetailPage from './pages/CaseDetailPage';
import AIScribePage from './pages/AIScribePage';
import AdminDoctorsPage from './pages/AdminDoctorsPage';
import AdminApplicationsPage from './pages/AdminApplicationsPage';
import AdminArticlesPage from './pages/AdminArticlesPage';
import AdminFeedbackPage from './pages/AdminFeedbackPage';
import JoinAsDoctorPage from './pages/JoinAsDoctorPage';

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: 'doctor' | 'admin' }) {
  const currentRole = localStorage.getItem('dashboard_role') || 'doctor';
  if (!getToken()) return <Navigate to="/login" replace />;
  if (role && role !== currentRole) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/hfufibfuvive/ffie@" element={<AdminLoginPage />} />
      <Route path="/join" element={<JoinAsDoctorPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="prescriptions" element={<PrescriptionQueuePage />} />
        <Route path="ai-scribe" element={<AIScribePage />} />
        <Route path="cases/:id" element={<CaseDetailPage />} />
        <Route path="admin/doctors" element={<ProtectedRoute role="admin"><AdminDoctorsPage /></ProtectedRoute>} />
        <Route path="admin/applications" element={<ProtectedRoute role="admin"><AdminApplicationsPage /></ProtectedRoute>} />
        <Route path="admin/articles" element={<ProtectedRoute role="admin"><AdminArticlesPage /></ProtectedRoute>} />
        <Route path="admin/feedback" element={<ProtectedRoute role="admin"><AdminFeedbackPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
