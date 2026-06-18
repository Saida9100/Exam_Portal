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
      return <Badge className="badge-status" style={{ background: '#fff3e0', color: '#e65100', border: '1px solid #ffb74d' }}>Upcoming</Badge>;
    }
    
    if (!exam.deadline) {
      return <Badge className="badge-status" bg="primary">Active</Badge>;
    }
    
    const deadlineTime = new Date(exam.deadline);
    const timeRemaining = deadlineTime - currentTime;
    
    if (timeRemaining <= 0) {
      return <Badge className="badge-status" bg="secondary">Expired</Badge>;
    }
    
    if (timeRemaining <= 30 * 60 * 1000) {
      return <Badge className="badge-status" bg="warning" text="dark">Expiring Soon</Badge>;
    }
    
    return <Badge className="badge-status" bg="success">Active</Badge>;
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
        <div className="dashboard-main">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            flexDirection: 'column',
            gap: 16
          }}>
            <div className="spinner-border text-primary" role="status" style={{ width: 60, height: 60 }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <div style={{ fontSize: 18, color: '#667eea', fontWeight: 600 }}>Loading exams...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active="exams" onLogout={handleLogout} />
      <div className="dashboard-main">
        <div className="dashboard-topbar">
          <h3>Exams</h3>
          <div className="user-info">
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e' }}>{studentName}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{studentEmail}</div>
            </div>
            <div className="user-avatar" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
              {studentInitial}
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="danger" dismissible onClose={() => setError('')} style={{ borderRadius: 10 }}>
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
          <div className="upcoming-notification-banner" onClick={() => setActiveTab('upcoming')} style={{ background: '#fff8e1', border: '1px solid #ffe0b2', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'all 0.2s', color: '#e65100', boxShadow: '0 2px 10px rgba(255,152,0,0.12)' }}>
            <span style={{ fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: '#ffcc80', borderRadius: '50%', color: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>🔔</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Upcoming Scheduled Exams</span>
                <Badge bg="warning" text="dark" style={{ fontSize: 11, padding: '4px 8px', borderRadius: 12, fontWeight: 800, border: '1px solid #ff9800' }}>
                  {upcomingCount} New
                </Badge>
              </div>
              <div style={{ fontSize: 13, color: '#b26a00' }}>You have {upcomingCount} upcoming exam{upcomingCount > 1 ? 's' : ''} scheduled to open in the future. Click here to view start dates and opening times.</div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#e65100', background: '#ffe0b2', padding: '8px 16px', borderRadius: 10 }}>
              View Upcoming →
            </div>
          </div>
        )}

        <Nav variant="pills" className="exam-tab-pills mb-4" activeKey={activeTab}>
          <Nav.Item>
            <Nav.Link eventKey="ongoing" onClick={() => setActiveTab('ongoing')}>
              Ongoing Exams
              {ongoingCount > 0 && <Badge bg="danger" className="ms-2" pill>{ongoingCount}</Badge>}
            </Nav.Link>
          </Nav.Item>
          <Nav.Item className="ms-2">
            <Nav.Link eventKey="upcoming" onClick={() => setActiveTab('upcoming')} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Upcoming Exams</span>
              {upcomingCount > 0 && (
                <Badge bg="warning" text="dark" pill style={{ fontWeight: 800, border: '1px solid #ff9800', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>🔔</span> {upcomingCount}
                </Badge>
              )}
            </Nav.Link>
          </Nav.Item>
          <Nav.Item className="ms-2">
            <Nav.Link eventKey="past" onClick={() => setActiveTab('past')}>
              Past Exams
            </Nav.Link>
          </Nav.Item>
        </Nav>

        {examList.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: 80,
            background: '#f8f9fa',
            borderRadius: 12
          }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>
              {activeTab === 'ongoing' ? '📝' : activeTab === 'upcoming' ? '📅' : '📋'}
            </div>
            <h5 style={{ color: '#666', fontWeight: 600 }}>
              No {activeTab} exams found
            </h5>
            <p style={{ color: '#888', fontSize: 14 }}>
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
                  <div className={`exam-card${isExpiringSoon ? ' exam-card-expiring' : ''}`}>
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div style={{
                        width: 42,
                        height: 42,
                        borderRadius: 10,
                        background: isExpiringSoon ? '#fff8e1' : '#F3E5F5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                      }}>
                        📝
                      </div>
                      {getStatusBadge(exam)}
                    </div>

                    <h6 style={{ fontWeight: 700, color: '#2D0040', marginBottom: 6 }}>
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
                        <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>Code:</span>
                        <span style={{
                          fontFamily: 'monospace',
                          fontWeight: 800,
                          fontSize: 14,
                          color: '#5B0A7B',
                          background: '#F3E5F5',
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
                            color: '#667eea',
                          }}
                        >📋</button>
                      </div>
                    )}

                    {cleanExamDescription(exam.description) && (
                      <p style={{ fontSize: 13, color: '#666', marginBottom: 12, lineHeight: 1.5 }}>
                        {cleanExamDescription(exam.description)}
                      </p>
                    )}

                    <div className="d-flex justify-content-between" style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
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
                          padding: 8,
                          background: '#fff3e0',
                          border: '1px solid #ffb74d',
                          borderRadius: 8,
                          fontSize: 12,
                          color: '#e65100',
                          fontWeight: 600,
                          textAlign: 'center'
                        }}>
                          ⏳ Scheduled to Open On:<br/>
                          <strong>{startTime.toLocaleString('en-IN', {
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
                        padding: 8,
                        background: isExpiringSoon ? '#fff8e1' : '#f8f9fa',
                        borderRadius: 8,
                        fontSize: 12,
                        color: isExpiringSoon ? '#e65100' : '#666',
                        fontWeight: isExpiringSoon ? 700 : 400
                      }}>
                        <div style={{ marginBottom: 4 }}>
                          📅 Deadline: {new Date(exam.deadline).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                        {isExpiringSoon && (
                          <div style={{ color: '#e53935', fontWeight: 700 }}>
                            ⚠️ Time left: {getTimeRemaining(exam.deadline)}
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'ongoing' && !exam.deadline && (
                      <div style={{ 
                        marginTop: 12,
                        padding: 8,
                        background: '#e8f5e9',
                        borderRadius: 8,
                        fontSize: 12,
                        color: '#2e7d32',
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
                            background: '#e8f5e9',
                            border: '1px solid #4caf50',
                            borderRadius: 8,
                            padding: '10px',
                            fontWeight: 600,
                            fontSize: 14,
                            color: '#2e7d32',
                            textAlign: 'center'
                          }}>
                            ✓ Completed
                          </div>
                        );
                      }
                      
                      return (
                        <Button
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
                            width: '100%',
                            marginTop: 12,
                            background: isExpiringSoon ? '#ff9800' : 'linear-gradient(135deg, #667eea, #764ba2)',
                            border: 'none',
                            borderRadius: 8,
                            padding: '10px',
                            fontWeight: 600,
                            fontSize: 14
                          }}
                        >
                          {isExpiringSoon ? '⚡ Auto-fill Code' : 'Get Exam Code'}
                        </Button>
                      );
                    })()}

                    {activeTab === 'upcoming' && (
                      <Button
                        disabled={true}
                        style={{
                          width: '100%',
                          marginTop: 12,
                          background: '#e0e0e0',
                          border: 'none',
                          borderRadius: 8,
                          padding: '10px',
                          fontWeight: 600,
                          fontSize: 14,
                          color: '#666'
                        }}
                      >
                        ⏳ Available Soon
                      </Button>
                    )}
                  </div>
                </Col>
              );
            })}
          </Row>
        )}

        {activeTab === 'ongoing' && (
          <div className="code-entry-section">
            <Row className="align-items-center">
              <Col md={6}>
                <h5>Enter Exam Code</h5>
                <p>
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
                    <Button type="submit" className="btn-enter-exam" disabled={codeLoading}>
                      {codeLoading ? '...' : 'Enter'}
                    </Button>
                  </div>
                  <small style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8, display: 'block' }}>
                    Check your email for the exam code
                  </small>
                </Form>
              </Col>
            </Row>
          </div>
        )}
      </div>

      {/* Reminder Modal */}
      <Modal 
        show={showReminderModal} 
        onHide={() => setShowReminderModal(false)} 
        centered 
        className="modal-reminder"
      >
        <Modal.Body style={{ padding: 0 }}>
          <div className="reminder-modal-content">
            <div className="reminder-modal-header">
              <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
              <h4>Exam Reminder</h4>
              <p>
                The following exam{reminderExams.length > 1 ? 's are' : ' is'} expiring soon!
              </p>
            </div>

            <div className="reminder-exam-list">
              {reminderExams.map(exam => (
                <div key={exam.id} className="reminder-exam-item">
                  <div className="reminder-exam-info">
                    <div className="reminder-exam-title">{exam.title}</div>
                    <div className="reminder-exam-code">
                      Questions: {exam.total_questions} | Duration: {exam.duration} min
                    </div>
                    <div className="reminder-exam-time">
                      Time remaining: <strong>{getTimeRemaining(exam.deadline)}</strong>
                    </div>
                  </div>
                  <div className="reminder-exam-actions">
                    <Button
                      size="sm"
                      style={{
                        borderRadius: 8,
                        fontWeight: 600,
                        background: '#5B0A7B',
                        border: 'none',
                        color: '#fff'
                      }}
                      onClick={() => {
                        setShowReminderModal(false);
                        navigate(`/exam/${exam.id}`);
                      }}
                    >
                      Start Exam
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      style={{ borderRadius: 8, fontWeight: 600 }}
                      onClick={() => dismissReminder(exam.id)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="reminder-modal-footer">
              <Button
                variant="outline-secondary"
                onClick={dismissAllReminders}
                style={{ borderRadius: 10, fontWeight: 600, padding: '8px 24px' }}
              >
                Dismiss All
              </Button>
              <Button
                onClick={() => setShowReminderModal(false)}
                style={{
                  borderRadius: 10,
                  fontWeight: 600,
                  padding: '8px 24px',
                  background: '#5B0A7B',
                  border: 'none'
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default ExamPortal;
