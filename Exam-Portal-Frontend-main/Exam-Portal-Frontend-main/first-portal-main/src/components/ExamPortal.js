/* eslint-disable */
// src/components/ExamPortal.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Nav, Form, Button, Badge, Alert, Modal } from 'react-bootstrap';
import Sidebar from './Sidebar';
import apiService from '../services/api';
import { parseExamStartTime, cleanExamDescription } from '../utils/exportUtils';

const ExamPortal = () => {
  const navigate = useNavigate();
  const student = apiService.getUser();

  const [activeTab, setActiveTab] = useState('ongoing');
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [examCode, setExamCode] = useState('');
  const [codeError, setCodeError] = useState('');
  
  const [reminderExams, setReminderExams] = useState([]);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [dismissedReminders, setDismissedReminders] = useState(new Set());

  // Fetch exams on component mount
  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [examsData, resultsData] = await Promise.all([
        apiService.getExams(),
        apiService.getUserResults().catch(() => ({ results: [] }))
      ]);
      
      setExams(examsData.exams || examsData || []);
      setResults(resultsData.results || resultsData || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch exams');
      console.error('Fetch exams error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    apiService.logout();
  };

  // Get upcoming exams (start time in the future)
  const getUpcomingExams = () => {
    const currentTime = new Date();
    return exams.filter(exam => {
      const startTime = parseExamStartTime(exam);
      if (!startTime) return false;
      if (exam.deadline && new Date(exam.deadline) <= currentTime) return false;
      return startTime > currentTime;
    });
  };

  // Get active ongoing exams (start time passed or immediately active, and not expired)
  const getActiveExams = () => {
    const currentTime = new Date();
    return exams.filter(exam => {
      const startTime = parseExamStartTime(exam);
      if (startTime && startTime > currentTime) return false; // In future -> upcoming
      if (!exam.deadline) return true; // No deadline -> always active
      return new Date(exam.deadline) > currentTime;
    });
  };

  // Get expired past exams
  const getExpiredExams = () => {
    const currentTime = new Date();
    return exams.filter(exam => {
      if (!exam.deadline) return false;
      return new Date(exam.deadline) <= currentTime;
    });
  };

  const activeExams = getActiveExams();

  // Check for expiring exams (within 30 minutes)
  useEffect(() => {
    const checkReminders = () => {
      const currentTime = new Date();
      const activeExamsList = getActiveExams();
      
      const expiringSoon = activeExamsList.filter(exam => {
        if (!exam.deadline) return false;
        const deadlineTime = new Date(exam.deadline);
        const timeRemaining = deadlineTime - currentTime;
        return (
          timeRemaining > 0 && 
          timeRemaining <= 30 * 60 * 1000 && 
          !dismissedReminders.has(exam.id)
        );
      });

      if (expiringSoon.length > 0) {
        setReminderExams(expiringSoon);
        setShowReminderModal(true);
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [exams, dismissedReminders]);

  const dismissReminder = (examId) => {
    const newSet = new Set(dismissedReminders);
    newSet.add(examId);
    setDismissedReminders(newSet);
    
    const remaining = reminderExams.filter(e => e.id !== examId);
    setReminderExams(remaining);
    
    if (remaining.length === 0) {
      setShowReminderModal(false);
    }
  };

  const dismissAllReminders = () => {
    const codes = new Set(dismissedReminders);
    reminderExams.forEach(e => codes.add(e.id));
    setDismissedReminders(codes);
    setReminderExams([]);
    setShowReminderModal(false);
  };

  const getTimeRemaining = (deadline) => {
    const diff = new Date(deadline) - new Date();
    if (diff <= 0) return 'Expired';
    
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Less than 1 min';
    if (mins === 1) return '1 minute';
    if (mins < 60) return `${mins} minutes`;
    
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const [codeLoading, setCodeLoading] = useState(false);

  const handleEnterExam = async (e) => {
    e.preventDefault();
    setCodeError('');
    
    const trimmed = examCode.trim().toUpperCase();
    
    if (!trimmed) {
      setCodeError('Please enter your exam code.');
      return;
    }

    setCodeLoading(true);
    try {
      const data = await apiService.getExamByCode(trimmed);
      navigate(`/exam/${data.exam.id}`);
    } catch (err) {
      setCodeError(err.message || 'Invalid exam code. Please check and try again.');
    } finally {
      setCodeLoading(false);
    }
  };

  const getStatusBadge = (exam) => {
    const currentTime = new Date();
    const startTime = parseExamStartTime(exam);
    if (startTime && startTime > currentTime) {
      return <span className="ep-badge ep-badge-warning">Upcoming</span>;
    }
    
    if (!exam.deadline) {
      return <span className="ep-badge ep-badge-success">Active</span>;
    }
    
    const deadlineTime = new Date(exam.deadline);
    const timeRemaining = deadlineTime - currentTime;
    
    if (timeRemaining <= 0) {
      return <span className="ep-badge ep-badge-muted">Expired</span>;
    }
    
    if (timeRemaining <= 30 * 60 * 1000) {
      return <span className="ep-badge ep-badge-danger">Expiring Soon</span>;
    }
    
    return <span className="ep-badge ep-badge-success">Active</span>;
  };

  const getExamList = () => {
    if (activeTab === 'ongoing') {
      return getActiveExams();
    } else if (activeTab === 'past') {
      return getExpiredExams();
    } else if (activeTab === 'upcoming') {
      return getUpcomingExams();
    }
    return [];
  };

  const examList = getExamList();
  const ongoingCount = activeExams.length;
  const upcomingCount = getUpcomingExams().length;

  const studentEmail = student?.email || 'Student';
  const studentName = student?.name || 'Student';
  const studentInitial = studentName.charAt(0).toUpperCase();

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar active="exams" onLogout={handleLogout} />
        <main className="dashboard-main ep-page">
          <div className="ep-loading-card">
            <div className="spinner-border text-primary" role="status" />
            <div>Loading exams...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active="exams" onLogout={handleLogout} />
      
      <main className="dashboard-main ep-page">
        <div className="ep-page-header">
          <div>
            <div className="ep-kicker">Student Workspace</div>
            <h1>Exams</h1>
            <p>View, join and complete examinations assigned to you.</p>
          </div>
          <div className="ep-user-chip">
            <div className="avatar">{studentInitial}</div>
            <div>
              <strong>{studentName}</strong>
              <span>{studentEmail}</span>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="danger" dismissible onClose={() => setError('')} className="ep-alert-box">
            {error}
          </Alert>
        )}

        {reminderExams.length > 0 && !showReminderModal && (
          <div className="reminder-banner" onClick={() => setShowReminderModal(true)}>
            <span className="reminder-banner-icon">⚠️</span>
            <span>
              {reminderExams.length} exam{reminderExams.length > 1 ? 's' : ''} expiring within 30 minutes! Click to view.
            </span>
          </div>
        )}

        {upcomingCount > 0 && activeTab !== 'upcoming' && (
          <div className="upcoming-notification-banner" onClick={() => setActiveTab('upcoming')} style={{ background: 'var(--ep-warning-soft)', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'all 0.2s', color: 'var(--ep-warning)' }}>
            <span style={{ fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'var(--ep-warning)', borderRadius: '50%', color: '#fff' }}>🔔</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ep-ink)' }}>
                <span>Upcoming Scheduled Exams</span>
                <span className="ep-badge ep-badge-warning">
                  {upcomingCount} New
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--ep-muted)' }}>You have {upcomingCount} upcoming exam{upcomingCount > 1 ? 's' : ''} scheduled to open in the future. Click here to view start dates and opening times.</div>
            </div>
            <div className="ep-btn ep-btn-outline" style={{ background: '#fff' }}>
              View Upcoming →
            </div>
          </div>
        )}

        <Nav variant="pills" className="exam-tab-pills mb-4" activeKey={activeTab}>
          <Nav.Item>
            <Nav.Link eventKey="ongoing" onClick={() => setActiveTab('ongoing')} className={activeTab === 'ongoing' ? 'active' : ''}>
              Ongoing Exams
              {ongoingCount > 0 && <span className="badge ms-2" style={{ background: 'var(--ep-danger)', color: '#fff' }}>{ongoingCount}</span>}
            </Nav.Link>
          </Nav.Item>
          <Nav.Item className="ms-2">
            <Nav.Link eventKey="upcoming" onClick={() => setActiveTab('upcoming')} className={activeTab === 'upcoming' ? 'active' : ''} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Upcoming Exams</span>
              {upcomingCount > 0 && (
                <span className="badge" style={{ background: 'var(--ep-warning)', color: '#fff' }}>
                  {upcomingCount}
                </span>
              )}
            </Nav.Link>
          </Nav.Item>
          <Nav.Item className="ms-2">
            <Nav.Link eventKey="past" onClick={() => setActiveTab('past')} className={activeTab === 'past' ? 'active' : ''}>
              Past Exams
            </Nav.Link>
          </Nav.Item>
        </Nav>

        {examList.length === 0 ? (
          <div className="ep-empty">
            <div style={{ fontSize: 64, marginBottom: 16 }}>
              {activeTab === 'ongoing' ? '📝' : activeTab === 'upcoming' ? '📅' : '📋'}
            </div>
            <h4>No {activeTab} exams found</h4>
            <p>
              {activeTab === 'ongoing' && 'There are no active exams at the moment.'}
              {activeTab === 'upcoming' && 'No exams scheduled in the near future.'}
              {activeTab === 'past' && 'You haven\'t taken any exams yet.'}
            </p>
          </div>
        ) : (
          <Row className="g-3">
            {examList.map(exam => {
              const isExpiringSoon = exam.deadline && 
                (new Date(exam.deadline) - new Date()) <= 30 * 60 * 1000 &&
                (new Date(exam.deadline) - new Date()) > 0;

              return (
                <Col md={6} lg={4} key={exam.id}>
                  <div className={`exam-card${isExpiringSoon ? ' exam-card-expiring' : ''}`} style={{ background: '#fff', padding: 20 }}>
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div style={{
                        width: 42,
                        height: 42,
                        borderRadius: 10,
                        background: isExpiringSoon ? 'var(--ep-warning-soft)' : 'var(--ep-brand-soft)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                      }}>
                        📝
                      </div>
                      {getStatusBadge(exam)}
                    </div>

                    <h6 style={{ fontWeight: 700, color: 'var(--ep-ink)', marginBottom: 6, fontSize: 15 }}>
                      {exam.title}
                    </h6>

                    {/* Exam Code display */}
                    {exam.exam_code && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 10,
                      }}>
                        <span style={{ fontSize: 12, color: 'var(--ep-muted)', fontWeight: 600 }}>Code:</span>
                        <span style={{
                          fontFamily: 'monospace',
                          fontWeight: 800,
                          fontSize: 14,
                          color: 'var(--ep-brand)',
                          background: 'var(--ep-brand-soft)',
                          padding: '2px 10px',
                          borderRadius: 6,
                          letterSpacing: 2,
                        }}>{exam.exam_code}</span>
                        <button
                          title="Copy code"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(exam.exam_code);
                            setExamCode(exam.exam_code);
                            e.currentTarget.textContent = '✓';
                            setTimeout(() => { e.currentTarget.textContent = '📋'; }, 1500);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 14,
                            padding: '2px 4px',
                            borderRadius: 4,
                            color: 'var(--ep-brand)',
                          }}
                        >📋</button>
                      </div>
                    )}

                    {cleanExamDescription(exam.description) && (
                      <p style={{ fontSize: 13, color: 'var(--ep-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                        {cleanExamDescription(exam.description)}
                      </p>
                    )}

                    <div className="d-flex justify-content-between" style={{ fontSize: 13, color: 'var(--ep-ink-2)', marginBottom: 8, fontWeight: 500 }}>
                      <span>📊 {exam.total_questions} Questions</span>
                      <span>⏱ {exam.duration} min</span>
                    </div>

                    {(() => {
                      if (activeTab !== 'upcoming') return null;
                      const startTime = parseExamStartTime(exam);
                      if (!startTime || startTime <= new Date()) return null;
                      return (
                        <div style={{
                          marginTop: 12,
                          padding: 10,
                          background: 'var(--ep-warning-soft)',
                          border: '1px solid #fde68a',
                          borderRadius: 8,
                          fontSize: 12,
                          color: 'var(--ep-warning)',
                          fontWeight: 600,
                          textAlign: 'center'
                        }}>
                          ⏳ Scheduled to Open On:<br/>
                          <strong style={{ color: 'var(--ep-ink-2)' }}>{startTime.toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}</strong>
                        </div>
                      );
                    })()}

                    {exam.deadline && (
                      <div style={{ 
                        marginTop: 12,
                        padding: 10,
                        background: isExpiringSoon ? 'var(--ep-danger-soft)' : 'var(--ep-surface-2)',
                        borderRadius: 8,
                        fontSize: 12,
                        color: isExpiringSoon ? 'var(--ep-danger)' : 'var(--ep-muted)',
                        fontWeight: isExpiringSoon ? 700 : 400
                      }}>
                        <div style={{ marginBottom: 4, color: 'var(--ep-ink-2)' }}>
                          📅 Deadline: {new Date(exam.deadline).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                        {isExpiringSoon && (
                          <div style={{ color: 'var(--ep-danger)', fontWeight: 700 }}>
                            ⚠️ Time left: {getTimeRemaining(exam.deadline)}
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'ongoing' && !exam.deadline && (
                      <div style={{ 
                        marginTop: 12,
                        padding: 10,
                        background: 'var(--ep-success-soft)',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'var(--ep-success)',
                        fontWeight: 600,
                        textAlign: 'center'
                      }}>
                        ✓ No deadline - Take anytime
                      </div>
                    )}

                    {activeTab === 'ongoing' && (() => {
                      const hasCompleted = results.some(r => String(r.exam_id) === String(exam.id));
                      
                      if (hasCompleted) {
                        return (
                          <div style={{
                            width: '100%',
                            marginTop: 12,
                            background: 'var(--ep-success-soft)',
                            border: '1.5px solid var(--ep-success)',
                            borderRadius: 10,
                            padding: '10px',
                            fontWeight: 700,
                            fontSize: 13.5,
                            color: 'var(--ep-success)',
                            textAlign: 'center'
                          }}>
                            ✓ Completed
                          </div>
                        );
                      }
                      
                      return (
                        <button
                          className="ep-btn ep-btn-primary ep-btn-block"
                          onClick={() => {
                            setExamCode(exam.exam_code || '');
                            setTimeout(() => {
                              const input = document.getElementById('code-input');
                              if (input) {
                                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                input.focus();
                              }
                            }, 100);
                          }}
                          style={{
                            marginTop: 12,
                            background: isExpiringSoon ? 'var(--ep-danger)' : 'var(--ep-brand)',
                          }}
                        >
                          {isExpiringSoon ? '⚡ Auto-fill Code' : 'Get Exam Code'}
                        </button>
                      );
                    })()}

                    {activeTab === 'upcoming' && (
                      <button
                        className="ep-btn ep-btn-outline ep-btn-block"
                        disabled={true}
                        style={{
                          marginTop: 12,
                        }}
                      >
                        ⏳ Available Soon
                      </button>
                    )}
                  </div>
                </Col>
              );
            })}
          </Row>
        )}

        {activeTab === 'ongoing' && (
          <div className="code-entry-section mt-18">
            <Row className="align-items-center">
              <Col md={6}>
                <h5 style={{ fontWeight: 800 }}>Enter Exam Code</h5>
                <p style={{ opacity: 0.9, fontSize: 13.5 }}>
                  If you have an exam code, enter it below to start your exam.
                  Codes are typically sent via email to {studentEmail}.
                </p>
              </Col>
              <Col md={6}>
                <Form onSubmit={handleEnterExam}>
                  {codeError && (
                    <Alert variant="danger" className="py-2" style={{ borderRadius: 10, fontSize: 13 }}>
                      {codeError}
                    </Alert>
                  )}
                  <div className="d-flex gap-2">
                    <Form.Control
                      id="code-input"
                      className="code-input flex-grow-1"
                      type="text"
                      placeholder="Enter exam code"
                      value={examCode}
                      onChange={(e) => setExamCode(e.target.value.toUpperCase())}
                      maxLength={12}
                    />
                    <button type="submit" className="ep-btn ep-btn-primary" disabled={codeLoading} style={{ padding: '0 24px', background: '#fff', color: 'var(--ep-brand)' }}>
                      {codeLoading ? '...' : 'Enter'}
                    </button>
                  </div>
                  <small style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8, display: 'block', fontSize: 12 }}>
                    Check your email for the exam code
                  </small>
                </Form>
              </Col>
            </Row>
          </div>
        )}
      </main>

      {/* Reminder Modal */}
      <Modal 
        show={showReminderModal} 
        onHide={() => setShowReminderModal(false)} 
        centered 
        className="modal-reminder"
      >
        <Modal.Body style={{ padding: 0 }}>
          <div className="reminder-modal-content" style={{ borderRadius: 16, overflow: 'hidden' }}>
            <div className="reminder-modal-header" style={{ padding: 32, background: 'var(--ep-danger-soft)', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
              <h4 style={{ color: 'var(--ep-danger)', fontWeight: 800 }}>Exam Reminder</h4>
              <p style={{ color: 'var(--ep-ink-2)', fontSize: 13.5, margin: 0 }}>
                The following exam{reminderExams.length > 1 ? 's are' : ' is'} expiring soon!
              </p>
            </div>

            <div className="reminder-exam-list" style={{ padding: 20, background: '#fff' }}>
              {reminderExams.map(exam => (
                <div key={exam.id} className="reminder-exam-item" style={{ borderBottom: '1px solid var(--ep-line)', padding: '16px 0' }}>
                  <div className="reminder-exam-info">
                    <div className="reminder-exam-title" style={{ fontWeight: 700, color: 'var(--ep-ink)' }}>{exam.title}</div>
                    <div className="reminder-exam-code" style={{ color: 'var(--ep-muted)', fontSize: 12.5 }}>
                      Questions: {exam.total_questions} | Duration: {exam.duration} min
                    </div>
                    <div className="reminder-exam-time" style={{ color: 'var(--ep-danger)', fontSize: 12.5, marginTop: 4 }}>
                      Time remaining: <strong>{getTimeRemaining(exam.deadline)}</strong>
                    </div>
                  </div>
                  <div className="reminder-exam-actions" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button
                      className="ep-btn ep-btn-primary"
                      style={{ fontSize: 12.5, padding: '8px 16px' }}
                      onClick={() => {
                        setShowReminderModal(false);
                        navigate(`/exam/${exam.id}`);
                      }}
                    >
                      Start Exam
                    </button>
                    <button
                      className="ep-btn ep-btn-outline"
                      style={{ fontSize: 12.5, padding: '8px 16px' }}
                      onClick={() => dismissReminder(exam.id)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="reminder-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: 18, background: 'var(--ep-surface-2)', borderTop: '1px solid var(--ep-line)' }}>
              <button
                className="ep-btn ep-btn-outline"
                onClick={dismissAllReminders}
                style={{ padding: '8px 18px', fontSize: 13 }}
              >
                Dismiss All
              </button>
              <button
                className="ep-btn ep-btn-primary"
                onClick={() => setShowReminderModal(false)}
                style={{ padding: '8px 18px', fontSize: 13 }}
              >
                Close
              </button>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default ExamPortal;
