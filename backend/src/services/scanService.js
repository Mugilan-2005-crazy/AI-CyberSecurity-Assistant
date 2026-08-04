/**
 * services/scanService.js
 * ============================================================
 * MODULE 1 (support) — Scan history persistence.
 * ------------------------------------------------------------
 * Records a scan into the ScanHistory collection. If MongoDB is
 * unavailable, it logs a warning and returns null instead of
 * throwing, so the scan API still returns its result to the user.
 */

import ScanHistory from '../models/ScanHistory.js';
import Notification from '../models/Notification.js';
import AIAnalysis from '../models/AIAnalysis.js';
import logger from '../utils/logger.js';
import { emitScanStarted, emitScanCompleted, createNotification } from '../socket/realtimeNotificationService.js';
import { recordActivity } from './ueba/behaviorService.js';

let aiAnalysisEnabled = true;

export const recordScan = async (userId, type, input, result, ip) => {
  const riskScore = result.riskScore ?? 0;
  const verdict = result.verdict ?? 'unknown';

  emitScanStarted(userId, null, type, input).catch((err) => {
    logger.warn(`[scanService] Failed to emit scan.started: ${err.message}`);
  });

  try {
    const scan = await ScanHistory.create({ user: userId, type, input, riskScore, verdict, details: result, ip });

    if (verdict === 'malicious' || verdict === 'suspicious') {
      await createNotification(userId, {
        title: 'Threat detected',
        message: `Your ${type} scan flagged a ${verdict} result (risk ${riskScore}/100).`,
        type: verdict === 'malicious' ? 'danger' : 'warning',
        category: 'scan_complete',
        severity: verdict === 'malicious' ? 'high' : 'medium',
        metadata: { scanId: scan._id, scanType: type, riskScore },
      });
    }

    recordActivity(userId, {
      type: 'scan',
      action: `Scan: ${type}`,
      ip,
      riskScore,
      metadata: { scanId: scan._id, scanType: type, verdict, input },
    }).catch((err) => logger.warn('[ueba] Scan activity recording failed', { error: err.message }));

    emitScanCompleted(userId, scan._id ?? null, result).catch((err) => {
      logger.warn(`[scanService] Failed to emit scan.completed: ${err.message}`);
    });

    if (aiAnalysisEnabled && (verdict === 'malicious' || verdict === 'suspicious')) {
      triggerAIAnalysis(scan._id, type, input, userId).catch((err) => {
        logger.warn(`[scanService] Auto AI analysis failed for scan ${scan._id}: ${err.message}`);
      });
    }

    return scan;
  } catch (err) {
    logger.warn(`Scan history unavailable (${err.message}) — continuing without persistence.`);
    emitScanCompleted(userId, null, result).catch(() => {});
    return null;
  }
};

async function triggerAIAnalysis(scanId, type, input, userId) {
  try {
    const existing = await AIAnalysis.findOne({ scanId, user: userId });
    if (existing) return;

    const doc = await AIAnalysis.create({
      user: userId,
      scanId,
      scanType: type,
      scanInput: input,
      threatScore: 0,
      riskLevel: 'Low',
      confidenceScore: 0,
      executiveSummary: 'AI analysis is being processed...',
      technicalSummary: '',
      rootCause: '',
      businessImpact: '',
      recommendedActions: [],
      mitreTechniques: [],
      cvssScore: null,
      cvssVector: '',
      cvssVersion: '3.1',
      aiProvider: 'pending',
      aiProvidersUsed: [],
      geminiContribution: '',
      ollamaContribution: '',
      status: 'pending',
      metadata: { autoTriggered: true },
    });

    const { analyzeScan } = await import('./ai/socAnalyzer.js');
    await analyzeScan(scanId, userId);
  } catch (err) {
    logger.error(`[scanService] Auto AI analysis error: ${err.message}`);
  }
}

export default { recordScan };
