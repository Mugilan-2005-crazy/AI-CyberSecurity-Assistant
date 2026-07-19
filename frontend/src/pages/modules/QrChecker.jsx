/**
 * pages/modules/QrChecker.jsx
 * Module 6 — QR Code Safety Checker (Phase 2 polish).
 * Reuses camera + jsQR decode then POST /scan/qr. Adds glass shell,
 * skeleton, empty/error/success states, and safe/action warnings.
 */
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { QrCodeIcon } from '@heroicons/react/24/outline';
import jsQR from 'jsqr';
import api from '../../services/api.js';
import ScanShell from '../../components/modules/ScanShell.jsx';
import RiskMeter from '../../components/ui/RiskMeter.jsx';
import VerdictBadge from '../../components/ui/VerdictBadge.jsx';
import RiskLevel from '../../components/ui/RiskLevel.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import StateView from '../../components/ui/StateView.jsx';

export default function QrChecker() {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [stream, setStream] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [scanned, setScanned] = useState('');

  const start = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(s);
      videoRef.current.srcObject = s;
      videoRef.current.play();
    } catch {
      toast.error('Camera access denied');
    }
  };

  useEffect(() => {
    if (!stream) return;
    const tick = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas && video && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height);
        if (code?.data && code.data !== scanned) {
          setScanned(code.data);
          analyze(code.data);
        }
      }
      requestAnimationFrame(tick);
    };
    tick();
    return () => stream?.getTracks().forEach((t) => t.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream]);

  const analyze = async (text) => {
    setLoading(true);
    setError(false);
    try {
      const r = await api.post('/scan/qr', { text });
      setResult(r.result);
    } catch {
      setError(true);
      toast.error('QR check failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScanShell title="QR Code Safety Checker" description="Scan a QR with your camera or paste its content." icon={QrCodeIcon}>
      <div className="space-y-3">
        <video ref={videoRef} className="w-full rounded-lg bg-black aspect-video" muted aria-label="Camera preview" />
        <canvas ref={canvasRef} className="hidden" />
        <button className="btn-cyber w-full" onClick={start}>Start Camera</button>
        <p className="text-xs text-slate-400">Or paste decoded QR content:</p>
        <label htmlFor="qr" className="sr-only">QR content</label>
        <input id="qr" className="input" placeholder="data / URL" value={scanned}
          onChange={(e) => setScanned(e.target.value)} />
        <button className="btn-primary w-full" onClick={() => analyze(scanned)}>Check Text</button>
      </div>

      {loading && (
        <div className="mt-5 space-y-3" aria-busy="true">
          <Skeleton className="h-40 w-40 mx-auto rounded-full" />
          <Skeleton className="h-4 w-2/3 mx-auto" />
        </div>
      )}

      {!loading && error && (
        <StateView type="error" title="Check failed" message="We couldn't evaluate that QR code." />
      )}
      {!loading && !error && !result && (
        <StateView type="empty" title="No QR scanned" message="Use the camera or paste content to assess safety." />
      )}

      {!loading && !error && result && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs break-all">{result.content}</span>
            <VerdictBadge verdict={result.verdict} />
          </div>
          <div className="flex flex-col items-center gap-2">
            <RiskMeter score={result.riskScore} />
            <RiskLevel score={result.riskScore} />
          </div>
          {result.reason && <p className="text-sm text-slate-400">{result.reason}</p>}
          {result.warnings?.length > 0 && (
            <ul className="list-disc list-inside text-sm text-warning space-y-1">
              {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}
    </ScanShell>
  );
}
