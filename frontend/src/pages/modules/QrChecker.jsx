/**
 * pages/modules/QrChecker.jsx
 * Module 6 — QR Code Safety Checker (Phase 2 polish).
 * Reuses camera + jsQR decode then POST /scan/qr. Adds glass shell,
 * skeleton, empty/error/success states, and safe/action warnings.
 */
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const videoRef = useRef();
  const canvasRef = useRef();
  const [stream, setStream] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [scanned, setScanned] = useState('');

  const start = async () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error(t('modules.qrChecker.browserNotSupported'));
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(s);
      videoRef.current.srcObject = s;
      videoRef.current.play();
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        toast.error(t('modules.qrChecker.cameraDenied'));
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        toast.error(t('modules.qrChecker.cameraUnavailable'));
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        toast.error(t('modules.qrChecker.cameraUnavailable'));
      } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
        toast.error(t('modules.qrChecker.cameraUnavailable'));
      } else {
        toast.error(t('modules.qrChecker.cameraUnavailable'));
      }
    }
  };

  const stop = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    setStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
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
      console.log('QR ANALYSIS RESPONSE', r);
      setResult(r.result);
    } catch {
      setError(true);
      toast.error(t('modules.qrChecker.checkFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScanShell title={t('modules.qrChecker.title')} description={t('modules.qrChecker.description')} icon={QrCodeIcon}>
      <div className="space-y-3">
        <video ref={videoRef} className="w-full rounded-lg bg-black aspect-video" muted aria-label="Camera preview" />
        <canvas ref={canvasRef} className="hidden" />
        {stream ? (
          <button className="btn-primary w-full" onClick={stop}>{t('modules.qrChecker.stopCamera')}</button>
        ) : (
          <button className="btn-cyber w-full" onClick={start}>{t('modules.qrChecker.startCamera')}</button>
        )}
        <p className="text-xs text-slate-400">{t('modules.qrChecker.orPaste')}</p>
        <label htmlFor="qr" className="sr-only">{t('modules.qrChecker.orPaste')}</label>
        <input id="qr" className="input" placeholder="data / URL" value={scanned}
          onChange={(e) => setScanned(e.target.value)} />
        <button className="btn-primary w-full" onClick={() => analyze(scanned)}>{t('modules.qrChecker.checkText')}</button>
      </div>

      {loading && (
        <div className="mt-5 space-y-3" aria-busy="true">
          <Skeleton className="h-40 w-40 mx-auto rounded-full" />
          <Skeleton className="h-4 w-2/3 mx-auto" />
        </div>
      )}

      {!loading && error && (
        <StateView type="error" title={t('modules.qrChecker.checkFailed')} message={t('modules.qrChecker.checkFailedText')} />
      )}
      {!loading && !error && !result && (
        <StateView type="empty" title={t('modules.qrChecker.noQrScanned')} message={t('modules.qrChecker.useCameraHint')} />
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
          {result.reason && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{result.reason}</p>
              {result.recommendation && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Recommendation: {result.recommendation}</p>
              )}
            </div>
          )}
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
