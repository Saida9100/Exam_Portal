import React, { useState, useEffect, useRef, useCallback } from 'react';

/*
 * ProctorEngine — FIXED version
 *
 * Changes from original deployed version:
 * 1. Detection interval: 300ms → 3000ms (was firing 3x per second!)
 * 2. Face detection scoreThreshold: 0.1 → 0.5 (was too sensitive → false "No Face" warnings)
 * 3. Audio threshold: 40 → 100 (was triggering on ambient room noise)
 * 4. Object detection: only "cell phone" now (was also "book", "laptop", "keyboard", "mouse", "remote")
 * 5. Object detection confidence: 0.5 → 0.65 (was flagging random objects)
 * 6. Multiple person frames needed: 2 → 8 consecutive (0.6s → 24s before flagging)
 * 7. Added per-type cooldown of 15 seconds (was 5s debounce in ExamDashboard, but engine itself had none)
 * 8. Removed Low Light check (was triggering with brightness < 15/255 which is pitch black but
 *    combined with face detection misses caused false cascading warnings)
 * 9. Face "no face" threshold: 3 seconds → 10 seconds continuous before flagging
 */

const ProctorEngine = ({ onViolation, isActive, onReady }) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [engineActive, setEngineActive] = useState(false);

  // Detection state refs
  const cocoModelRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const noFaceStartRef = useRef(Date.now()); // When we first detected no face
  const multiPersonCountRef = useRef(0);     // Consecutive frames with multiple people
  const lastViolationTimeRef = useRef({});    // Per-type cooldown tracking
  const cancelledRef = useRef(false);

  // Cooldown between same-type violations (ms)
  const VIOLATION_COOLDOWN = 15000;  // 15 seconds

  // Load coco-ssd model
  const loadCocoSSD = useCallback(async () => {
    if (cocoModelRef.current) return cocoModelRef.current;
    try {
      if (!window.cocoSsd) {
        // coco-ssd is loaded via CDN script tag in index.html
        console.warn('cocoSsd not available on window');
        return null;
      }
      const model = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
      cocoModelRef.current = model;
      return model;
    } catch (e) {
      console.warn('Failed to load coco-ssd:', e);
      return null;
    }
  }, []);

  // Setup audio analyser
  const setupAudio = useCallback((mediaStream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      const source = ctx.createMediaStreamSource(mediaStream);
      source.connect(analyser);
      analyser.fftSize = 512;
      audioContextRef.current = ctx;
      analyserRef.current = analyser;
    } catch (e) {
      console.warn('Audio setup failed:', e);
    }
  }, []);

  // Capture current frame as image
  const captureFrame = useCallback(() => {
    if (!videoRef.current) return null;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.5);
  }, []);

  // Send violation with cooldown
  const fireViolation = useCallback((type, severity, message) => {
    const now = Date.now();
    const lastTime = lastViolationTimeRef.current[type] || 0;
    if (now - lastTime < VIOLATION_COOLDOWN) return; // Skip if cooldown not elapsed

    lastViolationTimeRef.current[type] = now;
    onViolation({ type, severity, message, image: captureFrame() });
  }, [onViolation, captureFrame]);

  // Main detection loop
  const runDetection = useCallback(async () => {
    if (cancelledRef.current || !videoRef.current || videoRef.current.paused || !isActive) return;

    const video = videoRef.current;
    const faceApi = window.faceapi;
    const cocoModel = cocoModelRef.current;

    try {
      // ── 1. FACE DETECTION (face-api) ──
      // Higher threshold (0.5) to reduce false "No Face" warnings
      if (faceApi && faceApi.detectAllFaces) {
        let faceCount = 0;
        try {
          const detections = await faceApi.detectAllFaces(
            video,
            new faceApi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
          );
          faceCount = detections.length;
        } catch (faceErr) {
          // face-api can throw on bad frames — skip this iteration
          console.warn('Face detection error (skipping):', faceErr.message);
        }

        const now = Date.now();
        if (faceCount === 0) {
          // Only warn if no face for 10+ continuous seconds
          if (noFaceStartRef.current === 0) {
            noFaceStartRef.current = now;
          } else if (now - noFaceStartRef.current > 10000) {
            fireViolation(
              'No Face Detected',
              'High',
              'No face detected for 10 seconds. Please ensure your face is visible.'
            );
          }
        } else {
          noFaceStartRef.current = 0; // Reset timer when face is detected
        }

        // ── 3. MULTIPLE PERSON ──
        // Require 8+ consecutive frames with multiple faces (at 3s interval = 24 seconds)
        if (faceCount > 1) {
          multiPersonCountRef.current += 1;
          if (multiPersonCountRef.current >= 8) {
            fireViolation(
              'Multiple Person Detection',
              'Critical',
              'Multiple faces detected. Only one person should be in the camera view.'
            );
            multiPersonCountRef.current = 0;
          }
        } else {
          multiPersonCountRef.current = 0;
        }
      }

      // ── 2. OBJECT DETECTION (coco-ssd) ──
      // Only detect "cell phone" with higher confidence (0.65)
      if (cocoModel && video.videoWidth > 0 && video.videoHeight > 0) {
        try {
          const predictions = await cocoModel.detect(video);
          // Only flag actual cell phones with high confidence
          const phoneDetected = predictions.some(p =>
            p.class === 'cell phone' && p.score >= 0.65
          );
          if (phoneDetected) {
            fireViolation(
              'Mobile Phone Detection',
              'Critical',
              'A mobile phone was detected in your camera view.'
            );
          }
        } catch (cocoErr) {
          console.warn('Object detection error (skipping):', cocoErr.message);
        }
      }

      // ── 4. AUDIO MONITORING ──
      // Higher threshold (100) to avoid false positives from ambient noise
      if (analyserRef.current) {
        try {
          const bufferLength = analyserRef.current.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
          const avg = sum / bufferLength;

          if (avg > 100) {
            fireViolation(
              'Audio Violation',
              'Medium',
              'Loud background noise or talking detected. Please keep quiet.'
            );
          }
        } catch (audioErr) {
          console.warn('Audio analysis error (skipping):', audioErr.message);
        }
      }
    } catch (err) {
      console.warn('Proctor detection iteration failed:', err);
    }

    // Schedule next detection (3000ms interval instead of 300ms)
    if (!cancelledRef.current && isActive) {
      setTimeout(runDetection, 3000);
    }
  }, [isActive, fireViolation]);

  // Start/stop engine
  useEffect(() => {
    let localStream = null;

    const startEngine = async () => {
      try {
        cancelledRef.current = false;

        // Get camera + mic
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelledRef.current) { localStream.getTracks().forEach(t => t.stop()); return; }

        setStream(localStream);
        if (videoRef.current) {
          videoRef.current.srcObject = localStream;
        }

        // Load coco-ssd model in background
        loadCocoSSD();

        // Setup audio analyser
        setupAudio(localStream);

        setEngineActive(true);
        if (onReady) onReady();

        // Start detection loop after a 5-second grace period
        // (gives models time to load and student to settle)
        setTimeout(() => {
          if (!cancelledRef.current) runDetection();
        }, 5000);
      } catch (err) {
        console.error('Error starting proctor engine:', err);
      }
    };

    if (isActive) {
      startEngine();
    }

    return () => {
      cancelledRef.current = true;
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch (e) { /* ignore */ }
        audioContextRef.current = null;
      }
    };
  }, [isActive, loadCocoSSD, setupAudio, runDetection, onReady]);

  // Hidden video element for camera feed
  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      style={{ display: 'none' }}
    />
  );
};

export default ProctorEngine;
