import { motion } from 'framer-motion';

const RISK_TONES = {
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  unknown: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

function toRiskTone(level = 'unknown') {
  const key = String(level).toLowerCase();
  return RISK_TONES[key] || RISK_TONES.unknown;
}

async function downloadReportPdf(report) {
  try {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Security Report', 14, 16);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

    doc.setFontSize(12);
    doc.setTextColor(0);
    const left = 14;
    let y = 32;

    const fields = [
      ['Filename', report.filename || 'Unknown'],
      ['File Type', report.fileType || 'N/A'],
      ['Scan Date', new Date().toLocaleString()],
      ['Risk Level', String(report.riskLevel || 'Unknown').toUpperCase()],
      ['Confidence Score', report.confidenceScore || 'N/A'],
      ['AI Provider', report.aiProvider || 'N/A'],
    ];

    fields.forEach(([label, value]) => {
      doc.setFont(undefined, 'bold');
      doc.text(label + ':', left, y);
      doc.setFont(undefined, 'normal');
      doc.text(String(value), left + 42, y);
      y += 7;
    });

    y += 4;
    doc.setFont(undefined, 'bold');
    doc.text('Summary', left, y);
    y += 6;
    doc.setFont(undefined, 'normal');
    const summary = report.summary || report.filename || 'No summary provided.';
    const lines = doc.splitTextToSize(String(summary), 180);
    doc.text(lines, left, y);
    y += lines.length * 6 + 4;

    const threats = Array.isArray(report.detectedThreats) ? report.detectedThreats : [];
    if (threats.length > 0) {
      doc.setFont(undefined, 'bold');
      doc.text('Detected Threats', left, y);
      y += 6;
      doc.setFont(undefined, 'normal');
      threats.forEach((threat) => {
        const threatLines = doc.splitTextToSize(`- ${String(threat)}`, 180);
        doc.text(threatLines, left + 4, y);
        y += threatLines.length * 6 + 2;
      });
      y += 4;
    }

    if (report.recommendations) {
      doc.setFont(undefined, 'bold');
      doc.text('Recommendations', left, y);
      y += 6;
      doc.setFont(undefined, 'normal');
      const recLines = doc.splitTextToSize(String(report.recommendations), 180);
      doc.text(recLines, left, y);
    }

    const filename = `security-report-${(report.filename || 'file').replace(/[^a-z0-9\-_.]+/gi, '-')}.pdf`;
    doc.save(filename);
  } catch {
    // silent fail for PDF generation
  }
}

export default function SecurityReportCard({ report }) {
  if (!report) return null;

  const tone = toRiskTone(report.riskLevel);
  const items = Array.isArray(report.detectedThreats) ? report.detectedThreats : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Security Report</span>
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tone}`}>
            {report.riskLevel || 'Unknown'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">
            {report.fileType || 'FILE'}
          </span>
          <button
            type="button"
            onClick={() => downloadReportPdf(report)}
            className="text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Download
          </button>
        </div>
      </div>

      <div className="p-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Filename</p>
          <p className="text-sm text-slate-800 dark:text-slate-100 break-all">{report.filename || 'Unknown'}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Confidence</p>
          <p className="text-sm text-slate-800 dark:text-slate-100">{report.confidenceScore || 'N/A'}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Provider</p>
          <p className="text-sm text-slate-800 dark:text-slate-100">{report.aiProvider || 'N/A'}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Threats</p>
          <p className="text-sm text-slate-800 dark:text-slate-100">{items.length > 0 ? `${items.length} detected` : 'None detected'}</p>
        </div>
      </div>

      {items.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-2">Detected Threats</p>
          <ul className="space-y-1.5">
            {items.map((threat, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                <span className="break-words">{String(threat)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.recommendations && (
        <div className="px-4 pb-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1.5">Recommendations</p>
          <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/40 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-600">
            {report.recommendations}
          </p>
        </div>
      )}
    </motion.div>
  );
}
