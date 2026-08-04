/**
 * components/soc/ThreatFeed.jsx
 * Displays latest threat intelligence feeds (phishing, malware, suspicious IPs).
 */

const categoryColors = {
  phishing: 'bg-red-500/10 text-red-400',
  malware: 'bg-orange-500/10 text-orange-400',
  suspicious_ip: 'bg-amber-500/10 text-amber-400',
  cve: 'bg-purple-500/10 text-purple-400',
};

const typeLabels = {
  phishing: 'Phishing Domain',
  malware: 'Malware Hash',
  suspicious_ip: 'Suspicious IP',
  trojan: 'Trojan',
  ransomware: 'Ransomware',
  backdoor: 'Backdoor',
};

export default function ThreatFeed({ threats = [], loading = false }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 animate-pulse">
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
            <div className="h-3 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!threats.length) {
    return (
      <div className="text-center py-8 text-slate-400">
        <p className="text-sm">No active threat intelligence feeds</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {threats.map((threat) => (
        <div key={threat.id || threat.hash || threat.domain || threat.ip} className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[threat.category] || 'bg-slate-500/10 text-slate-400'}`}>
              {typeLabels[threat.category] || threat.category}
            </span>
            {threat.severity && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium">
                {threat.severity}
              </span>
            )}
          </div>
          <p className="text-sm font-medium truncate mb-1">{threat.id || threat.domain || threat.ip || threat.hash}</p>
          {threat.details && <p className="text-xs text-slate-400 line-clamp-2">{threat.details}</p>}
          {threat.affected && <p className="text-xs text-slate-500 mt-1">Affected: {threat.affected}</p>}
          {threat.reportedAt && <p className="text-xs text-slate-500 mt-1">Reported: {new Date(threat.reportedAt).toLocaleDateString()}</p>}
        </div>
      ))}
    </div>
  );
}
