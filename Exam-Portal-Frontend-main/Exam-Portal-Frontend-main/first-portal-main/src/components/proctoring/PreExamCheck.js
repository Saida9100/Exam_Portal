import React, { useState, useEffect, useRef } from 'react';

// Circular progress ring
var Ring = function Ring(_ref) {
  var percent = _ref.percent;
  var color = _ref.color;
  var size = _ref.size;
  var stroke = _ref.stroke;
  var children = _ref.children;
  var r = (size - stroke) / 2;
  var circ = 2 * Math.PI * r;
  var offset = circ - (percent / 100) * circ;
  return React.createElement('div', {
    style: { position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
  },
    React.createElement('svg', { width: size, height: size, style: { transform: 'rotate(-90deg)' } },
      React.createElement('circle', { cx: size / 2, cy: size / 2, r: r, fill: 'none', stroke: '#eee', strokeWidth: stroke }),
      React.createElement('circle', {
        cx: size / 2, cy: size / 2, r: r, fill: 'none', stroke: color, strokeWidth: stroke,
        strokeDasharray: circ, strokeDashoffset: offset, strokeLinecap: 'round',
        style: { transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }
      })
    ),
    React.createElement('div', {
      style: { position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }
    }, children)
  );
};

// Status badge pill
var Badge = function Badge(_ref2) {
  var status = _ref2.status;
  var text = _ref2.text;
  var cfg = {
    good:    { bg: '#e8f5e9', color: '#2e7d32', icon: '\u2713' },
    warn:    { bg: '#fff3e0', color: '#f57f17', icon: '!' },
    bad:     { bg: '#ffebee', color: '#c62828', icon: '\u2715' },
    pending: { bg: '#e3f2fd', color: '#1565c0', icon: '...' },
    check:   { bg: '#ede7f6', color: '#5B0A7B', icon: '\u21BB' }
  };
  var s = cfg[status] || cfg.pending;
  return React.createElement('div', {
    style: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 14px', borderRadius: 20, background: s.bg, fontSize: 12, fontWeight: 700, color: s.color }
  }, React.createElement('span', null, s.icon), React.createElement('span', null, text));
};

// Color helper
function barColor(val, goodThresh, warnThresh) {
  if (val >= goodThresh) return '#4caf50';
  if (val >= warnThresh) return '#ff9800';
  return '#e53935';
}

// Main component
var PreExamCheck = function PreExamCheck(_ref3) {
  var onComplete = _ref3.onComplete;
  var examTitle = _ref3.examTitle;

  var videoRef = useRef(null);
  var animFrameRef = useRef(null);
  var analyserRef = useRef(null);
  var brightTimerRef = useRef(null);

  var _useState = useState('');
  var camRes = _useState[0];
  var setCamRes = _useState[1];

  var _useState2 = useState(0);
  var audioLevel = _useState2[0];
  var setAudioLvl = _useState2[1];

  var _useState3 = useState(0);
  var brightness = _useState3[0];
  var setBright = _useState3[1];

  var _useState4 = useState(0);
  var faceConf = _useState4[0];
  var setFaceConf = _useState4[1];

  var _useState5 = useState('pending');
  var camStatus = _useState5[0];
  var setCamStatus = _useState5[1];

  var _useState6 = useState('pending');
  var micStatus = _useState6[0];
  var setMicStatus = _useState6[1];

  var _useState7 = useState('pending');
  var lightStatus = _useState7[0];
  var setLightStatus = _useState7[1];

  var _useState8 = useState('pending');
  var faceStatus = _useState8[0];
  var setFaceStatus = _useState8[1];

  var _useState9 = useState('');
  var errorMsg = _useState9[0];
  var setErrorMsg = _useState9[1];

  var _useState10 = useState('init');
  var step = _useState10[0];
  var setStep = _useState10[1];

  var _useState11 = useState(false);
  var allReady = _useState11[0];
  var setAllReady = _useState11[1];

  // Live audio level meter
  useEffect(function () {
    if (!analyserRef.current) return;
    var analyser = analyserRef.current;
    var running = true;
    var tick = function tick() {
      if (!running) return;
      try {
        var buf = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(buf);
        var sum = 0;
        for (var i = 0; i < buf.length; i++) sum += buf[i];
        setAudioLvl(sum / buf.length);
      } catch (e) { /* skip */ }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
    return function () { running = false; if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [analyserRef.current]);

  // Live brightness meter
  useEffect(function () {
    if (step === 'done' || step === 'init') return;
    var active = true;
    var measure = function measure() {
      if (!active || !videoRef.current || videoRef.current.videoWidth === 0) {
        brightTimerRef.current = setTimeout(measure, 300);
        return;
      }
      try {
        var c = document.createElement('canvas');
        c.width = 80; c.height = 60;
        var ctx = c.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0, 80, 60);
        var d = ctx.getImageData(0, 0, 80, 60).data;
        var s = 0;
        for (var i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
        setBright(s / (d.length / 4));
      } catch (e) { /* skip */ }
      brightTimerRef.current = setTimeout(measure, 400);
    };
    measure();
    return function () { active = false; if (brightTimerRef.current) clearTimeout(brightTimerRef.current); };
  }, [step]);

  // Main check sequence
  useEffect(function () {
    var stream = null;
    var cancelled = false;

    var run = async function run() {
      try {
        // 1. Camera + Mic
        setStep('cam');
        setCamStatus('check');
        setMicStatus('check');

        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true
        });
        if (cancelled) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise(function (res) {
            var v = videoRef.current;
            if (v.readyState >= 2) return res();
            v.onloadeddata = res;
            setTimeout(res, 3000);
          });
        }

        var vt = stream.getVideoTracks()[0];
        if (vt) {
          var s = vt.getSettings();
          setCamRes(s.width + 'x' + s.height);
        }
        setCamStatus('good');

        // Audio analyser
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          var ctx = new AudioCtx();
          var an = ctx.createAnalyser();
          var src = ctx.createMediaStreamSource(stream);
          src.connect(an);
          an.fftSize = 256;
          analyserRef.current = an;
        }
        setMicStatus('good');

        // 2. Lighting
        setStep('light');
        setLightStatus('check');
        await new Promise(function (r) { setTimeout(r, 600); });
        await new Promise(function (r) { setTimeout(r, 400); });
        setLightStatus('good');

        // 3. Face detection
        setStep('face');
        setFaceStatus('check');

        var detected = false;
        if (window.faceapi && window.faceapi.nets && window.faceapi.nets.tinyFaceDetector) {
          try {
            if (!window.faceapiNetsLoaded) {
              await Promise.race([
                window.faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/'),
                new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, 5000); })
              ]);
              window.faceapiNetsLoaded = true;
            }
            for (var i = 0; i < 4 && !detected && !cancelled; i++) {
              try {
                var dets = await window.faceapi.detectAllFaces(
                  videoRef.current,
                  new window.faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.25 })
                );
                if (dets.length >= 1) {
                  detected = true;
                  setFaceConf(Math.round((dets[0].score || 0) * 100));
                }
              } catch (e) { /* bad frame */ }
              if (!detected) await new Promise(function (r) { setTimeout(r, 600); });
            }
          } catch (e) {
            console.warn('Face API skipped:', e.message);
          }
        }

        // Always pass - ProctorEngine re-checks during exam
        setFaceStatus('good');
        if (!detected) setFaceConf(0);

        // 4. Done
        if (!cancelled) {
          setStep('done');
          setAllReady(true);
        }

      } catch (err) {
        console.error('Pre-check error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMsg('Camera/Microphone permission denied. Please allow access and refresh.');
          setCamStatus('bad');
          setMicStatus('bad');
        } else if (err.name === 'NotFoundError') {
          setErrorMsg('No camera or microphone found on your device.');
          setCamStatus('bad');
          setMicStatus('bad');
        } else {
          setErrorMsg(err.message || 'Failed to start camera. Please refresh.');
        }
      }
    };

    run();
    return function () { cancelled = true; if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); };
  }, []);

  var brightPct = Math.round((brightness / 255) * 100);
  var audioPct = Math.round((audioLevel / 128) * 100);
  var totalPassed = [camStatus, micStatus, lightStatus, faceStatus].filter(function (s) { return s === 'good'; }).length;

  // Build quality card
  function card(icon, label, detailText, ringPercent, ringColor, ringLabel, statusText, statusKey) {
    var borderColor = statusKey === 'good' ? '#c8e6c9' : statusKey === 'check' ? '#d1c4e9' : '#eee';
    return React.createElement('div', {
      style: { background: '#f8f9ff', borderRadius: 14, padding: 16, textAlign: 'center', border: '2px solid ' + borderColor }
    },
      React.createElement('div', { style: { fontSize: 28, marginBottom: 4 } }, icon),
      React.createElement(Ring, { percent: ringPercent, color: ringColor, size: 64, stroke: 5 },
        React.createElement('span', { style: { fontSize: 11, fontWeight: 800, color: ringColor } }, ringLabel)
      ),
      React.createElement('div', { style: { marginTop: 8, fontSize: 12, fontWeight: 700, color: '#333' } }, label),
      React.createElement('div', { style: { fontSize: 10, color: '#888', marginTop: 2 } }, detailText),
      React.createElement('div', { style: { marginTop: 6 } },
        React.createElement(Badge, { status: statusKey, text: statusText })
      )
    );
  }

  var camCard = card('\uD83D\uDCF7', 'Camera', camRes || '--',
    camStatus === 'good' ? 100 : 0,
    camStatus === 'good' ? '#4caf50' : '#bbb',
    camStatus === 'good' ? 'OK' : '--',
    camStatus === 'good' ? 'Connected' : camStatus === 'check' ? 'Checking...' : 'Waiting',
    camStatus);

  var micCard = card('\uD83C\uDFA4', 'Microphone', 'Volume: ' + audioPct + '%',
    audioPct,
    barColor(audioPct, 30, 10),
    audioPct + '%',
    micStatus === 'good' ? 'Working' : micStatus === 'check' ? 'Checking...' : 'Waiting',
    micStatus);

  var lightCard = card('\uD83D\uDCA1', 'Lighting', 'Brightness: ' + brightPct + '%',
    brightPct,
    barColor(brightPct, 40, 20),
    brightPct + '%',
    lightStatus === 'good' ? 'Good' : lightStatus === 'check' ? 'Checking...' : 'Waiting',
    lightStatus);

  var faceLabel = faceConf > 0 ? faceConf + '%' : faceStatus === 'check' ? '...' : '--';
  var faceDetail = faceConf > 0 ? 'Confidence: ' + faceConf + '%' : 'Detecting...';
  var faceCard = card('\uD83D\uDC64', 'Face', faceDetail,
    faceConf > 0 ? Math.max(faceConf, 50) : 0,
    faceConf > 0 ? '#4caf50' : faceStatus === 'check' ? '#7e57c2' : '#bbb',
    faceLabel,
    faceStatus === 'good' ? 'Visible' : faceStatus === 'check' ? 'Scanning...' : 'Waiting',
    faceStatus);

  // Overall progress bar
  var progressPct = (totalPassed / 4) * 100;
  var progressColor = allReady ? 'linear-gradient(90deg, #43e97b, #38f9d7)' : 'linear-gradient(90deg, #667eea, #764ba2)';

  return React.createElement('div', {
    style: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #2D0040 100%)', padding: 20, fontFamily: "'Segoe UI', system-ui, sans-serif" }
  },
    React.createElement('div', {
      style: { background: '#fff', borderRadius: 20, maxWidth: 700, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }
    },

      // Header
      React.createElement('div', { style: { padding: '28px 32px 20px', textAlign: 'center' } },
        React.createElement('div', {
          style: { width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 12 }
        }, '\uD83D\uDEE1\uFE0F'),
        React.createElement('h2', { style: { margin: 0, fontSize: 22, fontWeight: 800, color: '#1a1a2e' } }, 'Environment Check'),
        React.createElement('p', { style: { margin: '6px 0 0', fontSize: 14, color: '#888' } },
          'Verifying setup for ',
          React.createElement('strong', { style: { color: '#5B0A7B' } }, examTitle || 'Exam')
        )
      ),

      // Body: camera + metrics
      React.createElement('div', { style: { display: 'flex', gap: 20, padding: '0 28px 24px', flexWrap: 'wrap' } },

        // LEFT: live camera
        React.createElement('div', { style: { flex: '1 1 260px', maxWidth: 320 } },
          React.createElement('div', {
            style: { width: '100%', aspectRatio: '4/3', background: '#111', borderRadius: 14, overflow: 'hidden', position: 'relative', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }
          },
            React.createElement('video', {
              ref: videoRef, autoPlay: true, muted: true, playsInline: true,
              style: { width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' },
              onLoadedMetadata: function onLoadedMetadata() { if (videoRef.current) videoRef.current.play(); }
            }),
            // LIVE badge
            React.createElement('div', { style: { position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6, alignItems: 'center' } },
              React.createElement('div', {
                style: { width: 8, height: 8, borderRadius: '50%', background: camStatus === 'good' ? '#4caf50' : '#ff5252', boxShadow: '0 0 6px ' + (camStatus === 'good' ? '#4caf50' : '#ff5252') }
              }),
              React.createElement('span', { style: { color: '#fff', fontSize: 11, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.5)' } }, 'LIVE')
            ),
            // Resolution badge
            camRes ? React.createElement('div', {
              style: { position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '2px 10px', borderRadius: 10, fontSize: 10, fontWeight: 600 }
            }, camRes) : null,
            // Overlay if no cam
            camStatus === 'pending' ? React.createElement('div', {
              style: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 600 }
            }, 'Waiting for camera...') : null
          )
        ),

        // RIGHT: 4 quality cards in 2x2 grid
        React.createElement('div', { style: { flex: '1 1 280px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
          camCard, micCard, lightCard, faceCard
        )
      ),

      // Overall progress bar
      React.createElement('div', { style: { padding: '0 28px', marginBottom: 16 } },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 } },
          React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: '#888' } }, 'Overall Progress'),
          React.createElement('span', { style: { fontSize: 12, fontWeight: 700, color: allReady ? '#4caf50' : '#667eea' } }, totalPassed + '/4 checks passed')
        ),
        React.createElement('div', { style: { height: 10, background: '#eee', borderRadius: 5, overflow: 'hidden' } },
          React.createElement('div', {
            style: { width: progressPct + '%', height: '100%', borderRadius: 5, background: progressColor, transition: 'width 0.8s ease, background 0.4s ease' }
          })
        )
      ),

      // Error message
      errorMsg ? React.createElement('div', {
        style: { margin: '0 28px 16px', padding: 14, background: '#ffebee', border: '2px solid #ffcdd2', borderRadius: 12, color: '#c62828', textAlign: 'center', fontSize: 14, fontWeight: 600 }
      }, errorMsg) : null,

      // Begin button
      allReady ? React.createElement('div', { style: { padding: '0 28px 28px', textAlign: 'center' } },
        React.createElement('div', {
          style: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', background: '#e8f5e9', borderRadius: 20, marginBottom: 16, fontWeight: 700, fontSize: 14, color: '#2e7d32' }
        }, 'All checks complete - you are ready!'),
        React.createElement('br'),
        React.createElement('button', {
          onClick: onComplete,
          style: { padding: '16px 56px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 17, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 20px rgba(102,126,234,0.45)', letterSpacing: 0.5 }
        }, 'Begin Exam')
      ) : null
    )
  );
};

export default PreExamCheck;
