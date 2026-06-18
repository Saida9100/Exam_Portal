// src/components/proctoring/PreExamCheck.js
import React, { useState, useEffect, useRef } from 'react';
import { cleanExamDescription } from '../../utils/exportUtils';

const StatusBadge = ({ status, text }) => {
  const cfg = {
    good:    { bg: '#e8f5e9', color: '#2e7d32', icon: '✓' },
    warn:    { bg: '#fff3e0', color: '#f57f17', icon: '!' },
    bad:     { bg: '#ffebee', color: '#c62828', icon: '✕' },
    pending: { bg: '#e3f2fd', color: '#1565c0', icon: '...' },
    check:   { bg: '#ede7f6', color: '#5B0A7B', icon: '↻' }
  };
  const s = cfg[status] || cfg.pending;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 14px', borderRadius: 20, background: s.bg, fontSize: 12, fontWeight: 700, color: s.color }}>
      <span>{s.icon}</span>
      <span>{text}</span>
    </div>
  );
};

const PreExamCheck = ({ onComplete, examTitle, exam, totalQ }) => {
  const videoRef = useRef(null);
  const animFrameRef = useRef(null);
  const analyserRef = useRef(null);
  const scanTimerRef = useRef(null);

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

  // 1. Initialise Camera & Mic
  useEffect(() => {
    let stream = null;
    let active = true;

    const startMedia = async () => {
      try {
        setCamStatus('check');
        setMicStatus('check');
        setLightStatus('check');
        setFaceStatus('check');

        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true
        });

        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise(res => {
            const v = videoRef.current;
            if (!v || v.readyState >= 2) return res();
            v.onloadeddata = res;
            setTimeout(res, 3000);
          });
          videoRef.current?.play().catch(() => {});
        }

        const vt = stream.getVideoTracks()[0];
        if (vt) {
          const s = vt.getSettings();
          setCamRes(`${s.width}x${s.height}`);
        }
        setCamStatus('good');

        // Audio Analyser
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const an = ctx.createAnalyser();
          const src = ctx.createMediaStreamSource(stream);
          src.connect(an);
          an.fftSize = 256;
          analyserRef.current = an;
        }
        setMicStatus('good');

        // Show emergency override button after 7 seconds if CDN or network is slow
        setTimeout(() => {
          if (active) setShowOverride(true);
        }, 7000);

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
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  // 2. Continuous Audio Meter
  useEffect(() => {
    if (!analyserRef.current) return;
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
      } catch (e) {}
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => { running = false; if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, []);

  // 3. Continuous Lighting & Face Scanner
  useEffect(() => {
    if (camStatus !== 'good') return;
    let scanning = true;

    const scanFrame = async () => {
      if (!scanning || !videoRef.current || videoRef.current.videoWidth === 0) {
        scanTimerRef.current = setTimeout(scanFrame, 300);
        return;
      }

      // Lighting check
      try {
        const c = document.createElement('canvas');
        c.width = 80; c.height = 60;
        const ctx = c.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0, 80, 60);
        const d = ctx.getImageData(0, 0, 80, 60).data;
        let s = 0;
        for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i+1] + d[i+2]) / 3;
        const avgBright = s / (d.length / 4);
        setBrightness(avgBright);
        setLightStatus(avgBright > 20 ? 'good' : 'warn');
      } catch (e) {}

      // Face API scan
      if (window.faceapi && window.faceapi.nets && window.faceapi.nets.tinyFaceDetector) {
        try {
          if (!window.faceapiNetsLoaded) {
            await window.faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/');
            window.faceapiNetsLoaded = true;
          }

          const dets = await window.faceapi.detectAllFaces(
            videoRef.current,
            new window.faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.25 })
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

      if (scanning) {
        scanTimerRef.current = setTimeout(scanFrame, 800);
      }
    };

    scanFrame();

    return () => {
      scanning = false;
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    };
  }, [camStatus]);

  useEffect(() => {
    if (camStatus === 'good' && micStatus === 'good' && faceStatus === 'good') {
      setAllReady(true);
    } else {
      setAllReady(false);
    }
  }, [camStatus, micStatus, faceStatus]);

  const handleOverride = () => {
    setFaceStatus('good');
    setFaceConf(85);
    setAllReady(true);
  };

  const brightPct = Math.round((brightness / 255) * 100);
  const audioPct = Math.round((audioLevel / 128) * 100);

  const displayTitle = exam?.title || examTitle || 'University Online Exam';
  const displayQuestionsCount = totalQ || exam?.total_questions || 'N/A';
  const displayDuration = exam?.duration ? `${exam.duration} Mins` : '60 Mins';
  const displayDesc = cleanExamDescription(exam?.description) || 'Please read all questions carefully before submitting.';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #2D0040 100%)', padding: 20, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1100, width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
        
        {/* LEFT CARD: Instructions & Exam Overview */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 32, boxShadow: '0 10px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0, boxShadow: '0 4px 15px rgba(102,126,234,0.3)' }}>
                🎓
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1a1a2e', lineHeight: 1.2 }}>{displayTitle}</h2>
                <div style={{ fontSize: 13, color: '#667eea', fontWeight: 700, marginTop: 4 }}>Online Examination & AI Proctoring</div>
              </div>
            </div>

            {/* Overview Pills */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ background: '#f0f4ff', border: '1px solid #d8e3ff', borderRadius: 12, padding: '12px 16px', flex: 1, minWidth: 100, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#667eea', fontWeight: 700 }}>QUESTIONS</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: '#1a1a2e', marginTop: 2 }}>{displayQuestionsCount}</div>
              </div>
              <div style={{ background: '#fff3e0', border: '1px solid #ffe0b2', borderRadius: 12, padding: '12px 16px', flex: 1, minWidth: 100, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#e65100', fontWeight: 700 }}>DURATION</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: '#1a1a2e', marginTop: 2 }}>{displayDuration}</div>
              </div>
              <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: 12, padding: '12px 16px', flex: 1, minWidth: 100, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#2e7d32', fontWeight: 700 }}>PROCTORING</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: '#1a1a2e', marginTop: 2 }}>Strict AI</div>
              </div>
            </div>

            {/* Description */}
            <div style={{ background: '#f8f9fa', borderRadius: 14, padding: 16, marginBottom: 24, fontSize: 13, color: '#444', lineHeight: 1.6, borderLeft: '4px solid #5B0A7B' }}>
              <strong>📋 Overview:</strong> {displayDesc}
            </div>

            {/* Rules */}
            <h4 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠️</span> Strict Rules & Guidelines
            </h4>
            <ul style={{ margin: 0, paddingLeft: 20, color: '#444', fontSize: 13, lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li><strong>Face Visibility Required:</strong> Keep your face centered in the camera frame. Covering your camera or looking away will trigger proctor warnings.</li>
              <li><strong>No Tab / Window Switching:</strong> Navigating away from the active exam window or opening other software may automatically submit your exam.</li>
              <li><strong>No Electronic Devices:</strong> Mobile phones, smartwatches, earbuds, or unauthorized secondary screens are strictly prohibited.</li>
              <li><strong>Quiet Environment:</strong> Maintain a silent room. Secondary talking or multiple voices will be logged as critical violations.</li>
              <li><strong>Final Submission:</strong> Once you click submit or the timer expires, your performance is instantly recorded and cannot be modified.</li>
            </ul>
          </div>

          {/* Checkbox agreement */}
          <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid #eee' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none', background: agreedRules ? '#f0fdf4' : '#f8f9fa', padding: '14px 16px', borderRadius: 12, border: agreedRules ? '2px solid #bbf7d0' : '2px solid #ddd', transition: 'all 0.2s', boxSizing: 'border-box' }}>
              <input
                type="checkbox"
                checked={agreedRules}
                onChange={(e) => setAgreedRules(e.target.checked)}
                style={{ width: 20, height: 20, cursor: 'pointer', accentColor: '#15803d', flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: agreedRules ? '#15803d' : '#555', lineHeight: 1.4 }}>
                I have read and understood all exam rules, instructions, and proctoring policies.
              </span>
            </label>
          </div>
        </div>

        {/* RIGHT CARD: Pre-Exam Tech Check */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 32, boxShadow: '0 10px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 26 }}>🛡️</span>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1a1a2e' }}>Pre-Exam Tech Check</h3>
            </div>
            
            {/* Live Camera Box */}
            <div style={{ width: '100%', aspectRatio: '4/3', background: '#111', borderRadius: 16, overflow: 'hidden', position: 'relative', boxShadow: '0 6px 20px rgba(0,0,0,0.18)', marginBottom: 20 }}>
              <video
                ref={videoRef} autoPlay muted playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                onLoadedMetadata={() => videoRef.current?.play()}
              />
              {/* LIVE badge */}
              <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6, alignItems: 'center', background: 'rgba(0,0,0,0.65)', padding: '4px 12px', borderRadius: 20 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: camStatus === 'good' ? '#4caf50' : '#ff5252', boxShadow: `0 0 6px ${camStatus === 'good' ? '#4caf50' : '#ff5252'}` }} />
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>LIVE PROCTOR</span>
              </div>
              {/* Target Frame */}
              <div style={{ position: 'absolute', inset: '15%', border: '2px dashed rgba(255,255,255,0.3)', borderRadius: 20, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {faceStatus === 'bad' && <span style={{ color: '#ff5252', background: 'rgba(0,0,0,0.85)', padding: '8px 16px', borderRadius: 14, fontSize: 13, fontWeight: 800, letterSpacing: 0.5 }}>⚠️ Face Not Visible</span>}
              </div>
              {/* Resolution */}
              {camRes && <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '3px 12px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{camRes}</div>}
              {camStatus === 'pending' && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 15, fontWeight: 600 }}>Connecting camera...</div>}
            </div>

            {/* Quality cards in 2x2 grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              {/* Cam */}
              <div style={{ background: '#f8f9ff', borderRadius: 14, padding: '14px 16px', textAlign: 'center', border: `2px solid ${camStatus === 'good' ? '#c8e6c9' : '#ffebee'}`, boxSizing: 'border-box' }}>
                <div style={{ fontSize: 26, marginBottom: 4 }}>📸</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>Camera</div>
                <div style={{ fontSize: 11, color: '#777', margin: '2px 0 8px' }}>{camStatus === 'good' ? 'Connected' : 'Error'}</div>
                <StatusBadge status={camStatus} text={camStatus === 'good' ? 'OK' : 'Waiting'} />
              </div>

              {/* Mic */}
              <div style={{ background: '#f8f9ff', borderRadius: 14, padding: '14px 16px', textAlign: 'center', border: `2px solid ${micStatus === 'good' ? '#c8e6c9' : '#eee'}`, boxSizing: 'border-box' }}>
                <div style={{ fontSize: 26, marginBottom: 4 }}>🎙️</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>Microphone</div>
                <div style={{ fontSize: 11, color: '#777', margin: '2px 0 8px' }}>Vol: {audioPct}%</div>
                <StatusBadge status={micStatus} text={micStatus === 'good' ? 'Active' : 'Checking'} />
              </div>

              {/* Light */}
              <div style={{ background: '#f8f9ff', borderRadius: 14, padding: '14px 16px', textAlign: 'center', border: `2px solid ${lightStatus === 'good' ? '#c8e6c9' : '#fff3e0'}`, boxSizing: 'border-box' }}>
                <div style={{ fontSize: 26, marginBottom: 4 }}>💡</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>Lighting</div>
                <div style={{ fontSize: 11, color: '#777', margin: '2px 0 8px' }}>Bright: {brightPct}%</div>
                <StatusBadge status={lightStatus} text={lightStatus === 'good' ? 'Optimal' : 'Dim'} />
              </div>

              {/* Face */}
              <div style={{ background: '#f8f9ff', borderRadius: 14, padding: '14px 16px', textAlign: 'center', border: `2px solid ${faceStatus === 'good' ? '#c8e6c9' : '#ffebee'}`, boxSizing: 'border-box' }}>
                <div style={{ fontSize: 26, marginBottom: 4 }}>👤</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>Face Visible</div>
                <div style={{ fontSize: 11, color: '#777', margin: '2px 0 8px' }}>{faceConf > 0 ? `Conf: ${faceConf}%` : 'Not Detected'}</div>
                <StatusBadge status={faceStatus} text={faceStatus === 'good' ? 'Visible' : 'Not Visible'} />
              </div>
            </div>

            {errorMsg && (
              <div style={{ padding: 14, background: '#ffebee', border: '2px solid #ffcdd2', borderRadius: 12, color: '#c62828', textAlign: 'center', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                {errorMsg}
              </div>
            )}

            {showOverride && faceStatus !== 'good' && (
              <div style={{ padding: 14, background: '#fff9c4', borderRadius: 12, fontSize: 12, color: '#f57f17', textAlign: 'center', marginBottom: 16, border: '1px solid #fff59d', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <span>AI scanner blocked by network?</span>
                <button onClick={handleOverride} style={{ background: '#5B0A7B', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Override & Start</button>
              </div>
            )}
          </div>

          {/* Start Button */}
          <div style={{ marginTop: 12 }}>
            <button
              disabled={!allReady || !agreedRules}
              onClick={onComplete}
              style={{
                width: '100%', padding: '18px', fontSize: 18, fontWeight: 800, borderRadius: 16, border: 'none',
                background: (allReady && agreedRules) ? 'linear-gradient(135deg, #43e97b, #38f9d7)' : '#e0e0e0',
                color: (allReady && agreedRules) ? '#1a1a2e' : '#999',
                cursor: (allReady && agreedRules) ? 'pointer' : 'not-allowed',
                boxShadow: (allReady && agreedRules) ? '0 8px 25px rgba(67,233,123,0.45)' : 'none',
                transition: 'all 0.2s', letterSpacing: 0.5
              }}
            >
              {(allReady && agreedRules) ? '🚀 Begin Exam Now' : (!agreedRules ? '⚠️ Please agree to rules first' : '⚠️ Waiting for clear Face Visibility...')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PreExamCheck;
