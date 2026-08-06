/**
 * services/security/mitreMapper.js
 * ============================================================
 * MITRE ATT&CK threat enricher (TASK 5 — AI SOC Enhancement).
 *
 * Pure, side-effect-free utility. Maps a detected threat (a keyword
 * or short phrase returned by the AI / scan layer) to its MITRE ATT&CK
 * technique, tactic, severity, and a recommended incident-response
 * workflow. Does NOT alter existing response shapes — callers enrich
 * reports by ADDING new optional `mitre` / `incidentResponse` fields.
 *
 * Reference: https://attack.mitre.org/ (v15 coverage used here).
 * ============================================================
 */

/** Severity buckets for a detected technique. */
const SEVERITY = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high', CRITICAL: 'critical' };

/**
 * Curated mapping: trigger keyword/regex -> MITRE ATT&CK entry.
 * `match` can be a string (case-insensitive substring) or a RegExp.
 * Ordered from most-specific to least-specific; first hit wins.
 */
export const MITRE_TECHNIQUES = [
  {
    id: 'T1566.001',
    name: 'Spearphishing Attachment',
    tactic: 'Initial Access',
    tactics: ['Initial Access'],
    severity: SEVERITY.HIGH,
    match: /(phish|spearphish|email attachment|malicious attachment)/i,
    description: 'Adversary used a phishing email with a malicious attachment to gain Initial Access.',
    recommendedResponse: [
      'Quarantine the reported email and detach the attachment.',
      'Block the sender domain at the mail gateway.',
      'Scan endpoints for execution artifacts (Office macros, .lnk, .js).',
      'Reset credentials for any users who opened the attachment.',
      'Hunt mailboxes for similar phishing emails.',
    ],
  },
  {
    id: 'T1566.002',
    name: 'Spearphishing Link',
    tactic: 'Initial Access',
    tactics: ['Initial Access'],
    severity: SEVERITY.HIGH,
    match: /(phish|malicious link|url|qr\s?code|shortened url|suspicious link)/i,
    description: 'Initial Access via a phishing link (often in email or chat).',
    recommendedResponse: [
      'Block the destination URL/domain in the web proxy / DNS firewall.',
      'Warn users and run awareness training on the campaign.',
      'Search logs for users who clicked similar URLs.',
      'Investigate any resulting authentication from those links.',
    ],
  },
  {
    id: 'T1059.001',
    name: 'PowerShell',
    tactic: 'Execution',
    tactics: ['Execution'],
    severity: SEVERITY.HIGH,
    match: /(powershell|pwsh|psexec|wmic|cmd\.exe|command-line|shell)/i,
    description: 'Execution of a PowerShell (or shell) command sequence.',
    recommendedResponse: [
      'Collect and review script block logs (Event ID 4104).',
      'Check parent/child process trees for obfuscation.',
      'Block or audit unsigned PowerShell execution.',
      'Isolate the host and capture a memory image if malicious.',
    ],
  },
  {
    id: 'T1059.004',
    name: 'Unix Shell',
    tactic: 'Execution',
    tactics: ['Execution'],
    severity: SEVERITY.MEDIUM,
    match: /(bash|sh\s|\/bin\/sh|csh|zsh|reverse\s*shell)/i,
    description: 'Execution of a Unix shell, potentially a reverse shell.',
    recommendedResponse: [
      'Review shell history and process command lines (auditd).',
      'Inspect netstat/ss for outbound reverse-shell connections.',
      'Rotate keys/host credentials if a foothold is confirmed.',
    ],
  },
  {
    id: 'T1027',
    name: 'Obfuscated Files or Information',
    tactic: 'Defense Evasion',
    tactics: ['Defense Evasion'],
    severity: SEVERITY.HIGH,
    match: /(obfuscat|base64|encoded|packed|\.enc\b|encrypted payload)/i,
    description: 'Threat used encoding/obfuscation to hide malicious content.',
    recommendedResponse: [
      'Decode and sandbox the payload in an isolated VM.',
      'Add YARA/detection rules for the encoding pattern.',
      'Increase logging verbosity on affected hosts.',
    ],
  },
  {
    id: 'T1562.001',
    name: 'Disable or Modify Windows Defender',
    tactic: 'Defense Evasion',
    tactics: ['Defense Evasion'],
    severity: SEVERITY.HIGH,
    match: /(disable.*defender|defender.*disable|set-mpaspreference|disable.*security|disable.*antivirus|edr.*bypass|bypass.*edr)/i,
    description: 'Adversary tampered with endpoint security controls.',
    recommendedResponse: [
      'Alert the EDR/SIEM team; treat as high-priority.',
      'Force a full AV/EDR scan on the host.',
      'Capture registry/ETW integrity baseline for rollback.',
    ],
  },
  {
    id: 'T1003.001',
    name: 'OS Credential Dumping: LSASS Memory',
    tactic: 'Credential Access',
    tactics: ['Credential Access'],
    severity: SEVERITY.CRITICAL,
    match: /(lsass|credential dump|sekurlsa|mimikatz|lsa\.dll|dump.*cred|procdump)/i,
    description: 'Credentials dumped from LSASS memory.',
    recommendedResponse: [
      'Isolate the host immediately.',
      'Force-reset passwords for all accounts that recently authenticated on it.',
      'Rotate Kerberos service accounts and disable compromised TGTs (klist purge).',
      'Collect LSASS memory dump for forensics.',
    ],
  },
  {
    id: 'T1078',
    name: 'Valid Accounts',
    tactic: 'Defense Evasion',
    tactics: ['Defense Evasion', 'Initial Access', 'Persistence'],
    severity: SEVERITY.CRITICAL,
    match: /(valid account|compromised account|stolen credential|reused password|password reuse|brute.?force|brute force)/i,
    description: 'Use of valid (possibly stolen) accounts to access systems.',
    recommendedResponse: [
      'Enable MFA on all accounts; enforce for the affected user.',
      'Disable the compromised account pending investigation.',
      'Reset passwords and review recent activity/audit logs.',
      'Implement conditional access / sign-in risk policies.',
    ],
  },
  {
    id: 'T1021.002',
    name: 'Remote Services: SMB/Windows Admin Shares',
    tactic: 'Lateral Movement',
    tactics: ['Lateral Movement'],
    severity: SEVERITY.HIGH,
    match: /(lateral movement|smb|\.exe.*admin\$|admin share|psremoting|winrs|wmi.*remote|remote.*service)/i,
    description: 'Lateral movement across hosts via remote services/SMB.',
    recommendedResponse: [
      'Segment networks; restrict lateral ports (445, 135, 5985).',
      'Block lateral tool binaries via AppLocker/EDR.',
      'Monitor for SMB authentication anomalies.',
      'Rotate service account credentials used in the path.',
    ],
  },
  {
    id: 'T1020',
    name: ' Automated Collection / Archive Collected Data',
    tactic: 'Collection',
    tactics: ['Collection'],
    severity: SEVERITY.MEDIUM,
    match: /(data.*collect|archive.*data|staged.*data|exfil.*prepar|collect.*file)/i,
    description: 'Data staged or archived prior to exfiltration.',
    recommendedResponse: [
      'Identify and size staged archives on the host.',
      'Block outbound transfers of archive types (.zip/.rar) at the gateway.',
      'Snapshot the host for evidence retention.',
    ],
  },
  {
    id: 'T1041',
    name: 'Exfiltration Over C2 / Exfiltration Over Command and Control',
    tactic: 'Exfiltration',
    tactics: ['Exfiltration'],
    severity: SEVERITY.CRITICAL,
    match: /(exfiltrat|data.*exfil|outbound to unknown|large.*upload|dns.*tunnel|http.*post.*data)/i,
    description: 'Sensitive data sent externally over C2 or direct channels.',
    recommendedResponse: [
      'Block/ sinkhole the destination IP/domain immediately.',
      'Mirror traffic (port mirror) and capture the exfil channel.',
      'Inspect DLP alerts for data-classification matches.',
      'Quarantine the host and revoke its network segment.',
    ],
  },
  {
    id: 'T1071.001',
    name: 'Application Layer Protocol: Web Protocols',
    tactic: 'Command and Control',
    tactics: ['Command and Control'],
    severity: SEVERITY.HIGH,
    match: /(beaconing|c2|command.{0,15}control|http.*post.*beacon|keep-alive.*c2|malicious.*traffic)/i,
    description: 'Covert C2 channel over web protocols (HTTP/S).',
    recommendedResponse: [
      'Baseline and alert on anomalous HTTP(S) user-agent/header patterns.',
      'Block known-bad C2 domains in DNS firewall.',
      'Correlate flow logs for periodic beaconing (fixed intervals).',
    ],
  },
  {
    id: 'T1486',
    name: 'Data Encrypted for Impact (Ransomware)',
    tactic: 'Impact',
    tactics: ['Impact'],
    severity: SEVERITY.CRITICAL,
    match: /(ransomware|\.encrypted|file.*encrypt|lock.*file|wiper|data.*destroy|delete.*shadow|shadow.*copy)/i,
    description: 'Files encrypted or destroyed (ransomware/wiper).',
    recommendedResponse: [
      'Isolate the host; do NOT power off (preserve memory).',
      'Restore from immutable/offline backups after reimaging.',
      'Disable compromised user/service accounts.',
      'Engage incident response and legal/comms team per IRP.',
    ],
  },
  {
    id: 'T1190',
    name: 'Exploit Public-Facing Application',
    tactic: 'Initial Access',
    tactics: ['Initial Access'],
    severity: SEVERITY.CRITICAL,
    match: /(vulnerabilit|cve|exploit|rce|remote code|unpatched|sqli|xss|command injection|ssrf)/i,
    description: 'Exploitation of a public-facing application vulnerability.',
    recommendedResponse: [
      'Patch the vulnerable component immediately; roll back if needed.',
      'Audit WAF/IPS signatures for the CVE/technique.',
      'Scan for indicators of compromise across all instances.',
      'Rotate secrets/tokens that may have been exposed.',
    ],
  },
  {
    id: 'T1133',
    name: 'External Remote Services',
    tactic: 'Persistence',
    tactics: ['Persistence'],
    severity: SEVERITY.MEDIUM,
    match: /(vpn|remote access|unauth.*remote|open.*rdp|exposed.*remote|remote desktop)/i,
    description: 'Persistence or access via external remote services (VPN/RDP).',
    recommendedResponse: [
      'Restrict RDP/VPN to known IPs via allowlist / ZTNA.',
      'Enforce MFA on all remote-access accounts.',
      'Audit remote-access logs and terminate dormant sessions.',
    ],
  },
  {
    id: 'T1556.007',
    name: 'MFA Request Generation / MFA Fatigue',
    tactic: 'Authentication Patterns',
    tactics: ['Credential Access'],
    severity: SEVERITY.HIGH,
    match: /(mfa|2fa|mfa fatigue|push bomb|approve.*request|otp|totp)/i,
    description: 'Authentication bypass or MFA fatigue attack.',
    recommendedResponse: [
      'Warn users never to approve unexpected MFA prompts.',
      'Block repeated MFA requests; force re-enrollment.',
      'Review sign-in logs for impossible-travel anomalies.',
    ],
  },
];

/**
 * Map a single threat/keyword string to a MITRE entry, or null.
 * @param {string} threat
 * @returns {{id:string,name:string,tactic:string,tactics:string[],severity:string,description:string,recommendedResponse:string[]}|null}
 */
export const mapThreatToMITRE = (threat) => {
  if (!threat || typeof threat !== 'string') return null;
  const text = threat.trim();
  if (!text) return null;
  for (const entry of MITRE_TECHNIQUES) {
    if (typeof entry.match === 'string') {
      if (text.toLowerCase().includes(entry.match.toLowerCase())) return entry;
    } else if (entry.match.test(text)) {
      return entry;
    }
  }
  return null;
};

/**
 * Aggregate an overall incident-response playbook for a set of mapped
 * threats (deduplicated, severity-ordered). Used by AI responses so an
 * analyst sees a concrete 1..N step playbook (e.g. "Phishing email" ->
 * disable account / reset password / block domain / hunt similar).
 * @param {Array} mitreEntries
 * @returns {{severity:'low'|'medium'|'high'|'critical', steps:string[]}}
 */
export const buildIncidentResponse = (mitreEntries = []) => {
  const valid = mitreEntries.filter(Boolean);
  if (valid.length === 0) {
    return { severity: SEVERITY.LOW, steps: ['Review the alert manually; no specific ATT&CK technique matched.'] };
  }
  const rank = { low: 0, medium: 1, high: 2, critical: 3 };
  const severity = valid.reduce((max, e) => (rank[e.severity] > rank[max] ? e.severity : max), SEVERITY.LOW);
  const steps = [];
  const seen = new Set();
  for (const entry of valid) {
    for (const s of entry.recommendedResponse) {
      if (!seen.has(s)) {
        seen.add(s);
        steps.push(s);
      }
    }
  }
  return { severity, steps };
};

/**
 * Enrich an analysis result/report with MITRE ATT&CK context.
 * PURE ADDITION: returns a new object with `mitre` and `incidentResponse`
 * fields appended alongside any existing fields. Non-destructive.
 *
 * @param {{detectedThreats?:string[],detectedIssues?:string[],threatLevel?:string,analysis?:string}} result
 * @returns {{mitre:Array, incidentResponse:{severity:string,steps:string[]}, techniqueCount:number}}
 */
export const enrichWithMITRE = (result = {}) => {
  const threats = Array.isArray(result.detectedThreats)
    ? result.detectedThreats
    : Array.isArray(result.detectedIssues)
      ? result.detectedIssues
      : [];
  const mitre = threats.map(mapThreatToMITRE).filter(Boolean);
  return {
    mitre,
    incidentResponse: buildIncidentResponse(mitre),
    techniqueCount: mitre.length,
  };
};

export default { MITRE_TECHNIQUES, mapThreatToMITRE, buildIncidentResponse, enrichWithMITRE };
