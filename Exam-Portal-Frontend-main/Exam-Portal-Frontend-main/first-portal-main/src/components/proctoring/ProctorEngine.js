/* eslint-disable */
import React, { useEffect, useRef, useState, useCallback } from 'react';

// Extract global variables injected via CDN in index.html
const cocoSsd = window.cocoSsd;
const faceapi = window.faceapi;

const ProctorEngine = ({ onViolation, isActive, onReady }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  
  // Audio context for noise detection
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [showFeed, setShowFeed] = useState(true);
  const objectModelRef = useRef(null);
  const intervalRef = useRef(null);
  const missingFaceCountRef = useRef(0);
  const multipleFaceCountRef = useRef(0);
  const lastFaceSeenTimeRef = useRef(Date.now());
  const suspiciousObjectCountRef = useRef(0);
  
  // Track baseline objects to detect sudden new items
  const baselineObjectsRef = useRef(new Set());
  const engineStartTimeRef = useRef(null);
  
  const [debugMsg, setDebugMsg] = useState('Initializing ML Engine...');

  useEffect(() => {
    let mounted = true;
    
    const initEngine = async () => {
      try {
        setDebugMsg('Requesting Camera & Mic...');
        // 1. Get user media (Video + Audio)
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // 2. Setup Audio Analyzer for voice/noise detection
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          audioContextRef.current = new AudioContext();
          analyserRef.current = audioContextRef.current.createAnalyser();
          microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
          microphoneRef.current.connect(analyserRef.current);
          analyserRef.current.fftSize = 256;
        }

        setDebugMsg('Loading AI Models (this may take a moment)...');

        // 3 & 4. Load COCO-SSD and Face-API concurrently to cut load time by 50%
        const loadTasks = [];
        if (cocoSsd) {
          loadTasks.push(cocoSsd.load().then(model => { objectModelRef.current = model; }));
        }
        if (faceapi) {
          const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
          loadTasks.push(faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL));
        }
        await Promise.all(loadTasks);

        if (mounted) {
          setModelsLoaded(true);
          setDebugMsg('Engine Active');
          engineStartTimeRef.current = Date.now();
          if (onReady) onReady();
        }

      } catch (err) {
        console.error("Proctoring Engine Init Error:", err);
        setDebugMsg('Error starting engine: ' + err.message);
      }
    };

    if (isActive) {
      initEngine();
    }

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch (e) {
          console.warn('AudioContext close error:', e);
        }
        audioContextRef.current = null;
      }
    };
  }, [isActive]);

  const analyzeFrame = useCallback(async () => {
    if (!modelsLoaded || !videoRef.current || videoRef.current.paused || !isActive) return;

    try {
      const videoEl = videoRef.current;

      const captureSnapshot = () => {
        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.5);
      };

      let detectedFaces = 0;
      let detectedBodies = 0;

      // 1. Detect Faces
      if (faceapi) {
        // Higher inputSize (416) and lower threshold (0.2) to catch faces further in the background
        const detections = await faceapi.detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.2 }));
        detectedFaces = detections.length;
        
        if (detectedFaces === 0) {
          const now = Date.now();
          // Trigger if exactly 3 seconds have passed without seeing a face
          if (now - lastFaceSeenTimeRef.current > 3000) {
            onViolation({ 
              type: 'No Face Detected', 
              severity: 'High', 
              message: 'You have left the camera view.',
              image: captureSnapshot()
            });
            // Reset the timer after triggering so it doesn't spam every tick
            lastFaceSeenTimeRef.current = now;
          }
        } else {
          // Update the last seen time if a face is found
          lastFaceSeenTimeRef.current = Date.now();
        }
      }

      // 2. Detect Objects (Phones, Books, Laptops)
      if (objectModelRef.current) {
        // Run standard full-frame detection, using a higher minScore to avoid false positives
        const predictions = await objectModelRef.current.detect(videoEl, 20, 0.5);
        
        // Anti-Cheat Trick: Create a zoomed-in crop of the bottom half of the screen
        // because cheaters hide phones at the very edge where the AI shrinks them too small to see!
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = videoEl.videoWidth;
        cropCanvas.height = videoEl.videoHeight / 2;
        const cropCtx = cropCanvas.getContext('2d');
        if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
          cropCtx.drawImage(
            videoEl, 
            0, videoEl.videoHeight / 2, videoEl.videoWidth, videoEl.videoHeight / 2,
            0, 0, cropCanvas.width, cropCanvas.height
          );
        }
        const bottomPredictions = await objectModelRef.current.detect(cropCanvas, 20, 0.5);
        
        const allPredictions = [...predictions, ...bottomPredictions];
        
        // Count unique bodies from the full frame (avoiding crop double-counts)
        detectedBodies = predictions.filter(p => p.class === 'person' && p.score >= 0.4).length;

        const cheatingTools = ['cell phone', 'laptop', 'book', 'remote', 'keyboard', 'mouse'];

        allPredictions.forEach(prediction => {
          if (prediction.class === 'person') return; // Ignore user's body for cheating tool check

          // Require at least 50% confidence to avoid false positives like background shapes
          if (cheatingTools.includes(prediction.class) && prediction.score >= 0.5) {
            const snapshot = captureSnapshot();

            const msg = 'A mobile phone was instantly detected in your camera view.';

            onViolation({ 
              type: 'Mobile Phone Detection', // Map to critical violation category
              severity: 'Critical', 
              message: msg, 
              image: snapshot 
            });
          }
        });
      }

      // 3. Combined Multiple Person Detection
      const totalPeople = Math.max(detectedFaces, detectedBodies);
      if (totalPeople > 1) {
        multipleFaceCountRef.current += 1;
        if (multipleFaceCountRef.current >= 2) {
          onViolation({ 
            type: 'Multiple Person Detection', 
            severity: 'Critical', 
            message: `Detected multiple people in frame. Only one person is allowed.`,
            image: captureSnapshot()
          });
          multipleFaceCountRef.current = 0;
        }
      } else {
        multipleFaceCountRef.current = 0;
      }

      // 3. Audio / Noise Detection
      if (analyserRef.current) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for(let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const averageNoise = sum / bufferLength;

        // If background noise/talking is loud
        if (averageNoise > 40) { // Threshold may need tuning
          onViolation({ type: 'Audio Violation', severity: 'Medium', message: 'Loud background noise or talking detected.' });
        }
      }

      // 4. Low Light / Blocked Camera
      const canvas = document.createElement('canvas');
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let colorSum = 0;
      for (let i = 0; i < imageData.data.length; i += 4) {
        colorSum += (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
      }
      const brightness = colorSum / (imageData.data.length / 4);
      
      if (brightness < 15) {
        onViolation({ type: 'Low Light / Camera Blocked', severity: 'High', message: 'Camera feed is too dark or blocked. Please improve lighting.' });
      }

    } catch (err) {
      console.warn("Analysis iteration failed:", err);
    }
  }, [modelsLoaded, isActive, onViolation]);

  useEffect(() => {
    let checkTimeout;
    let isChecking = true;

    const runAnalysis = async () => {
      if (!isChecking) return;
      await analyzeFrame();
      if (isChecking) {
        checkTimeout = setTimeout(runAnalysis, 300);
      }
    };

    if (modelsLoaded && isActive) {
      // Run the ML analysis recursively every 300ms to guarantee capture within 1 second.
      checkTimeout = setTimeout(runAnalysis, 300);
      
      return () => {
        isChecking = false;
        clearTimeout(checkTimeout);
      };
    }
  }, [modelsLoaded, isActive, analyzeFrame]);

  useEffect(() => {
    if (modelsLoaded) {
      const timer = setTimeout(() => {
        setShowFeed(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [modelsLoaded]);

  useEffect(() => {
    // 5. DevTools Detection
    const devToolsDetect = () => {
      const threshold = 160;
      const widthDiff = window.outerWidth - window.innerWidth > threshold;
      const heightDiff = window.outerHeight - window.innerHeight > threshold;
      if (widthDiff || heightDiff) {
        onViolation({ type: 'Developer Tools Opened', severity: 'Critical', message: 'Developer tools or inspect element detected.' });
      }
    };
    
    window.addEventListener('resize', devToolsDetect);
    // Initial check
    devToolsDetect();
    
    return () => window.removeEventListener('resize', devToolsDetect);
  }, [onViolation]);

  if (!isActive) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: 20,
      width: 200,
      background: '#fff',
      borderRadius: 12,
      boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
      overflow: 'hidden',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ background: '#2D0040', color: '#fff', padding: '6px 12px', fontSize: 12, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
        <span>Live Proctoring</span>
        {modelsLoaded ? <span style={{ color: '#4caf50' }}>● Active</span> : <span style={{ color: '#ff9800' }}>● Loading</span>}
      </div>
      <div style={{ position: 'relative', background: '#000', width: '100%', aspectRatio: '4/3' }}>
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          playsInline 
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        />
        {/* Solid black overlay to prevent students from using the feed as a mirror to cheat */}
        {(!showFeed || !modelsLoaded) && (
          <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {modelsLoaded ? (
              <span style={{ color: '#555', fontSize: 11, fontWeight: 600 }}>Camera Feed Hidden</span>
            ) : (
              <span style={{ color: '#fff', fontSize: 10 }}>{debugMsg}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProctorEngine;

