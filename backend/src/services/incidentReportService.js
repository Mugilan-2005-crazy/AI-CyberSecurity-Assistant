import mongoose from 'mongoose';
import SecurityIncident from '../models/SecurityIncident.js';
import IncidentResponse from '../models/IncidentResponse.js';
import SecurityAlert from '../models/SecurityAlert.js';
import AIAnalysis from '../models/AIAnalysis.js';
import ThreatIntel from '../models/ThreatIntel.js';
import ScanHistory from '../models/ScanHistory.js';
import IncidentReport from '../models/IncidentReport.js';
import { routeAI } from './ai/aiRouter.js';
import { dispatchToUser, dispatchToOrg } from '../socket/eventDispatcher.js';
import { EVENTS } from '../socket/socketEvents.js';
import logger from '../utils/logger.js';

const ObjectId = mongoose.Types.ObjectId;

function buildTimeline(incident, responses, alerts, scans, threatIntels, aiAnalyses) {
  const events = [];

  if (incident.createdAt) {
    events.push({
      timestamp: incident.createdAt,
      event: 'Incident Created',
      source: 'SecurityIncident',
      description: `Threat type: ${incident.threatType}, Severity: ${incident.severity}`,
    });
  }

  if (incident.resolvedAt) {
    events.push({
      timestamp: incident.resolvedAt,
      event: 'Incident Resolved',
      source: 'SecurityIncident',
      description: `Status changed to ${incident.status}`,
    });
  }

  (responses || []).forEach((r) => {
    if (r.createdAt) {
      events.push({
        timestamp: r.createdAt,
        event: 'AI Investigation Started',
        source: 'IncidentResponse',
        description: `AI provider: ${r.aiProvider || 'none'}, Priority: ${r.priority}`,
      });
    }
    if (r.executedAt) {
      events.push({
        timestamp: r.executedAt,
        event: 'Response Executed',
        source: 'IncidentResponse',
        description: `Status: ${r.status}`,
      });
    }
  });

  (alerts || []).forEach((a) => {
    events.push({
      timestamp: a.createdAt,
      event: `Alert: ${a.alertType}`,
      source: 'SecurityAlert',
      description: `${a.title} — ${a.severity}`,
    });
  });

  (scans || []).forEach((s) => {
    events.push({
      timestamp: s.createdAt,
      event: `Scan: ${s.type}`,
      source: 'ScanHistory',
      description: `Risk score: ${s.riskScore}, Verdict: ${s.verdict}`,
    });
  });

  (threatIntels || []).forEach((t) => {
    events.push({
      timestamp: t.createdAt,
      event: `Threat Intel: ${t.iocType}`,
      source: 'ThreatIntel',
      description: `Classification: ${t.classification}, Reputation: ${t.reputationScore}`,
    });
  });

  (aiAnalyses || []).forEach((a) => {
    events.push({
      timestamp: a.createdAt,
      event: 'AI Analysis',
      source: 'AIAnalysis',
      description: `Risk level: ${a.riskLevel}, Confidence: ${a.confidenceScore}`,
    });
  });

  return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function buildEvidence(alerts, scans, threatIntels, aiAnalyses) {
  const evidence = [];

  (alerts || []).forEach((a) => {
    evidence.push({
      type: 'alert',
      sourceId: a._id,
      description: `${a.title}: ${a.message}`,
      timestamp: a.createdAt,
    });
  });

  (scans || []).forEach((s) => {
    evidence.push({
      type: 'scan',
      sourceId: s._id,
      description: `${s.type} scan of ${s.input} — ${s.verdict} (risk: ${s.riskScore})`,
      timestamp: s.createdAt,
    });
  });

  (threatIntels || []).forEach((t) => {
    evidence.push({
      type: 'threat_intel',
      sourceId: t._id,
      description: `${t.iocType} ${t.ioc} classified as ${t.classification}`,
      timestamp: t.createdAt,
    });
  });

  (aiAnalyses || []).forEach((a) => {
    evidence.push({
      type: 'ai_analysis',
      sourceId: a._id,
      description: `AI analysis: ${a.riskLevel} risk, confidence ${a.confidenceScore}`,
      timestamp: a.createdAt,
    });
  });

  return evidence;
}

function buildExecutivePrompt(data) {
  return `You are a cybersecurity executive report generator. Generate a professional executive security incident report.

INCIDENT DETAILS:
- Incident ID: ${data.incidentId}
- Threat Type: ${data.threatType}
- Severity: ${data.severity}
- Status: ${data.status}
- Description: ${data.description || 'No description'}
- MITRE Technique: ${data.mitreTechnique?.techniqueId || 'N/A'} - ${data.mitreTechnique?.techniqueName || 'N/A'}
- CVSS Score: ${data.cvssScore ?? 'N/A'}
- Created: ${data.createdAt}

AI INVESTIGATION SUMMARY:
${data.investigationSummary || 'No investigation available'}

THREAT INTELLIGENCE:
${data.threatIntelSummary || 'No threat intel available'}

Generate the following sections in plain text:

EXECUTIVE SUMMARY:
[2-3 sentences summarizing the incident and its business impact]

BUSINESS IMPACT:
[Describe potential business impact, data exposure, operational disruption]

RISK ASSESSMENT:
[Assess the risk level considering severity, CVSS, and threat sophistication]

PRIORITY ACTIONS:
[List 3-5 immediate priority actions for executive leadership]

RECOVERY RECOMMENDATION:
[High-level recovery and resilience recommendations]

Format each section with a clear heading. Be concise and professional.`;
}

function buildTechnicalPrompt(data) {
  return `You are a cybersecurity technical report generator. Generate a detailed technical security incident report.

INCIDENT DETAILS:
- Incident ID: ${data.incidentId}
- Threat Type: ${data.threatType}
- Severity: ${data.severity}
- Status: ${data.status}
- Description: ${data.description || 'No description'}
- MITRE Technique: ${data.mitreTechnique?.techniqueId || 'N/A'} - ${data.mitreTechnique?.techniqueName || 'N/A'} (Tactic: ${data.mitreTechnique?.tactic || 'N/A'})
- CVSS Score: ${data.cvssScore ?? 'N/A'}
- Created: ${data.createdAt}

INDICATORS OF COMPROMISE:
${(data.indicators || []).join('\n') || 'None identified'}

TIMELINE:
${data.timeline.map((t) => `${t.timestamp} [${t.source}] ${t.event}: ${t.description}`).join('\n') || 'No timeline events'}

Generate the following sections in plain text:

ATTACK VECTOR:
[Describe how the attack was carried out]

ROOT CAUSE:
[Identify the root cause of the incident]

INDICATORS OF COMPROMISE:
[List IOCs: IPs, domains, hashes, file names]

MITRE ATT&CK MAPPING:
[Map to MITRE ATT&CK techniques and tactics]

VULNERABILITIES:
[List exploited or exposed vulnerabilities]

EVIDENCE:
[Summarize key evidence gathered]

REMEDIATION STEPS:
[Detailed technical remediation steps]

Format each section with a clear heading. Be technical and precise.`;
}

function parseExecutiveResponse(response) {
  const sections = {};
  const patterns = {
    executiveSummary: /EXECUTIVE SUMMARY:\s*([\s\S]*?)(?=\nBUSINESS IMPACT:)/i,
    businessImpact: /BUSINESS IMPACT:\s*([\s\S]*?)(?=\nRISK ASSESSMENT:)/i,
    riskAssessment: /RISK ASSESSMENT:\s*([\s\S]*?)(?=\nPRIORITY ACTIONS:)/i,
    priorityActions: /PRIORITY ACTIONS:\s*([\s\S]*?)(?=\nRECOVERY RECOMMENDATION:)/i,
    recoveryRecommendation: /RECOVERY RECOMMENDATION:\s*([\s\S]*?)$/i,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = response.match(pattern);
    sections[key] = match ? match[1].trim() : '';
  }

  const actionsMatch = response.match(/PRIORITY ACTIONS:\s*([\s\S]*?)(?=\nRECOVERY RECOMMENDATION:)/i);
  if (actionsMatch) {
    sections.priorityActions = actionsMatch[1]
      .split('\n')
      .filter((line) => line.trim().length > 2)
      .map((line) => line.replace(/^[-•*\d.)\s]+/, '').trim())
      .filter(Boolean);
  }

  return sections;
}

function parseTechnicalResponse(response) {
  const sections = {};
  const patterns = {
    attackVector: /ATTACK VECTOR:\s*([\s\S]*?)(?=\nROOT CAUSE:)/i,
    rootCause: /ROOT CAUSE:\s*([\s\S]*?)(?=\nINDICATORS OF COMPROMISE:)/i,
    indicatorsOfCompromise: /INDICATORS OF COMPROMISE:\s*([\s\S]*?)(?=\nMITRE ATT&CK MAPPING:)/i,
    mitreMapping: /MITRE ATT&CK MAPPING:\s*([\s\S]*?)(?=\nVULNERABILITIES:)/i,
    vulnerabilities: /VULNERABILITIES:\s*([\s\S]*?)(?=\nEVIDENCE:)/i,
    evidence: /EVIDENCE:\s*([\s\S]*?)(?=\nREMEDIATION STEPS:)/i,
    remediationSteps: /REMEDIATION STEPS:\s*([\s\S]*?)$/i,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = response.match(pattern);
    if (match) {
      const text = match[1].trim();
      if (key === 'indicatorsOfCompromise' || key === 'vulnerabilities') {
        sections[key] = text
          .split('\n')
          .map((line) => line.replace(/^[-•*\d.)\s]+/, '').trim())
          .filter((line) => line.length > 1);
      } else {
        sections[key] = text;
      }
    } else {
      sections[key] = key === 'indicatorsOfCompromise' || key === 'vulnerabilities' ? [] : '';
    }
  }

  return sections;
}

export async function generateIncidentReport(incidentId, userId) {
  try {
    const incident = await SecurityIncident.findById(incidentId).lean();
    if (!incident) {
      throw new Error('Incident not found');
    }

    if (incident.userId.toString() !== userId) {
      throw new Error('Not authorized to generate report for this incident');
    }

    const [responses, alerts, scans, threatIntels, aiAnalyses] = await Promise.all([
      IncidentResponse.find({ incidentId }).sort({ createdAt: 1 }).lean(),
      SecurityAlert.find({ relatedIncident: incidentId }).sort({ createdAt: 1 }).lean(),
      ScanHistory.find({ user: incident.userId }).sort({ createdAt: 1 }).limit(50).lean(),
      ThreatIntel.find({ user: incident.userId }).sort({ createdAt: 1 }).limit(20).lean(),
      AIAnalysis.find({ user: incident.userId }).sort({ createdAt: 1 }).limit(20).lean(),
    ]);

    const timeline = buildTimeline(incident, responses, alerts, scans, threatIntels, aiAnalyses);
    const evidence = buildEvidence(alerts, scans, threatIntels, aiAnalyses);

    const incidentData = {
      incidentId: incident._id.toString(),
      threatType: incident.threatType,
      severity: incident.severity,
      status: incident.status,
      description: incident.description,
      mitreTechnique: incident.mitreTechnique,
      createdAt: incident.createdAt,
      investigationSummary: responses[0]?.investigationSummary || '',
      threatIntelSummary: threatIntels.map((t) => `${t.iocType}: ${t.ioc} (${t.classification})`).join('\n') || 'None',
      indicators: threatIntels.map((t) => `${t.iocType}: ${t.ioc}`).filter(Boolean),
      cvssScore: incident.metadata?.cvssScore || null,
      timeline,
    };

    const [execResult, techResult] = await Promise.all([
      routeAI(buildExecutivePrompt(incidentData), [], 'en'),
      routeAI(buildTechnicalPrompt(incidentData), [], 'en'),
    ]);

    const executiveSections = parseExecutiveResponse(execResult.response);
    const technicalSections = parseTechnicalResponse(techResult.response);

    const report = new IncidentReport({
      incidentId: incident._id,
      createdBy: userId,
      severity: incident.severity,
      status: 'completed',
      executiveSummary: executiveSections.executiveSummary || 'Incident report generated.',
      technicalSummary: techResult.response,
      businessImpact: executiveSections.businessImpact || '',
      priorityActions: executiveSections.priorityActions || [],
      recoveryRecommendation: executiveSections.recoveryRecommendation || '',
      attackVector: technicalSections.attackVector || '',
      rootCause: technicalSections.rootCause || '',
      indicatorsOfCompromise: technicalSections.indicatorsOfCompromise || [],
      mitreMapping: incident.mitreTechnique
        ? [
            {
              techniqueId: incident.mitreTechnique.techniqueId || 'T0000',
              techniqueName: incident.mitreTechnique.techniqueName || 'Unknown',
              tactic: incident.mitreTechnique.tactic || 'Unknown',
              severity: incident.severity,
            },
          ]
        : [],
      cvss: {
        score: incidentData.cvssScore,
        vector: incident.metadata?.cvssVector || '',
        version: '3.1',
      },
      vulnerabilities: technicalSections.vulnerabilities || [],
      evidence,
      timeline,
      recommendations: executiveSections.priorityActions || [],
      aiProvider: [execResult.provider, techResult.provider].filter(Boolean).join(',') || 'none',
      aiProvidersUsed: [execResult.provider, techResult.provider].filter(Boolean),
      metadata: {
        incidentThreatType: incident.threatType,
        incidentStatus: incident.status,
      },
    });

    await report.save();

    const io = getIoInstance();
    if (io) {
      dispatchToUser(io, userId, EVENTS.INCIDENT_REPORT_CREATED, {
        reportId: report._id,
        incidentId: incident._id,
        severity: report.severity,
        aiProvider: report.aiProvider,
      });
      dispatchToUser(io, userId, EVENTS.INCIDENT_REPORT_COMPLETED, {
        reportId: report._id,
        incidentId: incident._id,
      });
    }

    logger.info('[incidentReportService] Report generated', { reportId: report._id, incidentId, userId });
    return report;
  } catch (err) {
    logger.error('[incidentReportService] Report generation failed', { error: err.message, incidentId });
    throw err;
  }
}

export async function getIncidentReports(userId, filters = {}) {
  try {
    const filter = { createdBy: userId };

    if (filters.incidentId) filter.incidentId = filters.incidentId;
    if (filters.severity) filter.severity = filters.severity;
    if (filters.status) filter.status = filters.status;

    const reports = await IncidentReport.find(filter)
      .sort({ createdAt: -1 })
      .limit(filters.limit || 50)
      .lean();

    return reports.map((r) => ({
      id: r._id,
      incidentId: r.incidentId,
      severity: r.severity,
      status: r.status,
      executiveSummary: r.executiveSummary,
      aiProvider: r.aiProvider,
      createdAt: r.createdAt,
    }));
  } catch (err) {
    logger.error('[incidentReportService] Failed to get reports', { error: err.message });
    return [];
  }
}

export async function getIncidentReportById(reportId, userId) {
  try {
    const report = await IncidentReport.findById(reportId).lean();
    if (!report) return null;

    if (report.createdBy.toString() !== userId) {
      return null;
    }

    return report;
  } catch (err) {
    logger.error('[incidentReportService] Failed to get report', { error: err.message });
    return null;
  }
}

export async function getSharedReport(token) {
  try {
    const report = await IncidentReport.findOne({ shareToken: token }).lean();
    if (!report || !report.shareExpiresAt || report.shareExpiresAt < new Date()) {
      return null;
    }
    return report;
  } catch (err) {
    logger.error('[incidentReportService] Failed to get shared report', { error: err.message });
    return null;
  }
}

export async function shareIncidentReport(reportId, userId, expiresInHours = 72) {
  try {
    const report = await IncidentReport.findById(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    if (report.createdBy.toString() !== userId) {
      throw new Error('Not authorized to share this report');
    }

    const crypto = await import('crypto');
    report.shareToken = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 15)}`;
    report.shareExpiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    await report.save();

    const io = getIoInstance();
    if (io) {
      dispatchToUser(io, userId, EVENTS.INCIDENT_REPORT_SHARED, {
        reportId: report._id,
        shareToken: report.shareToken,
        expiresAt: report.shareExpiresAt,
      });
    }

    logger.info('[incidentReportService] Report shared', { reportId, shareToken: report.shareToken });
    return { shareToken: report.shareToken, expiresAt: report.shareExpiresAt };
  } catch (err) {
    logger.error('[incidentReportService] Share failed', { error: err.message });
    throw err;
  }
}

export async function emailIncidentReport(reportId, userId, recipientEmail) {
  try {
    const report = await IncidentReport.findById(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    if (report.createdBy.toString() !== userId) {
      throw new Error('Not authorized to email this report');
    }

    const subject = `[${report.severity}] Incident Report - ${report.incidentId}`;
    const html = generateEmailHtml(report);

    const { sendEmail } = await import('../utils/email.js');
    await sendEmail({ to: recipientEmail, subject, html });

    if (!report.emailedTo) report.emailedTo = [];
    if (!report.emailedTo.includes(recipientEmail)) {
      report.emailedTo.push(recipientEmail);
      await report.save();
    }

    logger.info('[incidentReportService] Report emailed', { reportId, to: recipientEmail });
    return { success: true, sentTo: recipientEmail };
  } catch (err) {
    logger.error('[incidentReportService] Email failed', { error: err.message });
    throw err;
  }
}

function generateEmailHtml(report) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="background: #1e293b; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px;">AI Incident Report</h1>
        <p style="margin: 8px 0 0; opacity: 0.8;">Severity: ${report.severity} | Generated: ${new Date(report.createdAt).toLocaleString()}</p>
      </div>
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #1e293b; margin-top: 0;">Executive Summary</h2>
        <p style="color: #334155; line-height: 1.6;">${report.executiveSummary || 'No summary available.'}</p>
      </div>
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #1e293b; margin-top: 0;">Technical Summary</h2>
        <pre style="white-space: pre-wrap; color: #334155; line-height: 1.6; font-size: 14px;">${report.technicalSummary || 'No technical summary available.'}</pre>
      </div>
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px;">
        <h2 style="color: #1e293b; margin-top: 0;">Priority Actions</h2>
        <ul style="color: #334155; line-height: 1.6;">
          ${(report.priorityActions || []).map((a) => `<li>${a}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

let _ioInstance = null;
export function setIoInstance(io) {
  _ioInstance = io;
}

export function getIoInstance() {
  return _ioInstance;
}

export default {
  generateIncidentReport,
  getIncidentReports,
  getIncidentReportById,
  getSharedReport,
  shareIncidentReport,
  emailIncidentReport,
  setIoInstance,
  getIoInstance,
};
