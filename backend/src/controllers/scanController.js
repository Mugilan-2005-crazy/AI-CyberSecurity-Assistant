/**
 * controllers/scanController.js
 * ------------------------------------------------------------
 * Handles all scanning modules (URL, password, email, file, QR),
 * records each scan to ScanHistory, and exposes the dashboard
 * aggregation + PDF report generation.
 */
import ScanHistory from '../models/ScanHistory.js';
import Report from '../models/Report.js';
import ApiError from '../utils/ApiError.js';
import { scanUrl } from '../services/security/urlScanner.js';
import { analyzePassword } from '../services/security/passwordAnalyzer.js';
import { analyzeEmail, explainEmailThreat } from '../services/security/emailPhishing.js';
import { scanFile } from '../services/security/fileScanner.js';
import { checkQr } from '../services/security/qrChecker.js';
import { decodeQr } from '../services/security/qrDecoder.js';
import { recordScan } from '../services/scanService.js';
import { buildReport } from '../services/security/reportGenerator.js';
import { recordActivity } from '../services/ueba/behaviorService.js';
import logger from '../utils/logger.js';

// Redact long targets so we never store full sensitive payloads.
const redact = (s) => (s && s.length > 60 ? s.slice(0, 60) + '…' : s);

/**
 * POST /api/scan/url  — Module 1 entry point.
 * Validates the request, runs the URL scanner, persists history
 * (gracefully), and returns the detailed JSON result.
 */
export const scanUrlRoute = async (req, res, next) => {
  try {
    const rawUrl = req.body?.url;

    // Input guard: reject obviously missing/invalid input early.
    if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
      throw new ApiError(400, 'A valid "url" field is required');
    }

    // Pure, synchronous analysis (no external I/O).
    const result = scanUrl(rawUrl);

    // Persist history; tolerates a downed MongoDB (returns null).
    const scan = await recordScan(req.user.id, 'url', redact(rawUrl), result, req.ip);

    // Always return the analysis; scanId is null when DB is offline.
    res.json({
      success: true,
      result,
      persisted: Boolean(scan),
      scanId: scan?._id ?? null,
    });
  } catch (err) {
    // Hand off to the global error handler (validation / unexpected).
    next(err);
  }
};

/**
 * POST /api/scan/password  — Module 2 entry point.
 * Validates input, analyzes the password, persists a history
 * record (gracefully), and returns detailed JSON. The plaintext
 * password is never persisted or echoed back to the client.
 */
export const scanPasswordRoute = async (req, res, next) => {
  try {
    const password = req.body?.password;

    // Input guard: must be a non-empty string.
    if (typeof password !== 'string' || password === '') {
      throw new ApiError(400, 'A non-empty "password" field is required');
    }

    // Pure, synchronous analysis (no external I/O).
    const result = analyzePassword(password);

    // Persist history; tolerates a downed MongoDB (returns null).
    // NOTE: we intentionally pass '' as input — never store the plaintext.
    const scan = await recordScan(req.user.id, 'password', '', result, req.ip);

    // Always return the analysis; scanId is null when DB is offline.
    res.json({
      success: true,
      result,
      persisted: Boolean(scan),
      scanId: scan?._id ?? null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/scan/email  — Module 3 entry point.
 * Accepts { subject, body, sender?, attachments? }. When ?ai=true
 * and Gemini is configured, returns an AI explanation; otherwise
 * returns the standard heuristic analysis. Never crashes if the
 * AI is unavailable (graceful degradation handled in the service).
 */
export const scanEmailRoute = async (req, res, next) => {
  try {
     const { subject, body, sender, attachments } = req.body || {};

    // Input guard: body is required and must be a non-empty string.
    if (typeof body !== 'string' || body.trim() === '') {
      throw new ApiError(400, 'A non-empty "body" field is required');
    }

    const input = {
      subject: typeof subject === 'string' ? subject : '',
      body,
      sender: typeof sender === 'string' ? sender : '',
      attachments: Array.isArray(attachments) ? attachments : [],
    };

    // AI is opt-in via query param; service degrades gracefully.
    const useAi = req.query.ai === 'true';
    const result = useAi ? await explainEmailThreat(input) : analyzeEmail(input);

    // Persist history; tolerates a downed MongoDB (returns null).
    const scan = await recordScan(req.user.id, 'email', redact(sender || ''), result, req.ip);

    // Always return the analysis; scanId is null when DB is offline.
    res.json({
      success: true,
      result,
      persisted: Boolean(scan),
      scanId: scan?._id ?? null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/scan/file  — Module 4 entry point.
 * `uploadSingle` (multer) already enforces size + extension rules.
 * We hash + scan via VirusTotal, persist history gracefully, and
 * return the detailed result (including "not configured" state).
 */
export const scanFileRoute = async (req, res, next) => {
  try {
    // Input validation: multer placed the file on req.file.
    if (!req.file || !Buffer.isBuffer(req.file.buffer)) {
      throw new ApiError(400, 'No file uploaded');
    }

    // Delegate to the service (handles VT + graceful degradation).
    const result = await scanFile(req.file.buffer);

    // Persist history; tolerates a downed MongoDB (returns null).
    // Only store history when the scanner is configured/meaningful.
    const scan = await recordScan(req.user.id, 'file', redact(req.file.originalname), result, req.ip);

    // Always return the analysis; scanId is null when DB is offline.
    res.json({
      success: true,
      result,
      persisted: Boolean(scan),
      scanId: scan?._id ?? null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/scan/qr  — Module 6 entry point.
 * Accepts an uploaded QR image (png/jpg) via `uploadQr`, decodes
 * it server-side, then analyzes the content. Backward compatible:
 * if a pre-decoded `text` body is supplied, it analyzes that.
 * Never crashes on decode failure; history is persisted gracefully.
 */
export const scanQrRoute = async (req, res, next) => {
  try {
    // Determine the decoded text: from uploaded image or raw body.
    let decodedText = '';
    if (req.file && Buffer.isBuffer(req.file.buffer)) {
      const decoded = decodeQr(req.file.buffer, req.file.mimetype);
      if (!decoded.decoded) {
        // Graceful: return a clear, non-crashing result.
        const result = { decoded: false, riskScore: 100, verdict: 'malicious', reason: decoded.error || 'Unable to read QR code.' };
        const scan = await recordScan(req.user.id, 'qr', redact(req.file.originalname), result, req.ip);
        return res.json({ success: true, result, persisted: Boolean(scan), scanId: scan?._id ?? null });
      }
      decodedText = decoded.text;
    } else if (typeof req.body?.text === 'string' && req.body.text.trim()) {
      // Frontend already decoded (jsQR) and posted the text.
      decodedText = req.body.text;
    } else {
      throw new ApiError(400, 'Provide a QR image file or a decoded "text" field');
    }

    // Analyze the decoded content (reuses URL Scanner for URLs).
    const result = checkQr(decodedText);

    // Persist history; tolerates a downed MongoDB (returns null).
    const scan = await recordScan(req.user.id, 'qr', redact(result.content || ''), result, req.ip);

    // Always return the analysis; scanId is null when DB is offline.
    res.json({
      success: true,
      result,
      persisted: Boolean(scan),
      scanId: scan?._id ?? null,
    });
  } catch (err) {
    next(err);
  }
};

// -------------------- Dashboard + Reports --------------------

export const dashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [totalScans, byType, recent, threats] = await Promise.all([
      ScanHistory.countDocuments({ user: userId }),
      ScanHistory.aggregate([{ $match: { user: userId } }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
      ScanHistory.find({ user: userId }).sort({ createdAt: -1 }).limit(8),
      ScanHistory.aggregate([
        { $match: { user: userId, verdict: { $in: ['malicious', 'suspicious'] } } },
        { $group: { _id: null, count: { $sum: 1 }, avg: { $avg: '$riskScore' } } },
      ]),
    ]);

    const tips = [
      'Use a password manager to generate unique 16+ char passwords.',
      'Enable multi-factor authentication on critical accounts.',
      'Hover over links before clicking to verify the real destination.',
      'Keep your OS and browser updated to patch known vulnerabilities.',
      'Never reuse passwords across multiple services.',
    ];

    res.json({
      success: true,
      data: {
        totalScans,
        typeBreakdown: byType,
        recentActivity: recent,
        threatsDetected: threats[0]?.count || 0,
        avgThreatScore: Math.round(threats[0]?.avg || 0),
        threatScore: Math.min(100, (threats[0]?.count || 0) * 5),
        securityTips: tips,
      },
    });
  } catch (err) { next(err); }
};

/**
 * POST /api/scan/report  — Module 7 entry point (PDF export).
 * Aggregates the user's scan history via the report generator
 * service, optionally persists a Report record (graceful), and
 * streams a downloadable PDF. Works in-memory if Mongo is down.
 */
export const generateReport = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { from, to } = req.body || {};

    // 1. Build the date-range filter for ScanHistory.
    const match = { user: userId };
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }

    // 2. Fetch scans (graceful: empty array if query throws).
    let scans = [];
    try {
      scans = await ScanHistory.find(match).sort({ createdAt: -1 });
    } catch (err) {
      logger.warn(`Report scan fetch failed (${err.message}) — generating in-memory report.`);
    }

    // 3. Build the structured report via the service layer.
    const reportData = buildReport(scans);

    // 4. Persist a Report record (optional; never blocks the PDF).
    let report = null;
    try {
      report = await Report.create({
        user: userId,
        title: `Security Report ${new Date().toISOString().slice(0, 10)}`,
        period: { from: from ? new Date(from) : null, to: to ? new Date(to) : null },
        summary: {
          totalScans: reportData.totalScans,
          avgRiskScore: 100 - reportData.securityScore,
          threatsDetected: reportData.threatsDetected,
        },
        moduleBreakdown: Object.fromEntries(reportData.modules.map((m) => [m.type, { count: m.scans, avg: m.avgThreatScore }])),
      });
    } catch (err) {
      logger.warn(`Report record save failed (${err.message}) — continuing without persistence.`);
    }

    // 5. Stream the PDF using the existing PDFKit service.
    recordActivity(userId, {
      type: 'report_generation',
      action: 'Security report generated',
      ip: req.ip || '',
      metadata: { period: { from, to }, totalScans: scans.length },
    }).catch((err) => logger.warn('[ueba] Report activity recording failed', { error: err.message }));

    const { buildPdfReport } = await import('../services/reportService.js');
    const doc = buildPdfReport({ report: report || { _id: 'preview', title: 'Security Report' }, scans, reportData });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="security-report-${report?._id || 'preview'}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/scan/reports  — List previous reports (Mongo-backed).
 * Returns an empty list (not an error) if Mongo is unavailable.
 */
export const listReports = async (req, res, next) => {
  try {
    let reports = [];
    try {
      reports = await Report.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50);
    } catch (err) {
      logger.warn(`Report list failed (${err.message}).`);
    }
    res.json({ success: true, reports });
  } catch (err) {
    next(err);
  }
};

export default {
  scanUrlRoute, scanPasswordRoute, scanEmailRoute, scanFileRoute, scanQrRoute,
  dashboard, generateReport, listReports,
};
