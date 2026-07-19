/**
 * pages/modules/FileScanner.jsx
 * Module 4 — File Malware Scanner (Phase 2 polish).
 * Reuses POST /scan/file (multipart). Adds glass shell, skeleton,
 * empty/error/success states, and graceful "not configured" UI.
 */
import { useState } from 'react';
import { toast } from 'react-toastify';
import { DocumentIcon } from '@heroicons/react/24/outline';
import api from '../../services/api.js';
import ScanShell from '../../components/modules/ScanShell.jsx';
import RiskMeter from '../../components/ui/RiskMeter.jsx';
import VerdictBadge from '../../components/ui/VerdictBadge.jsx';
import RiskLevel from '../../components/ui/RiskLevel.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import StateView from '../../components/ui/StateView.jsx';

export default function FileScanner() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Choose a file');
    setLoading(true);
    setError(false);
    const form = new FormData();
    form.append('file', file);
    try {
      const r = await api.post('/scan/file', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(r.result);
      toast.success('File scanned');
    } catch (err) {
      setError(true);
      toast.error(err.response?.data?.message || 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScanShell title="File Malware Scanner" description="Upload a file to check its SHA-256 against VirusTotal." icon={DocumentIcon}>
      <form onSubmit={upload} className="space-y-3">
        <label htmlFor="file" className="sr-only">File to scan</label>
        <input id="file" type="file" className="input" onChange={(e) => setFile(e.target.files[0])} required aria-required="true" />
        <button className="btn-cyber w-full" disabled={loading}>Scan with VirusTotal</button>
      </form>

      {loading && (
        <div className="mt-5 space-y-3" aria-busy="true">
          <Skeleton className="h-40 w-40 mx-auto rounded-full" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
        </div>
      )}

      {!loading && error && (
        <StateView type="error" title="Scan failed" message="We couldn't scan that file. Try a different file." />
      )}
      {!loading && !error && !result && (
        <StateView type="empty" title="No file scanned" message="Select a file above to check it for malware." />
      )}

      {!loading && !error && result && (
        <div className="mt-5 space-y-4">
          {result.configured === false ? (
            <StateView type="info" title="Service not configured"
              message="Malware scanning (VirusTotal) isn't enabled on the server. Contact your administrator." />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs break-all">{result.hash}</span>
                <VerdictBadge verdict={result.verdict} />
              </div>
              <div className="flex flex-col items-center gap-2">
                <RiskMeter score={result.riskScore} />
                <RiskLevel score={result.riskScore} />
              </div>
              <p className="text-sm text-slate-400 text-center">
                {result.detected} / {result.total} engines flagged this file
              </p>
            </>
          )}
        </div>
      )}
    </ScanShell>
  );
}
