import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Alert, Modal, Button, Badge } from 'react-bootstrap';
import apiService from '../services/api';
import SharedAdminSidebar from './SharedAdminSidebar';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  
  const superAdmin = apiService.getUser();
  const email = superAdmin?.email || 'Super Admin';
  const initial = superAdmin?.name ? superAdmin.name.charAt(0).toUpperCase() : 'S';

  useEffect(() => {
    fetchData();
    fetchDeletionRequests();
  }, []);

  const fetchDeletionRequests = async () => {
    try {
      const res = await apiService.getSuperAdminDeletionRequests();
      if (res.success) {
        setDeletionRequests((res.requests || []).filter(r => r.status === 'Pending Approval'));
      }
    } catch (e) { console.error(e); }
  };

  const handleApproveReject = async (id, action) => {
    try {
      await apiService.processDeletionRequest(id, action);
      fetchDeletionRequests();
      fetchData(); // Refresh dashboard counts
    } catch (e) {
      console.error(e);
      alert('Action failed');
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [examsData, resultsData, adminsData, studentsData] = await Promise.all([
        apiService.getExams(),
        apiService.getAdminResults().catch(() => ({ results: [] })),
        apiService.getAdmins().catch(() => ({ admins: [] })),
        apiService.getStudents().catch(() => ({ students: [] }))
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
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f9fa' }}>
        <SharedAdminSidebar active="dashboard" />
        <div className="dashboard-main" style={{ flex: 1, padding: '30px' }}>
          <div className="loading">Loading Super Admin panel...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f9fa' }}>
      <SharedAdminSidebar active="dashboard" />
      
      <div className="dashboard-main" style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
          <div>
            <h2 style={{ margin: 0, fontWeight: 700, color: '#1A237E' }}>Super Admin Dashboard</h2>
            <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: 14 }}>
              Platform Overview & Management
            </p>
          </div>
          <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative', cursor: 'pointer', marginRight: 15 }} onClick={() => setShowRequestsModal(true)}>
              <span style={{ fontSize: 24 }}>🔔</span>
              {deletionRequests.length > 0 && (
                <span style={{ position: 'absolute', top: -5, right: -5, background: '#d32f2f', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: 10, fontWeight: 'bold' }}>
                  {deletionRequests.length}
                </span>
              )}
            </div>
            <div style={{ fontSize: 14, color: '#5B0A7B', fontWeight: 600 }}>{email}</div>
            <div className="user-avatar" style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #5B0A7B, #2D0040)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 15 }}>
              {initial}
            </div>
          </div>
        </div>

        {error && <Alert variant="danger" style={{ borderRadius: 10 }}>{error}</Alert>}

        <Row className="g-4 mb-4">
          <Col md={6} lg={3}>
            <div className="stat-card" style={{ borderTop: '4px solid #1A237E' }}>
              <div className="stat-icon" style={{ background: '#E8EAF6' }}>🛡️</div>
              <h5>Total Admins</h5>
              <h2>{admins.length}</h2>
            </div>
          </Col>
          <Col md={6} lg={3}>
            <div className="stat-card" style={{ borderTop: '4px solid #9C27B0' }}>
              <div className="stat-icon" style={{ background: '#F3E5F5' }}>🎓</div>
              <h5>Total Students</h5>
              <h2>{students.length}</h2>
            </div>
          </Col>
          <Col md={6} lg={3}>
            <div className="stat-card" style={{ borderTop: '4px solid #4CAF50' }}>
              <div className="stat-icon" style={{ background: '#E8F5E9' }}>📝</div>
              <h5>Total Exams</h5>
              <h2>{exams.length}</h2>
            </div>
          </Col>
          <Col md={6} lg={3}>
            <div className="stat-card" style={{ borderTop: '4px solid #FF9800' }}>
              <div className="stat-icon" style={{ background: '#FFF3E0' }}>📊</div>
              <h5>Total Submissions</h5>
              <h2>{results.length}</h2>
            </div>
          </Col>
        </Row>

        <Row className="g-4">
          <Col md={6}>
            <div className="stat-card" style={{ cursor: 'pointer', border: '1px solid #FFD54F' }} onClick={() => navigate('/superadmin/manage-admins')}>
              <div className="d-flex align-items-center gap-3">
                <div className="stat-icon" style={{ background: '#FFF8E1', marginBottom: 0 }}>🛡️</div>
                <div>
                  <h5 style={{ margin: 0, color: '#1A237E', fontWeight: 700 }}>Manage Admins</h5>
                  <p style={{ margin: 0, color: '#888', fontSize: 13 }}>Create and oversee admin/faculty accounts</p>
                </div>
              </div>
            </div>
          </Col>
          <Col md={6}>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/superadmin/students')}>
              <div className="d-flex align-items-center gap-3">
                <div className="stat-icon" style={{ background: '#E8F5E9', marginBottom: 0 }}>👥</div>
                <div>
                  <h5 style={{ margin: 0, color: '#2D0040', fontWeight: 700 }}>Manage Students</h5>
                  <p style={{ margin: 0, color: '#888', fontSize: 13 }}>Add and manage student accounts</p>
                </div>
              </div>
            </div>
          </Col>
          <Col md={6}>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/superadmin/exams')}>
              <div className="d-flex align-items-center gap-3">
                <div className="stat-icon" style={{ background: '#E3F2FD', marginBottom: 0 }}>📋</div>
                <div>
                  <h5 style={{ margin: 0, color: '#2D0040', fontWeight: 700 }}>Manage Exams</h5>
                  <p style={{ margin: 0, color: '#888', fontSize: 13 }}>View and edit existing exams</p>
                </div>
              </div>
            </div>
          </Col>
          <Col md={6}>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/superadmin/create')}>
              <div className="d-flex align-items-center gap-3">
                <div className="stat-icon" style={{ background: '#F3E5F5', marginBottom: 0 }}>➕</div>
                <div>
                  <h5 style={{ margin: 0, color: '#2D0040', fontWeight: 700 }}>Create New Exam</h5>
                  <p style={{ margin: 0, color: '#888', fontSize: 13 }}>Upload PDF and set answer key</p>
                </div>
              </div>
            </div>
          </Col>
          <Col md={6}>
            <div className="stat-card" style={{ cursor: 'pointer', border: '1px solid #ffcdd2' }} onClick={() => navigate('/superadmin/detected-students')}>
              <div className="d-flex align-items-center gap-3">
                <div className="stat-icon" style={{ background: '#fff5f5', color: '#c62828', marginBottom: 0 }}>🚨</div>
                <div>
                  <h5 style={{ margin: 0, color: '#c62828', fontWeight: 700 }}>Detected Students</h5>
                  <p style={{ margin: 0, color: '#d32f2f', fontSize: 13 }}>Review proctoring violations</p>
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      <Modal show={showRequestsModal} onHide={() => setShowRequestsModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontWeight: 700, fontSize: 18 }}>Pending Deletion Requests</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deletionRequests.length === 0 ? (
            <p className="text-muted text-center py-4">No pending requests.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {deletionRequests.map(req => (
                <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #eee', borderRadius: 8, padding: 16 }}>
                  <div>
                    <h6 style={{ margin: 0, fontWeight: 700 }}>
                      <Badge
                        bg={req.has_violations ? 'danger' : (req.type === 'student' ? 'primary' : 'warning')}
                        className="me-2"
                        style={{ marginRight: 8 }}
                      >
                        {req.type === 'student' 
                          ? (req.has_violations ? 'STUDENT & VIOLATIONS' : 'STUDENT') 
                          : (req.has_violations ? 'RESULT & VIOLATIONS' : 'RESULT')}
                      </Badge>
                      {req.student_name} {req.student_email ? `(${req.student_email})` : ''}
                    </h6>
                    {req.reason && (
                      <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#999', fontStyle: 'italic' }}>
                        Reason: {req.reason}
                      </p>
                    )}
                    <p style={{ margin: 0, fontSize: 13, color: '#666', marginTop: 4 }}>
                      Requested by: {req.admin_name} | {new Date(req.created_at).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="outline-danger" size="sm" onClick={() => handleApproveReject(req.id, 'reject')}>Reject</Button>
                    <Button variant="success" size="sm" onClick={() => handleApproveReject(req.id, 'approve')}>Approve</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default SuperAdminDashboard;
