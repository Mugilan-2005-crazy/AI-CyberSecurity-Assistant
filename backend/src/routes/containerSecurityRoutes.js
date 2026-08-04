import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  scanImage,
  scanContainers,
  scanCompose,
  getImages,
  getImageById,
  getContainerMetrics,
  k8sScan,
  getClusters,
  getK8sResources,
  getK8sMetrics,
  getK8sResourceDetail,
} from '../controllers/containerSecurityController.js';

const router = Router();
router.use(protect);

router.post('/scan/image', authorize('admin', 'container_admin', 'security_manager', 'devops'), scanImage);
router.post('/scan/containers', authorize('admin', 'container_admin', 'security_manager', 'devops'), scanContainers);
router.post('/scan/compose', authorize('admin', 'container_admin', 'security_manager', 'devops'), scanCompose);

router.get('/images', authorize('admin', 'container_admin', 'security_manager', 'devops', 'auditor'), getImages);
router.get('/images/:id', authorize('admin', 'container_admin', 'security_manager', 'devops', 'auditor'), getImageById);

router.get('/metrics', authorize('admin', 'container_admin', 'security_manager', 'devops', 'auditor'), getContainerMetrics);

router.post('/k8s/scan', authorize('admin', 'container_admin', 'security_manager', 'devops'), k8sScan);
router.get('/k8s/clusters', authorize('admin', 'container_admin', 'security_manager', 'devops', 'auditor'), getClusters);
router.get('/k8s/resources', authorize('admin', 'container_admin', 'security_manager', 'devops', 'auditor'), getK8sResources);
router.get('/k8s/metrics', authorize('admin', 'container_admin', 'security_manager', 'devops', 'auditor'), getK8sMetrics);
router.get('/k8s/resources/:id', authorize('admin', 'container_admin', 'security_manager', 'devops', 'auditor'), getK8sResourceDetail);

router.get('/dashboard', authorize('admin', 'container_admin', 'security_manager', 'devops'), async (req, res, next) => {
  try {
    const containerMetrics = await import('../services/cloud/containerScanner.js').then((m) => m.getContainerSecurityMetrics());
    const k8sMetrics = await import('../services/cloud/kubernetesScanner.js').then((m) => m.getKubernetesMetrics());
    res.json({ success: true, data: { containers: containerMetrics, kubernetes: k8sMetrics } });
  } catch (err) {
    next(err);
  }
});

export default router;
