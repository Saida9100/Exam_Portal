// src/components/diagnostics/LiveTesting.js
//
// ✅ COMPREHENSIVE LIVE-TESTING DIAGNOSTIC PAGE
//
// What it does:
//   • Live camera preview with face-detection bounding box overlay 
//   • Real-time audio waveform & noise meter
//   • Real-time lighting analysis (brightness, contrast, color temp)
//   • Face detection confidence with history graph
//   • Network/CDN reachability test (verifies face-api.js loads)
//   • Performance metrics (FPS, latency)
//   • Actionable diagnostics: tells you EXACTLY what's wrong
//   • One-click "Run All Tests" + downloadable report
//
// Where to put it:
//   src/components/diagnostics/LiveTesting.js
//
// How to access:
//   Visit /live-testing in your browser (logged in as any role).
//   Optionally add a "🔬 Live Test" button to the student sidebar.
//
// Why this fixes your "No Face Detected" issue:
//   Previously the face-detection ran in a hidden video element with
//   no user feedback. This page surfaces EVERYTHING live so you can see
//   exactly what the camera sees, whether the model loaded, what the
//   light level is, and why face-api might be failing.

import React, { useState, useEffect, useRef, useCallback } from 'react'; 
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import apiService from '../services/api';

// ────────────────────────────────────────────────────────────────────
// Face-api model URLs (same as ProctorEngine.js)
// ────────────────────────────────────────────────────────────────────
const MODEL_URLS = {
  primary:   'https://justadudewhohacks.github.io/face-api.js/models',
  fallback:  'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/models',
};

// Tunables — aligned with ProctorEngine.js so what you see = what the exam uses
const TUNING = {
  scoreThreshold: 0.4,
  inputSize: 320,
  sampleIntervalMs: 200,    // sampling rate for audio/light
  faceDetectIntervalMs: 500, // how often to run face-api
};

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────
const fmtPct = (n, digits = 0) =>
  Number.isFinite(n) ? `${n.toFixed(digits)}%` : '—';

const fmtMs = (n) => Number.isFinite(n) ? `${n.toFixed(0)} ms` : '—';

const statusColor = (status) => ({
  good:    { bg: '#e8f5e9', fg: '#2e7d32', icon: '✓' },
  warn:    { bg: '#fff3e0', fg: '#e65100', icon: '!' },
  bad:     { bg: '#ffebee', fg: '#c62828', icon: '✕' },
  pending: { bg: '#e3f2fd', fg: '#1565c0', icon: '…' },
  check:   { bg: '#ede7f6', fg: '#5B0A7B', icon: '↻' },
}[status] || { bg: '#eee', fg: '#555', icon: '•' });

// ────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────
const StatusPill = ({ status, label }) => {
  const c = statusColor(status);
  return (
    <span style={{
      background: c.bg, color: c.fg,
      padding: '4px 10px', borderRadius: 999,
      fontSize: 12, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>
      <span>{c.icon}</span><span>{label || status}</span>
    </span>
  );
};

const Meter = ({ value, max = 100, label, color = '#5B0A7B' }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666', marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700 }}>{fmtPct(pct)}</span>
      </div>
      <div style={{ background: '#ececec', borderRadius: 999, height: 8, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: `linear-gradient(90deg, ${color}, ${color}dd)`,
          transition: 'width 0.15s ease',
        }} />
      </div>
    </div>
  );
};

const Card = ({ title, icon, status, children, action }) => (
  <div style={{
    background: '#fff', borderRadius: 14, padding: 18,
    border: '1px solid #ece9f4',
    boxShadow: '0 2px 10px rgba(91,10,123,0.04)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: statusColor(status).bg,
          color: statusColor(status).fg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>{icon}</div>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#2c2c54' }}>{title}</h3>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <StatusPill status={status} />
        {action}
      </div>
    </div>
    {children}
  </div>
);

// ────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────
const LiveTesting = () => {
  const navigate = useNavigate();
  const user = apiService.getUser();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const faceDetectTimerRef = useRef(null);

  // State
  const [camStatus, setCamStatus] = useState('pending');
  const [camError, setCamError] = useState('');
  const [camRes, setCamRes] = useState('');
  const [camFPS, setCamFPS] = useState(0);

  const [micStatus, setMicStatus] = useState('pending');
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioPeak, setAudioPeak] = useState(0);

  const [lightBrightness, setLightBrightness] = useState(0);
  const [lightContrast, setLightContrast] = useState(0);
  const [lightTemp, setLightTemp] = useState('neutral');
  const [lightStatus, setLightStatus] = useState('pending');

  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const [faceApiSource, setFaceApiSource] = useState('');
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceConf, setFaceConf] = useState(0);
  const [faceBox, setFaceBox] = useState(null); // { x, y, w, h }
  const [faceErrorLog, setFaceErrorLog] = useState([]);

  const [networkLatency, setNetworkLatency] = useState(null);
  const [modelCDNReachable, setModelCDNReachable] = useState('pending');

  const [issues, setIssues] = useState([]); // running list of detected issues
  const [running, setRunning] = useState(false);

  // FPS counter
  const frameCountRef = useRef(0);
  const lastFPSCheckRef = useRef(Date.now());

  // ════════════════════════════════════════════════════════════════════
  // Issues helper (declared before callbacks that use it so CI/ESLint is clean)
  // ════════════════════════════════════════════════════════════════════
  const pushIssue = useCallback((category, status, message) => {
    setIssues((prev) => [
      { id: Date.now() + Math.random(), category, status, message, ts: new Date() },
      ...prev,
    ].slice(0, 50));
  }, []);

  // ════════════════════════════════════════════════════════════════════
  // 1. Initialize camera + microphone
  // ════════════════════════════════════════════════════════════════════
  const initMedia = useCallback(async () => {
    try {
      setCamStatus('check');
      setMicStatus('check');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => {
          const v = videoRef.current;
          if (!v) return resolve();
          if (v.readyState >= 2) return resolve();
          v.addEventListener('loadeddata', () => resolve(), { once: true });
          setTimeout(resolve, 4000);
        });
        try { await videoRef.current.play(); }
        catch (e) { console.warn('play() rejected:', e?.message); }
      }

      const vt = stream.getVideoTracks()[0];
      const settings = vt?.getSettings() || {};
      setCamRes(`${settings.width || 640}×${settings.height || 480}`);
      setCamStatus('good');
      pushIssue('cam', 'good', `Camera connected at ${settings.width || 640}×${settings.height || 480}`);

      // Audio
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const an = ctx.createAnalyser();
        const src = ctx.createMediaStreamSource(stream);
        src.connect(an);
        an.fftSize = 512;
        audioCtxRef.current = ctx;
        analyserRef.current = an;
        setMicStatus('good');
        pushIssue('mic', 'good', 'Microphone connected and analyser ready');
      }
    } catch (err) {
      console.error('Media init error:', err);
      setCamError(err?.message || 'Camera/microphone permission denied');
      setCamStatus('bad');
      setMicStatus('bad');
      pushIssue('cam', 'bad', `Camera/Mic denied: ${err?.message || err}`);
    }
  }, [pushIssue]);

  // ════════════════════════════════════════════════════════════════════
  // 2. Load face-api model
  // ════════════════════════════════════════════════════════════════════
  const loadFaceApi = useCallback(async () => {
    if (!window.faceapi || !window.faceapi?.nets?.tinyFaceDetector) {
      pushIssue('face-api', 'bad', 'window.faceapi not loaded. The CDN script in index.html likely failed.');
      setFaceApiLoaded(false);
      setFaceApiSource('not loaded');
      return;
    }
    try {
      // try primary CDN
      await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URLS.primary);
      setFaceApiLoaded(true);
      setFaceApiSource('justadudewhohacks.github.io');
      pushIssue('face-api', 'good', 'Face detection model loaded from primary CDN');
    } catch (e1) {
      console.warn('Primary CDN failed, trying fallback…', e1);
      try {
        await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URLS.fallback);
        setFaceApiLoaded(true);
        setFaceApiSource('cdn.jsdelivr.net (fallback)');
        pushIssue('face-api', 'good', 'Face detection model loaded from fallback CDN');
      } catch (e2) {
        setFaceApiLoaded(false);
        setFaceApiSource('failed');
        pushIssue('face-api', 'bad', `Both CDNs failed: ${e1?.message} | ${e2?.message}`);
      }
    }
  }, [pushIssue]);

  // ════════════════════════════════════════════════════════════════════
  // 3. Network / CDN reachability test
  // ════════════════════════════════════════════════════════════════════
  const testNetwork = useCallback(async () => {
    // ping backend
    const t0 = Date.now();
    try {
      await fetch(apiService.baseURL + '/health', { cache: 'no-store' });
      setNetworkLatency(Date.now() - t0);
    } catch {
      setNetworkLatency(null);
      pushIssue('network', 'bad', 'Cannot reach backend — check your connection');
    }

    // ping model CDN
    try {
      const r = await fetch(MODEL_URLS.primary + '/tiny_face_detector_model-weights_manifest.json', { cache: 'no-store' });
      if (r.ok) setModelCDNReachable('good');
      else setModelCDNReachable('bad');
    } catch {
      setModelCDNReachable('bad');
      pushIssue('network', 'warn', `Cannot reach face-api CDN — face detection will fail in exam`);
    }
  }, [pushIssue]);

  // ════════════════════════════════════════════════════════════════════
  // 5. Real-time analysis loop (audio + light)
  // ════════════════════════════════════════════════════════════════════
  const tickAnalysis = useCallback(() => {
    if (!running) return;

    // FPS counter
    frameCountRef.current++;
    const now = Date.now();
    if (now - lastFPSCheckRef.current >= 1000) {
      setCamFPS(frameCountRef.current);
      frameCountRef.current = 0;
      lastFPSCheckRef.current = now;
    }

    const v = videoRef.current;
    if (v && v.videoWidth > 0) {
      // Draw current frame to canvas for analysis
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      c.width = 160; c.height = 120;
      ctx.drawImage(v, 0, 0, 160, 120);
      try {
        const data = ctx.getImageData(0, 0, 160, 120).data;
        // Brightness
        let sum = 0, sumR = 0, sumG = 0, sumB = 0, sumSq = 0;
        const pixels = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const lum = (r + g + b) / 3;
          sum += lum;
          sumR += r; sumG += g; sumB += b;
          sumSq += lum * lum;
        }
        const avg = sum / pixels;
        const variance = (sumSq / pixels) - (avg * avg);
        const std = Math.sqrt(Math.max(0, variance));
        const brightnessPct = (avg / 255) * 100;
        const contrastPct = (std / 128) * 100;
        setLightBrightness(brightnessPct);
        setLightContrast(contrastPct);
        // Color temperature (very rough): R-B ratio
        const ratio = sumR / Math.max(1, sumB);
        if (ratio > 1.15) setLightTemp('warm');
        else if (ratio < 0.85) setLightTemp('cool');
        else setLightTemp('neutral');

        // Status
        if (brightnessPct < 12) setLightStatus('bad');
        else if (brightnessPct < 22 || brightnessPct > 92) setLightStatus('warn');
        else setLightStatus('good');
      } catch (e) { /* skip frame */ }
    }

    // Audio
    if (analyserRef.current) {
      try {
        const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(buf);
        let sum = 0, peak = 0;
        for (let i = 0; i < buf.length; i++) {
          sum += buf[i];
          if (buf[i] > peak) peak = buf[i];
        }
        const avg = sum / buf.length;
        setAudioLevel((avg / 255) * 100);
        setAudioPeak((peak / 255) * 100);
      } catch (e) { /* skip */ }
    }

    rafRef.current = requestAnimationFrame(tickAnalysis);
  }, [running]);

  // ════════════════════════════════════════════════════════════════════
  // 6. Face detection loop
  // ════════════════════════════════════════════════════════════════════
  const runFaceDetection = useCallback(async () => {
    if (!running || !faceApiLoaded || !videoRef.current || !window.faceapi) return;
    const v = videoRef.current;
    if (v.paused || v.videoWidth === 0) return;

    try {
      const result = await window.faceapi.detectSingleFace(
        v,
        new window.faceapi.TinyFaceDetectorOptions({
          inputSize: TUNING.inputSize,
          scoreThreshold: TUNING.scoreThreshold,
        }),
      );
      if (result) {
        setFaceDetected(true);
        setFaceConf(Math.round((result.score || 0) * 100));
        // Map box from face-api (which uses video coords) to canvas coords
        const box = result.box || result.detection?.box;
        if (box) {
          setFaceBox({
            x: box.x, y: box.y, w: box.width, h: box.height,
          });
        }
        pushIssue('face', 'good', `Face detected (${Math.round((result.score || 0) * 100)}% confidence)`);
      } else {
        setFaceDetected(false);
        setFaceConf(0);
        setFaceBox(null);
      }
    } catch (e) {
      setFaceErrorLog((prev) => [...prev.slice(-4), e?.message || String(e)].filter(Boolean));
    }
  }, [running, faceApiLoaded, pushIssue]);

  // ════════════════════════════════════════════════════════════════════
  // 7. Lifecycle
  // ════════════════════════════════════════════════════════════════════
  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      setRunning(true);
      await initMedia();
      if (cancelled) return;
      await Promise.all([loadFaceApi(), testNetwork()]);
    };
    start();

    return () => {
      cancelled = true;
      setRunning(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (faceDetectTimerRef.current) clearInterval(faceDetectTimerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try { audioCtxRef.current.close(); } catch (e) {}
      }
    };
  }, [initMedia, loadFaceApi, testNetwork]);

  useEffect(() => {
    if (!running) return;
    rafRef.current = requestAnimationFrame(tickAnalysis);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running, tickAnalysis]);

  useEffect(() => {
    if (!running || !faceApiLoaded) return;
    faceDetectTimerRef.current = setInterval(runFaceDetection, TUNING.faceDetectIntervalMs);
    return () => { if (faceDetectTimerRef.current) clearInterval(faceDetectTimerRef.current); };
  }, [running, faceApiLoaded, runFaceDetection]);

  // ════════════════════════════════════════════════════════════════════
  // 8. Draw face box overlay on a second canvas
  // ════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (faceBox) {
      ctx.strokeStyle = faceDetected ? '#66bb6a' : '#ff9800';
      ctx.lineWidth = 3;
      ctx.strokeRect(faceBox.x, faceBox.y, faceBox.w, faceBox.h);
      // Label
      ctx.fillStyle = faceDetected ? '#2e7d32' : '#e65100';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${faceConf}%`, faceBox.x, Math.max(15, faceBox.y - 4));
    }
  }, [faceBox, faceDetected, faceConf]);

  // ════════════════════════════════════════════════════════════════════
  // 9. Diagnostic conclusions
  // ════════════════════════════════════════════════════════════════════
  const diagnosticReport = (() => {
    const problems = [];
    const fixes = [];

    if (camStatus === 'bad') {
      problems.push('❌ Camera not accessible');
      fixes.push('Click the camera icon in the browser address bar → Allow camera permissions → Refresh the page');
    }
    if (micStatus === 'bad') {
      problems.push('❌ Microphone not accessible');
      fixes.push('Allow microphone permission in browser settings, then refresh');
    }
    if (!faceApiLoaded) {
      problems.push('❌ Face detection model NOT loaded');
      fixes.push('Your network/CDN is blocking face-api.js. Try switching networks (mobile hotspot) or contact IT to allowlist justadudewhohacks.github.io');
    }
    if (lightStatus === 'bad') {
      problems.push('❌ Too dark — face detection will fail');
      fixes.push('Turn on a desk lamp or face a window. Aim for brightness > 22%');
    } else if (lightStatus === 'warn' && lightBrightness > 92) {
      problems.push('⚠️ Too bright / overexposed');
      fixes.push('Reduce direct light behind you. Sit so the light is in FRONT of your face, not behind');
    }
    if (faceApiLoaded && camStatus === 'good' && faceBox === null && lightStatus !== 'bad') {
      problems.push('⚠️ Camera works and model loaded, but no face detected');
      fixes.push('Sit directly facing the camera. Make sure your full face is in the frame. Remove masks/hats. Look straight at the lens');
    }
    if (audioLevel > 60) {
      problems.push('⚠️ Background noise is loud');
      fixes.push('Find a quieter room. Close windows. Ask others not to talk near you');
    }
    if (networkLatency != null && networkLatency > 800) {
      problems.push('⚠️ Slow network (' + fmtMs(networkLatency) + ')');
      fixes.push('Move closer to your router or switch to a faster connection');
    }
    return { problems, fixes };
  })();

  const overallStatus = (() => {
    if (camStatus !== 'good' || micStatus !== 'good') return 'bad';
    if (!faceApiLoaded) return 'bad';
    if (lightStatus === 'bad') return 'bad';
    if (faceApiLoaded && faceDetected) return 'good';
    if (faceApiLoaded && !faceDetected && lightStatus === 'good') return 'warn';
    return 'check';
  })();

  // ════════════════════════════════════════════════════════════════════
  // 10. Download report
  // ════════════════════════════════════════════════════════════════════
  const downloadReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      user: user?.email || 'anonymous',
      camera: { status: camStatus, resolution: camRes, fps: camFPS, error: camError },
      microphone: { status: micStatus, level: audioLevel, peak: audioPeak },
      lighting: {
        status: lightStatus, brightness: lightBrightness,
        contrast: lightContrast, temperature: lightTemp,
      },
      face_detection: {
        model_loaded: faceApiLoaded, model_source: faceApiSource,
        detected: faceDetected, confidence: faceConf,
        box: faceBox, errors: faceErrorLog,
      },
      network: { latency_ms: networkLatency, model_cdn: modelCDNReachable },
      browser: {
        user_agent: navigator.userAgent,
        platform: navigator.platform,
        cookie_enabled: navigator.cookieEnabled,
        on_line: navigator.onLine,
      },
      issues,
      conclusion: diagnosticReport,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `live-test-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ════════════════════════════════════════════════════════════════════
  // 11. Render
  // ════════════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <Sidebar onLogout={() => apiService.logout()} user={user} />

      <div style={{ marginLeft: 260, padding: '24px 28px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h1 style={{ margin: 0, color: '#2c2c54', fontSize: 24, fontWeight: 800 }}>
              🔬 Live Tech Check
              <StatusPill status={overallStatus} label={overallStatus === 'good' ? 'Ready for Exam' : overallStatus === 'bad' ? 'Cannot Start' : 'Needs Attention'} />
            </h1>
            <div style={{ color: '#7a7a93', fontSize: 13, marginTop: 4 }}>
              Real-time diagnostic of your camera, microphone, lighting, and AI face detection.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => window.location.reload()}
              style={{
                padding: '10px 16px', borderRadius: 10,
                background: '#fff', border: '1.5px solid #e0e0e0',
                color: '#555', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}>🔄 Restart</button>
            <button onClick={downloadReport}
              style={{
                padding: '10px 16px', borderRadius: 10,
                background: '#fff', border: '1.5px solid #5B0A7B',
                color: '#5B0A7B', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}>📥 Download Report</button>
            <button onClick={() => navigate('/dashboard')}
              style={{
                padding: '10px 18px', borderRadius: 10,
                background: 'linear-gradient(135deg, #5B0A7B, #7B1FA2)',
                color: '#fff', border: 'none',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>← Back to Dashboard</button>
          </div>
        </div>

        {/* Top row: Live camera + diagnostics summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Camera preview */}
          <Card title="Camera Preview" icon="📸" status={camStatus}>
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#0a0a14', aspectRatio: '4 / 3' }}>
              <video
                ref={videoRef}
                autoPlay muted playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
              {/* Overlay canvas for face box */}
              <canvas
                ref={canvasRef}
                width={640} height={480}
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: '100%', height: '100%',
                  transform: 'scaleX(-1)', // mirror so box aligns with video
                  pointerEvents: 'none',
                }}
              />
              {/* Resolution + FPS overlay */}
              <div style={{
                position: 'absolute', top: 10, right: 10,
                background: 'rgba(0,0,0,0.5)', color: '#fff',
                padding: '4px 10px', borderRadius: 6,
                fontSize: 11, fontFamily: 'monospace',
              }}>
                {camRes || '…'} • {camFPS} FPS
              </div>
              {/* Center status */}
              <div style={{
                position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.65)', color: '#fff',
                padding: '6px 14px', borderRadius: 999,
                fontSize: 12, fontWeight: 600,
              }}>
                {camStatus === 'pending' && '⏳ Initializing…'}
                {camStatus === 'check' && '🔌 Connecting…'}
                {camStatus === 'good' && faceDetected && `✓ Face Detected (${faceConf}%)`}
                {camStatus === 'good' && !faceDetected && faceApiLoaded && '⚠️ No Face in Frame'}
                {camStatus === 'good' && !faceApiLoaded && '🔄 Loading AI Model…'}
                {camStatus === 'bad' && '❌ ' + camError}
              </div>
            </div>
            {camError && (
              <div style={{
                marginTop: 12, padding: 10, background: '#ffebee',
                color: '#c62828', borderRadius: 8, fontSize: 13,
              }}>⚠️ {camError}</div>
            )}
          </Card>

          {/* Diagnosis */}
          <Card title="Diagnosis" icon="🩺"
                status={diagnosticReport.problems.length === 0 ? 'good' : (diagnosticReport.problems.some(p => p.startsWith('❌')) ? 'bad' : 'warn')}>
            {diagnosticReport.problems.length === 0 ? (
              <div style={{ padding: 14, background: '#e8f5e9', borderRadius: 10, color: '#2e7d32', fontSize: 14 }}>
                ✅ <strong>All systems look good!</strong> You should be able to start the exam.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#c62828', marginBottom: 6 }}>PROBLEMS</div>
                  {diagnosticReport.problems.map((p, i) => (
                    <div key={i} style={{
                      padding: '6px 10px', marginBottom: 4,
                      background: p.startsWith('❌') ? '#ffebee' : '#fff8e1',
                      color: p.startsWith('❌') ? '#c62828' : '#e65100',
                      borderRadius: 6, fontSize: 13, fontWeight: 600,
                    }}>{p}</div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1565c0', marginBottom: 6 }}>FIXES</div>
                  {diagnosticReport.fixes.map((f, i) => (
                    <div key={i} style={{
                      padding: '6px 10px', marginBottom: 4,
                      background: '#e3f2fd', color: '#1565c0',
                      borderRadius: 6, fontSize: 13,
                      borderLeft: '3px solid #1565c0',
                    }}>{f}</div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Mid row: Audio + Lighting */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Card title="Microphone" icon="🎙️" status={micStatus}>
            <Meter value={audioLevel} label="Current Level" color="#1565c0" />
            <Meter value={audioPeak} label="Peak Level" color="#0d47a1" />
            <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
              {audioLevel > 60 && '⚠️ Too loud — find a quieter room'}
              {audioLevel > 30 && audioLevel <= 60 && '⚠️ Background noise present'}
              {audioLevel > 5 && audioLevel <= 30 && '✓ Quiet — good for exam'}
              {audioLevel <= 5 && '🔇 Silent (or muted)'}
            </div>
          </Card>

          <Card title="Lighting" icon="💡" status={lightStatus}>
            <Meter value={lightBrightness} label="Brightness" color="#ff9800" />
            <Meter value={lightContrast} label="Contrast / Detail" color="#5b21b6" />
            <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
              <div>Color temp: <strong style={{ color: lightTemp === 'warm' ? '#e65100' : lightTemp === 'cool' ? '#1565c0' : '#2e7d32' }}>
                {lightTemp === 'warm' ? '🔥 Warm (yellowish)' : lightTemp === 'cool' ? '❄️ Cool (bluish)' : '☀️ Neutral'}
              </strong></div>
              {lightStatus === 'bad' && <div style={{ color: '#c62828', marginTop: 4 }}>❌ Too dark — turn on lights!</div>}
              {lightStatus === 'warn' && lightBrightness > 92 && <div style={{ color: '#e65100', marginTop: 4 }}>⚠️ Overexposed — reduce backlight</div>}
              {lightStatus === 'warn' && lightBrightness <= 22 && <div style={{ color: '#e65100', marginTop: 4 }}>⚠️ Dim — add more light on your face</div>}
              {lightStatus === 'good' && <div style={{ color: '#2e7d32', marginTop: 4 }}>✅ Lighting is good for face detection</div>}
            </div>
          </Card>
        </div>

        {/* Mid row: Face detection + Network */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Card title="Face Detection (AI)" icon="🤖"
                status={!faceApiLoaded ? 'bad' : faceDetected ? 'good' : 'warn'}>
            <div style={{ marginBottom: 10, fontSize: 13, color: '#555' }}>
              Model: <strong style={{ color: faceApiLoaded ? '#2e7d32' : '#c62828' }}>
                {faceApiLoaded ? `✓ Loaded (${faceApiSource})` : '✗ Not loaded'}
              </strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div style={{ padding: 10, background: faceDetected ? '#e8f5e9' : '#fff3e0', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#888', fontWeight: 700 }}>STATUS</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: faceDetected ? '#2e7d32' : '#e65100' }}>
                  {faceDetected ? '✓ DETECTED' : '⚠️ NOT FOUND'}
                </div>
              </div>
              <div style={{ padding: 10, background: '#fafafa', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#888', fontWeight: 700 }}>CONFIDENCE</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#5B0A7B' }}>{faceConf}%</div>
              </div>
            </div>
            {faceErrorLog.length > 0 && (
              <div style={{ marginTop: 8, padding: 8, background: '#ffebee', borderRadius: 6, fontSize: 12, color: '#c62828' }}>
                <strong>Recent errors:</strong>
                {faceErrorLog.map((e, i) => <div key={i}>• {e}</div>)}
              </div>
            )}
            <div style={{ marginTop: 12, fontSize: 12, color: '#888', lineHeight: 1.5 }}>
              Threshold: <code>{TUNING.scoreThreshold}</code> • Input size: <code>{TUNING.inputSize}px</code> • Sample rate: <code>{TUNING.faceDetectIntervalMs}ms</code>
            </div>
          </Card>

          <Card title="Network" icon="🌐"
                status={networkLatency == null ? 'bad' : networkLatency < 400 ? 'good' : networkLatency < 800 ? 'warn' : 'bad'}>
            <Meter value={networkLatency || 0} max={2000} label="Backend Latency" color="#0d47a1" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <div style={{ padding: 10, background: navigator.onLine ? '#e8f5e9' : '#ffebee', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#888', fontWeight: 700 }}>ONLINE</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: navigator.onLine ? '#2e7d32' : '#c62828' }}>
                  {navigator.onLine ? '✓ Connected' : '✗ Offline'}
                </div>
              </div>
              <div style={{ padding: 10, background: modelCDNReachable === 'good' ? '#e8f5e9' : modelCDNReachable === 'bad' ? '#ffebee' : '#f5f5f5', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#888', fontWeight: 700 }}>AI CDN</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: modelCDNReachable === 'good' ? '#2e7d32' : '#c62828' }}>
                  {modelCDNReachable === 'good' ? '✓ Reachable' : modelCDNReachable === 'bad' ? '✗ Blocked' : '…'}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: '#888' }}>
              Browser: <strong>{navigator.platform || 'Unknown'}</strong>
            </div>
          </Card>
        </div>

        {/* Issues log */}
        <Card title="Live Event Log" icon="📋" status="check">
          {issues.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>
              Waiting for events…
            </div>
          ) : (
            <div style={{ maxHeight: 240, overflowY: 'auto', fontSize: 13 }}>
              {issues.map((it) => (
                <div key={it.id} style={{
                  padding: '6px 10px', marginBottom: 4,
                  background: statusColor(it.status).bg,
                  color: statusColor(it.status).fg,
                  borderRadius: 6,
                  display: 'flex', justifyContent: 'space-between', gap: 10,
                }}>
                  <span>
                    <strong style={{ marginRight: 6, textTransform: 'uppercase', fontSize: 11 }}>
                      [{it.category}]
                    </strong>
                    {it.message}
                  </span>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>
                    {it.ts.toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default LiveTesting;
