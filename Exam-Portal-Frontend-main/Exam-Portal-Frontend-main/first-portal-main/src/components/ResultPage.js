/* eslint-disable */
// src/components/ResultPage.js
import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Button, Spinner, Alert } from 'react-bootstrap';
import Sidebar from './Sidebar';
import apiService from '../services/api';

const ResultPage = () => {
  const { attemptId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const student = apiService.getUser();
  const studentEmail = student?.email || 'Student';
  const studentName = student?.name || 'Student';
  const studentInitial = studentName.charAt(0).toUpperCase();

  const [result, setResult] = useState(null);
  const [allResults, setAllResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const locationState = location.state || {};

  useEffect(() => {
    if (attemptId) {
      fetchResult();
    } else {
      fetchAllResults();
    }
  }, [attemptId]);

  const fetchResult = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiService.getResult(attemptId);
      // Normalise: backend may wrap data
      setResult(data?.data || data);
    } catch (err) {
      setError(err.message || 'Failed to fetch results');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllResults = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiService.getUserResults();
      setAllResults(data?.results || data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch your results');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => apiService.logout();

  // ─── Download Answer Key ─────────────────────────────────────────────────

  const downloadAnswerKey = () => {
    if (!result) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    const timeStr = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });

    let correctCount = 0, wrongCount = 0, unansweredCount = 0;
    let answerRows = '';

    if (result.answers && Array.isArray(result.answers) && result.answers.length > 0) {
      result.answers.forEach((answer, index) => {
        const correctAnswer = answer.correct_answer;
        const studentAns = answer.student_answer;
        const isCorrect = answer.is_correct;

        let statusText, statusColor;
        const rowBg = index % 2 === 0 ? '#fff' : '#fafafa';

        if (!studentAns) {
          statusText = 'Not Answered'; statusColor = '#ff9800'; unansweredCount++;
        } else if (isCorrect) {
          statusText = 'Correct'; statusColor = '#4caf50'; correctCount++;
        } else {
          statusText = 'Wrong'; statusColor = '#e53935'; wrongCount++;
        }

        answerRows += `
          <tr style="background:${rowBg};">
            <td style="padding:10px 16px;border-bottom:1px solid #eee;font-weight:700;text-align:center;color:#2D0040;">${index + 1}</td>
            <td style="padding:10px 16px;border-bottom:1px solid #eee;text-align:center;">
              <span style="display:inline-block;padding:4px 16px;border-radius:20px;font-weight:700;background:#e8f5e9;color:#2e7d32;">
                ${correctAnswer || '—'}
              </span>
            </td>
            <td style="padding:10px 16px;border-bottom:1px solid #eee;text-align:center;font-weight:600;color:${studentAns ? '#2D0040' : '#ccc'};">
              ${studentAns || '—'}
            </td>
            <td style="padding:10px 16px;border-bottom:1px solid #eee;text-align:center;">
              <span style="display:inline-block;padding:3px 12px;border-radius:20px;font-weight:600;font-size:12px;background:${statusColor}15;color:${statusColor};">
                ${statusText}
              </span>
            </td>
          </tr>`;
      });
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Answer Key - ${result.exam_title}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Tahoma,sans-serif; background:#f5f5f5; padding:40px; }
    .container { max-width:800px; margin:0 auto; background:#fff; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.1); overflow:hidden; }
    .header { background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; padding:28px 32px; }
    .header h1 { font-size:20px; margin-bottom:4px; }
    .header p { font-size:13px; opacity:0.7; }
    .header .badge { display:inline-block; background:rgba(255,255,255,0.15); padding:4px 14px; border-radius:20px; font-size:12px; margin-top:8px; }
    .body-content { padding:28px 32px; }
    .info-row { display:flex; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:12px; }
    .info-item { background:#f8f9fa; border-radius:10px; padding:14px 20px; flex:1; min-width:120px; }
    .info-item .label { font-size:11px; color:#888; text-transform:uppercase; letter-spacing:0.5px; }
    .info-item .value { font-size:16px; font-weight:700; color:#333; margin-top:4px; }
    .score-grid { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:12px; margin-bottom:24px; }
    .score-box { background:#f8f9fa; border-radius:10px; padding:16px; text-align:center; }
    .score-box .num { font-size:24px; font-weight:700; }
    .score-box .lbl { font-size:10px; color:#888; text-transform:uppercase; margin-top:4px; }
    .green { color:#4caf50; } .red { color:#e53935; } .orange { color:#ff9800; } .blue { color:#667eea; }
    .section-title { font-size:15px; font-weight:700; color:#333; margin:24px 0 12px; padding-bottom:8px; border-bottom:2px solid #e0e0e0; }
    table { width:100%; border-collapse:collapse; }
    th { padding:10px 16px; text-align:center; font-size:12px; color:#555; text-transform:uppercase; background:#f8f9fa; }
    .footer { text-align:center; padding:20px 32px; color:#aaa; font-size:11px; border-top:1px solid #e0e0e0; }
    @media print { body { padding:0; background:#fff; } .container { box-shadow:none; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Answer Key — ${result.exam_title}</h1>
      <p>ExamPortal Result Report</p>
      <div class="badge">Exam Code: ${result.exam_code || 'N/A'}</div>
      &nbsp;
      <div class="badge">Generated: ${dateStr} at ${timeStr}</div>
    </div>
    <div class="body-content">
      <div class="info-row">
        <div class="info-item"><div class="label">EMAIL</div><div class="value">${studentEmail}</div></div>
        <div class="info-item"><div class="label">EXAM</div><div class="value">${result.exam_title}</div></div>
        <div class="info-item"><div class="label">DATE</div><div class="value">${dateStr}</div></div>
        <div class="info-item"><div class="label">TIME TAKEN</div><div class="value">${result.time_taken ? Math.floor(result.time_taken / 60) + 'm ' + (result.time_taken % 60) + 's' : 'N/A'}</div></div>
      </div>
      <div class="score-grid">
        <div class="score-box"><div class="num blue">${result.total_questions}</div><div class="lbl">Total</div></div>
        <div class="score-box"><div class="num green">${correctCount}</div><div class="lbl">Correct</div></div>
        <div class="score-box"><div class="num red">${wrongCount}</div><div class="lbl">Wrong</div></div>
        <div class="score-box"><div class="num orange">${unansweredCount}</div><div class="lbl">Skipped</div></div>
      </div>
      <div style="text-align: center; margin-bottom: 24px; padding: 16px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 10px;">
        <div style="font-size: 14px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9;">Total Score</div>
        <div style="font-size: 32px; font-weight: 800;">${correctCount} / ${result.total_questions}</div>
        <div style="font-size: 14px; opacity: 0.9;">${result.total_questions > 0 ? ((correctCount / result.total_questions) * 100).toFixed(1) : 0}% Correct</div>
      </div>
      <div class="section-title">Detailed Answer Comparison</div>
      <table>
        <thead><tr>
          <th>Q.NO</th><th>Correct Answer</th><th>Your Answer</th><th>Status</th>
        </tr></thead>
        <tbody>${answerRows}</tbody>
      </table>
    </div>
    <div class="footer">Generated on ${dateStr} at ${timeStr} &nbsp;|&nbsp; ExamPortal</div>
  </div>
</body>
</html>`;

    // Convert HTML to PDF using browser print
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // ─── Print Report ─────────────────────────────────────────────────────────

  const printReport = () => {
    if (!result) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html>
<html><head><title>Exam Result Report</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',sans-serif; padding:40px; }
  .h { text-align:center; margin-bottom:32px; border-bottom:2px solid #667eea; padding-bottom:16px; }
  .h h1 { color:#667eea; margin-bottom:8px; }
  table { width:100%; border-collapse:collapse; margin-bottom:20px; }
  th,td { padding:12px 14px; text-align:left; border:1px solid #e0e0e0; font-size:14px; }
  th { background:#f8f9fa; font-weight:600; }
  .score-banner { background:linear-gradient(135deg,#667eea,#764ba2); color:white; padding:24px; border-radius:12px; text-align:center; margin:24px 0; }
  .score-banner .score { font-size:48px; font-weight:700; margin-bottom:8px; }
  .f { text-align:center; margin-top:40px; color:#aaa; font-size:12px; border-top:1px solid #e0e0e0; padding-top:16px; }
</style></head><body>
  <div class="h"><h1>ExamPortal - Result Report</h1><p style="color:#666;">${dateStr}</p></div>
  <table>
    <tr><th>Student</th><td>${studentName}</td></tr>
    <tr><th>Email</th><td>${studentEmail}</td></tr>
    <tr><th>Exam</th><td>${result.exam_title}</td></tr>
    <tr><th>Exam Code</th><td>${result.exam_code || 'N/A'}</td></tr>
    <tr><th>Submitted At</th><td>${new Date(result.submitted_at).toLocaleString('en-IN')}</td></tr>
    <tr><th>Time Taken</th><td>${result.time_taken ? Math.floor(result.time_taken / 60) + 'm ' + (result.time_taken % 60) + 's' : 'N/A'}</td></tr>
    <tr><th>Score</th><td>${result.score} / ${result.total_questions} (${((result.score / result.total_questions) * 100).toFixed(1)}%)</td></tr>
  </table>
  <div class="score-banner">
    <div class="score">${result.score} / ${result.total_questions}</div>
    <div>${((result.score / result.total_questions) * 100).toFixed(1)}% Score</div>
  </div>
  <div class="f">ExamPortal - Secure Online Examination Platform</div>
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  // ─── Topbar helper ────────────────────────────────────────────────────────

  const Topbar = ({ title }) => (
    <div className="dashboard-topbar">
      <h3>{title}</h3>
      <div className="user-info">
        <div>
          <div style={{ fontWeight:600, fontSize:14, color:'#1a1a2e' }}>{studentName}</div>
          <div style={{ fontSize:12, color:'#888' }}>{studentEmail}</div>
        </div>
        <div className="user-avatar" style={{ background:'linear-gradient(135deg,#667eea,#764ba2)' }}>{studentInitial}</div>
      </div>
    </div>
  );

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <Sidebar active="results" onLogout={handleLogout} />
      <div className="dashboard-main">
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', flexDirection:'column', gap:16 }}>
          <Spinner animation="border" style={{ width:60, height:60, color:'#667eea' }} />
          <div style={{ fontSize:18, color:'#667eea', fontWeight:600 }}>Loading results...</div>
        </div>
      </div>
    </div>
  );

  if (!result && !attemptId) return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <Sidebar active="results" onLogout={handleLogout} />
      <div className="dashboard-main" style={{ overflowY: 'auto', padding: 24 }}>
        <Topbar title="My Results" />
        
        {allResults.length === 0 ? (
          <div className="result-card" style={{ textAlign:'center', marginTop: 40, padding: 48 }}>
            <div style={{ fontSize:64, marginBottom:16 }}>📊</div>
            <h3>No Results Yet</h3>
            <p style={{ color:'#888', marginBottom:24 }}>Complete an exam to view your results.</p>
            <Button onClick={() => navigate('/exams')} style={{ borderRadius:10, fontWeight:600, padding:'12px 32px', background:'linear-gradient(135deg,#667eea,#764ba2)', border:'none' }}>Go to Exams</Button>
          </div>
        ) : (
          <div className="result-card" style={{ marginTop: 24, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '24px 32px', borderBottom: '1px solid #eee' }}>
              <h4 style={{ margin: 0, color: '#2D0040', fontWeight: 700 }}>All Submissions ({allResults.length})</h4>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={{ padding: '16px 32px', color: '#667eea', fontWeight: 600, borderBottom: '2px solid #eee' }}>Exam Title</th>
                    <th style={{ padding: '16px 32px', color: '#667eea', fontWeight: 600, borderBottom: '2px solid #eee' }}>Score</th>
                    <th style={{ padding: '16px 32px', color: '#667eea', fontWeight: 600, borderBottom: '2px solid #eee' }}>Percentage</th>
                    <th style={{ padding: '16px 32px', color: '#667eea', fontWeight: 600, borderBottom: '2px solid #eee' }}>Time Taken</th>
                    <th style={{ padding: '16px 32px', color: '#667eea', fontWeight: 600, borderBottom: '2px solid #eee' }}>Submitted Date</th>
                    <th style={{ padding: '16px 32px', color: '#667eea', fontWeight: 600, borderBottom: '2px solid #eee', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allResults.map((res, idx) => {
                    const percentage = res.total_questions > 0 ? ((res.score / res.total_questions) * 100).toFixed(2) : 0;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #eee', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#fafafa'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        <td style={{ padding: '16px 32px', fontWeight: 700, color: '#2D0040' }}>{res.exam_title || 'Untitled Exam'}</td>
                        <td style={{ padding: '16px 32px', fontWeight: 600 }}>{res.score} / {res.total_questions}</td>
                        <td style={{ padding: '16px 32px', fontWeight: 600, color: percentage >= 60 ? '#2e7d32' : '#c62828' }}>{percentage}%</td>
                        <td style={{ padding: '16px 32px', color: '#555', fontWeight: 600 }}>{res.time_taken ? `${Math.floor(res.time_taken / 60)}m ${res.time_taken % 60}s` : 'N/A'}</td>
                        <td style={{ padding: '16px 32px', color: '#888', fontSize: 14 }}>{new Date(res.submitted_at).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '16px 32px', textAlign: 'center' }}>
                          <Button 
                            size="sm" 
                            onClick={() => navigate(`/result/${res.attempt_id || res.id}`)} 
                            style={{ background: '#e8f5e9', color: '#2e7d32', border: 'none', fontWeight: 700, padding: '8px 20px', borderRadius: 20 }}
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (error) return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <Sidebar active="results" onLogout={handleLogout} />
      <div className="dashboard-main">
        <Topbar title="Results" />
        <Alert variant="danger" style={{ margin:20, borderRadius:10 }}>{error}</Alert>
        <div style={{ textAlign:'center', padding:40 }}>
          <Button onClick={() => navigate('/dashboard')} style={{ borderRadius:10, fontWeight:600, background:'linear-gradient(135deg,#667eea,#764ba2)', border:'none' }}>Back to Dashboard</Button>
        </div>
      </div>
    </div>
  );

  // If we are supposed to show a specific result but it hasn't loaded yet, show loading
  if (attemptId && !result) {
    return (
      <div style={{ display:'flex', minHeight:'100vh' }}>
        <Sidebar active="results" onLogout={handleLogout} />
        <div className="dashboard-main">
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', flexDirection:'column', gap:16 }}>
            <Spinner animation="border" style={{ width:60, height:60, color:'#667eea' }} />
            <div style={{ fontSize:18, color:'#667eea', fontWeight:600 }}>Loading result details...</div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Result data ──────────────────────────────────────────────────────────

  const total = result?.total_questions ?? 0;
  
  let calculatedAttempted = 0;
  if (result?.answers && Array.isArray(result.answers)) {
    calculatedAttempted = result.answers.filter(a => a.student_answer != null && a.student_answer !== '').length;
  }
  
  const attempted = result?.attempted ?? calculatedAttempted;
  const unanswered = result?.unanswered ?? (total - attempted);
  const completion = total > 0 ? Math.round((attempted / total) * 100) : 0;
  const score = result?.score ?? 0;

  const submittedDate = new Date(result.submitted_at);
  const dateFormatted = submittedDate.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  const timeFormatted = submittedDate.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
  
  const timeTakenSec = result?.time_taken || 0;
  const timeTakenFormatted = timeTakenSec > 0 
    ? `${Math.floor(timeTakenSec / 60)}m ${timeTakenSec % 60}s` 
    : 'N/A';

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <Sidebar active="results" onLogout={handleLogout} />
      <div className="dashboard-main" style={{ overflowY:'auto' }}>
        <Topbar title="Exam Result" />

        {/* ── Termination / Auto-submit banners ── */}
        {locationState.terminated && (
          <div style={{ margin:'16px 24px 0', background:'#fff8e1', border:'2px solid #ffb300', borderRadius:10, padding:16, display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:28 }}>⚠️</span>
            <div>
              <strong style={{ color:'#f57f17' }}>Exam Terminated</strong>
              <div style={{ fontSize:12, color:'#666', marginTop:4 }}>{locationState.terminationReason || 'Exam was terminated due to policy violation'}</div>
            </div>
          </div>
        )}
        {locationState.autoSubmitted && (
          <div style={{ margin:'16px 24px 0', background:'#e3f2fd', border:'2px solid #1976d2', borderRadius:10, padding:16, display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:28 }}>⏱️</span>
            <div>
              <strong style={{ color:'#1565c0' }}>Auto-Submitted</strong>
              <div style={{ fontSize:12, color:'#666', marginTop:4 }}>{locationState.reason || 'Exam was automatically submitted when time expired'}</div>
            </div>
          </div>
        )}

        {/* ── Main Card ── */}
        <div className="result-card" style={{ maxWidth:620, margin:'32px auto' }}>

          {/* Success Icon */}
          <div style={{ textAlign:'center', marginBottom:12 }}>
            <div style={{
              width:64, height:64, borderRadius:'50%',
              border:'3px solid #4caf50',
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              marginBottom:12
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h4 style={{ fontWeight:700, color:'#1a1a2e', marginBottom:4 }}>Exam Submitted Successfully!</h4>
          </div>

          {/* Stats Pills */}
          <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:12, flexWrap:'wrap' }}>
            <div style={{ padding:'6px 18px', background:'#f3e5f5', borderRadius:20, fontSize:13, fontWeight:700, color:'#5B0A7B' }}>
              <strong>{total}</strong> <span style={{ fontWeight:400 }}>TOTAL</span>
            </div>
            <div style={{ padding:'6px 18px', background:'#e8f5e9', borderRadius:20, fontSize:13, fontWeight:700, color:'#2e7d32' }}>
              <strong>{attempted}</strong> <span style={{ fontWeight:400 }}>ATTEMPTED</span>
            </div>
            <div style={{ padding:'6px 18px', background:'#fce4ec', borderRadius:20, fontSize:13, fontWeight:700, color:'#c62828' }}>
              <strong>{unanswered}</strong> <span style={{ fontWeight:400 }}>UNANSWERED</span>
            </div>
          </div>

          {/* Completion bar */}
          <div style={{ 
            padding:'10px 18px',
            background:'#f3e5f5',
            borderRadius:10,
            fontSize:13,
            fontWeight:700,
            color:'#5B0A7B',
            marginBottom:24,
            textAlign:'center'
          }}>
            {completion}% <span style={{ fontWeight:400 }}>COMPLETION</span>
          </div>

          {/* Info table */}
          <div style={{ background:'#f8f9fa', borderRadius:10, padding:'4px 16px', marginBottom:20 }}>
            {[
              { label:'Email', value: studentEmail },
              { label:'Exam', value: result.exam_title },
              { label:'Code', value: result.exam_code || 'N/A' },
              { label:'Submitted', value: `${dateFormatted} at ${timeFormatted}` },
              { label:'Time Taken', value: timeTakenFormatted },
            ].map(({ label, value }) => (
              <div key={label} style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid #e0e0e0' }}>
                <span style={{ minWidth:90, fontWeight:600, color:'#667eea', fontSize:13 }}>{label}</span>
                <span style={{ color:'#333', fontSize:13 }}>{value}</span>
              </div>
            ))}
          </div>
          {/* Note */}
          <p style={{ textAlign:'center', fontSize:13, color:'#888', marginBottom:24 }}>
            Detailed answer breakdown is available in the downloaded report.
          </p>

          {/* Action Buttons */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center' }}>
            <Button
              onClick={() => navigate('/dashboard')}
              style={{ background:'linear-gradient(135deg,#667eea,#764ba2)', border:'none', borderRadius:10, padding:'10px 22px', fontWeight:600, fontSize:14 }}
            >
              Back to Dashboard
            </Button>
            <Button
              variant="outline-success"
              onClick={downloadAnswerKey}
              style={{ borderRadius:10, padding:'10px 22px', fontWeight:600, fontSize:14 }}
            >
              Download Answer Key
            </Button>
            <Button
              variant="outline-secondary"
              onClick={printReport}
              style={{ borderRadius:10, padding:'10px 22px', fontWeight:600, fontSize:14 }}
            >
              Print Report
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultPage;
