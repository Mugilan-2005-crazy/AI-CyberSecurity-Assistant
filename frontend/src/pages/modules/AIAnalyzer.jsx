import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  ShieldCheckIcon, ExclamationTriangleIcon, CheckCircleIcon,
  InformationCircleIcon, ArrowPathIcon, DocumentTextIcon,
  BeakerIcon, ChartBarIcon, ClockIcon, ArrowDownOnSquareIcon,
  FireIcon, BugAntIcon, GlobeAltIcon, FingerPrintIcon,
  SparklesIcon, CpuChipIcon, SignalIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api.js';
import endpoints from '../../services/endpoints.js';
import Card from '../../components/ui/Card.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import StateView from '../../components/ui/StateView.jsx';
import Loader from '../../components/ui/Loader.jsx';
import Badge from '../../components/ui/Badge.jsx';
import RiskLevel from '../../components/ui/RiskLevel.jsx';
import RiskMeter from '../../components/ui/RiskMeter.jsx';
import SecurityGauge from '../../components/ui/SecurityGauge.jsx';
import StreamingResponse from '../../components/soc/StreamingResponse.jsx';

const SCAN_TYPE_LABELS = { url: 'URL', password: 'Password', email: 'Email', file: 'File', qr: 'QR' };
const RISK_COLORS = { Critical: 'red', High: 'orange', Medium: 'amber', Low: 'green' };

export default function AIAnalyzer() {
  const { t } = useTranslation();
  const [analyses, setAnalyses] = useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [streamingAnalysis, setStreamingAnalysis] = useState(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [stats, setStats] = useState(null);
  const [reopenTarget, setReopenTarget] = useState(null);
  const [reopening, setReopening] = useState(false);
  const [filterScanType, setFilterScanType] = useState('all');
  const [filterRiskLevel, setFilterRiskLevel] = useState('all');
  const [activeTab, setActiveTab] = useState('history');
  const abortRef = useRef(null);

  useEffect(() => {
    loadHistory();
    loadStats();
  }, []);

  const loadHistory = async () => {
    try {
      const result = await endpoints.getAIAnalysisHistory();
      setAnalyses(result?.analyses || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const result = await endpoints.getAIAnalysisStats();
      setStats(result);
    } catch {
      // silently ignore
    }
  };

  const handleAnalyzeScan = useCallback(async (scanId, scanType) => {
    setAnalyzing(true);
    abortRef.current = new AbortController();

    try {
      const result = await api.post(`/ai/soc/scan/${scanId}/analyze`, {}, {
        signal: abortRef.current.signal,
      });

      setAnalyses((prev) => [result.data.data, ...prev]);
      setSelectedAnalysis(result.data.data);
      setActiveTab('detail');
      toast.success('AI analysis completed');
      loadStats();
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error('AI analysis failed');
      }
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const handleReopen = useCallback(async (analysisId) => {
    setReopening(true);
    try {
      await api.post(`/ai/soc/${analysisId}/reopen`);
      toast.success('Report reopened for review');
      loadHistory();
    } catch {
      toast.error('Failed to reopen report');
    } finally {
      setReopening(false);
    }
  }, []);

  const handleStreamAnalysis = useCallback(async (scanId, scanType) => {
    setStreamingAnalysis({ scanId, scanType });
    setStreamingContent('');
    abortRef.current = new AbortController();

    try {
      const response = await api.post(
        `/ai/soc/scan/${scanId}/analyze`,
        {},
        {
          signal: abortRef.current.signal,
          responseType: 'stream',
          onDownloadProgress: (progressEvent) => {
            const text = progressEvent.target?.responseText || '';
            setStreamingContent(text);
          },
        }
      );

      setStreamingAnalysis(null);
      if (response.data) {
        setAnalyses((prev) => [response.data.data, ...prev]);
        setSelectedAnalysis(response.data.data);
        setActiveTab('detail');
        toast.success('AI analysis completed');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error('Streaming analysis failed');
      }
      setStreamingAnalysis(null);
    }
  }, []);

  const filteredAnalyses = analyses.filter((a) => {
    if (filterScanType !== 'all' && a.scanType !== filterScanType) return false;
    if (filterRiskLevel !== 'all' && a.riskLevel !== filterRiskLevel) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-96 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return <StateView type="error" title="Failed to load AI Analyst" message="Check your connection and try again." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">AI SOC Analyst</h1>
          <p className="text-sm text-slate-400">Automated threat analysis with MITRE ATT&CK mapping and CVSS scoring</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('history')}
            className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-outline'}`}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`btn ${activeTab === 'new' ? 'btn-primary' : 'btn-outline'}`}
          >
            New Analysis
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs text-slate-400 mb-1">Total Analyses</p>
            <p className="text-3xl font-bold text-cyber-400">{stats.total}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-400 mb-1">Avg Threat Score</p>
            <p className="text-3xl font-bold text-primary">{stats.avgThreatScore}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-400 mb-1">Critical Findings</p>
            <p className="text-3xl font-bold text-danger">{stats.byRiskLevel?.Critical || 0}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-400 mb-1">High Findings</p>
            <p className="text-3xl font-bold text-orange-400">{stats.byRiskLevel?.High || 0}</p>
          </Card>
        </div>
      )}

      {activeTab === 'history' && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={filterScanType}
              onChange={(e) => setFilterScanType(e.target.value)}
              className="input text-sm"
            >
              <option value="all">All Scan Types</option>
              <option value="url">URL</option>
              <option value="password">Password</option>
              <option value="email">Email</option>
              <option value="file">File</option>
              <option value="qr">QR</option>
            </select>
            <select
              value={filterRiskLevel}
              onChange={(e) => setFilterRiskLevel(e.target.value)}
              className="input text-sm"
            >
              <option value="all">All Risk Levels</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {filteredAnalyses.length === 0 ? (
            <StateView type="empty" title="No AI analyses yet" message="Run a scan and analyze it with AI to see results here." />
          ) : (
            <div className="space-y-3">
              {filteredAnalyses.map((analysis) => (
                <div
                  key={analysis.id}
                  className="p-4 rounded-xl bg-white/50 dark:bg-surface-card/50 border border-slate-200 dark:border-slate-700 hover:border-cyber-400/50 transition-all cursor-pointer"
                  onClick={() => { setSelectedAnalysis(analysis); setActiveTab('detail'); }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                        {SCAN_TYPE_LABELS[analysis.scanType] || analysis.scanType}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        analysis.riskLevel === 'Critical' ? 'bg-red-500/10 text-red-400' :
                        analysis.riskLevel === 'High' ? 'bg-orange-500/10 text-orange-400' :
                        analysis.riskLevel === 'Medium' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-green-500/10 text-green-400'
                      }`}>
                        {analysis.riskLevel}
                      </span>
                      <span className="text-sm font-mono text-slate-400">Score: {analysis.threatScore}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {analysis.aiProvidersUsed?.includes('gemini') && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">Gemini</span>
                      )}
                      {analysis.aiProvidersUsed?.includes('ollama') && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">Ollama</span>
                      )}
                      <span className="text-xs text-slate-400">{new Date(analysis.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  {analysis.executiveSummary && (
                    <p className="text-sm text-slate-400 mt-2 line-clamp-2">{analysis.executiveSummary}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'new' && (
        <Card title="New AI Analysis" description="Select a completed scan to analyze with AI">
          {analyzing ? (
            <div className="flex items-center justify-center py-12">
              <Loader label="Running AI analysis..." />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">Choose a scan from your history to run AI analysis on.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {['url', 'password', 'email', 'file', 'qr'].map((type) => {
                  const count = analyses.filter((a) => a.scanType === type).length;
                  return (
                    <button
                      key={type}
                      onClick={() => handleAnalyzeScan(null, type)}
                      className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 hover:border-cyber-400/50 transition-all text-left"
                    >
                      <p className="text-sm font-medium capitalize">{SCAN_TYPE_LABELS[type]} Scan</p>
                      <p className="text-xs text-slate-400 mt-1">{count} previous analyses</p>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">AI combines outputs from Gemini and Ollama when beneficial for comprehensive analysis.</p>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'detail' && selectedAnalysis && (
        <AIAnalysisDetail
          analysis={selectedAnalysis}
          onBack={() => setActiveTab('history')}
          onReopen={() => handleReopen(selectedAnalysis.id)}
          onStream={() => handleStreamAnalysis(selectedAnalysis.scanId, selectedAnalysis.scanType)}
          reopening={reopening}
        />
      )}
    </div>
  );
}

function AIAnalysisDetail({ analysis, onBack, onStream, reopening }) {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', label: 'Overview', icon: ShieldCheckIcon },
    { id: 'technical', label: 'Technical', icon: DocumentTextIcon },
    { id: 'mitre', label: 'MITRE ATT&CK', icon: FingerPrintIcon },
    { id: 'cvss', label: 'CVSS', icon: ChartBarIcon },
    { id: 'actions', label: 'Actions', icon: ArrowDownOnSquareIcon },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="btn-outline text-sm">Back</button>
        <h2 className="text-xl font-bold">AI Analysis Report</h2>
        <Badge variant={RISK_COLORS[analysis.riskLevel] || 'slate'}>{analysis.riskLevel}</Badge>
        {analysis.status === 'reopened' && <Badge variant="warning">Reopened</Badge>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">Threat Score</p>
          <SecurityGauge score={analysis.threatScore} size={120} />
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">Confidence</p>
          <p className="text-3xl font-bold text-cyber-400">{Math.round((analysis.confidenceScore || 0) * 100)}%</p>
          <RiskMeter score={analysis.confidenceScore || 0} />
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">CVSS Score</p>
          <p className="text-3xl font-bold text-primary">{analysis.cvssScore?.toFixed(1) || 'N/A'}</p>
          <p className="text-xs text-slate-400 mt-1">{analysis.cvssVector || 'Auto-generated'}</p>
        </Card>
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === s.id
                ? 'bg-cyber-500/10 text-cyber-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <s.icon className="h-4 w-4" />
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === 'overview' && (
        <div className="space-y-4">
          <Card title="Executive Summary">
            <p className="text-sm text-slate-300 leading-relaxed">{analysis.executiveSummary || 'No summary available.'}</p>
          </Card>
          <Card title="Business Impact">
            <p className="text-sm text-slate-300 leading-relaxed">{analysis.businessImpact || 'No impact assessment available.'}</p>
          </Card>
          <Card title="Root Cause">
            <p className="text-sm text-slate-300 leading-relaxed">{analysis.rootCause || 'No root cause identified.'}</p>
          </Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card title="AI Provider">
              <div className="flex items-center gap-2">
                {analysis.aiProvider === 'gemini' && <SparklesIcon className="h-5 w-5 text-purple-400" />}
                {analysis.aiProvider === 'ollama' && <CpuChipIcon className="h-5 w-5 text-blue-400" />}
                <span className="text-sm font-medium capitalize">{analysis.aiProvider}</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">Providers used: {analysis.aiProvidersUsed?.join(', ') || 'none'}</p>
            </Card>
            <Card title="Scan Details">
              <p className="text-sm text-slate-300">Type: {SCAN_TYPE_LABELS[analysis.scanType]}</p>
              <p className="text-sm text-slate-300">Input: {analysis.scanInput || 'N/A'}</p>
              <p className="text-xs text-slate-500 mt-2">{new Date(analysis.createdAt).toLocaleString()}</p>
            </Card>
          </div>
        </div>
      )}

      {activeSection === 'technical' && (
        <Card title="Technical Summary">
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{analysis.technicalSummary || 'No technical summary available.'}</p>
        </Card>
      )}

      {activeSection === 'mitre' && (
        <div className="space-y-3">
          {(analysis.mitreTechniques?.length > 0) ? (
            analysis.mitreTechniques.map((tech, idx) => (
              <Card key={idx} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-cyber-400">{tech.techniqueId}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    tech.severity === 'Critical' ? 'bg-red-500/10 text-red-400' :
                    tech.severity === 'High' ? 'bg-orange-500/10 text-orange-400' :
                    tech.severity === 'Medium' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-green-500/10 text-green-400'
                  }`}>
                    {tech.severity}
                  </span>
                </div>
                <p className="text-sm font-semibold">{tech.techniqueName}</p>
                <p className="text-xs text-slate-400 capitalize">{tech.tactic}</p>
                {tech.description && <p className="text-xs text-slate-500 mt-2">{tech.description}</p>}
              </Card>
            ))
          ) : (
            <StateView type="empty" title="No MITRE techniques mapped" message="The analysis did not map to any known MITRE ATT&CK techniques." />
          )}
        </div>
      )}

      {activeSection === 'cvss' && (
        <Card title="CVSS Score">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Base Score</span>
              <span className="text-2xl font-bold">{analysis.cvssScore?.toFixed(1) || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Vector</span>
              <code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{analysis.cvssVector || 'N/A'}</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Version</span>
              <span className="text-sm">{analysis.cvssVersion || '3.1'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Severity</span>
              <Badge variant={
                (analysis.cvssScore || 0) >= 9 ? 'danger' :
                (analysis.cvssScore || 0) >= 7 ? 'warning' :
                (analysis.cvssScore || 0) >= 4 ? 'info' : 'success'
              }>
                {(analysis.cvssScore || 0) >= 9 ? 'Critical' :
                 (analysis.cvssScore || 0) >= 7 ? 'High' :
                 (analysis.cvssScore || 0) >= 4 ? 'Medium' : 'Low'}
              </Badge>
            </div>
          </div>
        </Card>
      )}

      {activeSection === 'actions' && (
        <div className="space-y-3">
          {(analysis.recommendedActions?.length > 0) ? (
            analysis.recommendedActions.map((action, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                <CheckCircleIcon className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
                <p className="text-sm text-slate-300">{action}</p>
              </div>
            ))
          ) : (
            <StateView type="empty" title="No recommended actions" message="The analysis did not generate specific recommendations." />
          )}
          <div className="flex items-center gap-3 pt-4">
            <button onClick={onStream} className="btn-cyber inline-flex items-center gap-2 text-sm">
              <ArrowPathIcon className="h-4 w-4" />
              Re-analyze with Streaming
            </button>
            <button onClick={() => handleReopen(analysis.id)} disabled={reopening} className="btn-outline inline-flex items-center gap-2 text-sm">
              <DocumentTextIcon className="h-4 w-4" />
              {reopening ? 'Reopening...' : 'Reopen Report'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}