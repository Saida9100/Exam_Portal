import React, { useState, useEffect, useRef, useCallback } from 'react';

/*
 * ProctorEngine  – fixed version
 *
 * This mirrors the EXACT structure of the deployed ProctorEngine (the `bi` component
 * in the production bundle) but with corrected detection thresholds so students don't
 * get false-terminated during exams.
 *
 * Key changes vs deployed code:
 * ┌──────────────────────────┬──────────────┬───────────────┐
 * │ Setting                  │ Deployed     │ This version  │
 * ├──────────────────────────┼──────────────┼───────────────┤
 * │ Detection interval       │ 300 ms       │ 3000 ms       │
 * │ Face scoreThreshold      │ 0.2          │ 0.5           │
 * │ No-face trigger time     │ 3 s          │ 10 s          │
 * │ Object classes           │ 6 (phone,    │ 1 (cell phone)│
 * │                          │ laptop,book…)│               │
 * │ Object confidence        │ 0.50         │ 0.66          │
 * │ Multi-person frames      │ 2            │ 8             │
 * │ Audio avg threshold      │ 40 / 255     │ 100 / 255     │
 * └──────────────────────────┴──────────────┴───────────────┘
 */

const ProctorEngine = ({ onViolation, isActive, onReady }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const cocoModelRef = useRef(null);

  const [engineReady, setEngineReady] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('Initializing ML Engine...');

  // detection state refs
  const noFaceStartRef = useRef(Date.now());
  const multiPersonCountRef = useRef(0);

  // ── Initialise camera, audio, models ───────────────────────
  useEffect(() => {
    let alive = true;

    if (!isActive) return;

    (async () => {
      try {
        setStatusMsg('Requesting Camera & Mic...');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        if (videoRef.current) videoRef.current.srcObject = stream;

        // audio analyser
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          audioCtxRef.current = new AudioCtx();
          analyserRef.current = audioCtxRef.current.createAnalyser();
          sourceRef.current = audioCtxRef.current.createMediaStreamSource(stream);
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.fftSize = 256;
        }

        // load models
        setStatusMsg('Loading AI Models...');
        const promises = [];

        const cocoSsd = window.cocoSsd;
        if (cocoSsd) {
          promises.push(cocoSsd.load().then(m => { cocoModelRef.current = m; }));
        }

        const faceapi = window.faceapi;
        if (faceapi) {
          promises.push(
            faceapi.nets.tinyFaceDetector.loadFromUri(
              'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/'
            )
          );
        }

        await Promise.all(promises);

        if (!alive) return;
        setEngineReady(true);
        setStatusMsg('Engine Active');
        if (onReady) onReady();
      } catch (err) {
        console.error('Proctoring Engine Init Error:', err);
        setStatusMsg('Error starting engine: ' + err.message);
      }
    })();

    return () => {
      alive = false;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try { audioCtxRef.current.close(); } catch (_) {}
        audioCtxRef.current = null;
      }
    };
  }, [isActive, onReady]);

  // ── Capture current frame as base64 JPEG ──────────────────
  const captureFrame = useCallback(() => {
    const v = videoRef.current;
    if (!v) return null;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.5);
  }, []);

  // ── Per-type cooldown tracking (15 s) ─────────────────────
  const lastViolationRef = useRef({});
  const fireViolation = useCallback((type, severity, message) => {
    const now = Date.now();
    const last = lastViolationRef.current[type] || 0;
    if (now - last < 15000) return;           // 15 s cooldown
    lastViolationRef.current[type] = now;
    onViolation({ type, severity, message, image: captureFrame() });
  }, [onViolation, captureFrame]);

  // ── Main detection loop ───────────────────────────────────
  const detect = useCallback(async () => {
    if (!engineReady || !videoRef.current || videoRef.current.paused || !isActive) return;

    const video = videoRef.current;
    const faceapi = window.faceapi;
    const cocoModel = cocoModelRef.current;

    try {
      let faceCount = 0;
      let personCount = 0;

      /* ── 1. Face detection (face-api) ────────────────────── */
      if (faceapi && faceapi.detectAllFaces) {
        try {
          const detections = await faceapi.detectAllFaces(
            video,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })
          );
          faceCount = detections.length;
        } catch (_) { /* skip bad frame */ }

        const now = Date.now();
        if (faceCount === 0) {
          if (noFaceStartRef.current === 0) noFaceStartRef.current = now;
          if (now - noFaceStartRef.current > 10000) {          // 10 s continuous
            fireViolation('No Face Detected', 'High',
              'No face detected for 10 seconds. Please ensure your face is visible.');
            noFaceStartRef.current = now;
          }
        } else {
          noFaceStartRef.current = 0;
        }
      }

      /* ── 2. Object detection (coco-ssd) ─────────────────── */
      if (cocoModel) {
        try {
          const preds = await cocoModel.detect(video);
          // Only flag actual cell phones at high confidence
          const phoneFound = preds.some(p => p.class === 'cell phone' && p.score >= 0.66);
          if (phoneFound) {
            fireViolation('Mobile Phone Detection', 'Critical',
              'A mobile phone was detected in your camera view.');
          }
          personCount = preds.filter(p => p.class === 'person' && p.score >= 0.5).length;
        } catch (_) { /* skip */ }
      }

      /* ── 3. Multiple person ──────────────────────────────── */
      if (Math.max(faceCount, personCount) > 1) {
        multiPersonCountRef.current += 1;
        if (multiPersonCountRef.current >= 8) {                 // ~24 s at 3 s interval
          fireViolation('Multiple Person Detection', 'Critical',
            'Multiple people detected. Only one person is allowed in frame.');
          multiPersonCountRef.current = 0;
        }
      } else {
        multiPersonCountRef.current = 0;
      }

      /* ── 4. Audio monitoring ─────────────────────────────── */
      if (analyserRef.current) {
        try {
          const buf = analyserRef.current.frequencyBinCount;
          const data = new Uint8Array(buf);
          analyserRef.current.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < buf; i++) sum += data[i];
          if (sum / buf > 100) {
            fireViolation('Audio Violation', 'Medium',
              'Loud background noise or talking detected.');
          }
        } catch (_) { /* skip */ }
      }
    } catch (err) {
      console.warn('Analysis iteration failed:', err);
    }
  }, [engineReady, isActive, fireViolation]);

  // schedule detection every 3 000 ms
  useEffect(() => {
    let timer, running = true;

    const loop = async () => {
      if (!running) return;
      await detect();
      if (running) timer = setTimeout(loop, 3000);
    };

    if (engineReady && isActive) {
      timer = setTimeout(loop, 3000);
    }

    return () => { running = false; clearTimeout(timer); };
  }, [engineReady, isActive, detect]);

  // hide loading overlay after 3 s
  useEffect(() => {
    if (engineReady) {
      const t = setTimeout(() => setShowLoading(false), 3000);
      return () => clearTimeout(t);
    }
  }, [engineReady]);

  // dev-tools detection (same as deployed code)
  useEffect(() => {
    const handler = () => {
      const wDiff = window.outerWidth - window.innerWidth > 160;
      const hDiff = window.outerHeight - window.innerHeight > 160;
      if (wDiff || hDiff) {
        onViolation({ type: 'Developer Tools Opened', severity: 'Critical',
          message: 'Developer tools or inspect element detected.' });
      }
    };
    window.addEventListener('resize', handler);
    handler();
    return () => window.removeEventListener('resize', handler);
  }, [onViolation]);

  /* ── Render: Live Proctoring widget (bottom-left, same as deployed) ── */
  if (!isActive) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: 20, width: 200,
      background: '#fff', borderRadius: 12,
      boxShadow: '0 8px 30px rgba(0,0,0,0.15)', overflow: 'hidden',
      zIndex: 9999, display: 'flex', flexDirection: 'column'
    }}>
      {/* header */}
      <div style={{
        background: '#2D0040', color: '#fff', padding: '6px 12px',
        fontSize: 12, fontWeight: 600, display: 'flex', justifyContent: 'space-between'
      }}>
        <span>Live Proctoring</span>
        {engineReady
          ? <span style={{ color: '#4caf50' }}>● Active</span>
          : <span style={{ color: '#ff9800' }}>● Loading</span>}
      </div>

      {/* video preview */}
      <div style={{ position: 'relative', background: '#000', width: '100%', aspectRatio: '4/3' }}>
        <video ref={videoRef} autoPlay muted playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        {showLoading && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'rgba(45,0,64,0.9)', color: '#fff',
            padding: '6px 10px', fontSize: 11, textAlign: 'center'
          }}>
            {statusMsg}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProctorEngine;
