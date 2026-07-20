/**
 * pages/modules/UrlScanner.jsx
 * Module 1 — URL Security Scanner (Phase 2 polish).
 * Reuses backend POST /scan/url. Now features a glass shell,
 * empty state before first scan, skeleton while analyzing, error
 * state on failure, and a success result with risk meter + checks.
 */
import { useState } from 'react';
import { toast } from 'react-toastify';
import { LinkIcon } from '@heroicons/react/24/outline';
import api from '../../services/api.js';
import ScanShell from '../../components/modules/ScanShell.jsx';
import RiskMeter from '../../components/ui/RiskMeter.jsx';
import VerdictBadge from '../../components/ui/VerdictBadge.jsx';
import RiskLevel from '../../components/ui/RiskLevel.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import StateView from '../../components/ui/StateView.jsx';

const URL_RE = /^(https?:\/\/)([\w-]+(\.[\w-]+)+)([\w\-./?%&=#:]*)?$/i;

export default function UrlScanner() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const scan = async (e) => {
    e.preventDefault();
    if (!URL_RE.test(url.trim())) {
      toast.error('Enter a valid URL (e.g. https://example.com)');
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const r = await api.post('/scan/url', { url: url.trim() });
      setResult(r.result);
      toast.success('URL analyzed');
    } catch (err) {
      setError(true);
      toast.error(err.response?.data?.message || 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  const { issues, recommendations } = buildFindings(result);

  const checks = result?.checks || {};

  return (
    <ScanShell title="URL Security Scanner" description="Check links for phishing, SSL, and brand impersonation." icon={LinkIcon}>
      <form onSubmit={scan} className="flex flex-col sm:flex-row gap-2" aria-label="URL scan form">
        <label htmlFor="url" className="sr-only">URL to scan</label>
        <input id="url" className="input flex-1" placeholder="https://example.com" value={url}
          onChange={(e) => setUrl(e.target.value)} required aria-required="true" />
        <button className="btn-cyber whitespace-nowrap" disabled={loading}>Scan</button>
      </form>

      {loading && (
        <div className="mt-5 space-y-3" aria-busy="true">
          <Skeleton className="h-40 w-40 mx-auto rounded-full" />
          <Skeleton className="h-4 w-2/3 mx-auto" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
        </div>
      )}

      {!loading && error && (
        <StateView type="error" title="Scan failed" message="We couldn't analyze that URL. Please try again." />
      )}

      {!loading && !error && !result && (
        <StateView type="empty" title="No scan yet" message="Enter a URL above to evaluate its safety in seconds." />
      )}

      {!loading && !error && result && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="font-mono text-sm break-all">{result.input}</p>
              <p className="text-slate-400 text-xs">Host: {result.host}</p>
            </div>
            <VerdictBadge verdict={result.verdict} />
          </div>

          <div className="flex flex-col items-center gap-2">
            <RiskMeter score={result.riskScore} />
            <RiskLevel score={result.riskScore} />
          </div>

          <ul className="space-y-1 text-sm" aria-label="Security checks">
            <Check label="HTTPS / SSL secured" ok={checks.https} />
            <Check label="Reputable top-level domain" ok={!checks.suspiciousTld} />
            <Check label="Not a URL shortener" ok={!checks.urlShortener} />
            <Check label="No raw IP host" ok={!checks.ipHost} />
            <Check label="No brand impersonation" ok={!checks.brandImpersonation}
              detail={checks.brandImpersonation ? `Looks like ${checks.brandImpersonation}` : null} />
          </ul>

          {issues.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Detected Issues</h3>
              <ul className="space-y-1 text-sm list-disc list-inside text-danger">
                {issues.map((i) => <li key={i}>{i}</li>)}
              </ul>
            </div>
          )}

          {recommendations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Recommendations</h3>
              <ul className="space-y-1 text-sm list-disc list-inside text-slate-300">
                {recommendations.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </ScanShell>
  );
}

function buildFindings(result) {
  const issues = [];
  const recommendations = [];
  const c = result?.checks || {};
  if (result?.valid === false) {
    issues.push('Invalid URL format — cannot be analyzed safely.');
    recommendations.push('Double-check the URL and make sure it is complete.');
    return { issues, recommendations };
  }
  if (c.format) { issues.push(c.format); recommendations.push('Provide a correctly formatted URL.'); }
  if (!c.https) {
    issues.push('Connection is not over HTTPS (no SSL/TLS).');
    recommendations.push('Avoid submitting sensitive data on non-HTTPS sites.');
  }
  if (c.suspiciousTld) {
    issues.push(`Suspicious top-level domain "${result?.host?.split('.').pop()}".`);
    recommendations.push('Be cautious of free/abused TLDs often used in phishing.');
  }
  if (c.urlShortener) {
    issues.push('URL uses a shortening service that hides the real destination.');
    recommendations.push('Expand the short link first to verify where it leads.');
  }
  if (c.ipHost) {
    issues.push('Host is a raw IP address rather than a domain name.');
    recommendations.push('Legitimate sites usually use a registered domain name.');
  }
  if (c.brandImpersonation) {
    issues.push(`Possible impersonation of "${c.brandImpersonation}".`);
    recommendations.push('Navigate to the brand’s official site directly, not via the link.');
  }
  if (Array.isArray(c.phishingKeywords) && c.phishingKeywords.length) {
    issues.push(`Phishing keywords detected: ${c.phishingKeywords.join(', ')}.`);
    recommendations.push('Be wary of pages asking to log in, verify, or update account info.');
  }
  if (!issues.length) {
    recommendations.push('No major issues detected — still verify the sender before acting.');
  }
  return { issues, recommendations };
}

function Check({ label, ok, detail }) {
  return (
    <li className="flex items-center gap-2">
      <span className={ok ? 'text-cyber-400' : 'text-danger'} aria-hidden="true">{ok ? '✓' : '✗'}</span>
      <span>{label}</span>
      {detail && <span className="text-xs text-danger">({detail})</span>}
    </li>
  );
}
