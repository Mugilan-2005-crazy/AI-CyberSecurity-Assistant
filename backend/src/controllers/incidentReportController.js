import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import {
  generateIncidentReport,
  getIncidentReports,
  getIncidentReportById,
  getSharedReport,
  shareIncidentReport,
  emailIncidentReport,
} from '../services/incidentReportService.js';

export const generateReport = async (req, res, next) => {
  try {
    const { incidentId } = req.params;
    const userId = req.user.id;

    const report = await generateIncidentReport(incidentId, userId);

    res.status(201).json({
      success: true,
      data: report,
    });
  } catch (err) {
    logger.error('[incidentReportController] Generate failed', { error: err.message });
    next(err);
  }
};

export const listReports = async (req, res, next) => {
  try {
    const { incidentId, severity, status, page = 1, limit = 20 } = req.query;
    const userId = req.user.id;

    const reports = await getIncidentReports(userId, {
      incidentId,
      severity,
      status,
      page: Number(page),
      limit: Number(limit),
    });

    res.json({
      success: true,
      reports,
      page: Number(page),
      total: reports.length,
    });
  } catch (err) {
    logger.error('[incidentReportController] List failed', { error: err.message });
    next(err);
  }
};

export const getReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const report = await getIncidentReportById(id, userId);
    if (!report) {
      throw new ApiError(404, 'Report not found');
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (err) {
    logger.error('[incidentReportController] Get failed', { error: err.message });
    next(err);
  }
};

export const shareReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { expiresInHours = 72 } = req.body;
    const userId = req.user.id;

    const result = await shareIncidentReport(id, userId, expiresInHours);

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    logger.error('[incidentReportController] Share failed', { error: err.message });
    next(err);
  }
};

export const getSharedReportByToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    const report = await getSharedReport(token);

    if (!report) {
      throw new ApiError(404, 'Shared report not found or expired');
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (err) {
    logger.error('[incidentReportController] Shared report fetch failed', { error: err.message });
    next(err);
  }
};

export const emailReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    const userId = req.user.id;

    if (!email) {
      throw new ApiError(400, 'Recipient email is required');
    }

    const result = await emailIncidentReport(id, userId, email);

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    logger.error('[incidentReportController] Email failed', { error: err.message });
    next(err);
  }
};

export const exportReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { format = 'pdf' } = req.query;
    const userId = req.user.id;

    const report = await getIncidentReportById(id, userId);
    if (!report) {
      throw new ApiError(404, 'Report not found');
    }

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=incident-report-${report.incidentId}.pdf`);
      res.json({
        success: true,
        format: 'pdf',
        data: report,
        message: 'PDF generation should be handled client-side with jsPDF',
      });
    } else if (format === 'docx') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=incident-report-${report.incidentId}.docx`);
      res.json({
        success: true,
        format: 'docx',
        data: report,
        message: 'DOCX generation should be handled client-side with docx library',
      });
    } else if (format === 'markdown') {
      const markdown = generateMarkdown(report);
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename=incident-report-${report.incidentId}.md`);
      res.send(markdown);
    } else {
      throw new ApiError(400, 'Unsupported format. Use pdf, docx, or markdown');
    }
  } catch (err) {
    logger.error('[incidentReportController] Export failed', { error: err.message });
    next(err);
  }
};

function generateMarkdown(report) {
  const lines = [
    '# AI Incident Report',
    '',
    `**Incident ID:** ${report.incidentId}`,
    `**Severity:** ${report.severity}`,
    `**Status:** ${report.status}`,
    `**Generated:** ${new Date(report.createdAt).toLocaleString()}`,
    `**AI Provider:** ${report.aiProvider}`,
    '',
    '---',
    '',
    '## Executive Summary',
    '',
    report.executiveSummary || 'No executive summary available.',
    '',
    '## Business Impact',
    '',
    report.businessImpact || 'No business impact assessment available.',
    '',
    '## Risk Assessment',
    '',
    `Severity: ${report.severity}`,
    '',
    '## Priority Actions',
    '',
    ...(report.priorityActions || []).map((a) => `- ${a}`),
    '',
    '## Recovery Recommendation',
    '',
    report.recoveryRecommendation || 'No recovery recommendations available.',
    '',
    '---',
    '',
    '## Technical Summary',
    '',
    report.technicalSummary || 'No technical summary available.',
    '',
    '## Attack Vector',
    '',
    report.attackVector || 'No attack vector identified.',
    '',
    '## Root Cause',
    '',
    report.rootCause || 'No root cause identified.',
    '',
    '## Indicators of Compromise',
    '',
    ...(report.indicatorsOfCompromise || []).map((i) => `- ${i}`),
    '',
    '## MITRE ATT&CK Mapping',
    '',
    ...(report.mitreMapping || []).map(
      (m) => `- **${m.techniqueId}** ${m.techniqueName} (${m.tactic})`
    ),
    '',
    '## CVSS Score',
    '',
    report.cvss?.score != null ? `${report.cvss.score} (${report.cvss.version})` : 'Not scored',
    '',
    '## Vulnerabilities',
    '',
    ...(report.vulnerabilities || []).map((v) => `- ${v}`),
    '',
    '## Timeline',
    '',
    ...(report.timeline || [])
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map(
        (t) =>
          `- **${new Date(t.timestamp).toLocaleString()}** [${t.source}] ${t.event}: ${t.description}`
      ),
    '',
    '## Evidence',
    '',
    ...(report.evidence || []).map(
      (e) => `- [${e.type}] ${e.description}`
    ),
    '',
    '## Remediation Steps',
    '',
    ...(report.recommendations || []).map((r) => `- ${r}`),
  ];

  return lines.join('\n');
}

export default {
  generateReport,
  listReports,
  getReport,
  shareReport,
  getSharedReportByToken,
  emailReport,
  exportReport,
};
