// src/components/SuperAdminDashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from 'react-bootstrap';
import apiService from '../services/api';
import SharedAdminSidebar from './SharedAdminSidebar';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [students, setStudents] = useState([]);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const superAdmin = apiService.getUser();
  const email = superAdmin?.email || 'Super Admin';
  const name = superAdmin?.name || 'Super Admin';
  const initial = name.charAt(0).toUpperCase();

  useEffect(() => {
    fetchData();
    fetchPendingCount();
    const t = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(t);
  }, []);

  const fetchPendingCount = async () => {
    try {
      const res = await apiService.getSuperAdminDeletionRequests();
      if (res.success) {
        setPendingRequests((res.requests || []).filter((r) => r.status === 'Pending Approval').length);
      }
    } catch (e) { /* silent */ }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [examsData, resultsData, adminsData, studentsData] = await Promise.all([
        apiService.getExams(),
        apiService.getAdminResults().catch(() => ({ results: [] })),
        apiService.getAdmins().catch(() => ({ admins: [] })),
        apiService.getStudents().catch(() => ({ students: [] })),
      ]);
      setExams(examsData.exams || examsData || []);
      setResults(resultsData.results || resultsData || []);
      setAdmins(adminsData.admins || adminsData || []);
      setStudents(studentsData.students || studentsData || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { icon: '🛡️', label: 'Total Admins', value: admins.length, tone: 'purple', sub: 'Platform administrators' },
    { icon: '🎓', label: 'Total Students', value: students.length, tone: 'blue', sub: 'Registered candidates' },
    { icon: '📝', label: 'Total Exams', value: exams.length, tone: 'orange', sub: 'Created exams' },
    { icon: '📊', label: 'Submissions', value: results.length, tone: 'green', sub: 'Completed attempts' },
  ];

  const actions = [
    { icon: '🔔', label: 'Deletion Requests', sub: pendingRequests > 0 ? `${pendingRequests} pending approvals` : 'No pending requests', to: '/superadmin/deletion-requests', tone: 'orange' },
    { icon: '🛡️', label: 'Manage Admins', sub: 'Create and oversee admin accounts', to: '/superadmin/manage-admins', tone: 'purple' },
    { icon: '👥', label: 'Manage Students', sub: 'Add and manage student accounts', to: '/superadmin/students', tone: 'blue' },
    { icon: '📋', label: 'Manage Exams', sub: 'View and edit existing exams', to: '/superadmin/exams', tone: 'green' },
    { icon: '➕', label: 'Create New Exam', sub: 'Upload PDF and set answer key', to: '/superadmin/create', tone: 'purple' },
    { icon: '🚨', label: 'Detected Students', sub: 'Review proctoring violations', to: '/superadmin/detected-students', tone: 'red' },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <SharedAdminSidebar />
        <main className="dashboard-main">
          <div className="ep-loading-card">
            <div className="spinner-border text-primary" role="status" />
            <div>Loading Super Admin panel...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <SharedAdminSidebar />
      <main className="dashboard-main ep-page">
        <div className="ep-page-header">
          <div>
            <div className="ep-kicker">Platform Control</div>
            <h1>Super Admin Dashboard</h1>
            <p>Monitor the complete examination platform and manage administrators.</p>
          </div>
          <div className="ep-user-chip">
            <div className="avatar">{initial}</div>
            <div>
              <strong>{name}</strong>
              <span>{email}</span>
            </div>
          </div>
        </div>

        {error && <Alert variant="danger" className="ep-alert-box">{error}</Alert>}

        {pendingRequests > 0 && (
          <section className="ep-hero-card" style={{ background: 'linear-gradient(135deg,#fff7ed,#ffedd5)', borderColor: '#fed7aa' }}>
            <div>
              <span className="ep-badge ep-badge-warning">🔔 Action required</span>
              <h2>{pendingRequests} deletion request{pendingRequests === 1 ? '' : 's'} awaiting approval</h2>
              <p>Admins have submitted requests to delete students, exams or results. Review them before data is removed.</p>
            </div>
            <button className="ep-btn ep-btn-primary" onClick={() => navigate('/superadmin/deletion-requests')}>
              Review Now →
            </button>
          </section>
        )}

        <section className="ep-grid ep-grid-4 ep-mb">
          {stats.map((s) => (
            <div className="ep-stat-card" key={s.label}>
              <div>
                <div className="ep-stat-label">{s.label}</div>
                <div className="ep-stat-value">{s.value}</div>
                <div className="ep-stat-sub">{s.sub}</div>
              </div>
              <div className={`ep-stat-icon ${s.tone}`}>{s.icon}</div>
            </div>
          ))}
        </section>

        <section className="ep-card">
          <div className="ep-card-head">
            <div>
              <h3>Quick actions</h3>
              <p>Jump to the most important platform management areas.</p>
            </div>
          </div>
          <div className="ep-action-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {actions.map((a) => (
              <button className="ep-action-card" key={a.label} onClick={() => navigate(a.to)}>
                <span>{a.icon}</span>
                <strong>{a.label}</strong>
                <small>{a.sub}</small>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default SuperAdminDashboard;
