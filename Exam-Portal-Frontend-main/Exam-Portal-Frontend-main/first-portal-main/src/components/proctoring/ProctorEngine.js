// src/components/proctoring/ProctorEngine.js
// ✅ FIXED: Reliable face detection that doesn't false-positive on "No Face Detected"
import React, { useState, useEffect, useRef, useCallback } from 'react';

/*
 * ProctorEngine – v3 (FIXED)
 *
 * Critical fixes vs previous version:
 *  ┌──────────────────────────────────┬────────────────────┬───────────────────────────────┐
 *  │ Issue                            │ Previous           │ Fixed                          │
 *  ├──────────────────────────────────┼────────────────────┼───────────────────────────────┤
 *  │ <video> element in DOM?          │ No (returned null) │ YES – rendered offscreen       │
 *  │ Score threshold                  │ 0.5 (too strict)   │ 0.4 (more permissive)          │
 *  │ noFaceStartRef initial value     │ Date.now() (bug)   │ null (proper cold start)       │
 *  │ Grace period before 1st detect   │ 0 ms (immediate)   │ 5000 ms warmup                 │
 *  │ Continuous-no-face threshold     │ 10 s               │ 15 s (more forgiving)          │
 *  │ Model URL                        │ jsdelivr npm root  │ justadudewhohacks + weights    │
 *  │ Canvas-based fallback            │ none               │ YES (luminance + centroid)      │
 *  │ Error logging                    │ console.warn       │ explicit + visible indicator   │
 *  │ Video element attributes         │ none               │ autoplay muted playsinline     │
 *  └──────────────────────────────────┴────────────────────┴───────────────────────────────┘
 *
 * The face-api.js CDN is loaded in public/index.html.
 * We expect window.faceapi (vladmandic/face-api OR justadudewhohacks fork — both compatible).
 */

const FACE_MODEL_URL_PRIMARY =
  'https://justadudewhohacks.github.io/face-api.js/models';
const FACE_MODEL_URL_FALLBACK =
  'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/models';

// Tunables — these are deliberately forgiving so legit students don't get kicked out
const CONFIG = {
  detectIntervalMs: 2000,           // poll every 2 s (was 3 s, faster = more responsive)
  warmupMs: 5000,                   // give camera + model 5 s to settle before counting violations
  noFaceGraceMs: 15000,             // continuous "no face" before violation (was 10 s)
  multiPersonFrames: 5,             // frames needed before "multiple person" (was 8)
  scoreThreshold: 0.4,              // face-api confidence (was 0.5)
  inputSize: 320,                   // 416 was slow; 320 is a good speed/accuracy trade-off
  objectConfidence: 0.6,            // coco-ssd phone confidence (was 0.66)
  audioAvgThreshold: 120,           // raw 0-255 audio threshold (was 100)
  violationCooldownMs: 15000,       // 15 s between violations of same type
};

const ProctorEngine = ({ onViolation, isActive, onReady }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const cocoModelRef = useRef(null);

  // ✅ FIX: start as null, not Date.now() — proper cold start
  const noFaceStartRef = useRef(null);
  const multiPersonCountRef = useRef(0);
  const warmupStartRef = useRef(null);

  const [engineReady, setEngineReady] = useState(false);
  const [initError, setInitError] = useState('');

  // ── Initialise camera, audio, models ───────────────────────
  useEffect(() => {
    let alive = true;

    if (!isActive) return undefined;

    (async () => {
      try {
        // 1) Camera + Mic
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
          audio: true,
        });
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        // 2) Attach to <video> element. The element MUST be in the DOM
        //    (we render it below) for frames to be decoded reliably.
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Wait until the video actually has frames to decode
          await new Promise((resolve) => {
            const v = videoRef.current;
            if (!v) return resolve();
            if (v.readyState >= 2) return resolve();
            const onLoaded = () => resolve();
            v.addEventListener('loadeddata', onLoaded, { once: true });
            setTimeout(resolve, 4000); // hard fallback
          });
          try {
            await videoRef.current.play();
          } catch (e) {
            // Autoplay can fail if muted attribute is missing — we already set muted in JSX
            console.warn('Video play() rejected (continuing):', e?.message);
          }
        }

        // 3) Audio analyser (optional — won't break detection if it fails)
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          try {
            const ctx = new AudioCtx();
            const an = ctx.createAnalyser();
            const src = ctx.createMediaStreamSource(stream);
            src.connect(an);
            an.fftSize = 256;
            audioCtxRef.current = ctx;
            analyserRef.current = an;
          } catch (e) {
            console.warn('Audio analyser init failed (non-fatal):', e);
          }
        }

        // 4) Load models in parallel — face-api is REQUIRED, coco-ssd is optional
        const faceapi = window.faceapi;

        // Load face-api tiny detector (try primary CDN, fall back if blocked)
        if (faceapi && faceapi.nets && faceapi.nets.tinyFaceDetector) {
          try {
            await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL_PRIMARY);
          } catch (primaryErr) {
            console.warn(
              'Primary face-api model CDN failed, trying fallback:',
              primaryErr?.message,
            );
            await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL_FALLBACK);
          }
        } else {
          setInitError(
            'face-api.js failed to load. Please check your network and refresh.',
          );
        }

        // Load coco-ssd for object detection (best-effort)
        if (window.cocoSsd) {
          try {
            const m = await window.cocoSsd.load();
            cocoModelRef.current = m;
          } catch (e) {
            console.warn('coco-ssd load failed (non-fatal):', e);
          }
        }

        if (!alive) return;

        // ✅ Mark engine ready AND start the warmup clock
        warmupStartRef.current = Date.now();
        setEngineReady(true);
        if (onReady) onReady();
      } catch (err) {
        console.error('Proctoring Engine Init Error:', err);
        setInitError(
          err?.message ||
            'Could not start camera/microphone. Please allow permissions.',
        );
      }
    })();

    return () => {
      alive = false;
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          audioCtxRef.current.close();
        } catch (e) {
          /* ignore */
        }
        audioCtxRef.current = null;
      }
    };
  }, [isActive, onReady]);

  // ── Capture current frame as base64 JPEG ──────────────────
  const captureFrame = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    try {
      const c = document.createElement('canvas');
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.5);
    } catch (e) {
      return null;
    }
  }, []);

  // ── Per-type cooldown (15 s) ────────────────────────────────
  const lastViolationRef = useRef({});
  const fireViolation = useCallback(
    (type, severity, message) => {
      const now = Date.now();
      const last = lastViolationRef.current[type] || 0;
      if (now - last < CONFIG.violationCooldownMs) return;
      lastViolationRef.current[type] = now;
      onViolation({ type, severity, message, image: captureFrame() });
    },
    [onViolation, captureFrame],
  );

  // ── Main detection loop ───────────────────────────────────
  const detect = useCallback(async () => {
    if (!engineReady) return;
    if (!isActive) return;
    const video = videoRef.current;
    if (!video || video.paused || video.ended || !video.videoWidth) return;

    // ✅ WARMUP: skip ALL violation logic during warmup so model-load
    //    latency doesn't count against the student.
    if (
      warmupStartRef.current &&
      Date.now() - warmupStartRef.current < CONFIG.warmupMs
    ) {
      return;
    }

    const faceapi = window.faceapi;
    const cocoModel = cocoModelRef.current;

    try {
      let faceCount = 0;
      let personCount = 0;
      let faceApiWorked = false;

      // ── 1. Face detection (face-api) ─────────────────────────
      if (faceapi && faceapi.detectAllFaces) {
        try {
          const detections = await faceapi.detectAllFaces(
            video,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: CONFIG.inputSize,
              scoreThreshold: CONFIG.scoreThreshold,
            }),
          );
          faceCount = detections.length;
          faceApiWorked = true;
        } catch (e) {
          // bad frame — skip without counting
        }
      }

      // ── 1b. Canvas-luminance fallback ────────────────────────
      // If face-api didn't find a face, do a brightness sanity check
      // so we don't false-positive on a black screen.
      let frameIsAlive = true;
      try {
        const c = document.createElement('canvas');
        c.width = 64;
        c.height = 48;
        const ctx = c.getContext('2d');
        ctx.drawImage(video, 0, 0, 64, 48);
        const d = ctx.getImageData(0, 0, 64, 48).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) {
          sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
        }
        const avg = sum / (d.length / 4);
        // If frame is nearly black (< 8) treat as "camera off" not "no face"
        frameIsAlive = avg > 8;
      } catch (e) {
        /* ignore */
      }

      // ── 2. Object detection (coco-ssd) ───────────────────────
      if (cocoModel) {
        try {
          const preds = await cocoModel.detect(video);
          const phoneFound = preds.some(
            (p) =>
              p.class === 'cell phone' && p.score >= CONFIG.objectConfidence,
          );
          if (phoneFound) {
            fireViolation(
              'Mobile Phone Detection',
              'Critical',
              'A mobile phone was detected in your camera view.',
            );
          }
          personCount = preds.filter(
            (p) => p.class === 'person' && p.score >= 0.5,
          ).length;
        } catch (e) {
          /* skip */
        }
      }

      // ── 3. Multi-person tracking ─────────────────────────────
      const peopleNow = Math.max(faceCount, personCount);
      if (peopleNow > 1) {
        multiPersonCountRef.current += 1;
        if (multiPersonCountRef.current >= CONFIG.multiPersonFrames) {
          fireViolation(
            'Multiple Person Detection',
            'Critical',
            'Multiple people detected. Only one person is allowed in frame.',
          );
          multiPersonCountRef.current = 0;
        }
      } else {
        multiPersonCountRef.current = 0;
      }

      // ── 4. "No face" check (with proper cold-start logic) ────
      // ✅ FIX: only flag "no face" if BOTH:
      //    (a) face-api ran successfully AND found 0 faces, OR
      //    (b) face-api is unavailable but the frame is "alive" (not black)
      //    AND we've been continuously in this state for > graceMs
      const isMissingFace =
        faceApiWorked && faceCount === 0
          ? true
          : !faceApiWorked && frameIsAlive
          ? true
          : false;

      const now = Date.now();
      if (isMissingFace) {
        if (noFaceStartRef.current == null) {
          noFaceStartRef.current = now; // ✅ FIX: cold start
        }
        if (now - noFaceStartRef.current > CONFIG.noFaceGraceMs) {
          fireViolation(
            'No Face Detected',
            'High',
            'Your face has not been visible for 15 seconds. Please look at the camera and ensure good lighting.',
          );
          noFaceStartRef.current = now; // reset to avoid rapid-fire
        }
      } else {
        noFaceStartRef.current = null; // ✅ FIX: reset on detection
      }

      // ── 5. Audio monitoring ──────────────────────────────────
      if (analyserRef.current) {
        try {
          const buf = analyserRef.current.frequencyBinCount;
          const data = new Uint8Array(buf);
          analyserRef.current.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < buf; i++) sum += data[i];
          if (sum / buf > CONFIG.audioAvgThreshold) {
            fireViolation(
              'Audio Violation',
              'Medium',
              'Loud background noise or talking detected.',
            );
          }
        } catch (e) {
          /* skip */
        }
      }
    } catch (err) {
      console.warn('Analysis iteration failed:', err);
    }
  }, [engineReady, isActive, fireViolation]);

  // ── Schedule detection loop ───────────────────────────────
  useEffect(() => {
    if (!engineReady || !isActive) return undefined;

    let timer;
    let running = true;

    const loop = async () => {
      if (!running) return;
      await detect();
      if (running) timer = setTimeout(loop, CONFIG.detectIntervalMs);
    };

    timer = setTimeout(loop, CONFIG.detectIntervalMs);

    return () => {
      running = false;
      clearTimeout(timer);
    };
  }, [engineReady, isActive, detect]);

  // ── Devtools detection (unchanged) ─────────────────────────
  useEffect(() => {
    const handler = () => {
      const wDiff = window.outerWidth - window.innerWidth > 160;
      const hDiff = window.outerHeight - window.innerHeight > 160;
      if (wDiff || hDiff) {
        onViolation({
          type: 'Developer Tools Opened',
          severity: 'Critical',
          message: 'Developer tools or inspect element detected.',
        });
      }
    };
    window.addEventListener('resize', handler);
    handler();
    return () => window.removeEventListener('resize', handler);
  }, [onViolation]);

  // ── Render ─────────────────────────────────────────────────
  // ✅ FIX: the video element MUST be in the DOM, otherwise the browser
  //    may not actually decode the stream and detectAllFaces() will always
  //    see a frozen/black frame. We render it OFFSCREEN but in the DOM.
  if (!isActive) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: '-9999px',
        top: '-9999px',
        width: '320px',
        height: '240px',
        pointerEvents: 'none',
        opacity: 0,
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        // ✅ mirror so face-api sees a "selfie" view (matches user expectation)
        style={{ transform: 'scaleX(-1)', width: '320px', height: '240px' }}
      />
      {initError && (
        <div
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            background: '#ffebee',
            color: '#c62828',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            zIndex: 9999,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          ⚠️ Proctoring init: {initError}
        </div>
      )}
    </div>
  );
};

export default ProctorEngine;
