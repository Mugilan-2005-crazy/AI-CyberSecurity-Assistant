/**
 * components/soc/CVECard.jsx
 * Displays a single CVE entry with severity, CVSS score, and details.
 */

const severityColors = {
  CRITICAL: 'bg-red-500/10 text-red-400',
  HIGH: 'bg-orange-500/10 text-orange-400',
  MEDIUM: 'bg-amber-500/10 text-amber-400',
  LOW: 'bg-green-500/10 text-green-400',
  INFO: 'bg-blue-500/10 text-blue-400',
};

export default function CVECard({ cve }) {
  if (!cve) return null;

  const cvss = cve.cvssScore || 0;
  const severity = cve.severity || 'INFO';

  return (
    <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityColors[severity] || severityColors.INFO}`}>
          {severity}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 font-mono">
          CVSS {cvss > 0 ? cvss.toFixed(1) : 'N/A'}
        </span>
      </div>
      <h4 className="text-sm font-bold font-mono mb-1">{cve.id}</h4>
      {cve.description && <p className="text-xs text-slate-400 line-clamp-3 mb-2">{cve.description}</p>}
      {cve.publishedDate && (
        <p className="text-xs text-slate-500">Published: {new Date(cve.publishedDate).toLocaleDateString()}</p>
      )}
      {cve.affected?.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-slate-500 mb-1">Affected Products:</p>
          <div className="flex flex-wrap gap-1">
            {cve.affected.slice(0, 3).map((item, idx) => (
              <span key={idx} className="text-xs px-2 py-0.5 rounded bg-slate-200/50 dark:bg-slate-700/50 text-slate-300">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
