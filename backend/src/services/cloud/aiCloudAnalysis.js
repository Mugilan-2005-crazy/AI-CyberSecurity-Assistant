import { routeAI } from '../ai/aiRouter.js';
import logger from '../../utils/logger.js';
import CloudFinding from '../../models/CloudFinding.js';
import CloudResource from '../../models/CloudResource.js';
import ContainerImage from '../../models/ContainerImage.js';
import KubernetesResource from '../../models/KubernetesResource.js';

const emitSocketEvent = async (event, data) => {
  try {
    const { getIoInstance } = await import('../../socket/socketServer.js');
    const io = getIoInstance();
    if (io) {
      io.to('admin-room').emit(event, data);
    }
  } catch (err) {
    logger.warn('[aiCloudAnalysis] Socket emit failed', { error: err.message });
  }
};

const buildContext = async (filters = {}) => {
  const findings = await CloudFinding.find(filters).sort({ createdAt: -1 }).limit(100).lean();
  const cloudResources = await CloudResource.find({}).limit(200).lean();
  const containerImages = await ContainerImage.find({}).sort({ createdAt: -1 }).limit(50).lean();
  const kubeResources = await KubernetesResource.find({}).sort({ lastScanned: -1 }).limit(100).lean();

  const summary = {
    totalFindings: findings.length,
    criticalFindings: findings.filter((f) => f.severity === 'Critical').length,
    highFindings: findings.filter((f) => f.severity === 'High').length,
    providers: {},
    categories: {},
    topFindings: [],
  };

  for (const f of findings) {
    const prov = f.cloudProvider || 'unknown';
    summary.providers[prov] = (summary.providers[prov] || 0) + 1;
    summary.categories[f.checkCategory] = (summary.categories[f.checkCategory] || 0) + 1;
  }

  summary.topFindings = findings.slice(0, 10).map((f) => ({
    checkId: f.checkId,
    title: f.title,
    severity: f.severity,
    riskScore: f.riskScore,
    description: f.description,
    recommendation: f.recommendation,
    category: f.checkCategory,
    provider: f.cloudProvider,
  }));

  return { summary, cloudResources, containerImages, kubeResources, findings };
};

export const generateCloudExecutiveSummary = async (filters = {}) => {
  logger.info('[aiCloudAnalysis] Generating executive summary');

  const context = await buildContext(filters);

  const prompt = `You are a Principal Cloud Security Architect. Generate an executive summary for a cloud security posture management platform.

Security findings summary:
- Total findings: ${context.summary.totalFindings}
- Critical: ${context.summary.criticalFindings}
- High: ${context.summary.highFindings}
- By provider: ${JSON.stringify(context.summary.providers)}
- By category: ${JSON.stringify(context.summary.categories)}
- Top findings: ${JSON.stringify(context.summary.topFindings.slice(0, 5), null, 2)}

Write a professional executive summary covering:
1. Overall cloud security posture
2. Key risk areas
3. Business impact
4. Priority actions

Respond with only the summary text, no markdown headings or labels.`;

  const { provider, response } = await routeAI(prompt, [], 'en');
  return { provider, summary: response };
};

export const generateCloudTechnicalFindings = async (filters = {}) => {
  logger.info('[aiCloudAnalysis] Generating technical findings');

  const context = await buildContext(filters);

  const prompt = `You are a Senior Cloud Security Engineer. Generate a technical analysis of cloud security findings.

Findings data: ${JSON.stringify(context.summary.topFindings.slice(0, 15), null, 2)}
Resource context: ${context.cloudResources.length} cloud resources across ${Object.keys(context.summary.providers).join(', ')}

For each major finding category, provide:
1. Technical description of the vulnerability
2. Affected resources
3. CVSS-style risk assessment
4. Exploit likelihood
5. Detection methods

Format as structured technical report.`;

  const { provider, response } = await routeAI(prompt, [], 'en');
  return { provider, analysis: response };
};

export const generateCloudRemediationPlan = async (findingIds = []) => {
  logger.info('[aiCloudAnalysis] Generating remediation plan', { findingIds });

  const query = findingIds.length > 0 ? { _id: { $in: findingIds } } : {};
  const findings = await CloudFinding.find(query).lean();

  const prompt = `You are a DevSecOps Architect. Generate a detailed remediation plan for these cloud security findings.

Findings: ${JSON.stringify(findings.slice(0, 20).map((f) => ({ checkId: f.checkId, title: f.title, severity: f.severity, recommendation: f.recommendation, evidence: f.evidence })), null, 2)}

For each finding, provide:
1. Priority (P0/P1/P2/P3)
2. Estimated remediation time
3. Step-by-step fix instructions
4. Validation steps
5. Rollback plan

Also provide an overall prioritized action plan sorted by risk.`;

  const { provider, response } = await routeAI(prompt, [], 'en');
  return { provider, plan: response };
};

export const generateCloudRiskScore = async (filters = {}) => {
  const context = await buildContext(filters);

  const baseScore = context.summary.totalFindings > 0 ? Math.min(100, Math.round(context.summary.topFindings.reduce((sum, f) => sum + f.riskScore, 0) / context.summary.topFindings.length)) : 0;

  const criticalWeight = context.summary.criticalFindings * 95;
  const highWeight = context.summary.highFindings * 75;
  const weightedScore = context.summary.topFindings.length > 0 ? Math.round((criticalWeight + highWeight + baseScore) / (context.summary.topFindings.length + 2)) : 0;

  const finalScore = Math.min(100, Math.max(baseScore, weightedScore));

  return {
    score: finalScore,
    level: getRiskLevel(finalScore),
    breakdown: {
      baseScore,
      criticalFindings: context.summary.criticalFindings,
      highFindings: context.summary.highFindings,
      totalFindings: context.summary.totalFindings,
      providers: context.summary.providers,
      categories: context.summary.categories,
    },
    trend: 'stable',
  };
};

export const generateBusinessImpact = async (filters = {}) => {
  const context = await buildContext(filters);

  const prompt = `You are an Enterprise Security Strategist. Analyze the business impact of these cloud security findings.

Security findings: ${JSON.stringify(context.summary.topFindings.slice(0, 10), null, 2)}

Consider:
1. Data breach risk and potential exposure
2. Regulatory compliance implications (GDPR, SOC2, PCI-DSS, HIPAA)
3. Financial impact (downtime, incident response, fines)
4. Reputation damage potential
5. Operational disruption risk

Provide business impact assessment with estimated risk ranges.`;

  const { provider, response } = await routeAI(prompt, [], 'en');
  return { provider, impact: response };
};

export const generateAttackPossibility = async (filters = {}) => {
  const context = await buildContext(filters);

  const prompt = `You are a Threat Modeling Expert (MITRE ATT&CK framework). Analyze the attack possibility based on cloud security findings.

Findings: ${JSON.stringify(context.summary.topFindings.slice(0, 10), null, 2)}

Map findings to MITRE ATT&CK techniques:
1. Initial access vectors (e.g., T1190, T1071)
2. Privilege escalation paths (e.g., T1088, T1068)
3. Credential access opportunities (e.g., T1555, T1552)
4. Lateral movement potential (e.g., T1021, T1075)
5. Defense evasion (e.g., T1562, T1070)

Rate each as Low/Medium/High/Critical and explain the attack chain.`;

  const { provider, response } = await routeAI(prompt, [], 'en');
  return { provider, analysis: response };
};

export const generateComplianceImpact = async (complianceStandards = ['cis', 'nist', 'iso27001', 'soc2']) => {
  const context = await buildContext({});

  const prompt = `You are a Compliance and Risk Management Expert. Map cloud security findings to compliance frameworks.

Frameworks: ${complianceStandards.join(', ')}
Findings: ${JSON.stringify(context.summary.topFindings.slice(0, 10), null, 2)}

For each framework, identify:
1. Relevant controls and requirements
2. Non-compliant findings
3. Gap analysis
4. Remediation timeline recommendations
5. Evidence requirements for audit

Format as structured compliance assessment.`;

  const { provider, response } = await routeAI(prompt, [], 'en');
  return { provider, assessment: response };
};

const getRiskLevel = (score) => {
  if (score >= 81) return 'Critical';
  if (score >= 61) return 'High';
  if (score >= 31) return 'Medium';
  return 'Low';
};

export const generateFullCloudAnalysis = async (filters = {}) => {
  const context = await buildContext(filters);
  const findings = context.summary.topFindings;

  const prompt = `You are an Enterprise Cloud Security Architect. Generate a comprehensive cloud security analysis.

Generate a JSON report with the following structure:
{
  "executiveSummary": "string",
  "technicalFindings": "string",
  "businessImpact": "string",
  "attackPossibility": "string",
  "riskScore": number (0-100),
  "confidenceScore": number (0-100),
  "remediationPlan": "string",
  "priorityFixes": [{"priority": "P0", "finding": "string", "estimatedTime": "string"}],
  "costImpact": "string",
  "complianceImpact": "string"
}

Findings data: ${JSON.stringify(findings.slice(0, 15), null, 2)}
Total findings: ${context.summary.totalFindings}
Critical: ${context.summary.criticalFindings}
High: ${context.summary.highFindings}

Respond ONLY with valid JSON.`;

  try {
    const { provider, response } = await routeAI(prompt, [], 'en');
    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch {
      const extracted = response.match(/\{[\s\S]*\}/);
      parsed = extracted ? JSON.parse(extracted[0]) : null;
    }

    if (parsed) {
      return { provider, analysis: parsed };
    }
  } catch (err) {
    logger.warn('[aiCloudAnalysis] AI analysis failed', { error: err.message });
  }

  return {
    provider: 'fallback',
    analysis: {
      executiveSummary: `Analysis of ${context.summary.totalFindings} findings across ${Object.keys(context.summary.providers).join(', ') || 'all providers'}. ${context.summary.criticalFindings} critical and ${context.summary.highFindings} high severity findings require immediate attention.`,
      technicalFindings: 'See individual findings for technical details.',
      businessImpact: 'High - potential data exposure and compliance violations.',
      attackPossibility: 'High - multiple privilege escalation and network exposure vectors identified.',
      riskScore: Math.min(100, context.summary.criticalFindings * 95 + context.summary.highFindings * 75 + 25),
      confidenceScore: 85,
      remediationPlan: 'Review all critical findings and apply remediation recommendations.',
      priorityFixes: findings.slice(0, 5).map((f, i) => ({ priority: i === 0 ? 'P0' : i <= 2 ? 'P1' : 'P2', finding: f.title, estimatedTime: '1-4 hours' })),
      costImpact: 'Medium - remediation requires engineering time but no significant infrastructure costs.',
      complianceImpact: 'Multiple compliance frameworks may be violated due to identified gaps.',
    },
  };
};

export default { generateCloudExecutiveSummary, generateCloudTechnicalFindings, generateCloudRemediationPlan, generateCloudRiskScore, generateBusinessImpact, generateAttackPossibility, generateComplianceImpact, generateFullCloudAnalysis };
