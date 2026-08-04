import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { scanDockerImage, scanRunningContainers, scanComposeFile, getContainerImages, getContainerSecurityMetrics } from '../services/cloud/containerScanner.js';
import { scanKubernetesCluster, discoverClusters, isKubernetesAvailable, getKubernetesResources, getKubernetesMetrics } from '../services/cloud/kubernetesScanner.js';
import ContainerImage from '../models/ContainerImage.js';
import KubernetesResource from '../models/KubernetesResource.js';
import { getIoInstance } from '../socket/socketServer.js';
import path from 'path';
import fs from 'fs';

const emitSocketEvent = (event, data) => {
  try {
    const io = getIoInstance();
    if (io) {
      io.to('admin-room').emit(event, data);
    }
  } catch (err) {
    logger.warn('[containerSecurityController] Socket emit failed', { error: err.message });
  }
};

const auditLog = async (action, details, userId) => {
  const { default: SecurityAuditLog } = await import('../models/SecurityAuditLog.js');
  try {
    await SecurityAuditLog.create({ userId, action, resourceType: 'container', ...details, status: 'success' });
  } catch (err) {
    logger.warn('[containerSecurityController] Audit log write failed', { error: err.message });
  }
};

export const scanImage = async (req, res, next) => {
  try {
    const { imageName } = req.body;
    if (!imageName) {
      throw new ApiError(400, 'imageName is required');
    }

    emitSocketEvent('container.scan.started', { imageName, startedBy: req.user.id, timestamp: new Date().toISOString() });
    await auditLog('container_image_scan', { imageName, status: true }, req.user.id);

    const result = await scanDockerImage(imageName, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[containerSecurityController] scanImage failed', { error: err.message });
    next(err);
  }
};

export const scanContainers = async (req, res, next) => {
  try {
    const dockerAvailable = await import('../services/cloud/containerScanner.js').then((m) => m.checkDockerAvailable());
    emitSocketEvent('container.scan.started', { scanType: 'running_containers', timestamp: new Date().toISOString() });
    await auditLog('container_runtime_scan', { status: true }, req.user.id);

    const result = await scanRunningContainers(req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[containerSecurityController] scanContainers failed', { error: err.message });
    next(err);
  }
};

export const scanCompose = async (req, res, next) => {
  try {
    const { composePath } = req.body;
    if (!composePath) {
      throw new ApiError(400, 'composePath is required');
    }

    const fullPath = path.isAbsolute(composePath) ? composePath : path.join(process.cwd(), composePath);
    if (!fs.existsSync(fullPath)) {
      throw new ApiError(404, `Compose file not found: ${composePath}`);
    }

    emitSocketEvent('container.scan.started', { scanType: 'docker_compose', filePath: composePath, timestamp: new Date().toISOString() });
    await auditLog('container_scan', { composePath, status: true }, req.user.id);

    const result = await scanComposeFile(fullPath, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[containerSecurityController] scanCompose failed', { error: err.message });
    next(err);
  }
};

export const getImages = async (req, res, next) => {
  try {
    const result = await getContainerImages({
      riskLevel: req.query.riskLevel,
      source: req.query.source,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[containerSecurityController] getImages failed', { error: err.message });
    next(err);
  }
};

export const getImageById = async (req, res, next) => {
  try {
    const image = await ContainerImage.findById(req.params.id);
    if (!image) {
      throw new ApiError(404, 'Image not found');
    }
    res.json({ success: true, data: image });
  } catch (err) {
    logger.error('[containerSecurityController] getImageById failed', { error: err.message });
    next(err);
  }
};

export const getContainerMetrics = async (_req, res, next) => {
  try {
    const metrics = await getContainerSecurityMetrics();
    res.json({ success: true, data: metrics });
  } catch (err) {
    logger.error('[containerSecurityController] getContainerMetrics failed', { error: err.message });
    next(err);
  }
};

export const k8sScan = async (req, res, next) => {
  try {
    const { clusterName, namespace, kubeconfigPath } = req.body || {};

    emitSocketEvent('k8s.scan.started', { clusterName: clusterName || 'default', startedBy: req.user.id, timestamp: new Date().toISOString() });
    await auditLog('k8s_scan', { clusterName, status: true }, req.user.id);

    const result = await scanKubernetesCluster({ clusterName, namespace, kubeconfigPath });
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[containerSecurityController] k8sScan failed', { error: err.message });
    next(err);
  }
};

export const getClusters = async (_req, res, next) => {
  try {
    const clusters = await discoverClusters();
    res.json({ success: true, data: clusters });
  } catch (err) {
    logger.error('[containerSecurityController] getClusters failed', { error: err.message });
    next(err);
  }
};

export const getK8sResources = async (req, res, next) => {
  try {
    const result = await getKubernetesResources({
      clusterName: req.query.clusterName,
      namespace: req.query.namespace,
      kind: req.query.kind,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[containerSecurityController] getK8sResources failed', { error: err.message });
    next(err);
  }
};

export const getK8sMetrics = async (_req, res, next) => {
  try {
    const metrics = await getKubernetesMetrics();
    res.json({ success: true, data: metrics });
  } catch (err) {
    logger.error('[containerSecurityController] getK8sMetrics failed', { error: err.message });
    next(err);
  }
};

export const getK8sResourceDetail = async (req, res, next) => {
  try {
    const resource = await KubernetesResource.findById(req.params.id);
    if (!resource) {
      throw new ApiError(404, 'Kubernetes resource not found');
    }
    res.json({ success: true, data: resource });
  } catch (err) {
    logger.error('[containerSecurityController] getK8sResourceDetail failed', { error: err.message });
    next(err);
  }
};

export default { scanImage, scanContainers, scanCompose, getImages, getImageById, getContainerMetrics, k8sScan, getClusters, getK8sResources, getK8sMetrics, getK8sResourceDetail };
