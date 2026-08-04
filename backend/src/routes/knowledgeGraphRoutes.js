import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/auth.js';
import {
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
  buildCloudGraph,
  getCloudThreatPredictions,
} from '../controllers/knowledgeGraphController.js';

const router = Router();
router.use(protect);

/**
 * @openapi
 * /api/knowledge-graph/build:
 *   post:
 *     tags:
 *       - Knowledge Graph
 *     summary: Build graph from user data
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Graph built successfully
 */
router.post('/build', buildGraph);

/**
 * @openapi
 * /api/knowledge-graph:
 *   get:
 *     tags:
 *       - Knowledge Graph
 *     summary: Get user's knowledge graph
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: entityType
 *       - in: query
 *         name: threatLevel
 *       - in: query
 *         name: minRiskScore
 *     responses:
 *       200:
 *         description: Graph data
 */
router.get('/', listGraph);

/**
 * @openapi
 * /api/knowledge-graph/entity:
 *   post:
 *     tags:
 *       - Knowledge Graph
 *     summary: Add entity
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - entityType
 *               - entityId
 *               - label
 *     responses:
 *       201:
 *         description: Entity created
 */
router.post('/entity', addGraphEntity);

/**
 * @openapi
 * /api/knowledge-graph/entity/{id}:
 *   get:
 *     tags:
 *       - Knowledge Graph
 *     summary: Get entity details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Entity details
 */
router.get('/entity/:id', getGraphEntity);

/**
 * @openapi
 * /api/knowledge-graph/entity/{id}:
 *   delete:
 *     tags:
 *       - Knowledge Graph
 *     summary: Delete entity
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Entity deleted
 */
router.delete('/entity/:id', removeGraphEntity);

/**
 * @openapi
 * /api/knowledge-graph/relationship:
 *   post:
 *     tags:
 *       - Knowledge Graph
 *     summary: Add relationship
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sourceEntityId
 *               - targetEntityId
 *               - relationshipType
 *     responses:
 *       201:
 *         description: Relationship created
 */
router.post('/relationship', addGraphRelationship);

/**
 * @openapi
 * /api/knowledge-graph/path:
 *   get:
 *     tags:
 *       - Knowledge Graph
 *     summary: Find attack paths
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: source
 *         required: true
 *       - in: query
 *         name: target
 *         required: true
 *       - in: query
 *         name: maxDepth
 *     responses:
 *       200:
 *         description: Attack paths found
 */
router.get('/path', getAttackPaths);

/**
 * @openapi
 * /api/knowledge-graph/search:
 *   get:
 *     tags:
 *       - Knowledge Graph
 *     summary: Search graph
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/search', searchKnowledgeGraph);

/**
 * @openapi
 * /api/knowledge-graph/insights:
 *   get:
 *     tags:
 *       - Knowledge Graph
 *     summary: Get AI graph insights
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI-generated insights
 */
router.get('/insights', getGraphInsights);

/**
 * @openapi
 * /api/knowledge-graph/reset:
 *   post:
 *     tags:
 *       - Knowledge Graph
 *     summary: Clear user graph
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Graph cleared
 */
router.post('/reset', resetGraph);

router.post('/cloud/build', authorize('admin', 'cloud_admin', 'security_manager', 'devops', 'auditor'), buildCloudGraph);
router.get('/cloud/threat-predictions', authorize('admin', 'cloud_admin', 'security_manager', 'devops', 'auditor'), getCloudThreatPredictions);

export default router;
