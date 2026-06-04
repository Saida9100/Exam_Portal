/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import SharedAdminSidebar from './SharedAdminSidebar';

const ANSWER_OPTIONS = ['A', 'B', 'C', 'D'];

const CreateExam = () => {
  
  const navigate = useNavigate();
  const user = apiService.getUser();

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [totalQuestions, setTotalQuestions] = useState('');
  const [optionsPerQuestion, setOptionsPerQuestion] = useState('4');
  const [duration, setDuration] = useState('');
  const [deadline, setDeadline] = useState('');
  const [showDeadline, setShowDeadline] = useState(false);

  // PDF states
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfSize, setPdfSize] = useState(0);

  // Answer key state: { "1": "A", "2": "C", ... }
  const [answerKey, setAnswerKey] = useState({});

  // UI states
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Success modal state
  const [createdExamCode, setCreatedExamCode] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdExamTitle, setCreatedExamTitle] = useState('');

  const handleLogout = () => {
    apiService.logout();
  };

  const handlePdfChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file only');
      setPdfFile(null);
      e.target.value = '';
      return;
    }
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File size must be less than 10MB');
      setPdfFile(null);
      e.target.value = '';
      return;
    }
    setPdfFile(file);
    setPdfFileName(file.name);
    setPdfSize(file.size);
    setError('');
  };

  const removePdf = () => {
    setPdfFile(null);
    setPdfFileName('');
    setPdfSize(0);
    const input = document.getElementById('pdf-input');
    if (input) input.value = '';
  };

  // Reset answer key when totalQuestions changes
  useEffect(() => {
    setAnswerKey({});
  }, [totalQuestions]);

  const setAnswer = (qNum, option) => {
    setAnswerKey(prev => ({ ...prev, [String(qNum)]: option }));
  };

  const quickSetAll = (option) => {
    const n = parseInt(totalQuestions) || 0;
    const newKey = {};
    for (let i = 1; i <= n; i++) newKey[String(i)] = option;
    setAnswerKey(newKey);
  };

  const clearAllAnswers = () => setAnswerKey({});

  const answeredCount = Object.keys(answerKey).length;
  const totalQ = parseInt(totalQuestions) || 0;
  const allAnswered = totalQ > 0 && answeredCount === totalQ;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) { setError('Please enter exam title'); return; }
    if (!pdfFile) { setError('Please upload a PDF file'); return; }
    if (!totalQuestions || parseInt(totalQuestions) < 1) { setError('Please enter number of questions (minimum 1)'); return; }
    if (!duration || parseInt(duration) < 1) { setError('Please enter exam duration (minimum 1 minute)'); return; }
    if (!allAnswered) {
      setError(`Please set answers for all ${totalQ} questions in the Answer Key section.`);
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('total_questions', parseInt(totalQuestions));
      formData.append('duration', parseInt(duration));
      formData.append('deadline', showDeadline ? deadline : '');
      formData.append('pdf_file', pdfFile, pdfFile.name);
      formData.append('answer_key', JSON.stringify(answerKey));

      const data = await apiService.request('/api/exams/create-with-pdf', {
        method: 'POST',
        body: formData
      });

      setCreatedExamCode(data.exam_code || data?.exam?.exam_code);
      setCreatedExamTitle(data.title || title?.trim() || data?.exam?.title || "");
      setShowSuccessModal(true);

      // Reset form
      setTitle('');
      setDescription('');
      setTotalQuestions('');
      setDuration('');
      setDeadline('');
      setShowDeadline(false);
      setAnswerKey({});
      removePdf();

    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const totalQArray = totalQ > 0 ? Array.from({ length: totalQ }, (_, i) => i + 1) : [];

  // -------- SUCCESS MODAL --------
  if (showSuccessModal) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f7fa' }}>
        <SharedAdminSidebar active="create" />

        {/* Success Card */}
        <div style={{ marginLeft: 220, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div style={{
            background: '#fff', borderRadius: 20, padding: 56, maxWidth: 540, width: '100%',
            boxShadow: '0 8px 40px rgba(0,0,0,0.12)', textAlign: 'center'
          }}>
            {/* Check icon */}
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(135deg, #43e97b, #38f9d7)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36, marginBottom: 20, boxShadow: '0 4px 20px rgba(67,233,123,0.35)'
            }}>✓</div>

            <h2 style={{ fontSize: 26, fontWeight: 800, color: '#1a1a2e', marginBottom: 8 }}>
              Exam Created Successfully!
            </h2>
            <p style={{ color: '#888', fontSize: 15, marginBottom: 32 }}>
              Share this code with your students so they can enter the exam.
            </p>

            {/* Code display */}
            <div style={{
              background: 'linear-gradient(135deg, #2D0040, #4a0070)',
              borderRadius: 16, padding: '28px 40px', marginBottom: 32,
              boxShadow: '0 4px 20px rgba(45,0,64,0.3)'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 3, marginBottom: 10 }}>
                EXAM CODE
              </div>
              <div style={{
                fontSize: 40, fontWeight: 900, color: '#fff', letterSpacing: 6,
                fontFamily: 'monospace'
              }}>
                {createdExamCode}
              </div>
            </div>

            <div style={{ color: '#666', fontSize: 14, marginBottom: 32 }}>
              Exam: <strong style={{ color: '#2D0040' }}>{createdExamTitle}</strong>
            </div>

            {/* Copy button */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdExamCode);
                alert('Exam code copied to clipboard!');
              }}
              style={{
                display: 'block', width: '100%', padding: '13px',
                background: 'rgba(45,0,64,0.08)', border: '2px dashed #764ba2',
                borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#764ba2',
                cursor: 'pointer', marginBottom: 16, transition: 'all 0.2s'
              }}
            >
              📋 Copy Code to Clipboard
            </button>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button
                onClick={() => setShowSuccessModal(false)}
                style={{
                  flex: 1, padding: '14px',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700,
                  color: '#fff', cursor: 'pointer', boxShadow: '0 4px 15px rgba(102,126,234,0.4)'
                }}
              >
                + Create Another Exam
              </button>
              <button
                onClick={() => navigate(user?.role === 'super_admin' ? '/superadmin' : '/admin')}
                style={{
                  flex: 1, padding: '14px',
                  background: '#fff', border: '2px solid #ddd', borderRadius: 12,
                  fontSize: 15, fontWeight: 600, color: '#555', cursor: 'pointer'
                }}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------- MAIN FORM --------
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f7fa' }}>
      <SharedAdminSidebar active="create" />

      {/* Main Content */}
      <div style={{ flex: 1, overflowX: 'hidden' }}>
        {/* Header */}
        <div style={{
          background: '#fff', padding: '18px 32px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, zIndex: 100
        }}>
          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>Create New Exam</h3>
          <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 14, color: '#5B0A7B', fontWeight: 600 }}>{user?.email}</div>
            <div className="user-avatar" style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #5B0A7B, #2D0040)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 15 }}>
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{ padding: '28px 32px', display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, maxWidth: 1200, margin: '0 auto' }}>

          {/* LEFT: Form */}
          <div>
            {/* Error */}
            {error && (
              <div style={{
                background: '#ffebee', border: '2px solid #f44336', borderRadius: 12,
                padding: '14px 20px', marginBottom: 20, color: '#c62828', fontWeight: 600,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span>{error}</span>
                <button onClick={() => setError('')} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#c62828', padding: 0 }}>×</button>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Card: Exam Details */}
              <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: '#2D0040' }}>📝 Exam Details</h4>

                {/* Title */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13, color: '#555' }}>
                    EXAM TITLE <span style={{ color: '#f44336' }}>*</span>
                  </label>
                  <input
                    type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Data Structures Mid-Term Exam" disabled={loading}
                    style={{ width: '100%', padding: '11px 14px', fontSize: 14, border: '2px solid #e0e0e0', borderRadius: 10, outline: 'none', transition: 'border 0.3s', boxSizing: 'border-box' }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                  />
                </div>

                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13, color: '#555' }}>
                      TOTAL QUESTIONS <span style={{ color: '#f44336' }}>*</span>
                    </label>
                    <input
                      type="number" value={totalQuestions} onChange={(e) => setTotalQuestions(e.target.value)}
                      min="1" max="200" placeholder="e.g., 10" disabled={loading}
                      style={{ width: '100%', padding: '11px 14px', fontSize: 14, border: '2px solid #e0e0e0', borderRadius: 10, outline: 'none', transition: 'border 0.3s', boxSizing: 'border-box' }}
                      onFocus={(e) => e.target.style.borderColor = '#667eea'}
                      onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13, color: '#555' }}>
                      OPTIONS PER QUESTION
                    </label>
                    <select
                      value={optionsPerQuestion} onChange={(e) => setOptionsPerQuestion(e.target.value)}
                      disabled={loading}
                      style={{ width: '100%', padding: '11px 14px', fontSize: 14, border: '2px solid #e0e0e0', borderRadius: 10, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                    >
                      <option value="4">4 (A, B, C, D)</option>
                      <option value="3">3 (A, B, C)</option>
                      <option value="2">2 (A, B)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13, color: '#555' }}>
                      DURATION (MINUTES) <span style={{ color: '#f44336' }}>*</span>
                    </label>
                    <input
                      type="number" value={duration} onChange={(e) => setDuration(e.target.value)}
                      min="1" max="300" placeholder="e.g., 60" disabled={loading}
                      style={{ width: '100%', padding: '11px 14px', fontSize: 14, border: '2px solid #e0e0e0', borderRadius: 10, outline: 'none', transition: 'border 0.3s', boxSizing: 'border-box' }}
                      onFocus={(e) => e.target.style.borderColor = '#667eea'}
                      onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                    />
                  </div>
                </div>

                {/* Deadline toggle */}
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13, color: '#555' }}>
                    DEADLINE (OPTIONAL)
                  </label>
                  {!showDeadline ? (
                    <button type="button" onClick={() => setShowDeadline(true)} style={{
                      padding: '10px 20px', background: '#f0f4ff', border: '2px dashed #667eea',
                      borderRadius: 10, color: '#667eea', fontWeight: 600, fontSize: 13, cursor: 'pointer'
                    }}>
                      📅 Click to Set Deadline
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)} disabled={loading}
                        style={{ flex: 1, padding: '11px 14px', fontSize: 14, border: '2px solid #e0e0e0', borderRadius: 10, outline: 'none', boxSizing: 'border-box' }}
                      />
                      <button type="button" onClick={() => { setShowDeadline(false); setDeadline(''); }} style={{
                        padding: '11px 16px', background: '#ffebee', border: 'none', borderRadius: 10,
                        color: '#c62828', fontWeight: 600, fontSize: 13, cursor: 'pointer'
                      }}>✕</button>
                    </div>
                  )}
                  <small style={{ color: '#aaa', fontSize: 12, marginTop: 5, display: 'block' }}>Leave empty for no deadline</small>
                </div>
              </div>

              {/* Card: PDF Upload */}
              <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: 20 }}>
                <div
                  onClick={() => !loading && document.getElementById('pdf-input').click()}
                  style={{
                    border: pdfFile ? '3px solid #4caf50' : '3px dashed #667eea',
                    borderRadius: 14, padding: pdfFile ? 24 : 40, textAlign: 'center',
                    background: pdfFile ? '#e8f5e9' : '#f8f9ff',
                    cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.3s'
                  }}
                >
                  <input id="pdf-input" type="file" accept=".pdf,application/pdf"
                    onChange={handlePdfChange} style={{ display: 'none' }} disabled={loading} />

                  {pdfFile ? (
                    <div>
                      <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#2e7d32', marginBottom: 4 }}>{pdfFileName}</div>
                      <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>Size: {(pdfSize / 1024 / 1024).toFixed(2)} MB</div>
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                        <button type="button" onClick={(e) => { e.stopPropagation(); document.getElementById('pdf-input').click(); }} disabled={loading}
                          style={{ padding: '8px 20px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                          🔄 Change
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); removePdf(); }} disabled={loading}
                          style={{ padding: '8px 20px', background: '#f44336', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                          🗑️ Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 56, marginBottom: 12 }}>📤</div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>Click here to upload PDF</div>
                      <div style={{ fontSize: 13, color: '#999' }}>Max 10MB · PDF only</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card: Answer Key */}
              {totalQ > 0 && (
                <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#2D0040' }}>🔑 Answer Key</h4>
                      <div style={{ fontSize: 13, color: '#888', marginTop: 3 }}>
                        {answeredCount} of {totalQ} answers set
                        {allAnswered && <span style={{ color: '#4caf50', marginLeft: 8, fontWeight: 600 }}>✓ Complete</span>}
                      </div>
                    </div>
                    {/* Progress */}
                    <div style={{ width: 120, height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${totalQ > 0 ? (answeredCount / totalQ) * 100 : 0}%`, height: '100%', background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                  </div>

                  {/* Quick set buttons */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#888', alignSelf: 'center', fontWeight: 600 }}>Quick Set:</span>
                    {ANSWER_OPTIONS.slice(0, parseInt(optionsPerQuestion)).map(opt => (
                      <button key={opt} type="button" onClick={() => quickSetAll(opt)}
                        style={{
                          padding: '5px 16px', border: '2px solid #667eea', borderRadius: 20,
                          background: '#f0f4ff', color: '#667eea', fontWeight: 700, fontSize: 13, cursor: 'pointer'
                        }}>
                        All {opt}
                      </button>
                    ))}
                    <button type="button" onClick={clearAllAnswers}
                      style={{
                        padding: '5px 16px', border: '2px solid #f44336', borderRadius: 20,
                        background: '#ffebee', color: '#f44336', fontWeight: 700, fontSize: 13, cursor: 'pointer'
                      }}>
                      Clear All
                    </button>
                  </div>

                  {/* Grid */}
                  <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid #eee', borderRadius: 10 }}>
                    {/* Header */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '60px repeat(4, 1fr) 60px',
                      background: '#f8f9fa', padding: '10px 16px',
                      position: 'sticky', top: 0, zIndex: 1,
                      borderBottom: '1px solid #e0e0e0', fontWeight: 700, fontSize: 12, color: '#555'
                    }}>
                      <div>Q.NO</div>
                      {ANSWER_OPTIONS.slice(0, parseInt(optionsPerQuestion)).map(o => <div key={o} style={{ textAlign: 'center' }}>{o}</div>)}
                      {parseInt(optionsPerQuestion) < 4 && Array.from({ length: 4 - parseInt(optionsPerQuestion) }).map((_, i) => <div key={i} />)}
                      <div style={{ textAlign: 'center' }}>STATUS</div>
                    </div>

                    {/* Rows */}
                    {totalQArray.map(qNum => {
                      const selected = answerKey[String(qNum)];
                      return (
                        <div key={qNum} style={{
                          display: 'grid', gridTemplateColumns: '60px repeat(4, 1fr) 60px',
                          padding: '8px 16px', borderBottom: '1px solid #f0f0f0',
                          background: selected ? '#fafbff' : '#fff',
                          alignItems: 'center', transition: 'background 0.15s'
                        }}>
                          {/* Q number */}
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: selected ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#eee',
                            color: selected ? '#fff' : '#999',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: 12
                          }}>{qNum}</div>

                          {/* Option buttons */}
                          {ANSWER_OPTIONS.slice(0, parseInt(optionsPerQuestion)).map(opt => (
                            <div key={opt} style={{ display: 'flex', justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={() => setAnswer(qNum, selected === opt ? null : opt)}
                                style={{
                                  width: 34, height: 34, borderRadius: '50%',
                                  border: selected === opt ? '2px solid #764ba2' : '2px solid #ddd',
                                  background: selected === opt ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#fff',
                                  color: selected === opt ? '#fff' : '#666',
                                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                                  transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                              >
                                {opt}
                              </button>
                            </div>
                          ))}
                          {/* Spacers for unused options */}
                          {parseInt(optionsPerQuestion) < 4 && Array.from({ length: 4 - parseInt(optionsPerQuestion) }).map((_, i) => <div key={i} />)}

                          {/* Status */}
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            {selected
                              ? <span style={{ color: '#4caf50', fontWeight: 700, fontSize: 18 }}>✓</span>
                              : <span style={{ color: '#ddd', fontSize: 18 }}>○</span>
                            }
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Submit */}
              <div style={{ display: 'flex', gap: 14 }}>
                <button
                  type="submit"
                  disabled={loading || !pdfFile || !title || !totalQ || !duration || !allAnswered}
                  style={{
                    flex: 1, padding: '15px 32px', fontSize: 15, fontWeight: 700, color: '#fff',
                    background: (loading || !pdfFile || !allAnswered) ? '#ccc' : 'linear-gradient(135deg, #667eea, #764ba2)',
                    border: 'none', borderRadius: 12,
                    cursor: (loading || !pdfFile || !allAnswered) ? 'not-allowed' : 'pointer',
                    boxShadow: (loading || !pdfFile || !allAnswered) ? 'none' : '0 4px 15px rgba(102,126,234,0.4)',
                    transition: 'all 0.2s'
                  }}
                >
                  {loading ? '⏳ Creating Exam...' : allAnswered ? '✅ Create Exam' : `⚠️ Set ${totalQ - answeredCount} more answer${totalQ - answeredCount !== 1 ? 's' : ''}`}
                </button>
                <button type="button" onClick={() => navigate('/admin')} disabled={loading}
                  style={{ padding: '15px 28px', fontSize: 15, fontWeight: 600, color: '#666', background: '#fff', border: '2px solid #ddd', borderRadius: 12, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>

          {/* RIGHT: Preview Panel */}
          <div style={{ position: 'sticky', top: 80 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#2D0040' }}>Exam Preview</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                {[
                  { label: 'QUESTIONS', value: totalQ || '—' },
                  { label: 'DURATION', value: duration ? `${duration} min` : '—' },
                  { label: 'OPTIONS', value: `${optionsPerQuestion} options` },
                  { label: 'PDF', value: pdfFile ? '✓' : '✗' },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: 'center', padding: '10px 8px', background: '#f8f9fa', borderRadius: 10 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#2D0040' }}>{item.value}</div>
                    <div style={{ fontSize: 10, color: '#aaa', fontWeight: 600, marginTop: 2 }}>{item.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center', padding: '10px', background: '#f8f9fa', borderRadius: 10, fontSize: 13 }}>
                <div style={{ fontSize: 10, color: '#aaa', fontWeight: 600, marginBottom: 4 }}>ANSWER KEYS</div>
                <div style={{ fontWeight: 800, color: '#2D0040', fontSize: 18 }}>{answeredCount}/{totalQ || '—'}</div>
              </div>

              <button
                type="submit"
                form="create-exam-form"
                disabled={loading || !pdfFile || !title || !totalQ || !duration || !allAnswered}
                onClick={handleSubmit}
                style={{
                  width: '100%', marginTop: 16, padding: '13px',
                  background: allAnswered && pdfFile && title ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#e0e0e0',
                  border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
                  color: allAnswered && pdfFile && title ? '#fff' : '#999',
                  cursor: allAnswered && pdfFile && title ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s'
                }}
              >
                {loading ? '⏳ Creating...' : 'Create Exam'}
              </button>
            </div>

            {/* Exam code preview hint */}
            <div style={{ background: 'linear-gradient(135deg, #2D0040, #4a0070)', borderRadius: 14, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>EXAM CODE</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: 'rgba(255,255,255,0.25)', letterSpacing: 5, fontFamily: 'monospace' }}>????????</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>Auto-generated on creation</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateExam;
