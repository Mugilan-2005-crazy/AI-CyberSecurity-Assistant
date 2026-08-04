const MITRE_TECHNIQUES = [
  {
    techniqueId: 'T1566',
    techniqueName: 'Phishing',
    tactic: 'Initial Access',
    description: 'Adversaries attempt to trick victims into revealing sensitive information or executing malicious code through deceptive communications, typically via email, social media, or other messaging channels.',
    severity: 'High',
  },
  {
    techniqueId: 'T1204',
    techniqueName: 'User Execution',
    tactic: 'Execution',
    description: 'Adversaries rely on victims to take action on malicious content such as opening a file, clicking a link, or running a program. This technique leverages social engineering and user trust.',
    severity: 'High',
  },
  {
    techniqueId: 'T1059',
    techniqueName: 'Command and Scripting Interpreter',
    tactic: 'Execution',
    description: 'Adversaries may abuse command and script interpreters such as PowerShell, Bash, or WMI to execute commands, scripts, or binaries. These interfaces are commonly used for automation and remote execution.',
    severity: 'Critical',
  },
  {
    techniqueId: 'T1486',
    techniqueName: 'Data Encrypted for Impact',
    tactic: 'Impact',
    description: 'Adversaries encrypt data on target systems or make it otherwise inaccessible. This is commonly associated with ransomware attacks where victims are unable to access their data until a ransom is paid.',
    severity: 'Critical',
  },
  {
    techniqueId: 'T1071',
    techniqueName: 'Application Layer Protocol',
    tactic: 'Command and Control',
    description: 'Adversaries may use application layer protocols such as HTTP, HTTPS, DNS, or FTP to communicate with compromised systems, blending malicious traffic with legitimate network activity to evade detection.',
    severity: 'Medium',
  },
];

function findTechniqueById(techniqueId) {
  return MITRE_TECHNIQUES.find((t) => t.techniqueId === techniqueId) || null;
}

function findTechniquesByTactic(tactic) {
  return MITRE_TECHNIQUES.filter((t) => t.tactic === tactic);
}

function getTechniqueBySeverity(severity) {
  return MITRE_TECHNIQUES.filter((t) => t.severity === severity);
}

function getAllTechniques() {
  return MITRE_TECHNIQUES;
}

function getTechniqueSummary(techniqueId) {
  const technique = findTechniqueById(techniqueId);
  if (!technique) return null;
  return {
    techniqueId: technique.techniqueId,
    techniqueName: technique.techniqueName,
    tactic: technique.tactic,
    severity: technique.severity,
  };
}

export default {
  MITRE_TECHNIQUES,
  findTechniqueById,
  findTechniquesByTactic,
  getTechniqueBySeverity,
  getAllTechniques,
  getTechniqueSummary,
};