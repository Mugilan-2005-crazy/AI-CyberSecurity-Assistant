/**
 * pages/modules/PasswordAnalyzer.jsx
 * Module 2 — Password Strength Analyzer (Phase 2 polish).
 * Reuses POST /scan/password. Adds glass shell, skeleton, empty/
 * error/success states, risk level, and breach warning.
 */
import { useState } from 'react';
import { toast } from 'react-toastify';
import { KeyIcon } from '@heroicons/react/24/outline';
import api from '../../services/api.js';
import ScanShell from '../../components/modules/ScanShell.jsx';
import RiskMeter from '../../components/ui/RiskMeter.jsx';
import RiskLevel from '../../components/ui/RiskLevel.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import StateView from '../../components/ui/StateView.jsx';

const strengthColor = (s) =>
  s === 'Very Weak' || s === 'Weak' ? '#ef4444' : s === 'Good' ? '#f59e0b' : '#10b981';

export default function PasswordAnalyzer() {
  const [pw, setPw] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const analyze = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const r = await api.post('/scan/password', { password: pw });
      setResult(r.result);
    } catch {
      setError(true);
      toast.error('Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  // Map the 0-100 score for the gauge (weak => high risk).
  const riskScore = result ? 100 - result.score : 0;

  return (
    <ScanShell title="Password Strength Analyzer" description="Estimate entropy, crack time, and breach exposure." icon={KeyIcon}>
      <form onSubmit={analyze} className="space-y-3">
        <label htmlFor="pw" className="sr-only">Password</label>
        <input id="pw" type="password" className="input" placeholder="Enter a password" value={pw}
          onChange={(e) => setPw(e.target.value)} required aria-required="true" autoComplete="new-password" />
        <button className="btn-cyber w-full" disabled={loading}>Analyze</button>
      </form>

      {loading && (
        <div className="mt-5 space-y-3" aria-busy="true">
          <Skeleton className="h-40 w-40 mx-auto rounded-full" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
        </div>
      )}

      {!loading && error && (
        <StateView type="error" title="Analysis failed" message="We couldn't score that password. Try again." />
      )}
      {!loading && !error && !result && (
        <StateView type="empty" title="No analysis yet" message="Type a password above to see its strength breakdown." />
      )}

      {!loading && !error && result && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-6">
            <RiskMeter score={riskScore} />
            <div className="flex-1">
              <p className="text-lg font-bold" style={{ color: strengthColor(result.strength) }}>{result.strength}</p>
              <RiskLevel score={riskScore} showScore={false} />
              <p className="text-sm text-slate-400 mt-2">Entropy: {result.entropy} bits</p>
              <p className="text-sm text-slate-400">Charset: {result.charsetSize} characters</p>
              <p className="text-sm text-slate-400">Crack time (online): {result.crackTimeOnline}</p>
              <p className="text-sm text-slate-400">Crack time (offline): {result.crackTimeOffline}</p>
            </div>
          </div>

          {result.isCommonBreach && (
            <div className="p-3 rounded-lg bg-red-500/10 text-danger text-sm" role="alert">
              ⚠ This password appears in known breach datasets. Do not use it.
            </div>
          )}

          {result.suggestions.length > 0 && (
            <div>
              <p className="font-semibold mb-1">Suggestions</p>
              <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                {result.suggestions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </ScanShell>
  );
}
