/* eslint-disable */
// src/components/ResultPage.js
import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Button, Spinner, Alert } from 'react-bootstrap';
import Sidebar from './Sidebar';
import apiService from '../services/api';
import ExportToolbar from './ExportToolbar';
import { prepareStudentResultsForExport, getExportFilename, filterByDateRange } from '../utils/exportUtils';

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
  const [examDeadline, setExamDeadline] = useState(null);
  const [exportFilters, setExportFilters] = useState({ startDate: '', endDate: '', searchTerm: '' });
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
      let resultData = data?.data || data;
      
      console.log('📊 Raw result data from backend:', JSON.stringify(resultData, null, 2));

      if (resultData.answers && Array.isArray(resultData.answers)) {
        resultData = {
          ...resultData,
          answers: resultData.answers.map(a => ({
            student_answer: a.student_answer ?? a.selected_option ?? a.selected_answer ?? a.answer ?? null,
            correct_answer: a.correct_answer ?? a.correctOption ?? a.correct ?? null,
            is_correct: a.is_correct ?? a.correct ?? false,
            question_id: a.question_id ?? a.qid ?? null,
            question_number: a.question_number ?? a.qno ?? a.questionNo ?? null,
          }))
        };
      }

      if (resultData.answers && Array.isArray(resultData.answers)) {
        const realAttempted = resultData.answers.filter(
          a => a.student_answer != null && a.student_answer !== '' && a.student_answer !== 'null' && a.student_answer !== 'undefined'
        ).length;
        const backendAttempted = resultData.attempted ?? 0;
        if (realAttempted > backendAttempted) {
          resultData.attempted = realAttempted;
          resultData.unanswered = (resultData.total_questions ?? resultData.answers.length) - realAttempted;
        }
      }

      let fetchedDeadline = resultData.deadline || resultData.exam?.deadline || resultData.exam_deadline || null;

      if (!fetchedDeadline && resultData.exam_id) {
        try {
          const qData = await apiService.getExamQuestions(resultData.exam_id);
          if (qData && qData.exam && qData.exam.deadline) {
            fetchedDeadline = qData.exam.deadline;
          }
        } catch (err) { console.warn("Could not fetch by exam_id", err); }
      }

      if (!fetchedDeadline && resultData.exam_code) {
        try {
          const cData = await apiService.getExamByCode(resultData.exam_code);
          if (cData && cData.exam && cData.exam.deadline) {
            fetchedDeadline = cData.exam.deadline;
          }
        } catch (err) { console.warn("Could not fetch by code", err); }
      }

      if (!fetchedDeadline) {
        try {
          const allExamsData = await apiService.getExams();
          const list = allExamsData?.exams || allExamsData || [];
          const found = list.find(e => String(e.id) === String(resultData.exam_id) || (e.title && e.title === resultData.exam_title));
          if (found && found.deadline) {
            fetchedDeadline = found.deadline;
          }
        } catch (err) { console.warn("Could not match from list", err); }
      }

      setExamDeadline(fetchedDeadline);
      setResult(resultData);
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

  const finalAllResults = filterByDateRange(allResults, exportFilters.startDate, exportFilters.endDate, 'submitted_at');

  const isAnswerKeyLocked = examDeadline && new Date(examDeadline) > new Date();

  // ─── Download Answer Key ─────────────────────────────────────────────────
  const downloadAnswerKey = () => {
    if (!result) return;
    if (isAnswerKeyLocked) {
      alert("Answer Key is locked to prevent leaking answers while the exam is still active. Please check back after the exam deadline.");
      return;
    }

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

        if (!studentAns || studentAns === '' || studentAns === 'null' || studentAns === 'undefined') {
          statusText = 'Not Answered'; statusColor = '#ff9800'; unansweredCount++;
        } else if (isCorrect) {
          statusText = 'Correct'; statusColor = '#4caf50'; correctCount++;
        } else {
          statusText = 'Wrong'; statusColor = '#e53935'; wrongCount++;
        }

        answerRows += `
          <tr style="background:${rowBg};">
            <td style="padding:10px 16px;border-bottom:1px solid #eee;font-weight:700;text-align:center;color:#0f172a;">${index + 1}</td>
            <td style="padding:10px 16px;border-bottom:1px solid #eee;text-align:center;">
              <span style="display:inline-block;padding:4px 16px;border-radius:20px;font-weight:700;background:#e8f5e9;color:#2e7d32;">
                ${correctAnswer || '—'}
              </span>
            </td>
            <td style="padding:10px 16px;border-bottom:1px solid #eee;text-align:center;font-weight:600;color:${studentAns ? '#0f172a' : '#ccc'};">
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
    .header { background:linear-gradient(135deg,#4f46e5,#6366f1); color:#fff; padding:28px 32px; }
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
    .green { color:#16a34a; } .red { color:#dc2626; } .orange { color:#d97706; } .blue { color:#4f46e5; }
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
      <div style="text-align: center; margin-bottom: 24px; padding: 16px; background: linear-gradient(135deg, #4f46e5, #6366f1); color: white; border-radius: 10px;">
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
    if (isAnswerKeyLocked) {
      alert("Result report is locked to prevent leaking answers while the exam is still active. Please check back after the exam deadline.");
      return;
    }
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html>
<html><head><title>Exam Result Report</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',sans-serif; padding:40px; }
  .h { text-align:center; margin-bottom:32px; border-bottom:2px solid #4f46e5; padding-bottom:16px; }
  .h h1 { color:#4f46e5; margin-bottom:8px; }
  table { width:100%; border-collapse:collapse; margin-bottom:20px; }
  th,td { padding:12px 14px; text-align:left; border:1px solid #e0e0e0; font-size:14px; }
  th { background:#f8f9fa; font-weight:600; }
  .score-banner { background:linear-gradient(135deg,#4f46e5,#6366f1); color:white; padding:24px; border-radius:12px; text-align:center; margin:24px 0; }
  .score-banner .score { font-size:48px; font-weight:700; margin-bottom:8px; }
  .f { text-align:center; margin-top:40px; color:#aaa; font-size:12px; border-top:1px solid #e0e0e0; padding-top:16px; }
</style></head><body>
<div class="h"><h1>Exam Result Report</h1><p>${studentEmail}</p></div>
<div class="score-banner"><div class="score">${result.score ?? 0} / ${result.total_questions ?? 0}</div><div>${result.total_questions > 0 ? ((result.score / result.total_questions) * 100).toFixed(1) : 0}%</div></div>
<table>
<tr><th>#</th><th>Correct</th><th>Your Answer</th><th>Status</th></tr>`);
    if (result.answers && Array.isArray(result.answers)) {
      result.answers.forEach((a,i) => {
        const st = a.student_answer;
        const status = (!st || st === '' || st === 'null') ? 'Not Answered' : a.is_correct ? 'Correct' : 'Wrong';
        w.document.write(`<tr><td>${i+1}</td><td>${a.correct_answer || '—'}</td><td>${st || '—'}</td><td>${status}</td></tr>`);
      });
    }
    w.document.write('</table><div class="f">Generated on ' + dateStr + '</div></body></html>');
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  if (loading) {
    return (
      <div style={{ display:'flex', minHeight:'100vh' }}>
        <Sidebar active="results" onLogout={handleLogout} />
        <main className="dashboard-main ep-page">
          <div className="ep-loading-card">
            <div className="spinner-border text-primary" role="status" />
            <div>Loading results...</div>
          </div>
        </main>
      </div>
    );
  }

  // ─── Show ALL results list (no attemptId) ─────────────────────────────────
  if (!attemptId) {
    return (
      <div style={{ display:'flex', minHeight:'100vh' }}>
        <Sidebar active="results" onLogout={handleLogout} />
        
        <main className="dashboard-main ep-page">
          <div className="ep-page-header">
            <div>
              <div className="ep-kicker">Student Workspace</div>
              <h1>Results</h1>
              <p>Monitor your performance, correct answers and historical reports.</p>
            </div>
            <div className="ep-user-chip">
              <div className="avatar">{studentInitial}</div>
              <div>
                <strong>{studentName}</strong>
                <span>{studentEmail}</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            {error && <Alert variant="danger" className="ep-alert-box">{error}</Alert>}
            
            {allResults.length === 0 ? (
              <div className="ep-empty">
                <div style={{ fontSize: 64, marginBottom: 16 }}>📊</div>
                <h4>No Results Yet</h4>
                <p>Complete an exam to see your reports here.</p>
                <button onClick={() => navigate('/dashboard')} className="ep-btn ep-btn-primary" style={{ marginTop: 12 }}>
                  Back to Dashboard
                </button>
              </div>
            ) : (
              <div className="ep-card">
                <div className="ep-card-head" style={{ padding: '18px 20px', borderBottom: '1px solid var(--ep-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>📊 All Exam Results</h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12.5 }}>Historical record of your submitted assessments ({finalAllResults.length})</p>
                  </div>
                  <ExportToolbar
                    data={finalAllResults}
                    prepareExportData={prepareStudentResultsForExport}
                    filename={getExportFilename('student', 'results')}
                    title="My Exam Results Report"
                    dateField="submitted_at"
                    showDateFilter={true}
                    showSearchFilter={false}
                    onFilterChange={(filters) => setExportFilters(filters)}
                  />
                </div>
                <div className="table-wrap">
                  <table className="ep-table">
                    <thead>
                      <tr>
                        <th>Exam</th>
                        <th>Score</th>
                        <th>Percentage</th>
                        <th>Time Taken</th>
                        <th>Submitted</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finalAllResults.map((res, idx) => {
                        const percentage = res.total_questions > 0 ? ((res.score / res.total_questions) * 100).toFixed(2) : 0;
                        const passed = Number(percentage) >= 60;
                        return (
                          <tr key={idx} className="row-hover">
                            <td className="cell-strong">{res.exam_title || 'Untitled Exam'}</td>
                            <td className="cell-strong">{res.score} / {res.total_questions}</td>
                            <td className="cell-strong" style={{ color: passed ? 'var(--ep-success)' : 'var(--ep-danger)' }}>{percentage}%</td>
                            <td>{res.time_taken ? `${Math.floor(res.time_taken / 60)}m ${res.time_taken % 60}s` : 'N/A'}</td>
                            <td>{new Date(res.submitted_at).toLocaleString('en-IN')}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button 
                                onClick={() => navigate(`/result/${res.attempt_id || res.id}`)} 
                                className="ep-btn ep-btn-outline"
                                style={{ padding: '6px 14px', fontSize: 12 }}
                              >
                                View Details
                              </button>
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
        </main>
      </div>
    );
  }

  if (error) return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <Sidebar active="results" onLogout={handleLogout} />
      <main className="dashboard-main ep-page">
        <div className="ep-page-header">
          <div>
            <div className="ep-kicker">Student Workspace</div>
            <h1>Error</h1>
            <p>Something went wrong while retrieving result information.</p>
          </div>
        </div>
        <Alert variant="danger" className="ep-alert-box">{error}</Alert>
        <div style={{ textAlign:'center', marginTop:24 }}>
          <button onClick={() => navigate('/dashboard')} className="ep-btn ep-btn-primary">
            Back to Dashboard
          </button>
        </div>
      </main>
    </div>
  );

  if (attemptId && !result) {
    return (
      <div style={{ display:'flex', minHeight:'100vh' }}>
        <Sidebar active="results" onLogout={handleLogout} />
        <main className="dashboard-main ep-page">
          <div className="ep-loading-card">
            <div className="spinner-border text-primary" role="status" />
            <div>Loading result details...</div>
          </div>
        </main>
      </div>
    );
  }

  // ─── Single Result Details ───────────────────────────────────────────────
  const total = result?.total_questions ?? 0;
  
  let calculatedAttempted = 0;
  if (result?.answers && Array.isArray(result.answers)) {
    calculatedAttempted = result.answers.filter(a => {
      const ans = a.student_answer;
      return ans != null && ans !== '' && ans !== 'null' && ans !== 'undefined';
    }).length;
  }
  
  const attempted = calculatedAttempted > 0 ? calculatedAttempted : (result?.attempted ?? 0);
  const unanswered = total - attempted;
  const completion = total > 0 ? Math.round((attempted / total) * 100) : 0;
  const score = result?.score ?? 0;

  const submittedDate = result.submitted_at ? new Date(result.submitted_at) : new Date();
  const dateFormatted = submittedDate.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  const timeFormatted = submittedDate.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
  
  const timeTakenSec = result?.time_taken || 0;
  const timeTakenFormatted = timeTakenSec > 0 
    ? `${Math.floor(timeTakenSec / 60)}m ${timeTakenSec % 60}s` 
    : 'N/A';

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <Sidebar active="results" onLogout={handleLogout} />
      
      <main className="dashboard-main ep-page" style={{ overflowY:'auto', flex: 1 }}>
        <div className="ep-page-header">
          <div>
            <div className="ep-kicker">Assessment Report</div>
            <h1>Exam Result</h1>
            <p>Submission summary and analytical scorecard.</p>
          </div>
          <div className="ep-user-chip">
            <div className="avatar">{studentInitial}</div>
            <div>
              <strong>{studentName}</strong>
              <span>{studentEmail}</span>
            </div>
          </div>
        </div>

        {/* ── Termination / Auto-submit banners ── */}
        {locationState.terminated && (
          <div style={{ margin:'16px 0', background:'var(--ep-danger-soft)', border:'1px solid #fee2e2', borderRadius:10, padding:16, display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:28 }}>⚠️</span>
            <div>
              <strong style={{ color:'var(--ep-danger)', fontSize: 15 }}>Exam Terminated</strong>
              <div style={{ fontSize:13, color:'var(--ep-ink-2)', marginTop:4 }}>{locationState.terminationReason || 'Exam was terminated due to policy violation'}</div>
            </div>
          </div>
        )}
        {locationState.autoSubmitted && (
          <div style={{ margin:'16px 0', background:'var(--ep-info-soft)', border:'1px solid #bae6fd', borderRadius:10, padding:16, display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:28 }}>⏱️</span>
            <div>
              <strong style={{ color:'var(--ep-info)', fontSize: 15 }}>Auto-Submitted</strong>
              <div style={{ fontSize:13, color:'var(--ep-ink-2)', marginTop:4 }}>{locationState.reason || 'Exam was automatically submitted when time expired'}</div>
            </div>
          </div>
        )}

        {/* ── Main Scorecard ── */}
        <div className="result-card ep-card" style={{ maxWidth: 720, margin:'24px auto', padding: 32 }}>

          {/* Success Icon */}
          <div style={{ textAlign:'center', marginBottom: 24 }}>
            <div style={{
              width: 58, height: 58, borderRadius:'50%',
              background: 'var(--ep-success-soft)',
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              marginBottom: 12
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ep-success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 style={{ fontWeight: 800, color:'var(--ep-ink)', marginBottom: 4 }}>Exam Completed Successfully!</h3>
            <p style={{ color: 'var(--ep-muted)', fontSize: 13.5 }}>Your answers have been securely logged and analyzed.</p>
          </div>

          {/* Score Circle / Hero */}
          <div style={{
            textAlign: 'center',
            background: 'linear-gradient(135deg, var(--ep-brand-soft), #fff)',
            padding: '24px',
            borderRadius: 14,
            marginBottom: 24,
            border: '1px solid var(--ep-line)'
          }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, color: 'var(--ep-muted)' }}>Analytical Score</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: 'var(--ep-brand)', margin: '4px 0' }}>
              {score} / {total}
            </div>
            <span className="ep-badge ep-badge-info" style={{ fontWeight: 700, fontSize: 12 }}>
              {total > 0 ? ((score / total) * 100).toFixed(1) : 0}% Correct Rate
            </span>
          </div>

          {/* Stats Pills Grid */}
          <div className="ep-grid ep-grid-4" style={{ marginBottom: 24 }}>
            <div className="ep-stat-card" style={{ padding: 14 }}>
              <div className="ep-stat-label">Total Qs</div>
              <div className="ep-stat-value" style={{ fontSize: 18 }}>{total}</div>
            </div>
            <div className="ep-stat-card" style={{ padding: 14 }}>
              <div className="ep-stat-label" style={{ color: 'var(--ep-success)' }}>Correct</div>
              <div className="ep-stat-value" style={{ fontSize: 18, color: 'var(--ep-success)' }}>{score}</div>
            </div>
            <div className="ep-stat-card" style={{ padding: 14 }}>
              <div className="ep-stat-label" style={{ color: 'var(--ep-warning)' }}>Attempted</div>
              <div className="ep-stat-value" style={{ fontSize: 18, color: 'var(--ep-warning)' }}>{attempted}</div>
            </div>
            <div className="ep-stat-card" style={{ padding: 14 }}>
              <div className="ep-stat-label" style={{ color: 'var(--ep-danger)' }}>Skipped</div>
              <div className="ep-stat-value" style={{ fontSize: 18, color: 'var(--ep-danger)' }}>{unanswered}</div>
            </div>
          </div>

          {/* Info list */}
          <div style={{ background:'var(--ep-surface-2)', borderRadius:10, padding:'8px 18px', marginBottom: 24, border: '1px solid var(--ep-line)' }}>
            {[
              { label:'Candidate', value: studentName },
              { label:'Email Address', value: studentEmail },
              { label:'Exam Paper', value: result.exam_title },
              { label:'Exam Code', value: result.exam_code || 'N/A' },
              { label:'Submitted On', value: `${dateFormatted} at ${timeFormatted}` },
              { label:'Duration Used', value: timeTakenFormatted },
            ].map(({ label, value }) => (
              <div key={label} style={{ display:'flex', justifyContent: 'space-between', padding:'10px 0', borderBottom:'1px solid var(--ep-line)' }}>
                <span style={{ fontWeight: 600, color:'var(--ep-muted)', fontSize:13 }}>{label}</span>
                <span style={{ color:'var(--ep-ink-2)', fontSize:13, fontWeight: 700 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Action Buttons / Locked Notice */}
          {isAnswerKeyLocked ? (
            <div style={{ textAlign: 'center', background: 'var(--ep-warning-soft)', border: '1px solid #fde68a', borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
              <h5 style={{ fontWeight: 800, color: 'var(--ep-warning)', margin: '0 0 6px' }}>Detailed Answer Key Locked</h5>
              <p style={{ color: 'var(--ep-ink-2)', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>
                To maintain academic fairness, details are locked while the exam is still ongoing. The answers will unlock automatically once the exam deadline passes.
              </p>
              <div className="ep-badge ep-badge-warning" style={{ marginBottom: 20 }}>
                ⏳ Releases after: {new Date(examDeadline).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
              <div>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="ep-btn ep-btn-primary"
                  style={{ padding: '10px 24px' }}
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', gap: 10, flexWrap:'wrap', justifyContent:'center' }}>
              <button
                onClick={() => navigate('/dashboard')}
                className="ep-btn ep-btn-primary"
                style={{ padding: '10px 20px' }}
              >
                Back to Dashboard
              </button>
              <button
                onClick={downloadAnswerKey}
                className="ep-btn ep-btn-outline"
                style={{ padding: '10px 20px', color: 'var(--ep-success)', borderColor: 'var(--ep-success-soft)' }}
              >
                Download Answer Key
              </button>
              <button
                onClick={printReport}
                className="ep-btn ep-btn-outline"
                style={{ padding: '10px 20px' }}
              >
                Print Report
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ResultPage;
