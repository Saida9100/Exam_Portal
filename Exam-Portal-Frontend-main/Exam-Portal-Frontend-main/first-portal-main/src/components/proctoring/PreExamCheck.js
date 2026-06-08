import React, { useState, useEffect, useRef } from 'react';
import { Spinner } from 'react-bootstrap';

const CheckItem = ({ label, passed, loading }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#f8f9fa', borderRadius: 8 }}>
    <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {loading ? (
        <Spinner animation="border" size="sm" />
      ) : passed ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
    </div>
    <span style={{ fontWeight: 600, color: passed ? '#2e7d32' : '#333' }}>{label}</span>
    {loading && <span style={{ fontSize: 12, color: '#888' }}>Checking...</span>}
  </div>
);

const PreExamCheck = ({ onComplete, examTitle }) => {
  const videoRef = useRef(null);
  const [status, setStatus] = useState({ camera: false, mic: false, face: false, lighting: false });
  const [loadingState, setLoadingState] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let stream = null;
    let cancelled = false;
    let checkTimer = null;

    const startCheck = async () => {
      try {
        setLoadingState('requesting');
        setErrorMsg('');

        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStatus(s => ({ ...s, camera: true, mic: true }));
        setLoadingState('checking');

        // Load face-api if not already loaded
        if (!window.faceapi) {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js';
            s.onload = resolve;
            s.onerror = reject;
            document.body.appendChild(s);
          });
        }

        if (!window.faceapiNetsLoaded) {
          await window.faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model');
          window.faceapiNetsLoaded = true;
        }

        const runCheck = async () => {
          if (cancelled || !videoRef.current || videoRef.current.paused) {
            if (!cancelled) checkTimer = setTimeout(runCheck, 500);
            return;
          }
          try {
            const detections = await window.faceapi.detectAllFaces(
              videoRef.current,
              new window.faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 })
            );
            const hasFace = detections.length >= 1;
            if (hasFace) {
              setStatus(s => ({ ...s, face: true, lighting: true }));
              setLoadingState('ready');
              return;
            } else {
              setStatus(s => ({ ...s, face: false, lighting: false }));
            }
          } catch (e) {
            console.warn('Check iteration failed', e);
          }
          if (!cancelled) checkTimer = setTimeout(runCheck, 500);
        };

        checkTimer = setTimeout(runCheck, 1000);
      } catch (err) {
        console.error('Error starting check:', err);
        setErrorMsg(err.message || 'Failed to access camera/microphone');
        setLoadingState('error');
      }
    };

    startCheck();

    return () => {
      cancelled = true;
      if (checkTimer) clearTimeout(checkTimer);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  const allPassed = status.camera && status.mic && status.face && status.lighting;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f5f5f5', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 32, maxWidth: 600, width: '100%', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
        <h3 style={{ textAlign: 'center', color: '#2D0040', marginBottom: 24 }}>System Environment Check</h3>
        <p style={{ textAlign: 'center', color: '#555', marginBottom: 24 }}>
          Before starting <strong>{examTitle}</strong>, we need to verify your camera, microphone, and testing environment.
        </p>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ flex: '1 1 250px', maxWidth: 300 }}>
            <div style={{ width: '100%', aspectRatio: '4/3', background: '#000', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
              <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} onLoadedMetadata={() => videoRef.current.play()} />
              {loadingState === 'requesting' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
                  <Spinner animation="border" variant="light" />
                </div>
              )}
            </div>
          </div>
          <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CheckItem label="Camera Access" passed={status.camera} loading={loadingState === 'requesting'} />
            <CheckItem label="Microphone Access" passed={status.mic} loading={loadingState === 'requesting'} />
            <CheckItem label="Face Detected" passed={status.face} loading={loadingState === 'checking'} />
            <CheckItem label="Lighting OK" passed={status.lighting} loading={loadingState === 'checking'} />
          </div>
        </div>
        {errorMsg && (
          <div style={{ marginTop: 16, padding: 12, background: '#ffebee', borderRadius: 8, color: '#c62828', textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}
        {allPassed && (
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <div style={{ color: '#4caf50', fontWeight: 700, marginBottom: 12 }}>✅ All checks passed! You're ready to start.</div>
            <button onClick={onComplete} style={{ padding: '12px 40px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
              Begin Exam
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreExamCheck;
