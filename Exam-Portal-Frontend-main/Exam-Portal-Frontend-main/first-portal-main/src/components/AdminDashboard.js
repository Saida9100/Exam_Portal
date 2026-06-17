/* eslint-disable */
// src/components/AdminDashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { Row, Col, Form, Button, Alert, Modal, Table } from 'react-bootstrap';
import apiService from '../services/api';
import SharedAdminSidebar from './SharedAdminSidebar';
import ExportToolbar from './ExportToolbar';
import { prepareStudentsForExport, prepareExamsForExport, prepareResultsForExport, prepareAdminsForExport, getExportFilename, filterByDateRange, parseExamStartTime, cleanExamDescription } from '../utils/exportUtils';

// Password generator (same logic as StudentManagement)
const generatePassword = (name) => {
  const nameBase = (name || 'admin').trim().split(' ')[0].toLowerCase().replace(/[^a-z]/g, '').substring(0, 4) || 'adm';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const specials = '!@#$%^&*';
  const parts = [
    nameBase,
    uppercase[Math.floor(Math.random() * uppercase.length)],
    digits[Math.floor(Math.random() * digits.length)],
    specials[Math.floor(Math.random() * specials.length)],
    digits[Math.floor(Math.random() * digits.length)],
  ];
  for (let i = parts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }
  return parts.join('');
};

const downloadCSV = (rows, filename) => {
  if (!rows || !rows.length) return;
  const header = Object.keys(rows[0]).join(',');
  const body = rows.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// ══════════════════════════════════════════════════════════════
// ADMIN DASHBOARD HOME
// ══════════════════════════════════════════════════════════════
const AdminDashboard = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const admin = apiService.getUser();
  const adminEmail = admin?.email || 'Admin';
  const adminInitial = admin?.name ? admin.name.charAt(0).toUpperCase() : 'A';

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [examsData, resultsData] = await Promise.all([
        apiService.getExams(),
        apiService.getAdminResults().catch(() => ({ results: [] }))
      ]);
      
      setExams(examsData.exams || examsData || []);
      setResults(resultsData.results || resultsData || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    apiService.logout();
  };

  const activeExamsCount = exams.filter(e => {
    if (!e.deadline) return true;
    return new Date(e.deadline) > new Date();
  }).length;

  const avgScore = results.length > 0 
    ? (results.reduce((sum, r) => sum + (r.score / r.total_questions * 100), 0) / results.length).toFixed(1)
    : '—';

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <SharedAdminSidebar active="dashboard" onLogout={handleLogout} />
        <div className="dashboard-main">
          <div className="loading">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <SharedAdminSidebar active="dashboard" onLogout={handleLogout} />
      <div className="dashboard-main">
        <div className="dashboard-topbar">
          <h3>Admin Dashboard</h3>
          <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 14, color: '#5B0A7B', fontWeight: 600 }}>{adminEmail}</div>
            <div className="user-avatar" style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #5B0A7B, #2D0040)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 15 }}>
              {adminInitial}
            </div>
          </div>
        </div>

        {error && <Alert variant="danger" style={{ borderRadius: 10 }}>{error}</Alert>}

        <Row className="g-4 mb-4">
          <Col md={6} lg={3}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#E3F2FD' }}>📝</div>
              <h5>Total Exams</h5>
              <h2>{exams.length}</h2>
            </div>
          </Col>
          <Col md={6} lg={3}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#E8F5E9' }}>✅</div>
              <h5>Active Exams</h5>
              <h2>{activeExamsCount}</h2>
            </div>
          </Col>
          <Col md={6} lg={3}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#FFF3E0' }}>👥</div>
              <h5>Submissions</h5>
              <h2>{results.length}</h2>
            </div>
          </Col>
          <Col md={6} lg={3}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#F3E5F5' }}>📊</div>
              <h5>Avg Score</h5>
              <h2>{avgScore}{avgScore !== '—' ? '%' : ''}</h2>
            </div>
          </Col>
        </Row>

        <Row className="g-4">
          <Col md={6}>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/create')}>
              <div className="d-flex align-items-center gap-3">
                <div className="stat-icon" style={{ background: '#E8F5E9', marginBottom: 0 }}>➕</div>
                <div>
                  <h5 style={{ margin: 0, color: '#2D0040', fontWeight: 700 }}>Create New Exam</h5>
                  <p style={{ margin: 0, color: '#888', fontSize: 13 }}>Upload PDF and set answer key</p>
                </div>
              </div>
            </div>
          </Col>
          <Col md={6}>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/exams')}>
              <div className="d-flex align-items-center gap-3">
                <div className="stat-icon" style={{ background: '#FFF3E0', marginBottom: 0 }}>📋</div>
                <div>
                  <h5 style={{ margin: 0, color: '#2D0040', fontWeight: 700 }}>Manage Exams</h5>
                  <p style={{ margin: 0, color: '#888', fontSize: 13 }}>View and edit existing exams</p>
                </div>
              </div>
            </div>
          </Col>
          <Col md={6}>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/results')}>
              <div className="d-flex align-items-center gap-3">
                <div className="stat-icon" style={{ background: '#E3F2FD', marginBottom: 0 }}>📈</div>
                <div>
                  <h5 style={{ margin: 0, color: '#2D0040', fontWeight: 700 }}>View Results</h5>
                  <p style={{ margin: 0, color: '#888', fontSize: 13 }}>Check student submissions</p>
                </div>
              </div>
            </div>
          </Col>
          <Col md={6}>
            <div className="stat-card" style={{ cursor: 'pointer', border: '1px solid #ffcdd2' }} onClick={() => navigate('/admin/detected-students')}>
              <div className="d-flex align-items-center gap-3">
                <div className="stat-icon" style={{ background: '#fff5f5', marginBottom: 0 }}>🚨</div>
                <div>
                  <h5 style={{ margin: 0, color: '#c62828', fontWeight: 700 }}>Detected Students</h5>
                  <p style={{ margin: 0, color: '#d32f2f', fontSize: 13 }}>Review proctoring violations</p>
                </div>
              </div>
            </div>
          </Col>
          <Col md={6}>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/settings')}>
              <div className="d-flex align-items-center gap-3">
                <div className="stat-icon" style={{ background: '#F3E5F5', marginBottom: 0 }}>⚙️</div>
                <div>
                  <h5 style={{ margin: 0, color: '#2D0040', fontWeight: 700 }}>Settings</h5>
                  <p style={{ margin: 0, color: '#888', fontSize: 13 }}>Configure portal settings</p>
                </div>
              </div>
            </div>
          </Col>
          <Col md={6}>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/students')}>
              <div className="d-flex align-items-center gap-3">
                <div className="stat-icon" style={{ background: '#FFF9C4', marginBottom: 0 }}>👥</div>
                <div>
                  <h5 style={{ margin: 0, color: '#2D0040', fontWeight: 700 }}>Student Accounts</h5>
                  <p style={{ margin: 0, color: '#888', fontSize: 13 }}>Add and manage students</p>
                </div>
              </div>
            </div>
          </Col>
          {admin?.role === 'super_admin' && (
            <Col md={6}>
              <div className="stat-card" style={{ cursor: 'pointer', border: '1px solid #FFD54F' }} onClick={() => navigate('/admin/manage-admins')}>
                <div className="d-flex align-items-center gap-3">
                  <div className="stat-icon" style={{ background: '#FFF8E1', marginBottom: 0 }}>🛡️</div>
                  <div>
                    <h5 style={{ margin: 0, color: '#2D0040', fontWeight: 700 }}>Manage Admins</h5>
                    <p style={{ margin: 0, color: '#888', fontSize: 13 }}>Create and oversee admin accounts</p>
                  </div>
                </div>
              </div>
            </Col>
          )}
        </Row>

        {exams.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <h5 style={{ color: '#2D0040', fontWeight: 700, marginBottom: 16 }}>Recent Exams</h5>
            <div className="create-exam-card">
              <Table responsive hover style={{ marginBottom: 0 }}>
                <thead>
                  <tr style={{ background: '#F8F0FB' }}>
                    <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Title</th>
                    <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Duration</th>
                    <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Questions</th>
                    <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Status</th>
                    <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.slice(0, 5).map((exam) => {
                    const isActive = !exam.deadline || new Date(exam.deadline) > new Date();
                    return (
                      <tr key={exam.id}>
                        <td style={{ padding: 12, fontWeight: 500 }}>{exam.title}</td>
                        <td style={{ padding: 12 }}>{exam.duration} min</td>
                        <td style={{ padding: 12 }}>{exam.total_questions || 'N/A'}</td>
                        <td style={{ padding: 12 }}>
                          <span style={{
                            padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                            background: isActive ? '#e8f5e9' : '#ffebee',
                            color: isActive ? '#2e7d32' : '#c62828',
                          }}>
                            {isActive ? 'Active' : 'Expired'}
                          </span>
                        </td>
                        <td style={{ padding: 12, fontSize: 13, color: '#888' }}>
                          {new Date(exam.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// CREATE EXAM PAGE
// ══════════════════════════════════════════════════════════════
const CreateExam = () => {
  const navigate = useNavigate();
  const admin = apiService.getUser();
  const adminEmail = admin?.email || 'Admin';
  const adminInitial = admin?.name ? admin.name.charAt(0).toUpperCase() : 'A';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [totalQuestions, setTotalQuestions] = useState('');
  const [duration, setDuration] = useState('');
  const [deadline, setDeadline] = useState('');
  const [startTime, setStartTime] = useState('');
  
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [tempDeadline, setTempDeadline] = useState('');

  const [showStartTimeModal, setShowStartTimeModal] = useState(false);
  const [tempStartTime, setTempStartTime] = useState('');
  
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [adminsList, setAdminsList] = useState([]);
  const [selectedAdminId, setSelectedAdminId] = useState('');

  useEffect(() => {
    if (admin?.role === 'super_admin') {
      apiService.getAdmins()
        .then(res => {
          const allAdmins = res.admins || res.data || [];
          setAdminsList(allAdmins.filter(a => a.role === 'admin'));
        })
        .catch(console.error);
    }
  }, [admin?.role]);

  const handleLogout = () => {
    apiService.logout();
  };

  const openDeadlinePicker = () => {
    setTempDeadline(deadline);
    setShowDeadlineModal(true);
  };

  const confirmDeadline = () => {
    setDeadline(tempDeadline);
    setShowDeadlineModal(false);
  };

  const clearDeadline = () => {
    setDeadline('');
    setTempDeadline('');
    setShowDeadlineModal(false);
  };

  const openStartTimePicker = () => {
    setTempStartTime(startTime);
    setShowStartTimeModal(true);
  };

  const confirmStartTime = () => {
    setStartTime(tempStartTime);
    setShowStartTimeModal(false);
  };

  const clearStartTime = () => {
    setStartTime('');
    setTempStartTime('');
    setShowStartTimeModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please enter exam title');
      return;
    }

    if (!totalQuestions || totalQuestions < 1) {
      setError('Please enter valid number of questions');
      return;
    }

    if (!duration || duration < 1) {
      setError('Please enter valid duration');
      return;
    }

    if (startTime && deadline && new Date(startTime) >= new Date(deadline)) {
      setError('Deadline (Exam End Time) must be after the Scheduled Start Time.');
      return;
    }

    if (admin?.role === 'super_admin' && !selectedAdminId) {
      setError('Please assign this exam to an admin');
      return;
    }

    setLoading(true);

    try {
      const finalDescription = startTime 
        ? `${description.trim()}\n[ScheduledStart: ${new Date(startTime).toISOString()}]`.trim()
        : description.trim() || null;

      const examData = {
        title: title.trim(),
        description: finalDescription,
        total_questions: parseInt(totalQuestions),
        duration: parseInt(duration),
        deadline: deadline || null,
        start_time: startTime || null,
        scheduled_at: startTime || null,
      };

      if (admin?.role === 'super_admin') {
        examData.admin_id = selectedAdminId;
      }

      // Call API to create exam
      const response = await apiService.createExamDbMode(examData);

      setSuccess(true);
      
      // Reset form after 2 seconds and redirect
      setTimeout(() => {
        navigate('/admin/exams');
      }, 2000);

    } catch (err) {
      setError(err.message || 'Failed to create exam');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setTotalQuestions('');
    setDuration('');
    setDeadline('');
    setStartTime('');
    setSuccess(false);
    setError('');
  };

  const formatDeadlineDisplay = (dl) => {
    if (!dl) return '';
    return new Date(dl).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <SharedAdminSidebar active="create" onLogout={handleLogout} />
      <div className="dashboard-main">
        <div className="dashboard-topbar">
          <h3>Create New Exam</h3>
          <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 14, color: '#5B0A7B', fontWeight: 600 }}>{adminEmail}</div>
            <div className="user-avatar" style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #5B0A7B, #2D0040)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 15 }}>
              {adminInitial}
            </div>
          </div>
        </div>

        {success ? (
          <div className="create-exam-card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <h4 style={{ color: '#2D0040', fontWeight: 700, marginBottom: 8 }}>Exam Created Successfully!</h4>
            <p style={{ color: '#888', marginBottom: 24 }}>Redirecting to exam management...</p>
          </div>
        ) : (
          <Form onSubmit={handleSubmit}>
            {error && <Alert variant="danger" style={{ borderRadius: 10 }}>{error}</Alert>}

            <Row className="g-4">
              <Col lg={8}>
                <div className="create-exam-card">
                  <h5 style={{ color: '#2D0040', fontWeight: 700, marginBottom: 24 }}>Exam Details</h5>

                  <Form.Group className="mb-3">
                    <Form.Label className="form-label-custom">Exam Title</Form.Label>
                    <Form.Control
                      type="text"
                      className="form-input-custom"
                      placeholder="e.g., Data Structures Mid-Term"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={loading}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label className="form-label-custom">Description (Optional)</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      className="form-input-custom"
                      placeholder="Brief description of the exam..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={loading}
                    />
                  </Form.Group>

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label className="form-label-custom">Total Questions</Form.Label>
                        <Form.Control
                          type="number"
                          className="form-input-custom"
                          min="1"
                          max="200"
                          placeholder="e.g., 50"
                          value={totalQuestions}
                          onChange={(e) => setTotalQuestions(e.target.value)}
                          disabled={loading}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label className="form-label-custom">Duration (minutes)</Form.Label>
                        <Form.Control
                          type="number"
                          className="form-input-custom"
                          min="5"
                          max="300"
                          placeholder="e.g., 60"
                          value={duration}
                          onChange={(e) => setDuration(e.target.value)}
                          disabled={loading}
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-4">
                        <Form.Label className="form-label-custom">Scheduled Start Time (Upcoming)</Form.Label>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          {startTime ? (
                            <div style={{
                              flex: 1,
                              padding: '12px 16px',
                              borderRadius: 10,
                              border: '1.5px solid #ff9800',
                              background: '#fff8e1',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}>
                              <div>
                                <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>
                                  Starts At
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#2D0040' }}>
                                  {formatDeadlineDisplay(startTime)}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <Button
                                  size="sm"
                                  variant="outline-primary"
                                  onClick={openStartTimePicker}
                                  style={{ borderRadius: 8, fontWeight: 600, fontSize: 12 }}
                                  disabled={loading}
                                >
                                  Change
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline-danger"
                                  onClick={clearStartTime}
                                  style={{ borderRadius: 8, fontWeight: 600, fontSize: 12 }}
                                  disabled={loading}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="outline-secondary"
                              onClick={openStartTimePicker}
                              disabled={loading}
                              style={{
                                borderRadius: 10,
                                padding: '12px 24px',
                                fontWeight: 600,
                                width: '100%',
                                border: '1.5px dashed #ffe0b2',
                                color: '#888',
                                background: '#fafafa',
                              }}
                            >
                              ⏳ Schedule Start Time
                            </Button>
                          )}
                        </div>
                        <Form.Text style={{ color: '#888', fontSize: 11 }}>
                          Leave empty to open immediately
                        </Form.Text>
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group className="mb-4">
                        <Form.Label className="form-label-custom">Deadline (Optional)</Form.Label>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          {deadline ? (
                            <div style={{
                              flex: 1,
                              padding: '12px 16px',
                              borderRadius: 10,
                              border: '1.5px solid #4caf50',
                              background: '#f1f8e9',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}>
                              <div>
                                <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>
                                  Deadline Set
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#2D0040' }}>
                                  {formatDeadlineDisplay(deadline)}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <Button
                                  size="sm"
                                  variant="outline-primary"
                                  onClick={openDeadlinePicker}
                                  style={{ borderRadius: 8, fontWeight: 600, fontSize: 12 }}
                                  disabled={loading}
                                >
                                  Change
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline-danger"
                                  onClick={clearDeadline}
                                  style={{ borderRadius: 8, fontWeight: 600, fontSize: 12 }}
                                  disabled={loading}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="outline-secondary"
                              onClick={openDeadlinePicker}
                              disabled={loading}
                              style={{
                                borderRadius: 10,
                                padding: '12px 24px',
                                fontWeight: 600,
                                width: '100%',
                                border: '1.5px dashed #E1BEE7',
                                color: '#888',
                                background: '#fafafa',
                              }}
                            >
                              📅 Click to Set Deadline
                            </Button>
                          )}
                        </div>
                        <Form.Text style={{ color: '#888', fontSize: 11 }}>
                          Leave empty for no deadline
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>

                  {admin?.role === 'super_admin' && (
                    <Form.Group className="mb-3">
                      <Form.Label className="form-label-custom">
                        Assign to Admin <span style={{ color: '#dc3545' }}>*</span>
                      </Form.Label>
                      <Form.Control
                        as="select"
                        className="form-input-custom"
                        value={selectedAdminId}
                        onChange={(e) => setSelectedAdminId(e.target.value)}
                        disabled={loading}
                      >
                        <option value="">-- Select an Admin --</option>
                        {adminsList.map(a => (
                          <option key={a.id} value={a.id}>{a.name || a.email} ({a.email})</option>
                        ))}
                      </Form.Control>
                    </Form.Group>
                  )}
                </div>
              </Col>

              <Col lg={4}>
                <div className="exam-preview-box">
                  <h6 style={{ color: '#2D0040', fontWeight: 700, marginBottom: 20, textAlign: 'center' }}>
                    Exam Preview
                  </h6>
                  <Row>
                    <Col xs={6}>
                      <div className="preview-item">
                        <div className="preview-value">{totalQuestions || '—'}</div>
                        <div className="preview-label">Questions</div>
                      </div>
                    </Col>
                    <Col xs={6}>
                      <div className="preview-item">
                        <div className="preview-value">{duration || '—'} {duration && 'min'}</div>
                        <div className="preview-label">Duration</div>
                      </div>
                    </Col>
                  </Row>

                  {startTime && (
                    <div style={{
                      marginTop: 16,
                      padding: 12,
                      background: '#fff8e1',
                      borderRadius: 10,
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>
                        Starts At
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e65100' }}>
                        {formatDeadlineDisplay(startTime)}
                      </div>
                    </div>
                  )}

                  {deadline && (
                    <div style={{
                      marginTop: 16,
                      padding: 12,
                      background: '#f1f8e9',
                      borderRadius: 10,
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>
                        Deadline
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#2e7d32' }}>
                        {formatDeadlineDisplay(deadline)}
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={!title || !totalQuestions || !duration || loading}
                    style={{
                      width: '100%',
                      marginTop: 24,
                      background: 'linear-gradient(135deg, #2D0040, #5B0A7B)',
                      border: 'none',
                      borderRadius: 10,
                      padding: 14,
                      fontWeight: 700,
                    }}
                  >
                    {loading ? 'Creating...' : 'Create Exam'}
                  </Button>
                </div>
              </Col>
            </Row>
          </Form>
        )}

        {/* Deadline Picker Modal */}
        <Modal show={showDeadlineModal} onHide={() => setShowDeadlineModal(false)} centered>
          <Modal.Body style={{ padding: 0 }}>
            <div style={{ padding: 28, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
              <h5 style={{ fontWeight: 700, color: '#2D0040', marginBottom: 4 }}>Set Exam Deadline</h5>
              <p style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>
                Choose the date and time when this exam expires
              </p>

              <Form.Control
                type="datetime-local"
                value={tempDeadline}
                onChange={(e) => setTempDeadline(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                style={{
                  borderRadius: 12,
                  padding: '14px 16px',
                  border: '2px solid #E1BEE7',
                  fontSize: 16,
                  fontWeight: 500,
                  textAlign: 'center',
                  marginBottom: 12,
                }}
              />

              {tempDeadline && (
                <div style={{
                  background: '#F8F0FB',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 20,
                  fontSize: 14,
                  color: '#5B0A7B',
                  fontWeight: 500,
                }}>
                  Selected: {formatDeadlineDisplay(tempDeadline)}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8 }}>
                <Button
                  variant="outline-secondary"
                  onClick={() => setShowDeadlineModal(false)}
                  style={{ borderRadius: 10, padding: '10px 28px', fontWeight: 600 }}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline-danger"
                  onClick={clearDeadline}
                  style={{ borderRadius: 10, padding: '10px 28px', fontWeight: 600 }}
                >
                  No Deadline
                </Button>
                <Button
                  onClick={confirmDeadline}
                  disabled={!tempDeadline}
                  style={{
                    borderRadius: 10,
                    padding: '10px 28px',
                    fontWeight: 700,
                    background: '#5B0A7B',
                    border: 'none',
                    fontSize: 15,
                  }}
                >
                  ✓ OK — Set Deadline
                </Button>
              </div>
            </div>
          </Modal.Body>
        </Modal>

        {/* Start Time Picker Modal */}
        <Modal show={showStartTimeModal} onHide={() => setShowStartTimeModal(false)} centered>
          <Modal.Body style={{ padding: 0 }}>
            <div style={{ padding: 28, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
              <h5 style={{ fontWeight: 700, color: '#2D0040', marginBottom: 4 }}>Set Scheduled Start Time</h5>
              <p style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>
                Choose the date and time when this exam becomes available to students
              </p>

              <Form.Control
                type="datetime-local"
                value={tempStartTime}
                onChange={(e) => setTempStartTime(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                style={{
                  borderRadius: 12,
                  padding: '14px 16px',
                  border: '2px solid #ffb74d',
                  fontSize: 16,
                  fontWeight: 500,
                  textAlign: 'center',
                  marginBottom: 12,
                }}
              />

              {tempStartTime && (
                <div style={{
                  background: '#fff8e1',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 20,
                  fontSize: 14,
                  color: '#e65100',
                  fontWeight: 500,
                }}>
                  Selected: {formatDeadlineDisplay(tempStartTime)}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8 }}>
                <Button
                  variant="outline-secondary"
                  onClick={() => setShowStartTimeModal(false)}
                  style={{ borderRadius: 10, padding: '10px 28px', fontWeight: 600 }}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline-danger"
                  onClick={clearStartTime}
                  style={{ borderRadius: 10, padding: '10px 28px', fontWeight: 600 }}
                >
                  Immediately
                </Button>
                <Button
                  onClick={confirmStartTime}
                  disabled={!tempStartTime}
                  style={{
                    borderRadius: 10,
                    padding: '10px 28px',
                    fontWeight: 700,
                    background: '#e65100',
                    border: 'none',
                    fontSize: 15,
                  }}
                >
                  ✓ OK — Set Start Time
                </Button>
              </div>
            </div>
          </Modal.Body>
        </Modal>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// MANAGE EXAMS PAGE
// ══════════════════════════════════════════════════════════════
const ManageExams = () => {
  const navigate = useNavigate();
  const admin = apiService.getUser();
  const adminEmail = admin?.email || 'Admin';
  const adminInitial = admin?.name ? admin.name.charAt(0).toUpperCase() : 'A';

  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [examToDelete, setExamToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [adminsList, setAdminsList] = useState([]);
  const [selectedFilterAdminId, setSelectedFilterAdminId] = useState('');
  const [exportFilters, setExportFilters] = useState({ startDate: '', endDate: '', searchTerm: '' });

  useEffect(() => {
    fetchExams();
    if (admin?.role === 'super_admin') {
      apiService.getAdmins()
        .then(res => {
          const allAdmins = res.admins || res.data || [];
          setAdminsList(allAdmins.filter(a => a.role === 'admin'));
        })
        .catch(console.error);
    }
  }, [admin?.role]);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const data = await apiService.getExams();
      setExams(data.exams || data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch exams');
    } finally {
      setLoading(false);
    }
  };

  const adminFilteredExams = selectedFilterAdminId 
    ? exams.filter(e => String(e.admin_id) === String(selectedFilterAdminId))
    : exams;

  const searchFilteredExams = adminFilteredExams.filter(e => 
    (e.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (e.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const finalFilteredExams = filterByDateRange(searchFilteredExams, exportFilters.startDate, exportFilters.endDate, 'created_at');

  const handleLogout = () => {
    apiService.logout();
  };

  const handleClearData = async () => {
    if (window.confirm("Are you sure you want to delete all exams? This action cannot be undone.")) {
      try {
        setLoading(true);
        await Promise.all(exams.map(exam => apiService.deleteExam(exam.id)));
        setExams([]);
      } catch (err) {
        setError('Failed to clear exams: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const confirmDelete = async () => {
    if (!examToDelete) return;

    try {
      await apiService.deleteExam(examToDelete.id);
      fetchExams();
      setShowDeleteModal(false);
      setExamToDelete(null);
    } catch (err) {
      setError(err.message || 'Failed to delete exam');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <SharedAdminSidebar active="exams" onLogout={handleLogout} />
        <div className="dashboard-main">
          <div className="loading">Loading exams...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <SharedAdminSidebar active="exams" onLogout={handleLogout} />
      <div className="dashboard-main">
        <div className="dashboard-topbar">
          <h3>Manage Exams</h3>
          <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 14, color: '#5B0A7B', fontWeight: 600 }}>{adminEmail}</div>
            <div className="user-avatar" style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #5B0A7B, #2D0040)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 15 }}>
              {adminInitial}
            </div>
          </div>
        </div>

        {error && <Alert variant="danger" style={{ borderRadius: 10 }}>{error}</Alert>}

        {!exams.length ? (
          <div className="create-exam-card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📝</div>
            <h4 style={{ color: '#2D0040', fontWeight: 700, marginBottom: 8 }}>No Exams Created Yet</h4>
            <p style={{ color: '#888', marginBottom: 24 }}>Create your first exam to get started</p>
            <Button
              onClick={() => navigate(admin?.role === 'super_admin' ? '/superadmin/create' : '/admin/create')}
              style={{
                background: 'linear-gradient(135deg, #5B0A7B, #7B1FA2)',
                border: 'none',
                borderRadius: 10,
                padding: '12px 32px',
                fontWeight: 600,
              }}
            >
              Create Exam
            </Button>
          </div>
        ) : (
          <div className="create-exam-card">
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
              marginBottom: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, flexWrap: 'wrap' }}>
                <h5 style={{ margin: 0, color: '#2D0040', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  All Exams ({finalFilteredExams.length})
                </h5>

                {admin?.role === 'super_admin' && (
                  <div style={{ minWidth: 200 }}>
                    <select
                      value={selectedFilterAdminId}
                      onChange={e => setSelectedFilterAdminId(e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '2px solid #f0f0f5', fontSize: 13, outline: 'none', background: '#fff', color: '#5B0A7B', fontWeight: 600 }}
                    >
                      <option value="">All Faculty / Admins</option>
                      {adminsList.map(a => (
                        <option key={a.id} value={a.id}>{a.name || a.email} ({a.email})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 250 }}>
                  <input
                    placeholder="🔍  Search exams by title or description..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '2px solid #f0f0f5', fontSize: 14, width: '100%', outline: 'none' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <ExportToolbar
                  data={finalFilteredExams}
                  prepareExportData={prepareExamsForExport}
                  filename={getExportFilename(admin?.role, 'exams')}
                  title="Exams Report"
                  dateField="created_at"
                  onFilterChange={(filters) => setExportFilters(filters)}
                />
                {admin?.role === 'super_admin' && (
                  <Button
                    onClick={handleClearData}
                    variant="outline-danger"
                    style={{
                      borderRadius: 8,
                      padding: '8px 20px',
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    Clear Data
                  </Button>
                )}
                <Button
                  onClick={() => navigate(admin?.role === 'super_admin' ? '/superadmin/create' : '/admin/create')}
                  style={{
                    background: '#5B0A7B',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 20px',
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  + New Exam
                </Button>
              </div>
            </div>

            <Table responsive hover>
              <thead>
                <tr style={{ background: '#F8F0FB' }}>
                  <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Title</th>
                  <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Questions</th>
                  <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Duration</th>
                  <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Start Time</th>
                  <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Deadline</th>
                  <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Status</th>
                  <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Actions</th>
                </tr>
              </thead>
                <tbody>
                  {finalFilteredExams.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: 40, textAlign: 'center', color: '#888' }}>
                        No matching exams found.
                      </td>
                    </tr>
                  ) : finalFilteredExams.map((exam) => {
                  const startTime = parseExamStartTime(exam);
                  const isUpcoming = startTime && startTime > new Date();
                  const isActive = !isUpcoming && (!exam.deadline || new Date(exam.deadline) > new Date());
                  return (
                    <tr key={exam.id}>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 600, color: '#2D0040' }}>{exam.title}</div>
                        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{cleanExamDescription(exam.description)}</div>
                      </td>
                      <td style={{ padding: 12 }}>{exam.total_questions}</td>
                      <td style={{ padding: 12 }}>{exam.duration} min</td>
                      <td style={{ padding: 12, fontSize: 13, color: '#e65100', fontWeight: 600 }}>
                        {startTime
                          ? new Date(startTime).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Immediately'}
                      </td>
                      <td style={{ padding: 12, fontSize: 13 }}>
                        {exam.deadline
                          ? new Date(exam.deadline).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td style={{ padding: 12 }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          background: isUpcoming ? '#fff3e0' : (isActive ? '#e8f5e9' : '#ffebee'),
                          color: isUpcoming ? '#e65100' : (isActive ? '#2e7d32' : '#c62828'),
                        }}>
                          {isUpcoming ? '⏳ Upcoming' : (isActive ? 'Active' : 'Expired')}
                        </span>
                      </td>
                      <td style={{ padding: 12 }}>
                        {admin?.role !== 'super_admin' && String(exam.admin_id) === '1' ? (
                          <span style={{ fontSize: 12, color: '#888', fontStyle: 'italic', fontWeight: 600 }}>Global Exam</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => {
                              setExamToDelete(exam);
                              setShowDeleteModal(true);
                            }}
                            style={{ borderRadius: 6, fontWeight: 600, fontSize: 12 }}
                          >
                            Delete
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontWeight: 700, fontSize: 18 }}>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete this exam?</p>
          {examToDelete && (
            <div style={{ background: '#F8F0FB', padding: 16, borderRadius: 10 }}>
              <strong>{examToDelete.title}</strong>
              <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                {examToDelete.total_questions} questions • {examToDelete.duration} minutes
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setShowDeleteModal(false)}
            style={{ borderRadius: 8 }}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete} style={{ borderRadius: 8 }}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// VIEW RESULTS PAGE
// ══════════════════════════════════════════════════════════════
const ViewResults = () => {
  const navigate = useNavigate();
  const admin = apiService.getUser();
  const adminEmail = admin?.email || 'Admin';
  const adminInitial = admin?.name ? admin.name.charAt(0).toUpperCase() : 'A';

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [resultToDelete, setResultToDelete] = useState(null);
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [adminsList, setAdminsList] = useState([]);
  const [selectedFilterAdminId, setSelectedFilterAdminId] = useState('');
  const [exportFilters, setExportFilters] = useState({ startDate: '', endDate: '', searchTerm: '' });
  const [examAdminMap, setExamAdminMap] = useState({});

  useEffect(() => {
    fetchResults();
    fetchDeletionRequests();
    apiService.getExams().then(data => {
      const examsList = data.exams || data || [];
      const map = {};
      examsList.forEach(e => {
        map[e.id] = e.admin_id;
        if (e.title) map[e.title] = e.admin_id;
      });
      setExamAdminMap(map);
    }).catch(() => {});

    if (admin?.role === 'super_admin') {
      apiService.getAdmins()
        .then(res => {
          const allAdmins = res.admins || res.data || [];
          setAdminsList(allAdmins.filter(a => a.role === 'admin'));
        })
        .catch(console.error);
    }
  }, [admin?.role]);

  const adminFilteredResults = selectedFilterAdminId
    ? results.filter(r => {
        const rAdmin = r.admin_id || examAdminMap[r.exam_id] || examAdminMap[r.exam_title];
        return String(rAdmin) === String(selectedFilterAdminId);
      })
    : results;

  const searchFilteredResults = adminFilteredResults.filter(r => 
    (r.student_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (r.student_email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.exam_title || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const finalFilteredResults = filterByDateRange(searchFilteredResults, exportFilters.startDate, exportFilters.endDate, 'submitted_at');

  const confirmDelete = async () => {
    try {
      setLoading(true);
      const targetId = resultToDelete.id || resultToDelete.attempt_id;
      if (admin?.role === 'super_admin') {
        await apiService.deleteAdminResult(targetId);
      } else {
        await apiService.submitDeletionRequest({ 
          type: 'result', 
          target_id: targetId, 
          student_name: resultToDelete.student_name,
          student_email: resultToDelete.student_email
        });
      }
      setShowDeleteModal(false);
      setResultToDelete(null);
      fetchResults();
      fetchDeletionRequests();
    } catch (err) {
      setError(err.message || 'Failed to delete result');
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    if (admin?.role !== 'super_admin') {
      return setError('Only Super Admins can perform bulk deletions.');
    }
    if (window.confirm("Are you sure you want to delete all results? This action cannot be undone.")) {
      try {
        setLoading(true);
        await Promise.all(results.map(result => apiService.deleteAdminResult(result.id || result.attempt_id)));
        setResults([]);
      } catch (err) {
        setError('Failed to clear results: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const fetchDeletionRequests = async () => {
    try {
      const res = await apiService.getAdminDeletionRequests();
      if (res.success) setDeletionRequests(res.requests || []);
    } catch (e) { console.error(e); }
  };

  const fetchResults = async () => {
    try {
      setLoading(true);
      const data = await apiService.getAdminResults();
      setResults(data.results || data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch results');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    apiService.logout();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <SharedAdminSidebar active="results" onLogout={handleLogout} />
        <div className="dashboard-main">
          <div className="loading">Loading results...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <SharedAdminSidebar active="results" onLogout={handleLogout} />
      <div className="dashboard-main">
        <div className="dashboard-topbar">
          <h3>Student Results</h3>
          <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 14, color: '#5B0A7B', fontWeight: 600 }}>{adminEmail}</div>
            <div className="user-avatar" style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #5B0A7B, #2D0040)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 15 }}>
              {adminInitial}
            </div>
          </div>
        </div>

        {error && <Alert variant="danger" style={{ borderRadius: 10 }}>{error}</Alert>}

        {!results.length ? (
          <div className="create-exam-card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📊</div>
            <h4 style={{ color: '#2D0040', fontWeight: 700, marginBottom: 8 }}>No Results Yet</h4>
            <p style={{ color: '#888' }}>Student submissions will appear here</p>
          </div>
        ) : (
          <div className="create-exam-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, flexWrap: 'wrap' }}>
                <h5 style={{ margin: 0, color: '#2D0040', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  All Submissions ({finalFilteredResults.length})
                </h5>

                {admin?.role === 'super_admin' && (
                  <div style={{ minWidth: 200 }}>
                    <select
                      value={selectedFilterAdminId}
                      onChange={e => setSelectedFilterAdminId(e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '2px solid #f0f0f5', fontSize: 13, outline: 'none', background: '#fff', color: '#5B0A7B', fontWeight: 600 }}
                    >
                      <option value="">All Faculty / Admins</option>
                      {adminsList.map(a => (
                        <option key={a.id} value={a.id}>{a.name || a.email} ({a.email})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 250 }}>
                  <input
                    placeholder="🔍  Search by student, email or exam..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '2px solid #f0f0f5', fontSize: 14, width: '100%', outline: 'none' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <ExportToolbar
                  data={finalFilteredResults}
                  prepareExportData={prepareResultsForExport}
                  filename={getExportFilename(admin?.role, 'results')}
                  title="Student Results Report"
                  dateField="submitted_at"
                  onFilterChange={(filters) => setExportFilters(filters)}
                />
                {admin?.role === 'super_admin' && (
                  <Button
                    onClick={handleClearData}
                    variant="outline-danger"
                    style={{
                      borderRadius: 8,
                      padding: '8px 20px',
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    Clear Data
                  </Button>
                )}
              </div>
            </div>
            <Table responsive hover>
              <thead>
                <tr style={{ background: '#F8F0FB' }}>
                  <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Student</th>
                  <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Exam</th>
                  <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Score</th>
                  <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Percentage</th>
                  <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Time Taken</th>
                  <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Violations</th>
                  <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Status</th>
                  <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Submitted</th>
                  <th style={{ fontWeight: 600, color: '#5B0A7B', padding: 12 }}>Actions</th>
                </tr>
              </thead>
                <tbody>
                  {finalFilteredResults.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ padding: 40, textAlign: 'center', color: '#888' }}>
                        No matching results found.
                      </td>
                    </tr>
                  ) : finalFilteredResults.map((result, idx) => {
                    const percentage = ((result.score / result.total_questions) * 100).toFixed(1);
                  const passed = percentage >= 60;
                  
                  return (
                    <tr key={idx}>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 600, color: '#2D0040' }}>{result.student_name || 'Unknown Student'}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>{result.student_email || 'No email provided'}</div>
                      </td>
                      <td style={{ padding: 12 }}>{result.exam_title}</td>
                      <td style={{ padding: 12 }}>
                        {result.score} / {result.total_questions}
                      </td>
                      <td style={{ padding: 12, fontWeight: 600 }}>{percentage}%</td>
                      <td style={{ padding: 12 }}>
                        {result.time_taken ? `${Math.floor(result.time_taken / 60)}m ${result.time_taken % 60}s` : 'N/A'}
                      </td>
                      <td style={{ padding: 12 }}>
                        {result.violations && result.violations.length > 0 ? (
                          <span style={{ color: '#c62828', fontWeight: 600, fontSize: 13, background: '#ffebee', padding: '4px 8px', borderRadius: 12 }}>
                            ⚠️ {result.violations.length}
                          </span>
                        ) : (
                          <span style={{ color: '#aaa', fontSize: 13 }}>None</span>
                        )}
                      </td>
                      <td style={{ padding: 12 }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          background: passed ? '#e8f5e9' : '#ffebee',
                          color: passed ? '#2e7d32' : '#c62828',
                        }}>
                          {passed ? 'Passed' : 'Failed'}
                        </span>
                      </td>
                      <td style={{ padding: 12, fontSize: 13, color: '#888' }}>
                        {new Date(result.submitted_at).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: 12 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {(() => {
                            const targetId = result.id || result.attempt_id;
                            const pendingReq = deletionRequests.find(r => String(r.target_id) === String(targetId) && r.type === 'result');
                            
                            if (pendingReq && pendingReq.status === 'Pending Approval') {
                              return <span style={{ padding: '6px 10px', background: '#fff3cd', color: '#856404', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #ffeeba' }}>⏳ Pending Approval</span>;
                            }
                            
                            if (pendingReq && pendingReq.status === 'Rejected') {
                              return (
                                <>
                                  <span style={{ padding: '6px 10px', background: '#f8d7da', color: '#721c24', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #f5c6cb' }}>❌ Rejected</span>
                                  <Button
                                    size="sm"
                                    variant="outline-danger"
                                    onClick={() => {
                                      setResultToDelete(result);
                                      setShowDeleteModal(true);
                                    }}
                                    style={{ borderRadius: 6, fontWeight: 600, fontSize: 12 }}
                                  >
                                    Retry Delete
                                  </Button>
                                </>
                              );
                            }

                            return (
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => {
                                  setResultToDelete(result);
                                  setShowDeleteModal(true);
                                }}
                                style={{ borderRadius: 6, fontWeight: 600, fontSize: 12 }}
                              >
                                Delete
                              </Button>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontWeight: 700, fontSize: 18 }}>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete this result? This action cannot be undone.</p>
          {resultToDelete && (
            <div style={{ background: '#F8F0FB', padding: 16, borderRadius: 10 }}>
              <strong>{resultToDelete.student_name}</strong>
              <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                Exam: {resultToDelete.exam_title} <br/>
                Score: {resultToDelete.score} / {resultToDelete.total_questions}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowDeleteModal(false)} style={{ borderRadius: 8 }}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete} style={{ borderRadius: 8 }}>
            Delete Result
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// SETTINGS PAGE (with Change Password)
// ══════════════════════════════════════════════════════════════
const AdminSettings = () => {
  const admin = apiService.getUser();
  const adminEmail = admin?.email || 'Admin';
  const adminInitial = admin?.name ? admin.name.charAt(0).toUpperCase() : 'A';

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = () => apiService.logout();

  const handleSave = () => {
    setError(''); setSaved(false);
    if (!oldPassword || !newPassword) return setError('Please fill in both fields.');
    setLoading(true);
    setTimeout(() => {
      // Mock save
      setSaved(true);
      setOldPassword('');
      setNewPassword('');
      setLoading(false);
      setTimeout(() => setSaved(false), 3000);
    }, 1000);
  };

  const inputStyle = { width: '100%', padding: '11px 14px', borderRadius: 10, border: '2px solid #e0e0e0', fontSize: 14, outline: 'none', marginBottom: 14, boxSizing: 'border-box' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <SharedAdminSidebar active="settings" onLogout={handleLogout} />
      <div className="dashboard-main">
        <div className="dashboard-topbar">
          <h3>Settings</h3>
          <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 14, color: '#5B0A7B', fontWeight: 600 }}>{adminEmail}</div>
            <div className="user-avatar" style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #5B0A7B, #2D0040)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 15 }}>
              {adminInitial}
            </div>
          </div>
        </div>

        <div className="create-exam-card" style={{ maxWidth: 500 }}>
          <h5 style={{ color: '#2D0040', fontWeight: 700, marginBottom: 24 }}>Change Password</h5>
          
          {error && <Alert variant="danger" style={{ borderRadius: 10 }}>{error}</Alert>}
          
          <div>
            <label style={{ fontWeight: 600, fontSize: 13, color: '#444', display: 'block', marginBottom: 6 }}>Current Password</label>
            <input type="password" style={inputStyle} value={oldPassword} onChange={e => setOldPassword(e.target.value)} onFocus={e => e.target.style.borderColor = '#5B0A7B'} onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
            
            <label style={{ fontWeight: 600, fontSize: 13, color: '#444', display: 'block', marginBottom: 6, marginTop: 10 }}>New Password</label>
            <input type="password" style={inputStyle} value={newPassword} onChange={e => setNewPassword(e.target.value)} onFocus={e => e.target.style.borderColor = '#5B0A7B'} onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
          </div>

          {saved && <Alert variant="success" style={{ borderRadius: 10, fontWeight: 600, marginTop: 16 }}>✓ Password updated successfully!</Alert>}
          <Button onClick={handleSave} disabled={loading}
            style={{ marginTop: 20, width: '100%', background: 'linear-gradient(135deg,#2D0040,#5B0A7B)', border: 'none', borderRadius: 10, padding: '12px 32px', fontWeight: 700, fontSize: 15 }}>
            {loading ? 'Saving...' : 'Update Password'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// MANAGE ADMINS PAGE (Super Admin only)
// ══════════════════════════════════════════════════════════════
const ManageAdmins = () => {
  const admin = apiService.getUser();
  const adminEmail = admin?.email || 'Admin';
  const adminInitial = admin?.name ? admin.name.charAt(0).toUpperCase() : 'A';

  const [admins, setAdmins] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedFilterAdminId, setSelectedFilterAdminId] = useState('');
  const [exportFilters, setExportFilters] = useState({ startDate: '', endDate: '', searchTerm: '' });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [autoPass, setAutoPass] = useState(true);

  // Bulk creation state
  const [bulkText, setBulkText] = useState('');
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkResult, setBulkResult] = useState(null);
  const fileRef = React.useRef();

  const handleLogout = () => apiService.logout();

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await apiService.getAdmins();
      setAdmins(res.admins || res.data || res || []);
    } catch (e) {
      setError(e.message || 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await apiService.getStudents();
      setStudents(res.students || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { 
    fetchAdmins(); 
    fetchStudents();
  }, []);

  const dropdownFilteredAdmins = selectedFilterAdminId
    ? admins.filter(a => String(a.id) === String(selectedFilterAdminId))
    : admins;

  const searchFilteredAdmins = dropdownFilteredAdmins.filter(a => 
    (a.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (a.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const finalFilteredAdmins = filterByDateRange(searchFilteredAdmins, exportFilters.startDate, exportFilters.endDate, 'created_at');

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.name || !form.email || !form.password) return setError('All fields are required.');
    setActionLoading(true);
    try {
      const res = await apiService.createAdmin({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      setSuccess(`✅ Admin "${form.name}" created successfully!\n📧 Email: ${form.email}\n🔑 Password: ${form.password}`);
      setForm({ name: '', email: '', password: '' });
      fetchAdmins();
      setTab('list');
    } catch (e) {
      setError(e.message || 'Failed to create admin.');
    } finally {
      setActionLoading(false);
    }
  };

  const parseBulkText = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed = lines.map((line, i) => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        const name = parts[0];
        const email = parts[1];
        const password = parts[2] || generatePassword(name);
        return { name, email, password, _line: i + 1, _valid: !!(name && email) };
      }
      return { name: line, email: '', password: '', _line: i + 1, _valid: false };
    });
    setBulkPreview(parsed);
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split('\n').filter(Boolean);
      const startIdx = lines[0]?.toLowerCase().includes('name') ? 1 : 0;
      const dataLines = lines.slice(startIdx).join('\n');
      setBulkText(dataLines);
      parseBulkText(dataLines);
    };
    reader.readAsText(file);
  };

  const handleBulkCreate = async () => {
    setError(''); 
    setSuccess(''); 
    setBulkResult(null);
    
    const validAdmins = bulkPreview
      .filter(s => s._valid)
      .map(({ name, email, password }) => ({
        email: email.toLowerCase(),
        password: password,
        first_name: name.trim().split(' ')[0],
        last_name: name.trim().split(' ').slice(1).join(' ') || null,
      }));
    
    if (!validAdmins.length) return setError('No valid admin records found.');
    setActionLoading(true);
    
    try {
      const csvContent = [
        'email,password,first_name,last_name',
        ...validAdmins.map(s => `${s.email},${s.password},"${s.first_name}","${s.last_name || ''}"`)
      ].join('\n');
      
      const csvBlob = new Blob([csvContent], { type: 'text/csv' });
      const csvFile = new File([csvBlob], 'admins.csv', { type: 'text/csv' });
      
      const data = await apiService.bulkCreateAdmins(csvFile);
      
      if (data.success) {
        setBulkResult(data.data);
        const created = data.data?.summary?.created ?? validAdmins.length;
        setSuccess(`✅ ${created} admin(s) created successfully!`);
        fetchAdmins();
        
        setTimeout(() => {
          setBulkText('');
          setBulkPreview([]);
        }, 3000);
      } else {
        setError(data.message || 'Failed to bulk create admins');
      }
    } catch (e) {
      setError(e.message || 'Failed to create admins');
    }
    setActionLoading(false);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete admin "${name}"?`)) return;
    try {
      setLoading(true);
      await apiService.deleteAdmin(id);
      setSuccess(`✅ Admin "${name}" deleted successfully.`);
      fetchAdmins();
    } catch (e) {
      setError(e.message || 'Failed to delete admin.');
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    if (window.confirm("Are you sure you want to delete all admins? This action cannot be undone.")) {
      try {
        setLoading(true);
        await Promise.all(admins.map(admin => apiService.deleteAdmin(admin.id)));
        setAdmins([]);
        setSuccess('All admins deleted successfully');
      } catch (err) {
        setError('Failed to clear admins: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };


  const inputStyle = { width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 10, border: '2px solid #e0e0e0', outline: 'none', boxSizing: 'border-box', transition: 'border 0.2s' };
  const tabStyle = (t) => ({ padding: '10px 24px', borderRadius: 8, fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: tab === t ? 'linear-gradient(135deg,#5B0A7B,#2D0040)' : '#f0f0f5', color: tab === t ? '#fff' : '#555', boxShadow: tab === t ? '0 4px 14px rgba(91,10,123,0.3)' : 'none' });

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <SharedAdminSidebar active="manage-admins" onLogout={handleLogout} />
      <div className="dashboard-main">
        <div className="dashboard-topbar">
          <h3>Manage Admins (Faculty)</h3>
          <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 14, color: '#5B0A7B', fontWeight: 600 }}>{adminEmail}</div>
            <div className="user-avatar" style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #5B0A7B, #2D0040)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 15 }}>
              {adminInitial}
            </div>
          </div>
        </div>

        {success && (
          <div style={{ background: '#e8f5e9', border: '2px solid #4caf50', borderRadius: 12, padding: '14px 20px', marginBottom: 20, color: '#2e7d32', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ whiteSpace: 'pre-line' }}>{success}</span>
            <button onClick={() => setSuccess('')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#2e7d32' }}>×</button>
          </div>
        )}
        {error && (
          <div style={{ background: '#ffebee', border: '2px solid #f44336', borderRadius: 12, padding: '14px 20px', marginBottom: 20, color: '#c62828', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>{error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#c62828' }}>×</button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 28 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button style={tabStyle('list')} onClick={() => setTab('list')}>🛡️ Admin List</button>
            <button style={tabStyle('create')} onClick={() => setTab('create')}>➕ Add Single</button>
            <button style={tabStyle('bulk')} onClick={() => setTab('bulk')}>📋 Bulk Create</button>
          </div>
          {admin?.role === 'super_admin' && (
            <button 
              style={{
                padding: '10px 24px', borderRadius: 8, fontWeight: 600, fontSize: 14, 
                cursor: 'pointer', transition: 'all 0.2s', 
                background: 'transparent', color: '#dc3545', border: '1px solid #dc3545', marginRight: 40
              }} 
              onClick={handleClearData}
            >
              🗑️ Clear Data
            </button>
          )}
        </div>

        {tab === 'list' && (
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            {selectedFilterAdminId && (
              <div style={{ padding: '12px 24px', background: '#e8f5e9', color: '#2e7d32', borderBottom: '1px solid #c8e6c9', fontWeight: 700, fontSize: 14 }}>
                🎓 Number of Students Assigned to this Faculty/Admin: {students.filter(s => String(s.admin_id) === String(selectedFilterAdminId)).length}
              </div>
            )}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 200 }}>
                  <select
                    value={selectedFilterAdminId}
                    onChange={e => setSelectedFilterAdminId(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '2px solid #f0f0f5', fontSize: 13, outline: 'none', background: '#fff', color: '#5B0A7B', fontWeight: 600 }}
                  >
                    <option value="">All Faculty / Admins</option>
                    {admins.map(a => (
                      <option key={a.id} value={a.id}>{a.name || a.email} ({a.email})</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 250 }}>
                  <input
                    placeholder="🔍  Search admins by name or email..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ padding: '10px 16px', borderRadius: 8, border: '2px solid #f0f0f5', fontSize: 14, width: '100%', outline: 'none' }}
                  />
                </div>
              </div>
              <ExportToolbar
                data={finalFilteredAdmins}
                prepareExportData={prepareAdminsForExport}
                filename={getExportFilename('super_admin', 'admins')}
                title="Admins Report"
                dateField="created_at"
                onFilterChange={(filters) => setExportFilters(filters)}
              />
            </div>
            {loading ? (
              <div style={{ padding: 60, textAlign: 'center', color: '#888' }}>Loading admins…</div>
            ) : finalFilteredAdmins.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center' }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>🛡️</div>
                <p style={{ color: '#888', fontSize: 15 }}>No admins found.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f6fc' }}>
                    {['#', 'Name', 'Email', 'Role', 'Assigned Students', 'Joined', 'Action'].map(h => (
                      <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {finalFilteredAdmins.map((a, i) => (
                    <tr key={a.id || i} style={{ borderTop: '1px solid #f0f0f5' }}>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: '#999' }}>{i + 1}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#5B0A7B,#2D0040)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                            {(a.name || a.email || 'A').charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e' }}>{a.name || '—'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: '#555' }}>{a.email}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#e8eaf6', color: '#3949ab' }}>
                          {a.role === 'super_admin' ? 'Super Admin' : 'Admin (Faculty)'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', fontWeight: 600, color: '#2e7d32', fontSize: 13 }}>
                        {students.filter(s => String(s.admin_id) === String(a.id)).length} Students
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: 12, color: '#888' }}>
                        {a.created_at ? new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <button onClick={() => handleDelete(a.id, a.name || a.email)}
                          style={{
                            padding: '6px 14px', background: '#fff', border: '2px solid #ffcdd2',
                            borderRadius: 8, color: '#c62828', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#ffebee'; e.currentTarget.style.borderColor = '#f44336'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#ffcdd2'; }}
                        >🗑 Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'create' && (
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', padding: 36, maxWidth: 540 }}>
            <h3 style={{ margin: '0 0 6px', color: '#1a1a2e', fontSize: 18, fontWeight: 700 }}>Create Admin Account</h3>
            <p style={{ margin: '0 0 24px', color: '#888', fontSize: 13 }}>Create a new faculty (admin) account.</p>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontWeight: 600, fontSize: 13, color: '#444', display: 'block', marginBottom: 6 }}>Full Name *</label>
                <input style={inputStyle} placeholder="e.g. Dr. Ramesh Kumar"
                  value={form.name}
                  onChange={e => {
                    const newName = e.target.value;
                    setForm(f => ({ ...f, name: newName, password: autoPass && newName.trim() ? generatePassword(newName) : f.password }));
                  }}
                  onFocus={e => e.target.style.borderColor = '#5B0A7B'}
                  onBlur={e => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontWeight: 600, fontSize: 13, color: '#444', display: 'block', marginBottom: 6 }}>Email Address *</label>
                <input style={inputStyle} type="email" placeholder="e.g. faculty@college.edu"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = '#5B0A7B'}
                  onBlur={e => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontWeight: 600, fontSize: 13, color: '#444' }}>Password *</label>
                  <label style={{ fontSize: 12, color: '#5B0A7B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={autoPass} onChange={e => {
                      const checked = e.target.checked;
                      setAutoPass(checked);
                      if (checked && form.name.trim()) setForm(f => ({ ...f, password: generatePassword(f.name) }));
                    }} /> Auto-generate
                  </label>
                </div>
                <input style={{ ...inputStyle, background: autoPass ? '#f9f6fc' : '#fff', marginBottom: 0 }}
                  placeholder="Password" value={form.password} readOnly={autoPass}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = '#5B0A7B'}
                  onBlur={e => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>
              <button type="submit" disabled={actionLoading} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg,#5B0A7B,#2D0040)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: actionLoading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 16px rgba(91,10,123,0.35)' }}>
                {actionLoading ? '⏳ Creating…' : '🛡️ Create Admin Account'}
              </button>
            </form>
          </div>
        )}

        {tab === 'bulk' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', padding: 32 }}>
              <h3 style={{ margin: '0 0 4px', color: '#1a1a2e', fontSize: 17, fontWeight: 700 }}>Bulk Create Admins</h3>
              <p style={{ margin: '0 0 20px', color: '#888', fontSize: 13 }}>Paste admin data or upload a CSV file.</p>
              
              <div style={{ background: '#f8f6fc', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 12, color: '#5B0A7B' }}>FORMAT (one per line):</p>
                <code style={{ fontSize: 12, color: '#333', display: 'block', lineHeight: 1.8 }}>
                  Name, email@domain.com, password<br />
                  Name, email@domain.com  ← (password auto-generated)
                </code>
              </div>

              <div style={{ marginBottom: 16 }}>
                <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleCSVUpload} />
                <button onClick={() => fileRef.current.click()} style={{ width: '100%', padding: '10px 0', border: '2px dashed #c7b0e0', borderRadius: 10, background: '#fdfcff', color: '#5B0A7B', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>📎 Upload CSV / TXT File</button>
              </div>

              <div style={{ marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#444' }}>Or paste directly:</div>
              <textarea
                rows={10}
                placeholder={`Dr. Ramesh, ramesh@college.edu, pass123\nDr. Suresh, suresh@college.edu`}
                value={bulkText}
                onChange={e => { setBulkText(e.target.value); parseBulkText(e.target.value); }}
                style={{ width: '100%', padding: 14, fontSize: 13, borderRadius: 10, border: '2px solid #e0e0e0', resize: 'vertical', outline: 'none', fontFamily: 'monospace', lineHeight: 1.7, boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#5B0A7B'}
                onBlur={e => e.target.style.borderColor = '#e0e0e0'}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={handleBulkCreate} disabled={actionLoading || !bulkPreview.filter(s => s._valid).length} style={{ flex: 1, padding: 14, background: 'linear-gradient(135deg,#5B0A7B,#2D0040)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: (!bulkPreview.filter(s => s._valid).length && !actionLoading) ? 0.5 : 1, boxShadow: '0 4px 16px rgba(91,10,123,0.3)' }}>
                  {actionLoading ? '⏳ Creating…' : `🚀 Create ${bulkPreview.filter(s => s._valid).length} Admin(s)`}
                </button>
                <button onClick={() => { setBulkText(''); setBulkPreview([]); setBulkResult(null); setError(''); setSuccess(''); }} style={{ padding: '14px 20px', background: '#f5f5f5', border: 'none', borderRadius: 10, color: '#555', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Clear</button>
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', padding: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: '#1a1a2e', fontSize: 17, fontWeight: 700 }}>Preview</h3>
                {bulkResult?.created?.length > 0 && (
                  <button onClick={() => downloadCSV(bulkResult.created, 'new_admins_credentials.csv')} style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#2e7d32,#1b5e20)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>⬇️ Download Credentials</button>
                )}
              </div>

              {bulkResult && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[ { label: 'Created', count: bulkResult.created?.length, color: '#4caf50', bg: '#e8f5e9' }, { label: 'Skipped', count: bulkResult.skipped?.length, color: '#ff9800', bg: '#fff3e0' }, { label: 'Errors', count: bulkResult.errors?.length, color: '#f44336', bg: '#ffebee' } ].map(stat => (
                      <div key={stat.label} style={{ flex: 1, background: stat.bg, borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: stat.color }}>{stat.count}</div>
                        <div style={{ fontSize: 11, color: stat.color, fontWeight: 600 }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bulkPreview.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb' }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
                  <p style={{ fontSize: 13 }}>Paste or upload admin data to see a preview here.</p>
                </div>
              ) : (
                <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                  {bulkPreview.map((s, i) => (
                    <div key={i} style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 8, background: s._valid ? '#f8f6fc' : '#fff4f4', border: `1px solid ${s._valid ? '#e8ddf5' : '#ffebee'}`, display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: s._valid ? 'linear-gradient(135deg,#5B0A7B,#2D0040)' : '#f44336', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                        {s._valid ? (s.name.charAt(0).toUpperCase() || 'A') : '✕'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name || '(No Name)'}</div>
                        <div style={{ fontSize: 12, color: s._valid ? '#555' : '#c62828' }}>{s.email || '(No Email)'}</div>
                      </div>
                      <div style={{ fontSize: 12, color: '#888', background: '#fff', padding: '4px 8px', borderRadius: 6, border: '1px solid #eee' }}>
                        {s.password ? '🔑 Custom' : '🔄 Auto'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { AdminDashboard, ManageExams, ViewResults, AdminSettings, ManageAdmins };
export default AdminDashboard;
