import mongoose from 'mongoose';
import GraphEntity from '../models/GraphEntity.js';
import GraphRelationship from '../models/GraphRelationship.js';
import SecurityIncident from '../models/SecurityIncident.js';
import SecurityAlert from '../models/SecurityAlert.js';
import ThreatIntel from '../models/ThreatIntel.js';
import ScanHistory from '../models/ScanHistory.js';
import AIAnalysis from '../models/AIAnalysis.js';
import IncidentResponse from '../models/IncidentResponse.js';
import { routeAI } from './ai/aiRouter.js';
import logger from '../utils/logger.js';

const ObjectId = mongoose.Types.ObjectId;

export async function createOrUpdateEntity(entityType, entityId, label, properties = {}, createdBy, riskScore = 0, threatLevel = 'Low') {
  try {
    const normalizedType = entityType === 'MITRETechnique' ? 'MITRETechnique' : entityType;
    
    let entity = await GraphEntity.findOne({ entityType: normalizedType, entityId });
    if (entity) {
      entity.properties = { ...entity.properties, ...properties };
      if (riskScore > 0) entity.riskScore = riskScore;
      if (threatLevel !== 'Low') entity.threatLevel = threatLevel;
      await entity.save();
    } else {
      entity = new GraphEntity({
        entityType: normalizedType,
        entityId,
        label,
        properties,
        riskScore,
        threatLevel,
        createdBy,
      });
      await entity.save();
    }
    return entity;
  } catch (err) {
    logger.error('[knowledgeGraph] createOrUpdateEntity failed', { error: err.message });
    return null;
  }
}

export async function createRelationship(sourceEntityId, targetEntityId, relationshipType, weight = 50, confidence = 0.5, createdBy, metadata = {}) {
  try {
    let rel = await GraphRelationship.findOne({
      sourceEntityId,
      targetEntityId,
      relationshipType,
    });

    if (rel) {
      rel.weight = Math.max(rel.weight, weight);
      rel.confidence = Math.max(rel.confidence, confidence);
      rel.metadata = { ...rel.metadata, ...metadata };
      await rel.save();
    } else {
      rel = new GraphRelationship({
        sourceEntityId,
        targetEntityId,
        relationshipType,
        weight,
        confidence,
        createdBy,
        metadata,
      });
      await rel.save();
    }
    return rel;
  } catch (err) {
    logger.error('[knowledgeGraph] createRelationship failed', { error: err.message });
    return null;
  }
}

export async function buildGraphFromUserData(userId) {
  try {
    const userObjectId = new ObjectId(userId);
    
    const [incidents, alerts, threatIntels, scans, aiAnalyses, responses] = await Promise.all([
      SecurityIncident.find({ userId: userObjectId }).lean(),
      SecurityAlert.find({ userId: userObjectId }).lean(),
      ThreatIntel.find({ user: userObjectId }).lean(),
      ScanHistory.find({ user: userObjectId }).lean(),
      AIAnalysis.find({ user: userObjectId }).lean(),
      IncidentResponse.find({ userId: userObjectId }).lean(),
    ]);

    const userEntity = await createOrUpdateEntity('User', userId.toString(), 'User', { userId: userId.toString() }, userId, 0, 'Low');

    for (const incident of incidents) {
      const incidentEntity = await createOrUpdateEntity(
        'SecurityIncident',
        incident._id.toString(),
        `${incident.threatType} Incident`,
        { status: incident.status, severity: incident.severity, description: incident.description },
        userId,
        incident.severity === 'Critical' ? 90 : incident.severity === 'High' ? 70 : incident.severity === 'Medium' ? 50 : 30,
        incident.severity
      );

      if (userEntity && incidentEntity) {
        await createRelationship(userEntity.entityId, incidentEntity.entityId, 'generated_by', 80, 0.9, userId, { source: 'SecurityIncident' });
      }

      if (incident.mitreTechnique?.techniqueId) {
        const mitreEntity = await createOrUpdateEntity(
          'MITRETechnique',
          incident.mitreTechnique.techniqueId,
          incident.mitreTechnique.techniqueName || 'Unknown Technique',
          { tactic: incident.mitreTechnique.tactic, techniqueId: incident.mitreTechnique.techniqueId },
          userId,
          60,
          'Medium'
        );
        if (incidentEntity && mitreEntity) {
          await createRelationship(incidentEntity.entityId, mitreEntity.entityId, 'uses', 70, 0.8, userId);
        }
      }
    }

    for (const alert of alerts) {
      const alertEntity = await createOrUpdateEntity(
        'SecurityAlert',
        alert._id.toString(),
        alert.title,
        { alertType: alert.alertType, severity: alert.severity, status: alert.status },
        userId,
        alert.severity === 'CRITICAL' ? 90 : alert.severity === 'HIGH' ? 70 : alert.severity === 'MEDIUM' ? 50 : 30,
        alert.severity === 'CRITICAL' ? 'Critical' : alert.severity === 'HIGH' ? 'High' : alert.severity === 'MEDIUM' ? 'Medium' : 'Low'
      );

      if (userEntity && alertEntity) {
        await createRelationship(userEntity.entityId, alertEntity.entityId, 'generated_by', 70, 0.85, userId, { source: 'SecurityAlert' });
      }

      if (alert.relatedIncident) {
        const incidentEntity = await GraphEntity.findOne({ entityType: 'SecurityIncident', entityId: alert.relatedIncident.toString() });
        if (incidentEntity) {
          await createRelationship(alertEntity.entityId, incidentEntity.entityId, 'related_to', 90, 0.9, userId);
        }
      }
    }

    for (const intel of threatIntels) {
      const intelEntity = await createOrUpdateEntity(
        'ThreatIntel',
        intel._id.toString(),
        `${intel.iocType}: ${intel.ioc}`,
        { ioc: intel.ioc, iocType: intel.iocType, classification: intel.classification, reputationScore: intel.reputationScore },
        userId,
        intel.reputationScore,
        intel.classification === 'malicious' ? 'Critical' : intel.classification === 'suspicious' ? 'High' : 'Low'
      );

      if (userEntity && intelEntity) {
        await createRelationship(userEntity.entityId, intelEntity.entityId, 'generated_by', 60, 0.8, userId, { source: 'ThreatIntel' });
      }

      if (intel.relatedCves && intel.relatedCves.length > 0) {
        for (const cveId of intel.relatedCves) {
          const cveEntity = await createOrUpdateEntity('CVE', cveId, cveId, { cveId }, userId, 50, 'Medium');
          if (intelEntity && cveEntity) {
            await createRelationship(intelEntity.entityId, cveEntity.entityId, 'references', 60, 0.7, userId);
          }
        }
      }

      if (intel.mitreTechniques && intel.mitreTechniques.length > 0) {
        for (const tech of intel.mitreTechniques) {
          const mitreEntity = await createOrUpdateEntity(
            'MITRETechnique',
            tech.techniqueId,
            tech.techniqueName || 'Unknown',
            { tactic: tech.tactic, techniqueId: tech.techniqueId },
            userId,
            60,
            'Medium'
          );
          if (intelEntity && mitreEntity) {
            await createRelationship(intelEntity.entityId, mitreEntity.entityId, 'uses', 70, 0.8, userId);
          }
        }
      }
    }

    for (const scan of scans) {
      const scanEntity = await createOrUpdateEntity(
        'URL',
        scan._id.toString(),
        scan.input || 'Unknown Scan',
        { scanType: scan.type, riskScore: scan.riskScore, verdict: scan.verdict, ip: scan.ip },
        userId,
        scan.riskScore,
        scan.riskScore >= 80 ? 'Critical' : scan.riskScore >= 60 ? 'High' : scan.riskScore >= 40 ? 'Medium' : 'Low'
      );

      if (userEntity && scanEntity) {
        await createRelationship(userEntity.entityId, scanEntity.entityId, 'generated_by', 50, 0.7, userId, { source: 'ScanHistory' });
      }
    }

    for (const analysis of aiAnalyses) {
      const analysisEntity = await createOrUpdateEntity(
        'SecurityIncident',
        analysis._id.toString(),
        `AI Analysis: ${analysis.scanType}`,
        { riskLevel: analysis.riskLevel, confidenceScore: analysis.confidenceScore, threatScore: analysis.threatScore },
        userId,
        analysis.threatScore,
        analysis.threatScore >= 80 ? 'Critical' : analysis.threatScore >= 60 ? 'High' : analysis.threatScore >= 40 ? 'Medium' : 'Low'
      );

      if (userEntity && analysisEntity) {
        await createRelationship(userEntity.entityId, analysisEntity.entityId, 'generated_by', 60, 0.75, userId, { source: 'AIAnalysis' });
      }
    }

    const createdEntities = await GraphEntity.find({ createdBy: userObjectId }).lean();
    const entityCount = createdEntities.length;
    logger.info('[knowledgeGraph] Graph built', { userId, entityCount });
    
    return { success: true, entityCount, relationshipCount: 0 };
  } catch (err) {
    logger.error('[knowledgeGraph] buildGraphFromUserData failed', { error: err.message, userId });
    return { success: false, error: err.message };
  }
}

export async function getGraph(userId, filters = {}) {
  try {
    const userObjectId = new ObjectId(userId);
    const entityFilter = { createdBy: userObjectId };
    const relFilter = { createdBy: userObjectId };

    if (filters.entityType) entityFilter.entityType = filters.entityType;
    if (filters.threatLevel) entityFilter.threatLevel = filters.threatLevel;
    if (filters.minRiskScore !== undefined) entityFilter.riskScore = { $gte: Number(filters.minRiskScore) };

    const [entities, relationships] = await Promise.all([
      GraphEntity.find(entityFilter).lean(),
      GraphRelationship.find(relFilter).lean(),
    ]);

    const entityMap = new Map(entities.map((e) => [e.entityId, e]));
    const filteredRelationships = relationships.filter((r) => entityMap.has(r.sourceEntityId) && entityMap.has(r.targetEntityId));

    return {
      nodes: entities.map((e) => ({
        id: e.entityId,
        label: e.label,
        type: e.entityType,
        riskScore: e.riskScore,
        threatLevel: e.threatLevel,
        properties: e.properties,
      })),
      edges: filteredRelationships.map((r) => ({
        id: `${r.sourceEntityId}-${r.targetEntityId}-${r.relationshipType}`,
        source: r.sourceEntityId,
        target: r.targetEntityId,
        type: r.relationshipType,
        weight: r.weight,
        confidence: r.confidence,
      })),
    };
  } catch (err) {
    logger.error('[knowledgeGraph] getGraph failed', { error: err.message });
    return { nodes: [], edges: [] };
  }
}

export async function getEntityDetails(entityId, userId) {
  try {
    const entity = await GraphEntity.findOne({ entityId, createdBy: new ObjectId(userId) }).lean();
    if (!entity) return null;

    const outgoing = await GraphRelationship.find({ sourceEntityId: entity.entityId, createdBy: new ObjectId(userId) }).lean();
    const incoming = await GraphRelationship.find({ targetEntityId: entity.entityId, createdBy: new ObjectId(userId) }).lean();

    return {
      ...entity,
      outgoingRelationships: outgoing,
      incomingRelationships: incoming,
    };
  } catch (err) {
    logger.error('[knowledgeGraph] getEntityDetails failed', { error: err.message });
    return null;
  }
}

export async function findAttackPaths(userId, sourceEntityId, targetEntityId, maxDepth = 5) {
  try {
    const relationships = await GraphRelationship.find({ createdBy: new ObjectId(userId) }).lean();
    const adjacency = new Map();
    
    for (const rel of relationships) {
      if (!adjacency.has(rel.sourceEntityId)) adjacency.set(rel.sourceEntityId, []);
      adjacency.get(rel.sourceEntityId).push({ target: rel.targetEntityId, type: rel.relationshipType, weight: rel.weight });
    }

    const paths = [];
    const visited = new Set();
    
    async function dfs(current, path, depth) {
      if (depth > maxDepth) return;
      if (current === targetEntityId) {
        paths.push([...path]);
        return;
      }
      if (visited.has(current)) return;
      visited.add(current);
      
      const neighbors = adjacency.get(current) || [];
      for (const neighbor of neighbors) {
        path.push({ entityId: neighbor.target, relationshipType: neighbor.type, weight: neighbor.weight });
        await dfs(neighbor.target, path, depth + 1);
        path.pop();
      }
      visited.delete(current);
    }

    await dfs(sourceEntityId, [{ entityId: sourceEntityId, relationshipType: 'start', weight: 100 }], 0);
    
    return paths.slice(0, 10);
  } catch (err) {
    logger.error('[knowledgeGraph] findAttackPaths failed', { error: err.message });
    return [];
  }
}

export async function searchGraph(userId, query) {
  try {
    const userObjectId = new ObjectId(userId);
    const q = query.toLowerCase();
    
    const entities = await GraphEntity.find({
      createdBy: userObjectId,
      $or: [
        { label: { $regex: q, $options: 'i' } },
        { 'properties.ioc': { $regex: q, $options: 'i' } },
        { 'properties.description': { $regex: q, $options: 'i' } },
      ],
    }).limit(20).lean();

    const relationships = await GraphRelationship.find({
      createdBy: userObjectId,
      $or: [
        { sourceEntityId: { $in: entities.map((e) => e.entityId) } },
        { targetEntityId: { $in: entities.map((e) => e.entityId) } },
      ],
    }).lean();

    const entityIds = new Set(entities.map((e) => e.entityId));
    const filteredRelationships = relationships.filter((r) => entityIds.has(r.sourceEntityId) || entityIds.has(r.targetEntityId));

    return {
      entities,
      relationships: filteredRelationships,
    };
  } catch (err) {
    logger.error('[knowledgeGraph] searchGraph failed', { error: err.message });
    return { entities: [], relationships: [] };
  }
}

export async function generateGraphInsights(userId, graphData) {
  try {
    const highRiskNodes = graphData.nodes.filter((n) => n.riskScore >= 70);
    const criticalNodes = graphData.nodes.filter((n) => n.threatLevel === 'Critical');
    const relationshipTypes = {};
    
    for (const edge of graphData.edges) {
      relationshipTypes[edge.type] = (relationshipTypes[edge.type] || 0) + 1;
    }

    const prompt = `You are a cybersecurity graph analyst. Analyze the following security knowledge graph data and provide insights.

GRAPH SUMMARY:
- Total Nodes: ${graphData.nodes.length}
- Total Relationships: ${graphData.edges.length}
- High Risk Nodes: ${highRiskNodes.length}
- Critical Nodes: ${criticalNodes.length}

HIGH RISK NODES:
${highRiskNodes.slice(0, 5).map((n) => `- ${n.label} (${n.type}): Risk ${n.riskScore}`).join('\n') || 'None'}

CRITICAL NODES:
${criticalNodes.slice(0, 5).map((n) => `- ${n.label} (${n.type})`).join('\n') || 'None'}

RELATIONSHIP TYPES:
${Object.entries(relationshipTypes).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Provide 3-5 concise insights about:
1. Hidden attack patterns
2. Risk propagation paths
3. Priority areas for investigation
4. Threat clustering observations`;

    const result = await routeAI(prompt, [], 'en');
    
    return {
      insights: result.response,
      provider: result.provider,
      summary: {
        totalNodes: graphData.nodes.length,
        totalEdges: graphData.edges.length,
        highRiskCount: highRiskNodes.length,
        criticalCount: criticalNodes.length,
        relationshipBreakdown: relationshipTypes,
      },
    };
  } catch (err) {
    logger.error('[knowledgeGraph] generateGraphInsights failed', { error: err.message });
    return { insights: 'Graph analysis unavailable.', provider: 'none', summary: {} };
  }
}

export async function deleteEntity(entityId, userId) {
  try {
    await GraphEntity.deleteOne({ entityId, createdBy: new ObjectId(userId) });
    await GraphRelationship.deleteMany({
      $or: [{ sourceEntityId: entityId }, { targetEntityId: entityId }],
      createdBy: new ObjectId(userId),
    });
    return { success: true };
  } catch (err) {
    logger.error('[knowledgeGraph] deleteEntity failed', { error: err.message });
    return { success: false, error: err.message };
  }
}

export async function clearUserGraph(userId) {
  try {
    const userObjectId = new ObjectId(userId);
    await GraphEntity.deleteMany({ createdBy: userObjectId });
    await GraphRelationship.deleteMany({ createdBy: userObjectId });
    return { success: true };
  } catch (err) {
    logger.error('[knowledgeGraph] clearUserGraph failed', { error: err.message });
    return { success: false, error: err.message };
  }
}

export default {
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
};
