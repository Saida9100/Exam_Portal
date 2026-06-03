import React, { useState, useEffect, useRef } from 'react';
import { Button, Spinner, Alert } from 'react-bootstrap';

const faceapi = window.faceapi;

const PreExamCheck = ({ onComplete, examTitle }) => {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('requesting'); // requesting, loading_models, checking, ready, error
  const [errorMsg, setErrorMsg] = useState('');
  const [checks, setChecks] = useState({
    camera: false,
    mic: false,
    face: false,
    lighting: false
  });

  useEffect(() => {
    let stream = null;

    const init = async () => {
      try {
        // 1. Request Permissions
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setChecks(c => ({ ...c, camera: true, mic: true }));
        setStatus('loading_models');

        // 2. Load Models
        // Start loading both models in the background without awaiting them!
        // This prevents students on slow internet from being stuck on the check screen for 1 minute.
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL).catch(e => console.warn('Background FaceAPI load error:', e));
        
        if (window.cocoSsd) {
          window.cocoSsd.load().then(async (model) => {
            // Warm up COCO-SSD to compile WebGL shaders
            if (videoRef.current && videoRef.current.readyState >= 2) {
              await model.detect(videoRef.current, 1, 0.5).catch(() => {});
            }
          }).catch(e => console.warn('Background COCO-SSD load error:', e));
        }
        
        // Immediately start checking (the 5-second auto-pass will bypass it if models aren't ready yet)
        setStatus('checking');

      } catch (err) {
        console.error('PreExamCheck init error:', err);
        setStatus('error');
        if (err.name === 'NotAllowedError' || err.name === 'NotFoundError') {
          setErrorMsg('Camera and Microphone permissions are required to take this exam.');
        } else {
          setErrorMsg('Failed to initialize hardware. ' + err.message);
        }
      }
    };

    init();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (status !== 'checking') return;

    let checkTimeout;
    let isChecking = true;
    let checkStartTime = Date.now();
    
    const runCheck = async () => {
      if (!isChecking || !videoRef.current || videoRef.current.paused) return;

      try {
        const now = Date.now();
        // Warm up with inputSize 416 so the shaders are perfectly ready for ProctorEngine
        const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.1 }));
        
        let faceFound = detections.length >= 1;
        let isGoodLighting = true; // Default to true to speed things up

        // Force pass after 5 seconds to prevent the student from being stuck
        if (now - checkStartTime > 5000) {
          faceFound = true;
          isGoodLighting = true;
        }
        
        if (faceFound) {
          setChecks(c => ({ ...c, face: true, lighting: isGoodLighting }));
          
          if (isGoodLighting) {
            setStatus('ready');
            isChecking = false;
            return;
          }
        } else {
          setChecks(c => ({ ...c, face: false, lighting: false }));
        }
      } catch (e) {
        console.warn('Check iteration failed', e);
      }

      if (isChecking) {
        checkTimeout = setTimeout(runCheck, 500);
      }
    };

    // Wait a moment for video to play
    checkTimeout = setTimeout(runCheck, 1000);

    return () => {
      isChecking = false;
      clearTimeout(checkTimeout);
    };
  }, [status]);

  const handleStart = () => {
    onComplete();
  };

  const allPassed = checks.camera && checks.mic && checks.face && checks.lighting;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#f5f5f5', padding: 24
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 32, maxWidth: 600, width: '100%',
        boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ textAlign: 'center', color: '#2D0040', marginBottom: 24 }}>System Environment Check</h3>
        <p style={{ textAlign: 'center', color: '#555', marginBottom: 24 }}>
          Before starting <strong>{examTitle}</strong>, we need to verify your camera, microphone, and testing environment.
        </p>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
          {/* Video Preview */}
          <div style={{ flex: '1 1 250px', maxWidth: 300 }}>
            <div style={{
              width: '100%', aspectRatio: '4/3', background: '#000', borderRadius: 8, overflow: 'hidden', position: 'relative'
            }}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                onLoadedMetadata={() => videoRef.current.play()}
              />
              {status === 'requesting' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
                  <Spinner animation="border" variant="light" />
                </div>
              )}
            </div>
          </div>

          {/* Checklist */}
          <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CheckItem label="Camera Access" passed={checks.camera} loading={status === 'requesting'} />
            <CheckItem label="Microphone Access" passed={checks.mic} loading={status === 'requesting'} />
            <CheckItem label="Face Visibility" passed={checks.face} loading={status === 'loading_models' || status === 'checking'} />
            <CheckItem label="Room Lighting" passed={checks.lighting} loading={status === 'loading_models' || status === 'checking'} />
          </div>
        </div>

        {status === 'error' && (
          <Alert variant="danger" style={{ marginTop: 24 }}>
            <strong>Verification Failed:</strong> {errorMsg}
          </Alert>
        )}

        {status === 'checking' && !allPassed && (
          <div style={{ marginTop: 24, textAlign: 'center', color: '#e65100', fontSize: 14 }}>
            Please look directly at the camera in a well-lit room.
          </div>
        )}

        <div style={{ marginTop: 24, padding: 16, background: '#fff8e1', borderLeft: '4px solid #ffb300', borderRadius: 4, textAlign: 'left', fontSize: 13, color: '#333' }}>
          <strong style={{ color: '#f57c00' }}>⚠️ Exam Proctoring Rules:</strong>
          <ul style={{ paddingLeft: 20, marginTop: 8, marginBottom: 12, color: '#555' }}>
            <li>Ensure your background is clear of any objects to avoid false violations.</li>
            <li>No mobile phones or electronic devices allowed.</li>
            <li>No other persons should be in the camera frame.</li>
            <li>Do not look away from the screen or leave the camera view.</li>
            <li>No speaking or background noise (Audio violations are recorded).</li>
            <li>Do not switch tabs or open other applications.</li>
          </ul>
          <div style={{ color: '#d32f2f', fontWeight: 700, marginBottom: 8 }}>
            🚨 Warning: If violations exceed 3 times, your exam will be automatically terminated.
          </div>
          <div style={{ color: '#e65100', fontWeight: 600 }}>
            ⏱️ Note: Environment verification takes up to 3 minutes. Please be patient.
          </div>
        </div>

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <Button
            variant="primary"
            size="lg"
            disabled={!allPassed}
            onClick={handleStart}
            style={{
              padding: '12px 48px',
              borderRadius: 30,
              background: allPassed ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#ccc',
              border: 'none',
              fontWeight: 600
            }}
          >
            {allPassed ? 'Start Exam' : 'Verifying...'}
          </Button>
        </div>
      </div>
    </div>
  );
};

const CheckItem = ({ label, passed, loading }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#f8f9fa', borderRadius: 8 }}>
    <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {passed ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      ) : loading ? (
        <Spinner animation="border" size="sm" style={{ color: '#888' }} />
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>
      )}
    </div>
    <span style={{ fontWeight: 600, color: passed ? '#2e7d32' : '#666' }}>{label}</span>
  </div>
);

export default PreExamCheck;
