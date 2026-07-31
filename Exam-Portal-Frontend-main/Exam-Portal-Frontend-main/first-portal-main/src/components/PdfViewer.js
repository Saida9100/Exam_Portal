import React, { useRef, useState, useEffect } from 'react';

const PdfViewer = ({ pdfSrc }) => {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (!pdfSrc) return;

    (async () => {
      try {
        setLoading(true);

        // Load pdf.js from CDN if not already loaded
        if (!window.pdfjsLib) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
          });
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        }

        const loadingTask = window.pdfjsLib.getDocument(pdfSrc);
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        const container = containerRef.current;
        if (!container) return;

        container.innerHTML = '';

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) return;

          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.5 });

          const canvas = document.createElement('canvas');
          canvas.style.display = 'block';
          canvas.style.margin = '0 auto 16px auto';
          canvas.style.maxWidth = '100%';
          canvas.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';

          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          container.appendChild(canvas);

          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };
          await page.render(renderContext).promise;
        }

        if (!cancelled) setLoading(false);
      } catch (err) {
        if (err.name === 'RenderingCancelledException') return;
        console.error('Error rendering PDF:', err);
        if (!cancelled) {
          setError('Failed to load PDF document.');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [pdfSrc]);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff', padding: '20px 0' }}>
      {loading && (
        <div style={{ padding: '20px', textAlign: 'center' }}>Loading PDF...</div>
      )}
      {error && (
        <div style={{ color: 'red', padding: '20px' }}>{error}</div>
      )}
      <div ref={containerRef} style={{ width: '100%', overflowX: 'auto', background: '#f9f9f9', padding: '20px 0' }} />
    </div>
  );
};

export default PdfViewer;
