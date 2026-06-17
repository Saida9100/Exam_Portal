// src/components/Dashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Button, Alert } from 'react-bootstrap';
import Sidebar from './Sidebar';
import apiService from '../services/api';
import { parseExamStartTime, cleanExamDescription } from '../utils/exportUtils';

const Dashboard = () => {
  const navigate = useNavigate();
  const student = apiService.getUser();
  
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
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
      setError(err.message || 'Failed to fetch dashboard data');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    apiService.logout();
  };

  // Calculate active ongoing exams (not upcoming and not expired)
  const getActiveExamsCount = () => {
    const currentTime = new Date();
    return exams.filter((exam) => {
      const startTime = parseExamStartTime(exam);
      if (startTime && startTime > currentTime) return false; // Upcoming
      if (!exam.deadline) return true; // No deadline -> active
      return new Date(exam.deadline) > currentTime;
    }).length;
  };

  // Calculate completed exams
  const getCompletedExamsCount = () => {
    return results.length;
  };

  // Calculate upcoming exams (start time in the future)
  const getUpcomingExamsCount = () => {
    const currentTime = new Date();
    return exams.filter((exam) => {
      const startTime = parseExamStartTime(exam);
      if (!startTime) return false;
      if (exam.deadline && new Date(exam.deadline) <= currentTime) return false;
      return startTime > currentTime;
    }).length;
  };

  // Calculate average score
  const getAverageScore = () => {
    if (results.length === 0) return '—';
    
    const totalPercentage = results.reduce((sum, result) => {
      const percentage = (result.score / result.total_questions) * 100;
      return sum + percentage;
    }, 0);
    
    return (totalPercentage / results.length).toFixed(1) + '%';
  };

  const studentEmail = student?.email || 'Student';
  const studentName = student?.name || 'Student';
  const studentInitial = studentName.charAt(0).toUpperCase();

  const activeExamsCount = getActiveExamsCount();
  const completedExamsCount = getCompletedExamsCount();
  const upcomingExamsCount = getUpcomingExamsCount();
  const averageScore = getAverageScore();

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar active="dashboard" onLogout={handleLogout} />
        <div className="dashboard-main">
          <div className="loading" style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            fontSize: 18,
            color: '#667eea'
          }}>
            <div>
              <div className="spinner-border text-primary mb-3" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <div>Loading dashboard...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active="dashboard" onLogout={handleLogout} />

      <div className="dashboard-main">
        {/* Topbar */}
        <div className="dashboard-topbar">
          <h3>Dashboard</h3>
          <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 14, color: '#5B0A7B', fontWeight: 600 }}>{studentEmail}</div>
            <div className="user-avatar" style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #5B0A7B, #2D0040)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 15 }}>
              {studentInitial}
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError('')} style={{ borderRadius: 10 }}>
            {error}
          </Alert>
        )}

        {/* Stats Cards */}
        <Row className="g-4 mb-4">
          <Col md={6} lg={3}>
            <div className="stat-card">
              <div className="stat-card-inline">
                <div className="stat-icon" style={{ background: '#E3F2FD' }}>📝</div>
                <div className="stat-text">
                  <h5>Active Exams</h5>
                </div>
                <div className="stat-number">{activeExamsCount}</div>
              </div>
            </div>
          </Col>
          <Col md={6} lg={3}>
            <div className="stat-card">
              <div className="stat-card-inline">
                <div className="stat-icon" style={{ background: '#E8F5E9' }}>✅</div>
                <div className="stat-text">
                  <h5>Completed</h5>
                </div>
                <div className="stat-number" style={{ color: '#4caf50' }}>
                  {completedExamsCount}
                </div>
              </div>
            </div>
          </Col>
          <Col md={6} lg={3}>
            <div className="stat-card">
              <div className="stat-card-inline">
                <div className="stat-icon" style={{ background: '#FFF3E0' }}>⏰</div>
                <div className="stat-text">
                  <h5>Upcoming</h5>
                </div>
                <div className="stat-number" style={{ color: '#ff9800' }}>
                  {upcomingExamsCount}
                </div>
              </div>
            </div>
          </Col>
          <Col md={6} lg={3}>
            <div className="stat-card">
              <div className="stat-card-inline">
                <div className="stat-icon" style={{ background: '#F3E5F5' }}>📊</div>
                <div className="stat-text">
                  <h5>Avg Score</h5>
                </div>
                <div className="stat-number" style={{ color: '#7B1FA2' }}>
                  {averageScore}
                </div>
              </div>
            </div>
          </Col>
        </Row>

        {/* Welcome Section */}
        <div className="welcome-section">
          <div className="welcome-card">
            <div className="welcome-icon">👋</div>
            <h4>Welcome back, {studentName}!</h4>
            <p>
              Your online examination platform. Take exams, track your progress,
              and view your results all in one place.
            </p>

            <div className="welcome-info-grid">
              <div className="welcome-info-item">
                <span className="welcome-info-icon">📧</span>
                <span><strong>Email:</strong> {studentEmail}</span>
              </div>
              <div className="welcome-info-item">
                <span className="welcome-info-icon">👤</span>
                <span><strong>Role:</strong> {student?.role || 'Student'}</span>
              </div>
              <div className="welcome-info-item">
                <span className="welcome-info-icon">📝</span>
                <span><strong>Active Exams:</strong> {activeExamsCount} available</span>
              </div>
              <div className="welcome-info-item">
                <span className="welcome-info-icon">✅</span>
                <span><strong>Completed:</strong> {completedExamsCount} exams</span>
              </div>
            </div>

            {activeExamsCount > 0 ? (
              <div style={{ marginTop: 24 }}>
                <Button
                  onClick={() => navigate('/exams')}
                  style={{
                    background: 'linear-gradient(135deg, #5B0A7B, #7B1FA2)',
                    border: 'none',
                    borderRadius: 10,
                    padding: '12px 32px',
                    fontWeight: 600,
                    fontSize: 15,
                  }}
                >
                  View Available Exams →
                </Button>
              </div>
            ) : (
              <div style={{ 
                marginTop: 24, 
                padding: 16, 
                background: '#f8f9fa', 
                borderRadius: 10,
                textAlign: 'center',
                color: '#666'
              }}>
                <span style={{ fontSize: 32, marginBottom: 8, display: 'block' }}>📭</span>
                <strong>No active exams available at the moment</strong>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  Check back later or contact your instructor
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <Row className="g-4 mt-4">
          <Col md={4}>
            <div 
              className="stat-card" 
              style={{ cursor: activeExamsCount > 0 ? 'pointer' : 'not-allowed', opacity: activeExamsCount > 0 ? 1 : 0.6 }} 
              onClick={() => activeExamsCount > 0 && navigate('/exams')}
            >
              <div className="d-flex align-items-center gap-3">
                <div className="stat-icon" style={{ background: '#E8F5E9', marginBottom: 0 }}>🚀</div>
                <div>
                  <h5 style={{ margin: 0, color: '#2D0040', fontWeight: 700 }}>Take an Exam</h5>
                  <p style={{ margin: 0, color: '#888', fontSize: 13 }}>
                    {activeExamsCount > 0 
                      ? `${activeExamsCount} exam${activeExamsCount > 1 ? 's' : ''} available`
                      : 'No exams available'
                    }
                  </p>
                </div>
              </div>
            </div>
          </Col>
          <Col md={4}>
            <div 
              className="stat-card" 
              style={{ cursor: upcomingExamsCount > 0 ? 'pointer' : 'not-allowed', opacity: upcomingExamsCount > 0 ? 1 : 0.6 }} 
              onClick={() => upcomingExamsCount > 0 && navigate('/exams')}
            >
              <div className="d-flex align-items-center gap-3">
                <div className="stat-icon" style={{ background: '#FFF3E0', marginBottom: 0 }}>📅</div>
                <div>
                  <h5 style={{ margin: 0, color: '#2D0040', fontWeight: 700 }}>Upcoming Exams</h5>
                  <p style={{ margin: 0, color: '#888', fontSize: 13 }}>
                    {upcomingExamsCount > 0 
                      ? `${upcomingExamsCount} exam${upcomingExamsCount > 1 ? 's' : ''} scheduled`
                      : 'No upcoming exams'
                    }
                  </p>
                </div>
              </div>
            </div>
          </Col>
          <Col md={4}>
            <div 
              className="stat-card" 
              style={{ cursor: completedExamsCount > 0 ? 'pointer' : 'not-allowed', opacity: completedExamsCount > 0 ? 1 : 0.6 }} 
              onClick={() => completedExamsCount > 0 && navigate('/results')}
            >
              <div className="d-flex align-items-center gap-3">
                <div className="stat-icon" style={{ background: '#F3E5F5', marginBottom: 0 }}>📈</div>
                <div>
                  <h5 style={{ margin: 0, color: '#2D0040', fontWeight: 700 }}>View Results</h5>
                  <p style={{ margin: 0, color: '#888', fontSize: 13 }}>
                    {completedExamsCount > 0 
                      ? `${completedExamsCount} result${completedExamsCount > 1 ? 's' : ''} available`
                      : 'No results yet'
                    }
                  </p>
                </div>
              </div>
            </div>
          </Col>
        </Row>

        {/* Recent Activity */}
        {results.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <h5 style={{ color: '#2D0040', fontWeight: 700, marginBottom: 16 }}>Recent Activity</h5>
            <div className="create-exam-card">
              {results.slice(0, 5).map((result, index) => {
                const percentage = ((result.score / result.total_questions) * 100).toFixed(1);
                const passed = percentage >= 60;
                
                return (
                  <div 
                    key={index}
                    style={{
                      padding: 16,
                      borderBottom: index < Math.min(4, results.length - 1) ? '1px solid #e0e0e0' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                    onClick={() => navigate(`/result/${result.attempt_id || result.id}`)}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#1a1a2e', marginBottom: 4 }}>
                        {result.exam_title}
                      </div>
                      <div style={{ fontSize: 12, color: '#888' }}>
                        {new Date(result.submitted_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        fontSize: 20, 
                        fontWeight: 700, 
                        color: passed ? '#4caf50' : '#e53935',
                        marginBottom: 4
                      }}>
                        {percentage}%
                      </div>
                      <div style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 600,
                        background: passed ? '#e8f5e9' : '#ffebee',
                        color: passed ? '#2e7d32' : '#c62828'
                      }}>
                        {passed ? 'Passed' : 'Failed'}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {results.length > 5 && (
                <div style={{ padding: 16, textAlign: 'center' }}>
                  <Button 
                    variant="outline-primary" 
                    size="sm"
                    onClick={() => navigate('/results')}
                    style={{ borderRadius: 8, fontWeight: 600 }}
                  >
                    View All Results ({results.length})
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tips Section */}
        <Row className="g-4 mt-4">
          <Col md={12}>
            <div className="create-exam-card" style={{ background: 'linear-gradient(135deg, #f8f9fa, #e9ecef)' }}>
              <div style={{ display: 'flex', alignItems: 'start', gap: 16 }}>
                <span style={{ fontSize: 32 }}>💡</span>
                <div>
                  <h6 style={{ fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>
                    Exam Tips
                  </h6>
                  <ul style={{ margin: 0, paddingLeft: 20, color: '#555', fontSize: 14, lineHeight: 1.8 }}>
                    <li>Make sure you have a stable internet connection before starting</li>
                    <li>Read all questions carefully before answering</li>
                    <li>Manage your time wisely - check the timer regularly</li>
                    <li>Review your answers before submitting</li>
                    <li>Avoid refreshing the page during the exam</li>
                  </ul>
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default Dashboard;
