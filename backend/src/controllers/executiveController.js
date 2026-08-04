/**
 * controllers/executiveController.js
 * ============================================================
 * PHASE 4 — Executive Security Command Center controller.
 * Exposes admin/security-manager aggregation endpoints under /api/executive.
 *
 * RBAC: admin + security_manager only (enforced in routes).
 * Endpoints:
 *   GET  /api/executive/summary?period=day|week|month|quarter
 *   GET  /api/executive/ai-summary?period=...
 *   GET  /api/executive/report?period=...&format=pdf|csv|excel|print
 *   GET  /api/executive/metrics  (performance instrumentation)
 */
import { getExecutiveSummary, getPerfMetrics, recordApiTime } from '../services/executive/executiveAnalytics.js';
import { audit, AUDIT_ACTIONS } from '../services/executive/auditLog.js';
import { routeAI } from '../services/ai/aiRouter.js';
import { getCloudSecurityMetrics } from '../services/cloud/cloudScanner.js';
import { getContainerSecurityMetrics } from '../services/cloud/containerScanner.js';
import { getKubernetesMetrics } from '../services/cloud/kubernetesScanner.js';
import { generateCloudRiskScore } from '../services/cloud/aiCloudAnalysis.js';
import { calculateSystemHealthScore } from '../routes/observabilityRoutes.js';
import logger from '../utils/logger.js';

const VALID_PERIODS = ['day', 'week', 'month', 'quarter'];

const normalizePeriod = (p) => (VALID_PERIODS.includes(p) ? p : 'month');

const buildNarrative = (summary) => {
  const score = summary.securityScore;
  const kpis = summary.kpis;
  const topCategories = summary.threatCategories.slice(0, 3);
  return {
    executiveSummary: `The organization's security posture is rated ${score.grade} (${score.score}/100). ` +
      `Active threats: ${kpis.threatsDetected}, open incidents: ${kpis.openIncidents}, ` +
      `critical alerts: ${kpis.criticalAlerts}.`,
    businessRisks: [
      `Critical alerts (${kpis.criticalAlerts}) require immediate executive attention.`,
      `Open incidents (${kpis.openIncidents}) indicate ongoing exposure.`,
      `Threat detection rate of ${kpis.threatsDetected} reflects active campaign pressure.`,
    ],
    topPriorities: topCategories.map((c) => `${c.category} (${c.count} detections)`),
    recommendedActions: [
      'Prioritize critical incidents and reduce mean time to respond.',
      'Increase coverage across the highest-risk threat categories.',
      'Strengthen compliance controls flagged as missing.',
    ],
    forecast: `At current activity levels, threat volume is expected to ${kpis.threatsDetected > 0 ? 'remain elevated' : 'stay stable'} over the next ${summary.period === 'quarter' ? '90' : '30'} days.`,
    generatedAt: summary.generatedAt,
  };
};

/**
 * GET /api/executive/summary
 * Aggregates the full executive dashboard. 60s cache + instrumentation.
 */
export const getSummary = async (req, res, next) => {
  const start = Date.now();
  try {
    const period = normalizePeriod(req.query.period);
    const data = await getExecutiveSummary(period);
    const apiMs = Date.now() - start;
    recordApiTime(apiMs);
    logger.info('[executive] summary', { apiMs, cache: data._cache, period, userId: req.user.id });
    res.json({
      success: true,
      data,
      meta: {
        cache: data._cache,
        apiMs,
        aggregationMs: getPerfMetrics().lastAggregationMs,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/executive/ai-summary
 * Generates the Executive AI Narrative using the existing routeAI() service.
 * Audit-logged. Never duplicates AI prompting logic.
 */
export const getAiSummary = async (req, res, next) => {
  try {
    const period = normalizePeriod(req.query.period);
    const summary = await getExecutiveSummary(period);
    const narrative = buildNarrative(summary);

    // Reuse existing routeAI() — no duplicate AI prompting logic.
    let ai = null;
    try {
      const prompt =
        `You are a Fortune 500 Chief Security Officer advisor. Given the following security posture, ` +
        `produce a concise executive brief with: Executive Summary, Business Risks, Top Priorities, ` +
        `Recommended Actions, and a Forward Forecast. ` +
        `Score: ${summary.securityScore.score}/100 (grade ${summary.securityScore.grade}). ` +
        `Open incidents: ${summary.kpis.openIncidents}. Critical alerts: ${summary.kpis.criticalAlerts}. ` +
        `Threats detected: ${summary.kpis.threatsDetected}. ` +
        `Top categories: ${summary.threatCategories.map((c) => c.category).join(', ') || 'none'}.`;
      const result = await routeAI(prompt, [], 'en', req.user.id);
      ai = { provider: result.provider, response: result.response };
    } catch (err) {
      logger.warn('[executive] AI summary fallback to local narrative', { error: err.message });
      ai = { provider: 'local', response: narrative.executiveSummary };
    }

    audit({
      action: AUDIT_ACTIONS.AI_SUMMARY,
      userId: req.user.id,
      email: req.user.email,
      period,
      details: { aiProvider: ai?.provider },
    });

    res.json({ success: true, data: { ...narrative, ai, period, generatedAt: summary.generatedAt } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/executive/report
 * Server-side export. Audit-logged. Returns the aggregated data for the
 * frontend to render PDF/Excel/CSV/Print with the required metadata.
 * When an explicit export format is requested (pdf/csv/excel/print),
 * records an EXPORT audit action in addition to generation.
 */
export const getReport = async (req, res, next) => {
  const start = Date.now();
  try {
    const period = normalizePeriod(req.query.period);
    const format = req.query.format || 'pdf';
    const summary = await getExecutiveSummary(period);
    const narrative = buildNarrative(summary);

    audit({
      action: AUDIT_ACTIONS.REPORT_GENERATED,
      userId: req.user.id,
      email: req.user.email,
      period,
      format,
      details: { score: summary.securityScore.score },
    });

    if (['pdf', 'csv', 'excel', 'print'].includes(format)) {
      audit({
        action: AUDIT_ACTIONS.EXPORT,
        userId: req.user.id,
        email: req.user.email,
        period,
        format,
        details: { score: summary.securityScore.score },
      });
    }

    const responseMs = Date.now() - start;
    logger.info('[executive] report/export', { format, period, apiMs: responseMs, userId: req.user.id });

    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        period,
        format,
        organizationScore: summary.securityScore.score,
        grade: summary.securityScore.grade,
        executiveSummary: narrative.executiveSummary,
        businessRisks: narrative.businessRisks,
        topPriorities: narrative.topPriorities,
        recommendedActions: narrative.recommendedActions,
        forecast: narrative.forecast,
        kpis: summary.kpis,
        riskTrends: summary.riskTrends,
        threatCategories: summary.threatCategories,
        countryThreats: summary.countryThreats,
        attackTrends: summary.attackTrends,
        compliance: summary.compliance,
        businessMetrics: summary.businessMetrics,
        meta: {
          generatedBy: 'Executive Security Command Center',
          role: req.user.role,
          user: req.user.email,
          cache: summary._cache,
          apiMs: responseMs,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/executive/metrics
 * Performance instrumentation: aggregation time, API time, cache hit/miss.
 */
export const getPerformanceMetrics = async (_req, res, next) => {
  try {
    res.json({ success: true, data: getPerfMetrics() });
  } catch (err) {
    next(err);
  }
};

export const getCloudDashboard = async (_req, res, next) => {
  try {
    const start = Date.now();
    const [cloudMetrics, containerMetrics, k8sMetrics, cloudRiskScore] = await Promise.all([
      getCloudSecurityMetrics().catch(() => null),
      getContainerSecurityMetrics().catch(() => null),
      getKubernetesMetrics().catch(() => null),
      generateCloudRiskScore().catch(() => null),
    ]);

    const cloudScore = cloudRiskScore?.score || 0;
    const containerScore = containerMetrics ? Math.min(100, 100 - (containerMetrics.highRiskImages / Math.max(1, containerMetrics.totalImages)) * 100) : 0;
    const k8sScore = k8sMetrics ? Math.min(100, 100 - (k8sMetrics.highRiskResources / Math.max(1, k8sMetrics.totalResources || 1)) * 100) : 0;

    const overallScore = cloudScore > 0 ? cloudScore : Math.round((containerScore + k8sScore) / 2);

    const apiMs = Date.now() - start;
    audit({
      action: 'cloud_dashboard',
      userId: _req.user.id,
      email: _req.user.email,
      details: { apiMs },
    });

    res.json({
      success: true,
      data: {
        cloudSecurityScore: cloudScore,
        containerHealthScore: Math.round(containerScore),
        kubernetesHealthScore: Math.round(k8sScore),
        overallScore,
        providerMetrics: cloudMetrics?.providerMetrics || {},
        providers: cloudMetrics?.providers || [],
        containerMetrics: containerMetrics || {},
        kubernetesMetrics: k8sMetrics || {},
        riskScore: cloudRiskScore || {},
        topMisconfigurations: (cloudMetrics?.providers || [])
          .flatMap((p) => {
            const provKey = Object.keys(cloudMetrics?.categoryDistribution || {})[0];
            return provKey ? [{ provider: p.name, category: provKey, count: cloudMetrics?.categoryDistribution[provKey] || 0 }] : [];
          })
          .slice(0, 10),
        compliance: {
          overall: cloudMetrics?.complianceScore || 100,
          providers: {},
        },
        generatedAt: new Date().toISOString(),
        apiMs,
      },
    });
  } catch (err) {
    logger.error('[executive] Cloud dashboard failed', { error: err.message });
    next(err);
  }
};

export const getExecutiveDashboard = async (_req, res, next) => {
  try {
    const snapshot = await getExecutiveSummary('month');
    const health = { status: 'healthy', checks: {}, summary: { total: 0, healthy: 0, unhealthy: 0 } };
    const activeAlerts = [];

    res.json({
      success: true,
      data: {
        systemHealthScore: calculateSystemHealthScore(snapshot, health, activeAlerts),
        infrastructureHealth: { cpu: 0, memory: 0, disk: 0, overall: 100 },
        performanceScore: 100,
        availability: { percentage: 100, uptime: 0, totalChecks: 0, unhealthyChecks: 0 },
        errorRate: 0,
        latencyTrends: { p50: 0, p95: 0, p99: 0, avg: 0 },
        serviceStatus: {
          backend: 'healthy',
          frontend: 'healthy',
          mongodb: 'healthy',
          socket: 'healthy',
          gemini: 'healthy',
          ollama: 'healthy',
          threatIntel: 'healthy',
          cloudProviders: 'healthy',
          docker: 'healthy',
          kubernetes: 'healthy',
        },
        cloudHealth: { score: 100, providers: 0, resources: 0 },
        containerHealth: { score: 100, images: 0, vulnerabilities: 0 },
        aiHealth: { score: 100, requests: 0, errors: 0, latency: 0 },
        liveMetrics: snapshot,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

export default { getSummary, getAiSummary, getReport, getPerformanceMetrics, getCloudDashboard, getExecutiveDashboard };