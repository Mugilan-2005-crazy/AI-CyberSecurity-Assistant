/**
 * pages/modules/EmailPhishing.jsx
 * Module 3 — Email Phishing Detector (Phase 2 polish).
 * Reuses POST /scan/email?ai=. Adds glass shell, skeleton, empty/
 * error/success states, AI explanation, and threat list.
 */
import { useState } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { EnvelopeIcon } from '@heroicons/react/24/outline';
import api from '../../services/api.js';
import ScanShell from '../../components/modules/ScanShell.jsx';
import RiskMeter from '../../components/ui/RiskMeter.jsx';
import VerdictBadge from '../../components/ui/VerdictBadge.jsx';
import RiskLevel from '../../components/ui/RiskLevel.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import StateView from '../../components/ui/StateView.jsx';

export default function EmailPhishing() {
  const { t } = useTranslation();
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
      const r = await api.post(`/scan/email?ai=${useAi}`, {
        body: text,
        sender,
      });
      setResult(r.result);
      if (r.result.aiEnabled) toast.success(t('modules.emailPhishing.analysisCompleteAi'));
      else toast.success(t('modules.emailPhishing.analysisComplete'));
    } catch (err) {
      setError(true);
      toast.error(err.response?.data?.message || t('modules.emailPhishing.analysisFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScanShell title={t('modules.emailPhishing.title')} description={t('modules.emailPhishing.description')} icon={EnvelopeIcon}>
      <form onSubmit={scan} className="space-y-3">
        <label htmlFor="sender" className="sr-only">{t('modules.emailPhishing.senderPlaceholder')}</label>
        <input id="sender" className="input" placeholder={t('modules.emailPhishing.senderPlaceholder')} value={sender}
          onChange={(e) => setSender(e.target.value)} />
        <label htmlFor="body" className="sr-only">{t('modules.emailPhishing.bodyPlaceholder')}</label>
        <textarea id="body" className="input h-40" placeholder={t('modules.emailPhishing.bodyPlaceholder')} value={text}
          onChange={(e) => setText(e.target.value)} required aria-required="true" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
          {t('modules.emailPhishing.useAi')}
        </label>
        <button className="btn-cyber w-full" disabled={loading}>{t('modules.emailPhishing.analyzeBtn')}</button>
      </form>

      {loading && (
        <div className="mt-5 space-y-3" aria-busy="true">
          <Skeleton className="h-40 w-40 mx-auto rounded-full" />
          <Skeleton className="h-4 w-2/3 mx-auto" />
        </div>
      )}

      {!loading && error && (
        <StateView type="error" title={t('modules.emailPhishing.analysisFailed')} message={t('modules.emailPhishing.analysisFailedText')} />
      )}
      {!loading && !error && !result && (
        <StateView type="empty" title={t('modules.emailPhishing.noAnalysisYet')} message={t('modules.emailPhishing.pasteEmailHint')} />
      )}

      {!loading && !error && result && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <RiskLevel score={result.riskScore} />
            <VerdictBadge verdict={result.verdict} />
          </div>
          <div className="flex justify-center"><RiskMeter score={result.riskScore} /></div>

          <ul className="text-sm space-y-1">
            <li>{t('modules.emailPhishing.spam')}: {result.spam ? t('common.yes') : t('common.no')}</li>
            <li>{t('modules.emailPhishing.urgencySignals')}: {result.checks?.urgencyLanguage?.length || 0}</li>
            <li>{t('modules.emailPhishing.credentialRequests')}: {result.checks?.credentialRequests?.length || 0}</li>
            <li>{t('modules.emailPhishing.mismatchedLinks')}: {result.checks?.mismatchedLinks || 0}</li>
            {result.checks?.possibleSpoof && <li className="text-danger">⚠ {t('modules.emailPhishing.possibleSpoof')} ({result.checks.possibleSpoof})</li>}
          </ul>

          {result.threats?.length > 0 && (
            <ul className="list-disc list-inside text-sm text-danger space-y-1">
              {result.threats.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          )}

          {result.explanation && (
            <div className="p-3 rounded-lg bg-primary/10 text-sm" role="note">
              <p className="font-semibold mb-1">{t('modules.emailPhishing.aiExplanation')}</p>
              <p className="whitespace-pre-wrap">{result.explanation}</p>
            </div>
          )}
        </div>
      )}
    </ScanShell>
  );
}
