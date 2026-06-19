// src/components/Dashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Alert } from 'react-bootstrap';
import Sidebar from './Sidebar';
import apiService from '../services/api';
import { parseExamStartTime } from '../utils/exportUtils';

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
        apiService.getUserResults().catch(() => ({ results: [] })),
      ]);

      setExams(examsData.exams || examsData || []);
      setResults(resultsData.results || resultsData || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getActiveExamsCount = () => {
    const now = new Date();
    return exams.filter((exam) => {
      const startTime = parseExamStartTime(exam);
      if (startTime && startTime > now) return false;
      if (!exam.deadline) return true;
      return new Date(exam.deadline) > now;
    }).length;
  };

  const getUpcomingExamsCount = () => {
    const now = new Date();
    return exams.filter((exam) => {
      const startTime = parseExamStartTime(exam);
      if (!startTime) return false;
      if (exam.deadline && new Date(exam.deadline) <= now) return false;
      return startTime > now;
    }).length;
  };

  const getAverageScore = () => {
    if (results.length === 0) return '—';
    const totalPercentage = results.reduce((sum, result) => {
      const total = result.total_questions || 1;
      return sum + ((result.score || 0) / total) * 100;
    }, 0);
    return `${(totalPercentage / results.length).toFixed(1)}%`;
  };

  const studentEmail = student?.email || 'Student';
  const studentName = student?.name || 'Student';
  const initial = studentName.charAt(0).toUpperCase();

  const activeExamsCount = getActiveExamsCount();
  const completedExamsCount = results.length;
  const upcomingExamsCount = getUpcomingExamsCount();
  const averageScore = getAverageScore();

  const stats = [
    { label: 'Active Exams', value: activeExamsCount, icon: '📝', tone: 'blue', sub: activeExamsCount > 0 ? 'Ready to attempt' : 'No active exams' },
    { label: 'Completed', value: completedExamsCount, icon: '✅', tone: 'green', sub: completedExamsCount > 0 ? 'Submitted exams' : 'No submissions yet' },
    { label: 'Upcoming', value: upcomingExamsCount, icon: '📅', tone: 'orange', sub: upcomingExamsCount > 0 ? 'Scheduled exams' : 'Nothing scheduled' },
    { label: 'Avg Score', value: averageScore, icon: '📊', tone: 'purple', sub: averageScore === '—' ? 'Available after results' : 'Across all results' },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar active="dashboard" />
        <main className="dashboard-main">
          <div className="ep-loading-card">
            <div className="spinner-border text-primary" role="status" />
            <div>Loading dashboard...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active="dashboard" />

      <main className="dashboard-main ep-page">
        <div className="ep-page-header">
          <div>
            <div className="ep-kicker">Student Workspace</div>
            <h1>Dashboard</h1>
            <p>Track assigned exams, submissions and progress from one place.</p>
          </div>
          <div className="ep-user-chip">
            <div className="avatar">{initial}</div>
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

        <section className="ep-hero-card">
          <div>
            <span className="ep-badge ep-badge-info">👋 Welcome back</span>
            <h2>{studentName}</h2>
            <p>
              Take exams, monitor upcoming schedules and review your performance reports.
              Keep your camera and microphone ready before starting any proctored exam.
            </p>
          </div>
          <div className="ep-hero-actions">
            <Button className="ep-btn ep-btn-primary" onClick={() => navigate('/exams')}>
              View Exams →
            </Button>
            <Button className="ep-btn ep-btn-outline" onClick={() => navigate('/results')} disabled={completedExamsCount === 0}>
              View Results
            </Button>
          </div>
        </section>

        <section className="ep-grid ep-grid-4 ep-mb">
          {stats.map((item) => (
            <div className="ep-stat-card" key={item.label}>
              <div>
                <div className="ep-stat-label">{item.label}</div>
                <div className="ep-stat-value">{item.value}</div>
                <div className="ep-stat-sub">{item.sub}</div>
              </div>
              <div className={`ep-stat-icon ${item.tone}`}>{item.icon}</div>
            </div>
          ))}
        </section>

        <section className="ep-grid ep-grid-main">
          <div className="ep-card">
            <div className="ep-card-head">
              <div>
                <h3>Quick actions</h3>
                <p>Continue with the most common student tasks.</p>
              </div>
            </div>
            <div className="ep-action-grid">
              <button className="ep-action-card" onClick={() => navigate('/exams')} disabled={activeExamsCount === 0 && upcomingExamsCount === 0}>
                <span>🚀</span>
                <strong>Take an Exam</strong>
                <small>{activeExamsCount} active, {upcomingExamsCount} upcoming</small>
              </button>
              <button className="ep-action-card" onClick={() => navigate('/results')} disabled={completedExamsCount === 0}>
                <span>📈</span>
                <strong>View Results</strong>
                <small>{completedExamsCount} result{completedExamsCount === 1 ? '' : 's'} available</small>
              </button>
              <button className="ep-action-card" onClick={() => navigate('/exams')}>
                <span>🔐</span>
                <strong>Enter Exam Code</strong>
                <small>Use the code shared by your administrator</small>
              </button>
            </div>
          </div>

          <div className="ep-card">
            <div className="ep-card-head">
              <div>
                <h3>Exam tips</h3>
                <p>Prepare before you begin.</p>
              </div>
            </div>
            <ul className="ep-tip-list">
              <li>Use a stable internet connection.</li>
              <li>Allow camera and microphone permissions.</li>
              <li>Do not switch tabs or open other windows.</li>
              <li>Keep your face clearly visible.</li>
              <li>Submit before the timer ends.</li>
            </ul>
          </div>
        </section>

        <section className="ep-card ep-mt">
          <div className="ep-card-head">
            <div>
              <h3>Recent activity</h3>
              <p>Your latest completed exam submissions.</p>
            </div>
            {results.length > 5 && (
              <button className="ep-btn ep-btn-outline" onClick={() => navigate('/results')}>View all</button>
            )}
          </div>

          {results.length === 0 ? (
            <div className="ep-empty">
              <div>📭</div>
              <h4>No activity yet</h4>
              <p>Completed exams and result summaries will appear here.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="ep-table">
                <thead>
                  <tr>
                    <th>Exam</th>
                    <th>Submitted</th>
                    <th>Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 5).map((result, index) => {
                    const total = result.total_questions || 1;
                    const percentage = (((result.score || 0) / total) * 100).toFixed(1);
                    const passed = Number(percentage) >= 60;
                    return (
                      <tr key={result.attempt_id || index} onClick={() => navigate(`/result/${result.attempt_id || result.id}`)}>
                        <td className="cell-strong">{result.exam_title || 'Untitled Exam'}</td>
                        <td>{result.submitted_at ? new Date(result.submitted_at).toLocaleString('en-IN') : '—'}</td>
                        <td className="cell-strong">{percentage}%</td>
                        <td><span className={`ep-badge ${passed ? 'ep-badge-success' : 'ep-badge-danger'}`}>{passed ? 'Passed' : 'Failed'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
