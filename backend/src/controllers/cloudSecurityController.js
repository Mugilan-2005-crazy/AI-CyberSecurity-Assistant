import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { runCloudScan, getCloudFindings, getCloudSecurityMetrics, updateFindingStatus, addCloudProvider, getCloudProviders, removeCloudProvider } from '../services/cloud/cloudScanner.js';
import { generateCloudExecutiveSummary, generateCloudTechnicalFindings, generateCloudRemediationPlan, generateCloudRiskScore, generateBusinessImpact, generateAttackPossibility, generateComplianceImpact, generateFullCloudAnalysis } from '../services/cloud/aiCloudAnalysis.js';
import CloudProvider from '../models/CloudProvider.js';
import CloudFinding from '../models/CloudFinding.js';
import CloudResource from '../models/CloudResource.js';
import { getIoInstance } from '../socket/socketServer.js';

const emitSocketEvent = (event, data) => {
  try {
    const io = getIoInstance();
    if (io) {
      io.to('admin-room').emit(event, data);
    }
  } catch (err) {
    logger.warn('[cloudSecurityController] Socket emit failed', { error: err.message });
  }
};

const auditLog = async (action, details, userId) => {
  const { default: SecurityAuditLog } = await import('../models/SecurityAuditLog.js');
  try {
    await SecurityAuditLog.create({
      userId,
      action,
      resourceType: 'cloud',
      ...details,
      status: 'success',
    });
  } catch (err) {
    logger.warn('[cloudSecurityController] Audit log write failed', { error: err.message });
  }
};

export const getProviders = async (req, res, next) => {
  try {
    const providers = await getCloudProviders();
    res.json({ success: true, data: providers });
  } catch (err) {
    logger.error('[cloudSecurityController] getProviders failed', { error: err.message });
    next(err);
  }
};

export const addProvider = async (req, res, next) => {
  try {
    const provider = await addCloudProvider(req.body, req.user.id);
    res.status(201).json({ success: true, data: provider });
  } catch (err) {
    logger.error('[cloudSecurityController] addProvider failed', { error: err.message });
    next(err);
  }
};

export const removeProvider = async (req, res, next) => {
  try {
    await removeCloudProvider(req.params.id, req.user.id);
    await auditLog('cloud_provider_remove', { resourceId: req.params.id, provider: req.params.provider || 'unknown' }, req.user.id);
    res.json({ success: true, message: 'Cloud provider removed' });
  } catch (err) {
    logger.error('[cloudSecurityController] removeProvider failed', { error: err.message });
    next(err);
  }
};

export const triggerScan = async (req, res, next) => {
  try {
    const provider = req.params.provider;
    const { background = true } = req.body;

    await auditLog('cloud_scan', { provider, userId: req.user.id, status: true }, req.user.id);

    if (background) {
      emitSocketEvent('cloud.scan.started', { provider, startedBy: req.user.id, timestamp: new Date().toISOString() });

      runCloudScan(provider)
        .then((result) => {
          emitSocketEvent('cloud.scan.completed', { provider, result: { totalFindings: result.totalFindings, averageRisk: result.averageRisk, providersScanned: result.providersScanned }, timestamp: new Date().toISOString() });
          auditLog('cloud_scan', { provider, userId: req.user.id, status: true, findings: result.totalFindings }, req.user.id);
        })
        .catch((err) => {
          logger.error('[cloudSecurityController] Background scan failed', { provider, error: err.message });
          emitSocketEvent('cloud.scan.completed', { provider, error: err.message, timestamp: new Date().toISOString() });
          auditLog('cloud_scan', { provider, userId: req.user.id, status: false, error: err.message }, req.user.id);
        });

      return res.json({ success: true, message: 'Cloud scan started in background', provider });
    }

    const result = await runCloudScan(provider);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[cloudSecurityController] triggerScan failed', { error: err.message });
    next(err);
  }
};

export const scanAll = async (req, res, next) => {
  try {
    runCloudScan(null)
      .then((result) => {
        emitSocketEvent('cloud.scan.completed', { provider: 'all', result: { totalFindings: result.totalFindings, averageRisk: result.averageRisk, providersScanned: result.providersScanned }, timestamp: new Date().toISOString() });
      })
      .catch((err) => {
        logger.error('[cloudSecurityController] Background scan-all failed', { error: err.message });
      });

    res.json({ success: true, message: 'Cloud scan started for all providers' });
  } catch (err) {
    logger.error('[cloudSecurityController] scanAll failed', { error: err.message });
    next(err);
  }
};

export const getFindings = async (req, res, next) => {
  try {
    const filters = {
      severity: req.query.severity,
      status: req.query.status,
      checkCategory: req.query.checkCategory,
      provider: req.query.provider,
      page: req.query.page,
      limit: req.query.limit,
    };
    Object.keys(filters).forEach((k) => filters[k] === undefined && delete filters[k]);
    const result = await getCloudFindings(filters);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[cloudSecurityController] getFindings failed', { error: err.message });
    next(err);
  }
};

export const getFindingById = async (req, res, next) => {
  try {
    const finding = await CloudFinding.findById(req.params.id);
    if (!finding) {
      throw new ApiError(404, 'Finding not found');
    }
    res.json({ success: true, data: finding });
  } catch (err) {
    logger.error('[cloudSecurityController] getFindingById failed', { error: err.message });
    next(err);
  }
};

export const updateFinding = async (req, res, next) => {
  try {
    const { status, assignedTo } = req.body;
    const finding = await updateFindingStatus(req.params.id, status || finding?.status, req.user.id);
    if (assignedTo) {
      finding.assignedTo = assignedTo;
      await finding.save();
    }
    res.json({ success: true, data: finding });
  } catch (err) {
    logger.error('[cloudSecurityController] updateFinding failed', { error: err.message });
    next(err);
  }
};

export const getSecurityMetrics = async (req, res, next) => {
  try {
    const metrics = await getCloudSecurityMetrics();
    res.json({ success: true, data: metrics });
  } catch (err) {
    logger.error('[cloudSecurityController] getSecurityMetrics failed', { error: err.message });
    next(err);
  }
};

export const getCloudRiskScore = async (_req, res, next) => {
  try {
    const result = await generateCloudRiskScore();
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[cloudSecurityController] getCloudRiskScore failed', { error: err.message });
    next(err);
  }
};

export const getExecutiveSummary = async (_req, res, next) => {
  try {
    const result = await generateCloudExecutiveSummary();
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[cloudSecurityController] getExecutiveSummary failed', { error: err.message });
    next(err);
  }
};

export const getTechnicalFindings = async (_req, res, next) => {
  try {
    const result = await generateCloudTechnicalFindings();
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[cloudSecurityController] getTechnicalFindings failed', { error: err.message });
    next(err);
  }
};

export const getRemediationPlan = async (req, res, next) => {
  try {
    const findingIds = req.body?.findingIds || [];
    const result = await generateCloudRemediationPlan(findingIds);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[cloudSecurityController] getRemediationPlan failed', { error: err.message });
    next(err);
  }
};

export const getBusinessImpact = async (_req, res, next) => {
  try {
    const result = await generateBusinessImpact();
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[cloudSecurityController] getBusinessImpact failed', { error: err.message });
    next(err);
  }
};

export const getAttackPossibility = async (_req, res, next) => {
  try {
    const result = await generateAttackPossibility();
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[cloudSecurityController] getAttackPossibility failed', { error: err.message });
    next(err);
  }
};

export const getComplianceImpact = async (req, res, next) => {
  try {
    const standards = req.body?.standards || ['cis', 'nist', 'iso27001', 'soc2'];
    const result = await generateComplianceImpact(standards);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[cloudSecurityController] getComplianceImpact failed', { error: err.message });
    next(err);
  }
};

export const getFullAnalysis = async (_req, res, next) => {
  try {
    const result = await generateFullCloudAnalysis();
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[cloudSecurityController] getFullAnalysis failed', { error: err.message });
    next(err);
  }
};

export const getResources = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.provider) filter.cloudProvider = req.query.provider;
    if (req.query.resourceType) filter.resourceType = req.query.resourceType;
    if (req.query.isPublic === 'true') filter.isPublic = true;

    const resources = await CloudResource.find(filter)
      .sort({ lastScanned: -1 })
      .skip((Number(req.query.page || 1) - 1) * Number(req.query.limit || 50))
      .limit(Number(req.query.limit || 50));
    const total = await CloudResource.countDocuments(filter);
    res.json({ success: true, data: { resources, total, page: Number(req.query.page || 1), totalPages: Math.ceil(total / Number(req.query.limit || 50)) } });
  } catch (err) {
    logger.error('[cloudSecurityController] getResources failed', { error: err.message });
    next(err);
  }
};

export const getProviderDashboard = async (req, res, next) => {
  try {
    const provider = req.params.provider;
    const providerDoc = await CloudProvider.findOne({ provider });
    const findings = await CloudFinding.find({ cloudProvider: provider }).sort({ createdAt: -1 }).lean();
    const resources = await CloudResource.find({ cloudProvider: provider }).lean();

    const dashboard = {
      provider,
      providerInfo: providerDoc || null,
      summary: {
        totalFindings: findings.length,
        critical: findings.filter((f) => f.severity === 'Critical').length,
        high: findings.filter((f) => f.severity === 'High').length,
        medium: findings.filter((f) => f.severity === 'Medium').length,
        low: findings.filter((f) => f.severity === 'Low').length,
        totalResources: resources.length,
        openFindings: findings.filter((f) => f.status === 'open' || f.status === 'in_progress').length,
      },
      categories: {},
      findings: findings.slice(0, 20).map((f) => ({
        id: f._id,
        checkId: f.checkId,
        title: f.title,
        severity: f.severity,
        riskScore: f.riskScore,
        status: f.status,
        recommendation: f.recommendation,
      })),
    };

    for (const f of findings) {
      dashboard.categories[f.checkCategory] = (dashboard.categories[f.checkCategory] || 0) + 1;
    }

    res.json({ success: true, data: dashboard });
  } catch (err) {
    logger.error('[cloudSecurityController] getProviderDashboard failed', { error: err.message });
    next(err);
  }
};

export default { getProviders, addProvider, removeProvider, triggerScan, scanAll, getFindings, getFindingById, updateFinding, getSecurityMetrics, getCloudRiskScore, getExecutiveSummary, getTechnicalFindings, getRemediationPlan, getBusinessImpact, getAttackPossibility, getComplianceImpact, getFullAnalysis, getResources, getProviderDashboard };
