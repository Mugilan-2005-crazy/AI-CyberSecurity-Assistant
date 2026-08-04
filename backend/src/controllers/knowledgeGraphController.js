import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import {
  createOrUpdateEntity,
  createRelationship,
  buildGraphFromUserData,
  getGraph,
  getEntityDetails,
  findAttackPaths,
  searchGraph,
  generateGraphInsights,
  deleteEntity,
  clearUserGraph,
} from '../services/knowledgeGraphService.js';
import { recordActivity } from '../services/ueba/behaviorService.js';

export const buildGraph = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await buildGraphFromUserData(userId);
    recordActivity(userId, { type: 'graph_search', action: 'Knowledge graph built', ip: req.ip || '', metadata: { source: 'buildGraph' } }).catch((err) => logger.warn('[ueba] Graph build activity failed', { error: err.message }));
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[knowledgeGraphController] buildGraph failed', { error: err.message });
    next(err);
  }
};

export const listGraph = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { entityType, threatLevel, minRiskScore } = req.query;
    const graph = await getGraph(userId, { entityType, threatLevel, minRiskScore });
    res.json({ success: true, data: graph });
  } catch (err) {
    logger.error('[knowledgeGraphController] listGraph failed', { error: err.message });
    next(err);
  }
};

export const getGraphEntity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const entity = await getEntityDetails(id, userId);
    if (!entity) {
      throw new ApiError(404, 'Entity not found');
    }
    res.json({ success: true, data: entity });
  } catch (err) {
    logger.error('[knowledgeGraphController] getGraphEntity failed', { error: err.message });
    next(err);
  }
};

export const addGraphEntity = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { entityType, entityId, label, properties, riskScore, threatLevel } = req.body;
    
    if (!entityType || !entityId || !label) {
      throw new ApiError(400, 'entityType, entityId, and label are required');
    }

    const entity = await createOrUpdateEntity(entityType, entityId, label, properties, userId, riskScore, threatLevel);
    if (!entity) {
      throw new ApiError(500, 'Failed to create entity');
    }

    res.status(201).json({ success: true, data: entity });
  } catch (err) {
    logger.error('[knowledgeGraphController] addGraphEntity failed', { error: err.message });
    next(err);
  }
};

export const addGraphRelationship = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { sourceEntityId, targetEntityId, relationshipType, weight, confidence, metadata } = req.body;
    
    if (!sourceEntityId || !targetEntityId || !relationshipType) {
      throw new ApiError(400, 'sourceEntityId, targetEntityId, and relationshipType are required');
    }

    const rel = await createRelationship(sourceEntityId, targetEntityId, relationshipType, weight, confidence, userId, metadata);
    if (!rel) {
      throw new ApiError(500, 'Failed to create relationship');
    }

    res.status(201).json({ success: true, data: rel });
  } catch (err) {
    logger.error('[knowledgeGraphController] addGraphRelationship failed', { error: err.message });
    next(err);
  }
};

export const getAttackPaths = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { source, target, maxDepth = 5 } = req.query;
    
    if (!source || !target) {
      throw new ApiError(400, 'source and target entity IDs are required');
    }

    const paths = await findAttackPaths(userId, source, target, Number(maxDepth));
    res.json({ success: true, data: { paths, count: paths.length } });
  } catch (err) {
    logger.error('[knowledgeGraphController] getAttackPaths failed', { error: err.message });
    next(err);
  }
};

export const searchKnowledgeGraph = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      throw new ApiError(400, 'Query must be at least 2 characters');
    }

    const results = await searchGraph(userId, q.trim());
    recordActivity(userId, { type: 'graph_search', action: `Graph search: ${q.trim()}`, ip: req.ip || '', metadata: { query: q.trim(), resultCount: results.entities?.length || 0 } }).catch((err) => logger.warn('[ueba] Graph search activity failed', { error: err.message }));
    res.json({ success: true, data: results });
  } catch (err) {
    logger.error('[knowledgeGraphController] searchKnowledgeGraph failed', { error: err.message });
    next(err);
  }
};

export const getGraphInsights = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const graph = await getGraph(userId);
    const insights = await generateGraphInsights(userId, graph);
    res.json({ success: true, data: insights });
  } catch (err) {
    logger.error('[knowledgeGraphController] getGraphInsights failed', { error: err.message });
    next(err);
  }
};

export const removeGraphEntity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await deleteEntity(id, userId);
    if (!result.success) {
      throw new ApiError(500, result.error || 'Failed to delete entity');
    }
    res.json({ success: true, message: 'Entity deleted' });
  } catch (err) {
    logger.error('[knowledgeGraphController] removeGraphEntity failed', { error: err.message });
    next(err);
  }
};

export const resetGraph = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await clearUserGraph(userId);
    if (!result.success) {
      throw new ApiError(500, result.error || 'Failed to clear graph');
    }
    res.json({ success: true, message: 'Graph cleared' });
  } catch (err) {
    logger.error('[knowledgeGraphController] resetGraph failed', { error: err.message });
    next(err);
  }
};

export default {
  buildGraph,
  listGraph,
  getGraphEntity,
  addGraphEntity,
  addGraphRelationship,
  getAttackPaths,
  searchKnowledgeGraph,
  getGraphInsights,
  removeGraphEntity,
  resetGraph,
};
