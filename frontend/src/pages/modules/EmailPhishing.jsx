/**
 * pages/modules/EmailPhishing.jsx
 * Module 3 — Email Phishing Detector (Phase 2 polish).
 * Reuses POST /scan/email?ai=. Adds glass shell, skeleton, empty/
 * error/success states, AI explanation, and threat list.
 */
import { useState } from 'react';
import { toast } from 'react-toastify';
import { EnvelopeIcon } from '@heroicons/react/24/outline';
import api from '../../services/api.js';
import ScanShell from '../../components/modules/ScanShell.jsx';
import RiskMeter from '../../components/ui/RiskMeter.jsx';
import VerdictBadge from '../../components/ui/VerdictBadge.jsx';
import RiskLevel from '../../components/ui/RiskLevel.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import StateView from '../../components/ui/StateView.jsx';

export default function EmailPhishing() {
  const [text, setText] = useState('');
  const [sender, setSender] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [useAi, setUseAi] = useState(false);

  const scan = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const r = await api.post(`/scan/email?ai=${useAi}`, { text, sender });
      setResult(r.result);
      if (r.result.aiEnabled) toast.success('Analysis complete (AI)');
      else toast.success('Analysis complete');
    } catch (err) {
      setError(true);
      toast.error(err.response?.data?.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScanShell title="Email Phishing Detector" description="Paste raw email text to detect phishing and impersonation." icon={EnvelopeIcon}>
      <form onSubmit={scan} className="space-y-3">
        <label htmlFor="sender" className="sr-only">Sender</label>
        <input id="sender" className="input" placeholder="Sender (e.g. Support <noreply@x.com>)" value={sender}
          onChange={(e) => setSender(e.target.value)} />
        <label htmlFor="body" className="sr-only">Email body</label>
        <textarea id="body" className="input h-40" placeholder="Paste the raw email text here..." value={text}
          onChange={(e) => setText(e.target.value)} required aria-required="true" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
          Use AI to explain the threat (Gemini)
        </label>
        <button className="btn-cyber w-full" disabled={loading}>Analyze</button>
      </form>

      {loading && (
        <div className="mt-5 space-y-3" aria-busy="true">
          <Skeleton className="h-40 w-40 mx-auto rounded-full" />
          <Skeleton className="h-4 w-2/3 mx-auto" />
        </div>
      )}

      {!loading && error && (
        <StateView type="error" title="Analysis failed" message="We couldn't process that email. Try again." />
      )}
      {!loading && !error && !result && (
        <StateView type="empty" title="No analysis yet" message="Paste an email above to check for phishing signals." />
      )}

      {!loading && !error && result && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <RiskLevel score={result.riskScore} />
            <VerdictBadge verdict={result.verdict} />
          </div>
          <div className="flex justify-center"><RiskMeter score={result.riskScore} /></div>

          <ul className="text-sm space-y-1">
            <li>Spam: {result.spam ? 'Yes' : 'No'}</li>
            <li>Urgency signals: {result.checks?.urgencyLanguage?.length || 0}</li>
            <li>Credential requests: {result.checks?.credentialRequests?.length || 0}</li>
            <li>Mismatched links: {result.checks?.mismatchedLinks || 0}</li>
            {result.checks?.possibleSpoof && <li className="text-danger">⚠ Possible sender spoofing ({result.checks.possibleSpoof})</li>}
          </ul>

          {result.threats?.length > 0 && (
            <ul className="list-disc list-inside text-sm text-danger space-y-1">
              {result.threats.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          )}

          {result.explanation && (
            <div className="p-3 rounded-lg bg-primary/10 text-sm" role="note">
              <p className="font-semibold mb-1">AI Explanation</p>
              <p className="whitespace-pre-wrap">{result.explanation}</p>
            </div>
          )}
        </div>
      )}
    </ScanShell>
  );
}
