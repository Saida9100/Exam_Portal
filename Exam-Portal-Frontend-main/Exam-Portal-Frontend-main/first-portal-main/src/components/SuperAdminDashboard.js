// src/components/SuperAdminDashboard.js
// ✅ ENHANCED: prominent Deletion Requests card + quick badge

import React, { useState, useEffect } from 'react'; 
import { useNavigate } from 'react-router-dom';
import { Row, Col, Alert } from 'react-bootstrap';
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
  const initial = superAdmin?.name ? superAdmin.name.charAt(0).toUpperCase() : 'S';

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
        const pending = (res.requests || []).filter((r) => r.status === 'Pending Approval').length;
        setPendingRequests(pending);
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

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        Loading Super Admin panel...
      </div>
    );
  }

  const cardStyle = (hoverBg = '#faf8ff') => ({
    background: '#fff', borderRadius: 14, padding: 24,
    border: '1px solid #ece9f4', cursor: 'pointer',
    boxShadow: '0 2px 10px rgba(91,10,123,0.04)',
    transition: 'all 0.2s', height: '100%',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <SharedAdminSidebar onLogout={() => apiService.logout()} admin={superAdmin} />

      <div style={{ marginLeft: 260, padding: '24px 28px' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 24,
        }}>
          <div>
            <h1 style={{ margin: 0, color: '#2c2c54', fontSize: 26, fontWeight: 800 }}>
              🛡️ Super Admin Dashboard
            </h1>
            <div style={{ color: '#7a7a93', fontSize: 13, marginTop: 4 }}>
              Platform Overview & Management
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#555' }}>{email}</span>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg, #5B0A7B, #7B1FA2)',
              color: '#fff', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 700,
            }}>{initial}</div>
          </div>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        {/* ✅ NEW: Prominent Deletion Requests banner */}
        {pendingRequests > 0 && (
          <div
            onClick={() => navigate('/superadmin/deletion-requests')}
            style={{
              background: 'linear-gradient(135deg, #fff3e0, #ffe0b2)',
              border: '1.5px solid #ff9800',
              borderRadius: 14, padding: '18px 24px',
              marginBottom: 22, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: '0 4px 16px rgba(255,152,0,0.15)',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: '#fff', color: '#e65100',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, fontWeight: 800,
                boxShadow: '0 2px 8px rgba(230,81,0,0.25)',
              }}>🔔</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#e65100' }}>
                  {pendingRequests} Deletion {pendingRequests === 1 ? 'Request' : 'Requests'} Awaiting Your Approval
                </div>
                <div style={{ fontSize: 13, color: '#bf360c', marginTop: 2 }}>
                  Admins have submitted requests to delete students / exams / results. Click here to review →
                </div>
              </div>
            </div>
            <div style={{
              background: '#e65100', color: '#fff',
              padding: '10px 20px', borderRadius: 10,
              fontWeight: 700, fontSize: 14,
            }}>
              Review Now →
            </div>
          </div>
        )}

        {/* Stats */}
        <Row style={{ marginBottom: 22 }}>
          {[
            { icon: '🛡️', label: 'Total Admins', value: admins.length, color: '#7B1FA2' },
            { icon: '🎓', label: 'Total Students', value: students.length, color: '#1565c0' },
            { icon: '📝', label: 'Total Exams', value: exams.length, color: '#e65100' },
            { icon: '📊', label: 'Total Submissions', value: results.length, color: '#2e7d32' },
          ].map((s, i) => (
            <Col md={3} key={i} style={{ marginBottom: 14 }}>
              <div style={cardStyle()}>
                <div style={{ fontSize: 26 }}>{s.icon}</div>
                <div style={{ fontSize: 12, color: '#888', fontWeight: 700, marginTop: 8, letterSpacing: 0.5 }}>
                  {s.label.toUpperCase()}
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: s.color, marginTop: 2 }}>
                  {s.value}
                </div>
              </div>
            </Col>
          ))}
        </Row>

        {/* Quick actions */}
        <h3 style={{ color: '#2c2c54', fontSize: 17, fontWeight: 700, marginBottom: 14 }}>
          Quick Actions
        </h3>
        <Row>
          {[
            { icon: '🔔', label: 'Deletion Requests', sub: pendingRequests > 0 ? `${pendingRequests} pending` : 'No pending', to: '/superadmin/deletion-requests', color: '#e65100' },
            { icon: '🛡️', label: 'Manage Admins', sub: 'Create and oversee admin accounts', to: '/superadmin/manage-admins', color: '#7B1FA2' },
            { icon: '👥', label: 'Manage Students', sub: 'Add and manage student accounts', to: '/superadmin/students', color: '#1565c0' },
            { icon: '📋', label: 'Manage Exams', sub: 'View and edit existing exams', to: '/superadmin/exams', color: '#2e7d32' },
            { icon: '➕', label: 'Create New Exam', sub: 'Upload PDF and set answer key', to: '/superadmin/create', color: '#5B0A7B' },
            { icon: '🚨', label: 'Detected Students', sub: 'Review proctoring violations', to: '/superadmin/detected-students', color: '#c62828' },
          ].map((a, i) => (
            <Col md={4} key={i} style={{ marginBottom: 14 }}>
              <div
                onClick={() => navigate(a.to)}
                style={cardStyle()}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#faf8ff'; e.currentTarget.style.borderColor = a.color; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#ece9f4'; }}
              >
                <div style={{ fontSize: 30 }}>{a.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#2c2c54', marginTop: 6 }}>
                  {a.label}
                </div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{a.sub}</div>
              </div>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
