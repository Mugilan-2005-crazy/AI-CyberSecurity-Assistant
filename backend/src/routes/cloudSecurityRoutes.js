import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  getProviders,
  addProvider,
  removeProvider,
  triggerScan,
  scanAll,
  getFindings,
  getFindingById,
  updateFinding,
  getSecurityMetrics,
  getCloudRiskScore,
  getExecutiveSummary,
  getTechnicalFindings,
  getRemediationPlan,
  getBusinessImpact,
  getAttackPossibility,
  getComplianceImpact,
  getFullAnalysis,
  getResources,
  getProviderDashboard,
} from '../controllers/cloudSecurityController.js';

const router = Router();
router.use(protect);

router.get('/providers', authorize('admin', 'cloud_admin', 'security_manager', 'devops', 'auditor'), getProviders);
router.post('/providers', authorize('admin', 'cloud_admin', 'security_manager', 'devops'), addProvider);
router.delete('/providers/:id', authorize('admin', 'cloud_admin', 'security_manager', 'devops'), removeProvider);
router.get('/providers/:provider/dashboard', authorize('admin', 'cloud_admin', 'security_manager', 'devops', 'auditor'), getProviderDashboard);

router.post('/scan', authorize('admin', 'cloud_admin', 'security_manager', 'devops'), triggerScan);
router.post('/scan/all', authorize('admin', 'cloud_admin', 'security_manager', 'devops'), scanAll);

router.get('/findings', authorize('admin', 'cloud_admin', 'security_manager', 'devops', 'auditor'), getFindings);
router.get('/findings/:id', authorize('admin', 'cloud_admin', 'security_manager', 'devops', 'auditor'), getFindingById);
router.patch('/findings/:id', authorize('admin', 'cloud_admin', 'security_manager', 'devops'), updateFinding);

router.get('/resources', authorize('admin', 'cloud_admin', 'security_manager', 'devops', 'auditor'), getResources);

router.get('/metrics', authorize('admin', 'cloud_admin', 'security_manager', 'devops', 'auditor'), getSecurityMetrics);
router.get('/risk-score', authorize('admin', 'cloud_admin', 'security_manager', 'devops', 'auditor'), getCloudRiskScore);

router.get('/analysis/executive-summary', authorize('admin', 'cloud_admin', 'security_manager', 'devops'), getExecutiveSummary);
router.get('/analysis/technical-findings', authorize('admin', 'cloud_admin', 'security_manager', 'devops'), getTechnicalFindings);
router.post('/analysis/remediation-plan', authorize('admin', 'cloud_admin', 'security_manager', 'devops'), getRemediationPlan);
router.get('/analysis/business-impact', authorize('admin', 'cloud_admin', 'security_manager', 'devops'), getBusinessImpact);
router.get('/analysis/attack-possibility', authorize('admin', 'cloud_admin', 'security_manager', 'devops'), getAttackPossibility);
router.post('/analysis/compliance-impact', authorize('admin', 'cloud_admin', 'security_manager', 'devops'), getComplianceImpact);
router.get('/analysis/full', authorize('admin', 'cloud_admin', 'security_manager', 'devops'), getFullAnalysis);

router.get('/dashboard', authorize('admin', 'cloud_admin', 'security_manager', 'devops'), getProviderDashboard);

export default router;
