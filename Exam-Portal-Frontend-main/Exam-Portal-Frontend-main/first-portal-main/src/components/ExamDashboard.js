/* eslint-disable */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Modal, Alert } from 'react-bootstrap';
import apiService from '../services/api';
import PdfViewer from './PdfViewer';
import PreExamCheck from './proctoring/PreExamCheck';
import ProctorEngine from './proctoring/ProctorEngine';

const TimerDisplay = ({ initialTimeLeft, onTimeUp }) => {
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft);
  const onTimeUpRef = useRef(onTimeUp);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  useEffect(() => {
    if (initialTimeLeft <= 0) return;
    
    const endTime = Date.now() + initialTimeLeft * 1000;
    
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        clearInterval(timer);
        onTimeUpRef.current();
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [initialTimeLeft]);

  const h = Math.floor(timeLeft / 3600);
  const m = Math.floor((timeLeft % 3600) / 60);
  const sec = timeLeft % 60;
  const formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;

  return (
    <div className={`timer-value ${timeLeft < 300 ? 'timer-warning' : ''}`}>
      {formatted}
    </div>
  );
};

const ExamDashboard = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const student = apiService.getUser();

  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);

  // DB-question mode state
  const [currentQ, setCurrentQ] = useState(0);

  // Unified answer state
  const [answers, setAnswers] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [examTerminated, setExamTerminated] = useState(false);

  // Proctoring states
  const [preCheckPassed, setPreCheckPassed] = useState(false);
  const [violations, setViolations] = useState([]);
  const [proctorReady, setProctorReady] = useState(false);

  const [mobileDetectCount, setMobileDetectCount] = useState(0);
  const [missingFaceCount, setMissingFaceCount] = useState(0);
  const [audioViolationCount, setAudioViolationCount] = useState(0);
  const [multipleFaceCount, setMultipleFaceCount] = useState(0);
  const [warningType, setWarningType] = useState('Tab Switch');
  const MAX_MOBILE_WARNINGS = 3;
  const MAX_MISSING_FACE_WARNINGS = 3;
  const MAX_AUDIO_WARNINGS = 3;
  const MAX_MULTIPLE_FACE_WARNINGS = 3;
  const MAX_TAB_SWITCHES = 3;

  const violationCountsRef = useRef({
    'Mobile Phone Detection': 0,
    'No Face Detected': 0,
    'Audio Violation': 0,
    'Multiple Person Detection': 0,
    'Tab Switch': 0,
  });
  const lastViolationTimesRef = useRef({});
  const violationsListRef = useRef([]);



  // ✅ FIXED: Fetch exam data correctly
  useEffect(() => {
    fetchExamData();
  }, [examId]);

  const fetchExamData = async () => {
  try {
    setLoading(true);
    setError('');

    console.log('📝 Fetching exam data for ID:', examId);
    
    // Get exam details
    const examData = await apiService.getExamQuestions(examId);
    
    if (!examData || !examData.exam) {
      setError('Exam not found');
      setLoading(false);
      return;
    }

    console.log('✅ Got exam:', examData.exam);
    
    // Check if student has already joined
    if (examData.submission) {
      console.log('✅ Already joined:', examData.submission);
    } else {
      // Try to auto-join using exam code
      const examCode = examData.exam.exam_code;
      console.log('📝 Auto-joining exam with code:', examCode);
      
      try {
        await apiService.joinExam(examCode);
        console.log('✅ Auto-joined successfully');
      } catch (joinError) {
        console.error('⚠️ Join failed:', joinError.message);
        if (joinError.message?.includes('must join')) {
          setError('Please use the exam code to join first');
          setLoading(false);
          return;
        }
      }
    }
    
    setExam(examData.exam);
    setQuestions(examData.questions || []);

    console.log('✅ Exam ready');

  } catch (err) {
    console.error('❌ Error:', err);
    setError(err.message || 'Failed to load exam');
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    if (exam && exam.pdf_url) {
      if (exam.pdf_url.startsWith('data:application/pdf;base64,')) {
        try {
          const base64Data = exam.pdf_url.split(',')[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(blob);
          setPdfBlobUrl(blobUrl);
          
          return () => {
            URL.revokeObjectURL(blobUrl);
          };
        } catch (e) {
          console.error('Failed to convert base64 to blob:', e);
          setPdfBlobUrl(exam.pdf_url);
        }
      } else {
        setPdfBlobUrl(exam.pdf_url);
      }
    }
  }, [exam]);

  const isPdfMode = exam && exam.pdf_url;
  const totalQ = isPdfMode ? exam.total_questions : questions.length;

  const getKey = (indexOrId) => String(indexOrId);

  const saveAnswerToBackend = async (key, answer) => {
    try {
      if (isPdfMode) {
        await apiService.saveAnswer(parseInt(examId), {
          exam_id: parseInt(examId),
          question_number: parseInt(key),
          answer,
        });
      } else {
        await apiService.saveAnswer(parseInt(examId), {
          exam_id: parseInt(examId),
          question_id: parseInt(key),
          answer,
        });
      }
    } catch (err) {
      console.error('Failed to save answer:', err);
    }
  };

  const toggleOption = async (key, optionValue) => {
    if (answers[key] === optionValue) {
      const updated = { ...answers };
      delete updated[key];
      setAnswers(updated);
    } else {
      setAnswers({ ...answers, [key]: optionValue });
      await saveAnswerToBackend(key, optionValue);
    }
  };

  const buildFormattedAnswers = useCallback((currentExam, currentAnswers) => {
    const currentIsPdfMode = currentExam && currentExam.pdf_url;
    if (currentIsPdfMode) {
      return Object.keys(currentAnswers).map(qNum => ({
        question_number: parseInt(qNum),
        answer: currentAnswers[qNum],
      }));
    } else {
      return Object.keys(currentAnswers).map(qId => ({
        question_id: parseInt(qId),
        answer: currentAnswers[qId],
      }));
    }
  }, []);

  const handleForceSubmit = useCallback(async (reasonStr) => {
    if (submitted || submitting) return;
    setExamTerminated(true);
    setSubmitting(true);
    try {
      const timeTaken = examStartTimeRef.current ? Math.min(exam.duration * 60, Math.floor((Date.now() - examStartTimeRef.current) / 1000)) : 0;
      
      // Inject termination reason as a final violation log
      const finalViolations = [...violationsListRef.current];
      if (reasonStr) {
        finalViolations.push({
          type: 'Exam Terminated',
          severity: 'Critical',
          message: `Auto-submitted due to: ${reasonStr}`,
          timestamp: Date.now()
        });
      }

      const result = await apiService.submitExam(examId, buildFormattedAnswers(exam, answers), timeTaken, finalViolations);
      const attemptId = result?.attempt_id || result?.data?.attempt_id;
      navigate(`/result/${attemptId}`, {
        state: { terminated: true, terminationReason: reasonStr || 'Proctoring violation limit exceeded' },
      });
    } catch (err) {
      setError(err.message || 'Failed to submit exam');
      setSubmitting(false);
      setExamTerminated(false);
    }
  }, [examId, exam, answers, submitted, submitting, navigate, buildFormattedAnswers]);

  const handleViolation = useCallback((violation) => {
    const now = Date.now();
    const lastTime = lastViolationTimesRef.current[violation.type] || 0;
    
    // 5000ms debounce per violation type
    if (now - lastTime < 5000) return;
    
    lastViolationTimesRef.current[violation.type] = now;
    const newViolation = { ...violation, timestamp: now };
    
    // Update ref for synchronous access during force submits
    violationsListRef.current = [...violationsListRef.current, newViolation];
    
    // Update state for UI
    setViolations(violationsListRef.current);

    let maxLimit = 0;
    let currentCount = 0;

    if (violation.type === 'Mobile Phone Detection') {
      violationCountsRef.current['Mobile Phone Detection'] += 1;
      currentCount = violationCountsRef.current['Mobile Phone Detection'];
      setMobileDetectCount(currentCount);
      maxLimit = MAX_MOBILE_WARNINGS;
    } else if (violation.type === 'No Face Detected') {
      violationCountsRef.current['No Face Detected'] += 1;
      currentCount = violationCountsRef.current['No Face Detected'];
      setMissingFaceCount(currentCount);
      maxLimit = MAX_MISSING_FACE_WARNINGS;
    } else if (violation.type === 'Audio Violation') {
      violationCountsRef.current['Audio Violation'] += 1;
      currentCount = violationCountsRef.current['Audio Violation'];
      setAudioViolationCount(currentCount);
      maxLimit = MAX_AUDIO_WARNINGS;
    } else if (violation.type === 'Multiple Person Detection') {
      violationCountsRef.current['Multiple Person Detection'] += 1;
      currentCount = violationCountsRef.current['Multiple Person Detection'];
      setMultipleFaceCount(currentCount);
      maxLimit = MAX_MULTIPLE_FACE_WARNINGS;
    }

    if (maxLimit > 0) {
      if (currentCount >= maxLimit) {
        setWarningMessage(`${violation.message}\nLimit reached (${maxLimit} times).\nYour exam is now being auto-submitted.`);
        setWarningType(violation.type);
        setShowWarningModal(true);
        setTimeout(() => { setShowWarningModal(false); handleForceSubmit(`${violation.type} Limit Exceeded`); }, 3000);
      } else {
        const remaining = maxLimit - currentCount;
        setWarningMessage(`AI Proctoring Warning:\n\n${violation.message}\n\n${remaining} warning${remaining === 1 ? '' : 's'} remaining before auto-submission.`);
        setWarningType(violation.type);
        setShowWarningModal(true);
      }
    } else if (violation.type !== 'Tab/Window Focus Lost' && violation.type !== 'Tab Switched') {
      setWarningMessage(`AI Proctoring Warning:\n\n${violation.message}`);
      setWarningType(violation.type);
      setShowWarningModal(true);
    }
  }, [handleForceSubmit]);

  const handleAutoSubmit = useCallback(async () => {
    if (submitted || submitting) return;
    setSubmitting(true);
    try {
      const timeTaken = exam.duration * 60; // Max time taken
      const result = await apiService.submitExam(examId, buildFormattedAnswers(exam, answers), timeTaken, violationsListRef.current);
      const attemptId = result?.attempt_id || result?.data?.attempt_id;
      navigate(`/result/${attemptId}`, {
        state: { autoSubmitted: true, reason: 'Time expired' },
      });
    } catch (err) {
      setError(err.message || 'Failed to submit exam');
      setSubmitting(false);
    }
  }, [examId, exam, answers, submitted, submitting, navigate, buildFormattedAnswers]);

  const lastSwitchTimeRef = useRef(0);
  const examStartTimeRef = useRef(0);

  useEffect(() => {
    if (submitted || examTerminated || !preCheckPassed) return;
    
    // Set exam start time to ignore initial blurs from rendering transition
    if (examStartTimeRef.current === 0) {
      examStartTimeRef.current = Date.now();
    }

    const handleFocusLoss = (e) => {
      // Ignore events within the first 2 seconds of starting the exam
      if (Date.now() - examStartTimeRef.current < 2000) return;

      // If it's a blur event but document is hidden, it's a tab switch, handled by visibilitychange
      if (e.type === 'blur' && document.hidden) return;

      // Debounce: prevent double counting if events fire simultaneously
      const now = Date.now();
      if (now - lastSwitchTimeRef.current < 1000) return;
      lastSwitchTimeRef.current = now;

      const type = e.type === 'visibilitychange' ? 'Tab Switched' : 'Tab/Window Focus Lost';
      const msg = e.type === 'visibilitychange' ? 'You switched to another tab.' : 'You clicked outside the exam window.';

      // Log to AI Proctoring Violations
      handleViolation({ type, severity: 'High', message: msg });

      violationCountsRef.current['Tab Switch'] += 1;
      const newCount = violationCountsRef.current['Tab Switch'];
      setTabSwitchCount(newCount);

      if (newCount >= MAX_TAB_SWITCHES) {
        setWarningMessage(`You have lost focus / switched tabs ${MAX_TAB_SWITCHES} times. Your exam is now being auto-submitted.`);
        setWarningType('Tab Switch');
        setShowWarningModal(true);
        setTimeout(() => { setShowWarningModal(false); handleForceSubmit('Tab switch limit exceeded'); }, 3000);
      } else {
        const remaining = MAX_TAB_SWITCHES - newCount;
        setWarningMessage(`WARNING: You switched away from the exam tab!\n\nTab switch ${newCount} of ${MAX_TAB_SWITCHES}.\n\n${remaining} warning${remaining === 1 ? '' : 's'} remaining before auto-submission.`);
        setWarningType('Tab Switch');
        setShowWarningModal(true);
      }
    };

    const handleVisibilityChange = (e) => {
      if (document.hidden) {
        handleFocusLoss(e);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleFocusLoss);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleFocusLoss);
    };
  }, [submitted, examTerminated, handleForceSubmit, handleViolation, preCheckPassed]);

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  };

  if (loading) {
    return (
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', flexDirection:'column', gap:16 }}>
        <div className="spinner-border text-primary" role="status" style={{ width:60, height:60 }}>
          <span className="visually-hidden">Loading...</span>
        </div>
        <div style={{ fontSize:18, color:'#667eea', fontWeight:600 }}>Loading exam...</div>
      </div>
    );
  }

  if (error && !exam) {
    return (
      <div style={{ textAlign:'center', padding:80 }}>
        <div style={{ fontSize:64, marginBottom:16 }}>⚠️</div>
        <h3>Failed to Load Exam</h3>
        <p style={{ color:'#666', marginBottom:24 }}>{error}</p>
        <Button variant="primary" onClick={() => navigate('/exams')}>Back to Exams</Button>
      </div>
    );
  }

  // Pre-exam Environment Check
  if (!preCheckPassed) {
    return <PreExamCheck onComplete={() => setPreCheckPassed(true)} examTitle={exam?.title || 'Exam'} />;
  }

  if (!exam) {
    return (
      <div style={{ textAlign:'center', padding:80 }}>
        <div style={{ fontSize:64, marginBottom:16 }}>📝</div>
        <h3>Exam Not Found</h3>
        <Button variant="primary" onClick={() => navigate('/exams')}>Back to Exams</Button>
      </div>
    );
  }

  const confirmSubmit = async () => {
    setShowModal(false);
    setSubmitting(true);
    try {
      const timeTaken = examStartTimeRef.current ? Math.min(exam.duration * 60, Math.floor((Date.now() - examStartTimeRef.current) / 1000)) : 0;
      // Append violations to answers payload so it's saved in the attempt
      const result = await apiService.submitExam(examId, buildFormattedAnswers(exam, answers), timeTaken, violationsListRef.current);
      setSubmitted(true);
      const attemptId = result?.attempt_id || result?.data?.attempt_id;
      if (!attemptId) {
        throw new Error('Submission succeeded but no attempt ID returned. Please contact support.');
      }
      navigate(`/result/${attemptId}`);
    } catch (err) {
      setError(err.message || 'Failed to submit exam. Please try again.');
      setSubmitting(false);
    }
  };

  const attemptedCount = Object.keys(answers).length;
  const unanswered = totalQ - attemptedCount;

  const getWarningColor = () => {
    if (tabSwitchCount >= MAX_TAB_SWITCHES) return '#e53935';
    if (tabSwitchCount === 2) return '#ff9800';
    if (tabSwitchCount === 1) return '#ffc107';
    return 'transparent';
  };

  const renderOmrPanel = () => {
    const OPTIONS = ['A', 'B', 'C', 'D'];

    return (
      <div className="omr-panel">
        <div className="timer-box">
          <div className="timer-label">TIME REMAINING</div>
          {(!submitted && !examTerminated && exam && !loading) ? (
            <TimerDisplay initialTimeLeft={exam.duration * 60} onTimeUp={handleAutoSubmit} />
          ) : (
            <div className="timer-value">{formatTime(exam?.duration ? exam.duration * 60 : 0)}</div>
          )}
        </div>

        {tabSwitchCount > 0 && (
          <div className={`tab-warning-bar ${tabSwitchCount >= 2 ? 'critical' : ''}`}>
            <div className="tab-warning-icon">⚠️</div>
            <div className="tab-warning-text">
              <strong>Tab Switches: {tabSwitchCount}/{MAX_TAB_SWITCHES}</strong><br />
              <span>{MAX_TAB_SWITCHES - tabSwitchCount} remaining before auto-submit</span>
            </div>
          </div>
        )}

        <div className="omr-header">
          <h6>OMR Answer Sheet</h6>
          <span className="omr-count">{attemptedCount}/{totalQ} Answered</span>
        </div>
        <div className="omr-info-text">Click to select. Tap SAME option to deselect.</div>

        <div className="omr-sheet-container" style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '40px repeat(4, 1fr)',
            gap: 4,
            padding: '8px 12px 4px',
            borderBottom: '1px solid #e0e0e0',
            position: 'sticky',
            top: 0,
            background: '#fff',
            zIndex: 1,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textAlign: 'center' }}>Q.NO</div>
            {OPTIONS.map(opt => (
              <div key={opt} style={{ fontSize: 11, fontWeight: 700, color: '#888', textAlign: 'center' }}>{opt}</div>
            ))}
          </div>

          {Array.from({ length: totalQ }, (_, i) => {
            const qNum = i + 1;
            const key = isPdfMode ? getKey(qNum) : getKey(questions[i]?.id);
            const selected = answers[key];
            const isCurrentRow = false; // No longer using single question view

            return (
              <div
                key={qNum}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px repeat(4, 1fr)',
                  gap: 4,
                  padding: '5px 12px',
                  background: isCurrentRow ? '#f0f0ff' : (qNum % 2 === 0 ? '#fafafa' : '#fff'),
                  borderLeft: isCurrentRow ? '3px solid #667eea' : '3px solid transparent',
                  alignItems: 'center',
                }}
              >
                <div 
                  style={{ fontSize: 12, fontWeight: 700, color: '#2D0040', textAlign: 'center', cursor: 'pointer' }}
                  onClick={() => {
                    if (!isPdfMode) {
                      document.getElementById(`question-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  title="Click to scroll to question"
                >
                  {qNum}
                </div>
                {OPTIONS.map(opt => {
                  const isSel = selected === opt;
                  return (
                    <div
                      key={opt}
                      onClick={() => {
                        toggleOption(key, opt);
                      }}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: `2px solid ${isSel ? '#667eea' : '#ccc'}`,
                        background: isSel ? '#667eea' : '#fff',
                        color: isSel ? '#fff' : '#666',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        margin: '0 auto',
                        transition: 'all 0.15s',
                        userSelect: 'none',
                      }}
                    >
                      {opt}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="submit-section">
          <Button className="btn-submit-exam" onClick={() => setShowModal(true)} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Exam'}
          </Button>
        </div>
      </div>
    );
  };

  if (isPdfMode) {
    let pdfSrc = pdfBlobUrl || exam.pdf_url;
    
    // Only modify paths if it's not a blob or data URI
    if (!pdfSrc.startsWith('blob:') && !pdfSrc.startsWith('http://') && !pdfSrc.startsWith('https://') && !pdfSrc.startsWith('data:')) {
      // Relative path — prepend BACKEND URL (not frontend URL)
      if (!pdfSrc.startsWith('/')) pdfSrc = '/' + pdfSrc;
      pdfSrc = `https://exam-backend-eg8c.onrender.com${pdfSrc}`;
    }

    return (
      <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <ProctorEngine onViolation={handleViolation} isActive={!submitted && !examTerminated} onReady={() => setProctorReady(true)} />
        <div className="exam-header-bar">
          <h4>{exam.exam_code} &mdash; {student?.name || 'Student'}</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
              {attemptedCount} of {totalQ} Answered
            </span>
            {tabSwitchCount > 0 && (
              <div className="tab-switch-indicator" style={{ background: getWarningColor() }}>
                Tab Switches: {tabSwitchCount}/{MAX_TAB_SWITCHES}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '6px 16px', background: '#f8f9fa', borderBottom: '1px solid #e0e0e0', fontSize: 13, color: '#555' }}>
          Question Paper &mdash; {exam.title}
          <span style={{ float: 'right', color: '#667eea', fontWeight: 600 }}>{attemptedCount} of {totalQ} Answered</span>
        </div>

        {error && (
          <Alert variant="danger" style={{ margin: 8, borderRadius: 10 }}>{error}</Alert>
        )}

        <div className="exam-body" style={{ flex: 1, overflow: 'hidden' }}>
          <div className="question-panel" style={{ padding: 0 }}>
            <PdfViewer pdfSrc={pdfSrc} />
          </div>
          {renderOmrPanel()}
        </div>

        <SubmitModal
          showModal={showModal}
          setShowModal={setShowModal}
          confirmSubmit={confirmSubmit}
          submitting={submitting}
          totalQ={totalQ}
          attemptedCount={attemptedCount}
          unanswered={unanswered}
        />

        <GenericWarningModal 
          showWarningModal={showWarningModal} 
          setShowWarningModal={setShowWarningModal} 
          activeCount={
            warningType === 'Tab Switch' ? tabSwitchCount : 
            warningType === 'Mobile Phone Detection' ? mobileDetectCount : 
            warningType === 'No Face Detected' ? missingFaceCount : 
            warningType === 'Audio Violation' ? audioViolationCount : 
            warningType === 'Multiple Person Detection' ? multipleFaceCount : 0
          } 
          maxCount={
            warningType === 'Tab Switch' ? MAX_TAB_SWITCHES : 
            warningType === 'Mobile Phone Detection' ? MAX_MOBILE_WARNINGS : 
            warningType === 'No Face Detected' ? MAX_MISSING_FACE_WARNINGS : 
            warningType === 'Audio Violation' ? MAX_AUDIO_WARNINGS : 
            warningType === 'Multiple Person Detection' ? MAX_MULTIPLE_FACE_WARNINGS : 0
          } 
          warningMessage={warningMessage} 
          warningType={warningType}
        />
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>📭</div>
        <h3>No Questions Available</h3>
        <p style={{ color: '#666', marginBottom: 24 }}>This exam doesn't have any questions yet.</p>
        <Button variant="primary" onClick={() => navigate('/exams')}>Back to Exams</Button>
      </div>
    );
  }

  const currentQuestion = questions[0] || {}; // Fallback, no longer used for single render

  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <ProctorEngine onViolation={handleViolation} isActive={!submitted && !examTerminated} onReady={() => setProctorReady(true)} />
      <div className="exam-header-bar">
        <h4>{exam.title}</h4>
        {tabSwitchCount > 0 && (
          <div className="tab-switch-indicator" style={{ background: getWarningColor() }}>
            Tab Switches: {tabSwitchCount}/{MAX_TAB_SWITCHES}
          </div>
        )}
      </div>

      {error && <Alert variant="danger" style={{ margin: 16, borderRadius: 10 }}>{error}</Alert>}

      <div className="exam-body">
        <div className="question-panel">
          <div style={{ padding: 24, height: '100%', overflowY: 'auto', scrollBehavior: 'smooth' }}>
            {questions.map((q, idx) => {
              const isAns = answers[getKey(q.id)];
              const qText = q.question_text || q.text || `Question ${idx + 1}`;
              
              const optionKeys = ['A', 'B', 'C', 'D', 'E'];
              const displayOptions = optionKeys.map((opt, i) => {
                const flatKey = `option_${opt.toLowerCase()}`;
                const optText = q[flatKey] || (q.options && q.options[opt]);
                if (!optText) return null;
                
                const isSelected = answers[getKey(q.id)] === opt;
                return (
                  <label
                    key={opt}
                    style={{
                      display:'flex', alignItems:'center', padding:16,
                      border:`2px solid ${isSelected ? '#667eea' : '#e0e0e0'}`,
                      borderRadius:12, cursor:'pointer',
                      background: isSelected ? '#f8f9ff' : '#fff', transition:'all 0.3s',
                    }}
                    onClick={() => toggleOption(getKey(q.id), opt)}
                  >
                    <div style={{
                      width:24, height:24, borderRadius:'50%',
                      border:`2px solid ${isSelected ? '#667eea' : '#ccc'}`,
                      background: isSelected ? '#667eea' : '#fff',
                      marginRight:16, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
                    }}>
                      {isSelected && <div style={{ width:12, height:12, borderRadius:'50%', background:'#fff' }} />}
                    </div>
                    <div style={{ flex:1 }}>
                      <span style={{ fontWeight:600, marginRight:8, color: isSelected ? '#667eea' : '#333' }}>{opt}.</span>
                      <span style={{ color:'#333' }}>{optText}</span>
                    </div>
                  </label>
                );
              });

              return (
                <div key={q.id} id={`question-${idx}`} style={{ marginBottom: 40 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, paddingBottom:16, borderBottom:'2px solid #e0e0e0' }}>
                    <h5 style={{ margin:0, color:'#667eea', fontWeight:700 }}>Question {idx + 1} of {totalQ}</h5>
                    <span style={{
                      padding:'6px 16px',
                      background: isAns ? '#e8f5e9' : '#fff3e0',
                      color: isAns ? '#2e7d32' : '#f57f17',
                      borderRadius:20, fontSize:12, fontWeight:600
                    }}>
                      {isAns ? 'Answered' : 'Not Answered'}
                    </span>
                  </div>

                  <p style={{ fontSize:18, lineHeight:1.8, color:'#333', marginBottom:32, whiteSpace:'pre-wrap' }}>
                    {qText}
                  </p>

                  <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                    {displayOptions}
                  </div>
                </div>
              );
            })}

            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:32, paddingTop:24, borderTop:'2px solid #e0e0e0' }}>
              <Button variant="success" onClick={() => setShowModal(true)} disabled={submitting} style={{ borderRadius:10, padding:'10px 24px', fontWeight:600 }}>
                {submitting ? 'Submitting...' : 'Submit Exam'}
              </Button>
            </div>
          </div>
        </div>

        {renderOmrPanel()}
      </div>

      <SubmitModal showModal={showModal} setShowModal={setShowModal} confirmSubmit={confirmSubmit} submitting={submitting} totalQ={totalQ} attemptedCount={attemptedCount} unanswered={unanswered} />
      <GenericWarningModal 
        showWarningModal={showWarningModal} 
        setShowWarningModal={setShowWarningModal} 
        activeCount={
          warningType === 'Tab Switch' ? tabSwitchCount : 
          warningType === 'Mobile Phone Detection' ? mobileDetectCount : 
          warningType === 'No Face Detected' ? missingFaceCount : 
          warningType === 'Audio Violation' ? audioViolationCount : 
          warningType === 'Multiple Person Detection' ? multipleFaceCount : 0
        } 
        maxCount={
          warningType === 'Tab Switch' ? MAX_TAB_SWITCHES : 
          warningType === 'Mobile Phone Detection' ? MAX_MOBILE_WARNINGS : 
          warningType === 'No Face Detected' ? MAX_MISSING_FACE_WARNINGS : 
          warningType === 'Audio Violation' ? MAX_AUDIO_WARNINGS : 
          warningType === 'Multiple Person Detection' ? MAX_MULTIPLE_FACE_WARNINGS : 0
        } 
        warningMessage={warningMessage} 
        warningType={warningType}
      />
    </div>
  );
};

const SubmitModal = ({ showModal, setShowModal, confirmSubmit, submitting, totalQ, attemptedCount, unanswered }) => (
  <Modal show={showModal} onHide={() => setShowModal(false)} centered className="modal-confirm">
    <Modal.Header closeButton>
      <Modal.Title style={{ fontWeight:700, fontSize:18 }}>Confirm Submission</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <p style={{ color:'#555', marginBottom:16 }}>Are you sure you want to submit? You cannot change answers after submission.</p>
      <div className="summary-grid">
        <div className="summary-item"><div className="s-value">{totalQ}</div><div className="s-label">Total</div></div>
        <div className="summary-item"><div className="s-value" style={{ color:'#4caf50' }}>{attemptedCount}</div><div className="s-label">Attempted</div></div>
        <div className="summary-item"><div className="s-value" style={{ color:'#e53935' }}>{unanswered}</div><div className="s-label">Unanswered</div></div>
        <div className="summary-item">
          <div className="s-value" style={{ color:'#7B1FA2' }}>{Math.round((attemptedCount / Math.max(totalQ,1)) * 100)}%</div>
          <div className="s-label">Progress</div>
        </div>
      </div>
    </Modal.Body>
    <Modal.Footer>
      <Button variant="outline-secondary" onClick={() => setShowModal(false)} style={{ borderRadius:10, fontWeight:600, padding:'8px 24px' }} disabled={submitting}>Go Back</Button>
      <Button variant="danger" onClick={confirmSubmit} disabled={submitting} style={{ borderRadius:10, fontWeight:600, padding:'8px 24px' }}>
        {submitting ? 'Submitting...' : 'Yes, Submit'}
      </Button>
    </Modal.Footer>
  </Modal>
);

const GenericWarningModal = ({ showWarningModal, setShowWarningModal, activeCount, maxCount, warningMessage, warningType }) => {
  const isCritical = maxCount > 0 && activeCount >= maxCount;
  const isFinalWarning = maxCount > 0 && activeCount === maxCount - 1;
  const title = isCritical ? 'Exam Terminated!' : `Warning: ${warningType} Detected!`;

  return (
  <Modal show={showWarningModal} onHide={() => { if (!isCritical) setShowWarningModal(false); }} centered backdrop="static" keyboard={false} className="modal-warning">
    <Modal.Body style={{ padding:0 }}>
      <div className={`warning-modal-content ${isCritical ? 'terminated' : ''}`}>
        <div className="warning-icon-container">
          {isCritical ? <div style={{ fontSize:72, color:'#e53935' }}>🚫</div> : <div style={{ fontSize:72, color:'#ff9800' }}>⚠️</div>}
        </div>
        <h4 className="warning-title">{title}</h4>
        <p className="warning-message" style={{ whiteSpace:'pre-wrap' }}>{warningMessage}</p>
        
        {maxCount > 0 && (
          <div className="warning-dots">
            {Array.from({ length: maxCount }, (_, i) => (
              <div key={i} className={`warning-dot ${i < activeCount ? 'active' : ''} ${i < activeCount && isCritical ? 'terminated' : ''}`}>{i + 1}</div>
            ))}
          </div>
        )}

        <div className="warning-level">
          {isCritical ? <span className="level-critical">EXAM AUTO-SUBMITTING...</span>
            : isFinalWarning ? <span className="level-high">FINAL WARNING - Last chance!</span>
            : <span className="level-low">Please maintain exam integrity</span>}
        </div>
        {!isCritical && (
          <Button onClick={() => setShowWarningModal(false)} style={{ borderRadius:10, fontWeight:700, padding:'12px 40px', marginTop:16, fontSize:16, background:'#5B0A7B', border:'none', color:'#fff' }}>
            I Understand — Continue Exam
          </Button>
        )}
      </div>
    </Modal.Body>
  </Modal>
  );
};

export default ExamDashboard;

