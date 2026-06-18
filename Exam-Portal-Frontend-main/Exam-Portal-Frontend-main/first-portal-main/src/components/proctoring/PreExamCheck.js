// src/components/proctoring/PreExamCheck.js
// ✅ ENHANCED: Added "🔬 Open Live Test in new tab" link so students
//    can do a deep diagnostic if the inline check is failing.

import React, { useState, useEffect, useRef } from 'react';
import { cleanExamDescription } from '../../utils/exportUtils';

const FACE_MODEL_URL_PRIMARY =
  'https://justadudewhohacks.github.io/face-api.js/models';
const FACE_MODEL_URL_FALLBACK =
  'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/models';

const StatusBadge = ({ status, text }) => {
  const cfg = {
    good: { bg: '#e8f5e9', color: '#2e7d32', icon: '✓' },
    warn: { bg: '#fff3e0', color: '#f57f17', icon: '!' },
    bad: { bg: '#ffebee', color: '#c62828', icon: '✕' },
    pending: { bg: '#e3f2fd', color: '#1565c0', icon: '…' },
    check: { bg: '#ede7f6', color: '#5B0A7B', icon: '↻' },
  };
  const s = cfg[status] || cfg.pending;
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '4px 10px', borderRadius: 999,
      fontSize: 12, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>
      <span>{s.icon}</span>
      <span>{text}</span>
    </span>
  );
};

const PreExamCheck = ({ onComplete, examTitle, exam, totalQ }) => {
  const videoRef = useRef(null);
  const animFrameRef = useRef(null);
  const analyserRef = useRef(null);
  const scanTimerRef = useRef(null);
  const streamRef = useRef(null);
  const faceApiLoadedRef = useRef(false);

  const [camRes, setCamRes] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [brightness, setBrightness] = useState(0);
  const [faceConf, setFaceConf] = useState(0);

  const [camStatus, setCamStatus] = useState('pending');
  const [micStatus, setMicStatus] = useState('pending');
  const [lightStatus, setLightStatus] = useState('pending');
  const [faceStatus, setFaceStatus] = useState('pending');

  const [errorMsg, setErrorMsg] = useState('');
  const [allReady, setAllReady] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [agreedRules, setAgreedRules] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);

  // 1. Initialise Camera & Mic
  useEffect(() => {
    let active = true;

    const startMedia = async () => {
      try {
        setCamStatus('check');
        setMicStatus('check');
        setLightStatus('check');
        setFaceStatus('check');

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: true,
        });

        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise((resolve) => {
            const v = videoRef.current;
            if (!v || v.readyState >= 2) return resolve();
            v.addEventListener('loadeddata', resolve, { once: true });
            setTimeout(resolve, 5000);
          });
          try { await videoRef.current.play(); }
          catch (e) { console.warn('Video play() rejected:', e?.message); }
        }

        try {
          const vt = stream.getVideoTracks()[0];
          if (vt) {
            const s = vt.getSettings();
            setCamRes(`${s.width || 640}x${s.height || 480}`);
          }
        } catch (e) { setCamRes('640x480'); }
        setCamStatus('good');

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          try {
            const ctx = new AudioCtx();
            const an = ctx.createAnalyser();
            const src = ctx.createMediaStreamSource(stream);
            src.connect(an);
            an.fftSize = 256;
            analyserRef.current = an;
          } catch (e) { console.warn('Audio analyser init failed:', e); }
        }
        setMicStatus('good');

        setTimeout(() => { if (active) setShowOverride(true); }, 5000);
      } catch (err) {
        console.error('Media start error:', err);
        setErrorMsg('Camera or Microphone access denied. Please allow permissions in your browser settings and refresh the page.');
        setCamStatus('bad');
        setMicStatus('bad');
      }
    };

    startMedia();

    return () => {
      active = false;
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // 2. Continuous Audio Meter
  useEffect(() => {
    if (!analyserRef.current) return undefined;
    const analyser = analyserRef.current;
    let running = true;
    const tick = () => {
      if (!running) return;
      try {
        const buf = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        setAudioLevel(sum / buf.length);
      } catch (e) { /* ignore */ }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // 3. Lighting + Face scanner
  useEffect(() => {
    let scanning = true;

    const scanFrame = async () => {
      if (!scanning) return;
      const v = videoRef.current;
      if (!v || v.videoWidth === 0) {
        scanTimerRef.current = setTimeout(scanFrame, 300);
        return;
      }

      // Lighting
      try {
        const c = document.createElement('canvas');
        c.width = 80; c.height = 60;
        const ctx = c.getContext('2d');
        ctx.drawImage(v, 0, 0, 80, 60);
        const d = ctx.getImageData(0, 0, 80, 60).data;
        let s = 0;
        for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
        const avgBright = s / (d.length / 4);
        setBrightness(avgBright);
        setLightStatus(avgBright > 20 ? 'good' : 'warn');
      } catch (e) { /* ignore */ }

      // Face API scan
      if (window.faceapi && window.faceapi.nets && window.faceapi.nets.tinyFaceDetector) {
        try {
          if (!faceApiLoadedRef.current) {
            try {
              await window.faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL_PRIMARY);
            } catch (primaryErr) {
              console.warn('Primary model CDN failed, trying fallback…');
              await window.faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL_FALLBACK);
            }
            faceApiLoadedRef.current = true;
          }

          const dets = await window.faceapi.detectAllFaces(
            v,
            new window.faceapi.TinyFaceDetectorOptions({
              inputSize: 224,
              scoreThreshold: 0.3,
            }),
          );

          if (dets && dets.length >= 1) {
            const score = Math.round((dets[0].score || 0) * 100);
            setFaceConf(score);
            setFaceStatus('good');
          } else {
            setFaceConf(0);
            setFaceStatus('bad');
          }
        } catch (err) {
          // Ignore bad frame
        }
      }

      if (scanning) scanTimerRef.current = setTimeout(scanFrame, 800);
    };

    scanFrame();

    return () => {
      scanning = false;
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    };
  }, []);

  // 4. allReady
  useEffect(() => {
    if (manualOverride) {
      setAllReady(true);
      return;
    }
    if (camStatus === 'good' && micStatus === 'good' && faceStatus === 'good') {
      setAllReady(true);
    } else {
      setAllReady(false);
    }
  }, [camStatus, micStatus, faceStatus, manualOverride]);

  const brightPct = Math.round((brightness / 255) * 100);
  const audioPct = Math.round((audioLevel / 128) * 100);

  const displayTitle = exam?.title || examTitle || 'University Online Exam';
  const displayQuestionsCount = totalQ || exam?.total_questions || 'N/A';
  const displayDuration = exam?.duration ? `${exam.duration} Mins` : '60 Mins';
  const displayDesc =
    cleanExamDescription(exam?.description) ||
    'Please read all questions carefully before submitting.';

  const handleManualOverride = () => setManualOverride(true);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fb 0%, #e9ecf5 100%)',
      padding: '24px 16px',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    }}>
      <div style={{
        maxWidth: 1100, width: '100%',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
        gap: 20,
      }}>
        {/* LEFT CARD */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: 28,
          boxShadow: '0 4px 24px rgba(91,10,123,0.08)',
          border: '1px solid #ece9f4',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'linear-gradient(135deg, #5B0A7B, #7B1FA2)',
              color: '#fff', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 24,
            }}>🎓</div>
            <div>
              <h2 style={{ margin: 0, color: '#2c2c54', fontSize: 22, fontWeight: 700 }}>
                {displayTitle}
              </h2>
              <div style={{ color: '#7a7a93', fontSize: 13, marginTop: 2 }}>
                Online Examination & ML AI Proctoring
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0' }}>
            <div style={{ background: '#f3eafd', color: '#5B0A7B', padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
              QUESTIONS: <span style={{ marginLeft: 6 }}>{displayQuestionsCount}</span>
            </div>
            <div style={{ background: '#fff3e0', color: '#e65100', padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
              DURATION: <span style={{ marginLeft: 6 }}>{displayDuration}</span>
            </div>
            <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
              PROCTORING: <span style={{ marginLeft: 6 }}>Strict AI</span>
            </div>
          </div>

          <div style={{
            background: '#faf8ff', border: '1px solid #ece9f4',
            borderRadius: 12, padding: '14px 16px',
            fontSize: 14, color: '#444', lineHeight: 1.6,
          }}>
            <strong>📋 Overview:</strong> {displayDesc}
          </div>

          <h4 style={{ color: '#c62828', fontSize: 15, marginTop: 24, marginBottom: 12, fontWeight: 700 }}>
            ⚠️ Strict Rules & Guidelines
          </h4>
          <ul style={{ paddingLeft: 18, color: '#444', fontSize: 13.5, lineHeight: 1.7 }}>
            <li><strong>Face Visibility Required:</strong> Keep your face clearly centered in the camera frame.</li>
            <li><strong>No Tab / Window Switching:</strong> Triggers instant warnings and auto-submit.</li>
            <li><strong>No Electronic Devices:</strong> Mobile phones, smartwatches, etc. are prohibited.</li>
            <li><strong>Quiet Environment:</strong> Maintain a silent room.</li>
            <li><strong>Final Performance:</strong> Once submitted, your responses are permanently recorded.</li>
          </ul>

          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            marginTop: 20, padding: '12px 14px',
            background: agreedRules ? '#e8f5e9' : '#fafafa',
            border: `1.5px solid ${agreedRules ? '#66bb6a' : '#e0e0e0'}`,
            borderRadius: 10, cursor: 'pointer', fontSize: 13.5, color: '#444',
            transition: 'all 0.2s',
          }}>
            <input
              type="checkbox"
              checked={agreedRules}
              onChange={(e) => setAgreedRules(e.target.checked)}
              style={{ width: 22, height: 22, cursor: 'pointer', accentColor: '#15803d', flexShrink: 0, marginTop: 2 }}
            />
            <span>I have read, understood, and agree to follow all exam rules and proctoring policies.</span>
          </label>
        </div>

        {/* RIGHT CARD */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: 28,
          boxShadow: '0 4px 24px rgba(91,10,123,0.08)',
          border: '1px solid #ece9f4',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: '#ede7f6', color: '#5B0A7B',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
            }}>🛡️</div>
            <h3 style={{ margin: 0, color: '#2c2c54', fontSize: 19, fontWeight: 700 }}>
              Pre-Exam Tech Check
            </h3>
          </div>

          {/* Live Camera Box */}
          <div style={{
            position: 'relative', borderRadius: 14, overflow: 'hidden',
            background: '#0a0a14', aspectRatio: '4 / 3',
            border: '2px solid #ece9f4',
          }}>
            <video
              ref={videoRef}
              autoPlay muted playsInline
              onClick={() => videoRef.current?.play()}
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                transform: 'scaleX(-1)', background: '#0a0a14',
              }}
            />
            <div style={{
              position: 'absolute', top: 10, left: 10,
              background: 'rgba(229,57,53,0.92)', color: '#fff',
              padding: '4px 10px', borderRadius: 6,
              fontSize: 11, fontWeight: 700, letterSpacing: 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#fff', animation: 'pulse 1.5s infinite',
              }} />
              LIVE PROCTOR
            </div>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '55%', aspectRatio: '3 / 4',
              border: `2px dashed ${
                faceStatus === 'good' ? 'rgba(76,175,80,0.7)' :
                faceStatus === 'bad' ? 'rgba(229,57,53,0.7)' :
                'rgba(255,255,255,0.5)'
              }`,
              borderRadius: '50% 50% 45% 45% / 60% 60% 40% 40%',
              pointerEvents: 'none', transition: 'border-color 0.3s',
            }} />
            <div style={{
              position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.6)', color: '#fff',
              padding: '6px 12px', borderRadius: 999,
              fontSize: 12, fontWeight: 600,
            }}>
              {camStatus === 'pending' && 'Initializing Camera…'}
              {camStatus === 'check' && 'Connecting…'}
              {camStatus === 'good' && faceStatus === 'good' && '✓ Face Detected'}
              {camStatus === 'good' && faceStatus === 'bad' && '⚠️ Face Not Detected'}
              {camStatus === 'good' && faceStatus === 'pending' && 'Scanning…'}
              {camStatus === 'bad' && '❌ Camera Error'}
            </div>
            {camRes && (
              <div style={{
                position: 'absolute', top: 10, right: 10,
                background: 'rgba(0,0,0,0.5)', color: '#fff',
                padding: '3px 8px', borderRadius: 4,
                fontSize: 11, fontFamily: 'monospace',
              }}>{camRes}</div>
            )}
          </div>

          {/* Quality grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14,
          }}>
            {[
              { icon: '📸', label: 'Camera', status: camStatus, val: camStatus === 'good' ? 'Connected' : camStatus === 'bad' ? 'Error' : '…' },
              { icon: '🎙️', label: 'Microphone', status: micStatus, val: `Vol: ${audioPct}%` },
              { icon: '💡', label: 'Lighting', status: lightStatus, val: `Bright: ${brightPct}%` },
              { icon: '👤', label: 'Face Visible', status: faceStatus, val: faceConf > 0 ? `Conf: ${faceConf}%` : faceStatus === 'bad' ? 'Not Detected' : '…' },
            ].map((q, i) => (
              <div key={i} style={{
                background: '#fafafa', border: '1px solid #ececec',
                borderRadius: 10, padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ fontSize: 20 }}>{q.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>{q.label}</div>
                  <StatusBadge status={q.status} text={q.val} />
                </div>
              </div>
            ))}
          </div>

          {/* ✅ NEW: Link to full diagnostic */}
          <a
            href="/live-testing"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: 14, padding: '10px 14px',
              background: '#f3eafd', color: '#5B0A7B',
              border: '1px solid #d1b3ed', borderRadius: 10,
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#ede0fa'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#f3eafd'}
          >
            <span>🔬 Open Full Live Diagnostic Test (new tab)</span>
            <span>↗</span>
          </a>

          {errorMsg && (
            <div style={{
              marginTop: 14, background: '#ffebee', color: '#c62828',
              padding: '10px 14px', borderRadius: 10, fontSize: 13,
              border: '1px solid #ffcdd2',
            }}>{errorMsg}</div>
          )}

          {(showOverride || faceStatus === 'bad') && !manualOverride && (
            <button
              onClick={handleManualOverride}
              style={{
                marginTop: 14, width: '100%',
                background: '#fff8e1', color: '#e65100',
                border: '1px solid #ffe0b2', borderRadius: 10,
                padding: '10px 14px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              ⚠️ Tech check struggling or AI blocked? Click here to{' '}
              <strong>Skip Face Scan & Begin</strong> →
            </button>
          )}

          {manualOverride && (
            <div style={{
              marginTop: 14, background: '#fff3e0', color: '#e65100',
              padding: '10px 14px', borderRadius: 10, fontSize: 12,
              border: '1px solid #ffe0b2',
            }}>
              ✓ Manual override accepted. The proctoring engine will still monitor your session during the exam.
            </div>
          )}

          <button
            onClick={onComplete}
            disabled={!allReady || !agreedRules}
            style={{
              marginTop: 18, width: '100%',
              background: allReady && agreedRules
                ? 'linear-gradient(135deg, #5B0A7B, #7B1FA2)'
                : '#e0e0e0',
              color: allReady && agreedRules ? '#fff' : '#888',
              border: 'none', borderRadius: 12,
              padding: '14px 24px', fontSize: 16, fontWeight: 700,
              cursor: allReady && agreedRules ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s', letterSpacing: 0.3,
            }}
          >
            {allReady && agreedRules
              ? '🚀 Begin Exam Now'
              : !agreedRules
              ? '⚠️ Please check the agreement box above first'
              : '⚠️ Waiting for clear face visibility…'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreExamCheck;
