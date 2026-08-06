/**
 * pages/admin/AIIncidentReportCenter.jsx
 * ------------------------------------------------------------
 * PHASE 5 — AI Incident Report Generator.
 * Reuses: endpoints, useSocket, existing UI components.
 *
 * Features:
 *  - Report list with search/filter
 *  - Severity badges
 *  - Timeline viewer
 *  - Evidence viewer
 *  - AI-generated executive + technical summaries
 *  - Export PDF / DOCX / Markdown
 *  - Shareable link generation
 *  - Email report
 *  - Realtime updates via Socket.IO
 */
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { useSocket } from '../../hooks/useSocket.js';
import endpoints from '../../services/endpoints.js';
import Card from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import StateView from '../../components/ui/StateView.jsx';

const SEVERITY_TONES = {
  Low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  High: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  Critical: 'bg-red-500/15 text-red-400 border-red-500/30',
};

export default function AIIncidentReportCenter() {
  const { t } = useTranslation();
  const { connected, on } = useSocket(true);
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState('pdf');
  const [emailAddress, setEmailAddress] = useState('');

  const loadReports = () => {
    setLoading(true);
    return endpoints
      .getIncidentReports({ severity: filterSeverity || undefined })
      .then((data) => setReports(data))
      .catch(() => toast.error('Failed to load reports'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReports();
  }, [filterSeverity]);

  useEffect(() => {
    const unsubCreated = on('incident.report.created', (payload) => {
      toast.info(`New report generated for incident ${payload.incidentId}`);
      loadReports();
    });
    const unsubCompleted = on('incident.report.completed', (payload) => {
      toast.success(`Report ${payload.reportId} completed`);
      loadReports();
    });
    const unsubShared = on('incident.report.shared', (payload) => {
      toast.success(`Report shared. Link expires: ${new Date(payload.expiresAt).toLocaleString()}`);
    });

    return () => {
      unsubCreated?.();
      unsubCompleted?.();
      unsubShared?.();
    };
  }, [on, loadReports]);

  const filteredReports = useMemo(() => {
    if (!search) return reports;
    const q = search.toLowerCase();
    return reports.filter(
      (r) =>
        r.incidentId?.toLowerCase().includes(q) ||
        r.executiveSummary?.toLowerCase().includes(q) ||
        r.severity?.toLowerCase().includes(q)
    );
  }, [reports, search]);

  const handleGenerate = async (incidentId) => {
    setGenerating(true);
    try {
      const report = await endpoints.generateIncidentReport(incidentId);
      toast.success('Report generated successfully');
      setSelectedReport(report);
      loadReports();
    } catch {
      toast.error('Report generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async (format) => {
    if (!selectedReport) return;
    try {
      const result = await endpoints.exportIncidentReport(selectedReport.id, format);
      if (format === 'markdown') {
        const blob = new Blob([result.data || result], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `incident-report-${selectedReport.incidentId}.md`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Markdown exported');
      } else if (format === 'pdf') {
        await buildPdf(selectedReport);
        toast.success('PDF exported');
      } else if (format === 'docx') {
        await buildDocx(selectedReport);
        toast.success('DOCX exported');
      }
    } catch {
      toast.error('Export failed');
    }
  };

  const handleShare = async () => {
    if (!selectedReport) return;
    setShareLoading(true);
    try {
      const result = await endpoints.shareIncidentReport(selectedReport.id);
      const shareUrl = `${window.location.origin}/shared-report/${result.shareToken}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied to clipboard');
      setSelectedReport((prev) => ({ ...prev, shareToken: result.shareToken, shareExpiresAt: result.expiresAt }));
    } catch {
      toast.error('Share failed');
    } finally {
      setShareLoading(false);
    }
  };

  const handleEmail = async () => {
    if (!selectedReport || !emailAddress) return;
    setEmailLoading(true);
    try {
      await endpoints.emailIncidentReport(selectedReport.id, emailAddress);
      toast.success(`Report emailed to ${emailAddress}`);
    } catch {
      toast.error('Email failed');
    } finally {
      setEmailLoading(false);
    }
  };

  const buildPdf = async (report) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    let y = 14;

    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text('AI Incident Report', 14, y);
    y += 10;

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Incident ID: ${report.incidentId}`, 14, y);
    doc.text(`Severity: ${report.severity}`, pageW / 2, y);
    doc.text(`Generated: ${new Date(report.createdAt).toLocaleString()}`, pageW - 14, y, { align: 'right' });
    y += 10;

    doc.setDrawColor(203, 213, 225);
    doc.line(14, y, pageW - 14, y);
    y += 8;

    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('Executive Summary', 14, y);
    y += 7;
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    const execLines = doc.splitTextToSize(report.executiveSummary || '', pageW - 28);
    doc.text(execLines, 14, y);
    y += execLines.length * 6 + 8;

    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('Business Impact', 14, y);
    y += 7;
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    const bizLines = doc.splitTextToSize(report.businessImpact || '', pageW - 28);
    doc.text(bizLines, 14, y);
    y += bizLines.length * 6 + 8;

    doc.setFontSize(14);
    doc.text('Priority Actions', 14, y);
    y += 7;
    doc.setFontSize(11);
    (report.priorityActions || []).forEach((action) => {
      if (y > 280) { doc.addPage(); y = 14; }
      doc.text(`- ${action}`, 14, y);
      y += 6;
    });
    y += 6;

    doc.setFontSize(14);
    doc.text('Technical Summary', 14, y);
    y += 7;
    doc.setFontSize(10);
    const techLines = doc.splitTextToSize(report.technicalSummary || '', pageW - 28);
    doc.text(techLines, 14, y);
    y += techLines.length * 5 + 8;

    doc.setFontSize(14);
    doc.text('Timeline', 14, y);
    y += 7;
    doc.setFontSize(10);
    (report.timeline || [])
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .forEach((t) => {
        if (y > 280) { doc.addPage(); y = 14; }
        doc.text(`${new Date(t.timestamp).toLocaleString()} [${t.source}] ${t.event}`, 14, y);
        y += 5;
        if (t.description) {
          doc.setTextColor(100);
          doc.text(t.description, 18, y);
          doc.setTextColor(0);
          y += 5;
        }
      });

    doc.save(`incident-report-${report.incidentId}.pdf`);
  };

  const buildDocx = async (report) => {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
    const doc = new Document({
      creator: 'CyberSec AI Incident Report Generator',
      title: `Incident Report ${report.incidentId}`,
      description: `AI-generated incident report for ${report.incidentId}`,
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({ text: 'AI Incident Report', heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: `Incident ID: ${report.incidentId}`, style: 'Normal' }),
            new Paragraph({ text: `Severity: ${report.severity}`, style: 'Normal' }),
            new Paragraph({ text: `Status: ${report.status}`, style: 'Normal' }),
            new Paragraph({ text: `Generated: ${new Date(report.createdAt).toLocaleString()}`, style: 'Normal' }),
            new Paragraph({ text: `AI Provider: ${report.aiProvider}`, style: 'Normal' }),
            new Paragraph({ text: '' }),
            new Paragraph({ text: 'Executive Summary', heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: report.executiveSummary || 'No executive summary available.', style: 'Normal' }),
            new Paragraph({ text: '' }),
            new Paragraph({ text: 'Business Impact', heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: report.businessImpact || 'No business impact assessment available.', style: 'Normal' }),
            new Paragraph({ text: '' }),
            new Paragraph({ text: 'Priority Actions', heading: HeadingLevel.HEADING_2 }),
            ...(report.priorityActions || []).map((a) => new Paragraph({ text: `- ${a}`, style: 'Normal' })),
            new Paragraph({ text: '' }),
            new Paragraph({ text: 'Recovery Recommendation', heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: report.recoveryRecommendation || 'No recovery recommendations available.', style: 'Normal' }),
            new Paragraph({ text: '' }),
            new Paragraph({ text: 'Technical Summary', heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: report.technicalSummary || 'No technical summary available.', style: 'Normal' }),
            new Paragraph({ text: '' }),
            new Paragraph({ text: 'Attack Vector', heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: report.attackVector || 'No attack vector identified.', style: 'Normal' }),
            new Paragraph({ text: '' }),
            new Paragraph({ text: 'Root Cause', heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: report.rootCause || 'No root cause identified.', style: 'Normal' }),
            new Paragraph({ text: '' }),
            new Paragraph({ text: 'Indicators of Compromise', heading: HeadingLevel.HEADING_2 }),
            ...(report.indicatorsOfCompromise || []).map((i) => new Paragraph({ text: `- ${i}`, style: 'Normal' })),
            new Paragraph({ text: '' }),
            new Paragraph({ text: 'MITRE ATT&CK Mapping', heading: HeadingLevel.HEADING_2 }),
            ...(report.mitreMapping || []).map(
              (m) => new Paragraph({ text: `- ${m.techniqueId}: ${m.techniqueName} (${m.tactic})`, style: 'Normal' })
            ),
            new Paragraph({ text: '' }),
            new Paragraph({ text: 'CVSS Score', heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: report.cvss?.score != null ? `${report.cvss.score} (v${report.cvss.version})` : 'Not scored', style: 'Normal' }),
            new Paragraph({ text: '' }),
            new Paragraph({ text: 'Timeline', heading: HeadingLevel.HEADING_2 }),
            ...(report.timeline || [])
              .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
              .map(
                (t) =>
                  new Paragraph({
                    text: `${new Date(t.timestamp).toLocaleString()} [${t.source}] ${t.event}: ${t.description || ''}`,
                    style: 'Normal',
                  })
              ),
            new Paragraph({ text: '' }),
            new Paragraph({ text: 'Evidence', heading: HeadingLevel.HEADING_2 }),
            ...(report.evidence || []).map(
              (e) => new Paragraph({ text: `- [${e.type}] ${e.description}`, style: 'Normal' })
            ),
            new Paragraph({ text: '' }),
            new Paragraph({ text: 'Remediation Steps', heading: HeadingLevel.HEADING_2 }),
            ...(report.recommendations || []).map((r) => new Paragraph({ text: `- ${r}`, style: 'Normal' })),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incident-report-${report.incidentId}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Incident Report Center</h1>
          <p className="text-sm text-slate-400">Generate, manage, and export AI-powered incident reports</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${connected ? 'bg-green-500/15 text-green-400' : 'bg-slate-500/15 text-slate-400'}`}>
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-400' : 'bg-slate-400'}`} />
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card title="Reports" description="AI-generated incident reports">
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Search reports..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-surface-card px-3 py-2 text-sm"
              />
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-surface-card px-3 py-2 text-sm"
              >
                <option value="">All Severities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
              <Button variant="cyber" size="sm" onClick={loadReports} className="w-full">
                Refresh
              </Button>
            </div>
          </Card>

          <Card title="Generate Report" description="Create a new AI incident report">
            <ReportGenerator onGenerate={handleGenerate} loading={generating} />
          </Card>
        </div>

        <div className="lg:col-span-2">
          {loading ? (
            <Loader />
          ) : !selectedReport ? (
            <Card>
              <div className="p-8 text-center">
                <p className="text-slate-400 mb-4">Select a report to view details</p>
                <div className="space-y-2">
                  {filteredReports.slice(0, 10).map((r) => (
                    <div
                      key={r.id}
                      onClick={() => setSelectedReport(r)}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-cyber-400 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Incident {r.incidentId}</p>
                          <p className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleString()}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full border ${SEVERITY_TONES[r.severity] || SEVERITY_TONES.Medium}`}>
                          {r.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                  {!filteredReports.length && (
                    <p className="text-sm text-slate-400">No reports found. Generate your first report.</p>
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card title={`Report: ${selectedReport.incidentId}`} description={`Severity: ${selectedReport.severity} | AI: ${selectedReport.aiProvider}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="cyber" size="sm" onClick={() => handleExport('pdf')}>Export PDF</Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport('docx')}>Export DOCX</Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport('markdown')}>Export MD</Button>
                  <Button variant="outline" size="sm" onClick={handleShare} loading={shareLoading}>Share</Button>
                </div>
                {selectedReport.shareToken && (
                  <p className="text-xs text-slate-400 mt-2">
                    Share link expires: {new Date(selectedReport.shareExpiresAt).toLocaleString()}
                  </p>
                )}
                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    placeholder="Email address"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-surface-card px-3 py-2 text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={handleEmail} loading={emailLoading}>Send Email</Button>
                </div>
              </Card>

              <Card title="Executive Summary" description="AI-generated executive overview">
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{selectedReport.executiveSummary || 'No executive summary available.'}</p>
              </Card>

              <Card title="Business Impact" description="Business risk assessment">
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{selectedReport.businessImpact || 'No business impact assessment available.'}</p>
              </Card>

              <Card title="Priority Actions" description="Immediate actions for leadership">
                <ul className="space-y-2">
                  {(selectedReport.priorityActions || []).map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyber-400 shrink-0" />
                      <span>{action}</span>
                    </li>
                  ))}
                  {!selectedReport.priorityActions?.length && (
                    <p className="text-sm text-slate-400">No priority actions identified.</p>
                  )}
                </ul>
              </Card>

              <Card title="Technical Summary" description="Detailed technical analysis">
                <pre className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl overflow-x-auto">
                  {selectedReport.technicalSummary || 'No technical summary available.'}
                </pre>
              </Card>

              <Card title="Indicators of Compromise" description="Detected IOCs">
                <div className="flex flex-wrap gap-2">
                  {(selectedReport.indicatorsOfCompromise || []).map((ioc, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30">
                      {ioc}
                    </span>
                  ))}
                  {!selectedReport.indicatorsOfCompromise?.length && (
                    <p className="text-sm text-slate-400">No IOCs identified.</p>
                  )}
                </div>
              </Card>

              <Card title="MITRE ATT&CK Mapping" description="Attack technique mapping">
                <div className="space-y-2">
                  {(selectedReport.mitreMapping || []).map((m, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <span className="text-sm font-medium">{m.techniqueId}: {m.techniqueName}</span>
                      <Badge tone="info">{m.tactic}</Badge>
                    </div>
                  ))}
                  {!selectedReport.mitreMapping?.length && (
                    <p className="text-sm text-slate-400">No MITRE mapping available.</p>
                  )}
                </div>
              </Card>

              <Card title="Timeline" description="Chronological event sequence">
                <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-4">
                  {(selectedReport.timeline || [])
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                    .map((t, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[21px] h-3 w-3 rounded-full bg-cyber-400 border-2 border-white dark:border-surface-card" />
                        <p className="text-xs text-slate-400">{new Date(t.timestamp).toLocaleString()}</p>
                        <p className="text-sm font-medium">{t.event}</p>
                        <p className="text-xs text-slate-400">Source: {t.source}</p>
                        {t.description && <p className="text-sm text-slate-600 dark:text-slate-300">{t.description}</p>}
                      </div>
                    ))}
                  {!selectedReport.timeline?.length && (
                    <p className="text-sm text-slate-400">No timeline events.</p>
                  )}
                </div>
              </Card>

              <Card title="Evidence" description="Supporting evidence">
                <div className="space-y-2">
                  {(selectedReport.evidence || []).map((e, i) => (
                    <div key={i} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-sm">
                      <span className="text-xs text-cyber-400 font-medium">[{e.type}]</span> {e.description}
                    </div>
                  ))}
                  {!selectedReport.evidence?.length && (
                    <p className="text-sm text-slate-400">No evidence collected.</p>
                  )}
                </div>
              </Card>

              <Card title="Remediation Steps" description="AI-generated recommendations">
                <ul className="space-y-2">
                  {(selectedReport.recommendations || []).map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                  {!selectedReport.recommendations?.length && (
                    <p className="text-sm text-slate-400">No remediation steps available.</p>
                  )}
                </ul>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportGenerator({ onGenerate, loading }) {
  const [incidentId, setIncidentId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!incidentId.trim()) return;
    onGenerate(incidentId.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs text-slate-400">Incident ID</label>
        <input
          type="text"
          value={incidentId}
          onChange={(e) => setIncidentId(e.target.value)}
          placeholder="Enter SecurityIncident ID"
          className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-surface-card px-3 py-2 text-sm"
          required
        />
      </div>
      <Button type="submit" variant="cyber" size="sm" loading={loading} className="w-full">
        Generate Report
      </Button>
      <p className="text-xs text-slate-400">
        Uses AI to generate executive and technical reports with timeline and evidence.
      </p>
    </form>
  );
}
