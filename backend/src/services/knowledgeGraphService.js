import mongoose from 'mongoose';
import GraphEntity from '../models/GraphEntity.js';
import GraphRelationship from '../models/GraphRelationship.js';
import SecurityIncident from '../models/SecurityIncident.js';
import SecurityAlert from '../models/SecurityAlert.js';
import ThreatIntel from '../models/ThreatIntel.js';
import ScanHistory from '../models/ScanHistory.js';
import AIAnalysis from '../models/AIAnalysis.js';
import IncidentResponse from '../models/IncidentResponse.js';
import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import UserRiskEvent from '../models/UserRiskEvent.js';
import BehaviorTimeline from '../models/BehaviorTimeline.js';
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

export async function buildUebaSubgraph(userId) {
  try {
    const userObjectId = new ObjectId(userId);

    const [profile, riskEvents, timelines] = await Promise.all([
      UserBehaviorProfile.findOne({ userId: userObjectId }).lean(),
      UserRiskEvent.find({ userId: userObjectId }).sort({ createdAt: -1 }).limit(50).lean(),
      BehaviorTimeline.find({ userId: userObjectId }).sort({ timestamp: -1 }).limit(100).lean(),
    ]);

    const userEntity = await createOrUpdateEntity('User', userId.toString(), 'User', { userId: userId.toString() }, userId, profile?.riskScore || 0, profile?.riskLevel || 'Low');

    for (const event of riskEvents) {
      const entity = await createOrUpdateEntity(
        'SecurityAlert',
        `ueba:${event._id}`,
        `${event.title}`,
        { eventType: event.eventType, severity: event.severity, riskScore: event.riskScore, description: event.description, status: event.status, createdAt: event.createdAt },
        userId,
        event.riskScore,
        event.severity === 'Critical' ? 'Critical' : event.severity === 'High' ? 'High' : event.severity === 'Medium' ? 'Medium' : 'Low'
      );

      if (userEntity && entity) {
        await createRelationship(userEntity.entityId, entity.entityId, 'generated_by', 75, 0.9, userId, { source: 'UserRiskEvent' });
      }

      if (event.relatedAlert) {
        await createRelationship(entity.entityId, event.relatedAlert.toString(), 'indicates', 80, 0.85, userId, { source: 'UserRiskEvent' });
      }
    }

    for (const tl of timelines.slice(0, 50)) {
      const entity = await createOrUpdateEntity(
        'BehaviorTimeline',
        `behavior:${tl._id}`,
        `${tl.eventType} — ${tl.description}`,
        { category: tl.category, riskScore: tl.riskScore, anomalyMatched: tl.anomalyMatched, timestamp: tl.timestamp },
        userId,
        tl.riskScore,
        tl.riskScore >= 70 ? 'Critical' : tl.riskScore >= 50 ? 'High' : tl.riskScore >= 30 ? 'Medium' : 'Low'
      );

      if (userEntity && entity) {
        await createRelationship(userEntity.entityId, entity.entityId, 'performs', 60, 0.8, userId, { source: 'BehaviorTimeline' });
      }
    }

    const riskEventsWithAlerts = riskEvents.filter((e) => e.relatedAlert);
    const alerts = await SecurityAlert.find({ 'metadata.riskEventId': { $in: riskEventsWithAlerts.map((e) => e._id) } }).lean();
    for (const alert of alerts) {
      await createOrUpdateEntity(
        'SecurityAlert',
        alert._id.toString(),
        alert.title,
        { alertType: alert.alertType, severity: alert.severity, status: alert.status },
        userId,
        alert.severity === 'CRITICAL' ? 90 : alert.severity === 'HIGH' ? 70 : alert.severity === 'MEDIUM' ? 50 : 30,
        alert.severity === 'CRITICAL' ? 'Critical' : alert.severity === 'HIGH' ? 'High' : alert.severity === 'MEDIUM' ? 'Medium' : 'Low'
      );
    }

    logger.info('[knowledgeGraph] UEBA subgraph built', { userId });
    return { success: true, riskEvents: riskEvents.length, timelineEntries: timelines.length };
  } catch (err) {
    logger.error('[knowledgeGraph] buildUebaSubgraph failed', { error: err.message });
    return { success: false, error: err.message };
  }
}

export async function predictInsiderThreats(userId) {
  try {
    const profile = await UserBehaviorProfile.findOne({ userId }).lean();
    if (!profile) return { threats: [], confidence: 0 };

    const recentEvents = await UserRiskEvent.find({ userId, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const threatIndicators = [];

    if (profile.riskScore >= 70) {
      threatIndicators.push({ indicator: 'High aggregate risk score', weight: 0.3, detail: `Score: ${profile.riskScore}` });
    }
    if (profile.highRiskAnomalyCount >= 3) {
      threatIndicators.push({ indicator: 'Multiple high-risk anomalies', weight: 0.25, detail: `Count: ${profile.highRiskAnomalyCount}` });
    }

    const criticalOrHigh = recentEvents.filter((e) => ['Critical', 'High'].includes(e.severity));
    if (criticalOrHigh.length >= 2) {
      threatIndicators.push({ indicator: 'Multiple critical/high anomalies active', weight: 0.3, detail: `Count: ${criticalOrHigh.length}` });
    }

    const impossibleTravel = recentEvents.find((e) => e.eventType === 'impossible_travel');
    if (impossibleTravel) {
      threatIndicators.push({ indicator: 'Impossible travel detected', weight: 0.15, detail: 'Potential account takeover' });
    }

    const confidence = threatIndicators.reduce((sum, i) => sum + i.weight, 0);
    const isInsiderThreat = confidence >= 0.5;

    return {
      threats: isInsiderThreat ? threatIndicators : [],
      confidence: Math.min(1, Math.round(confidence * 100) / 100),
      isInsiderThreat,
      profile: { riskScore: profile.riskScore, riskLevel: profile.riskLevel, anomalyCount: profile.anomalyCount },
    };
  } catch (err) {
    logger.error('[knowledgeGraph] predictInsiderThreats failed', { error: err.message });
    return { threats: [], confidence: 0 };
  }
}

export async function buildCloudSubgraph(userId, filters = {}) {
  try {
    const userObjectId = new ObjectId(userId);

    const CloudProvider = (await import('../models/CloudProvider.js')).default;
    const CloudResource = (await import('../models/CloudResource.js')).default;
    const CloudFinding = (await import('../models/CloudFinding.js')).default;
    const ContainerImage = (await import('../models/ContainerImage.js')).default;
    const KubernetesResource = (await import('../models/KubernetesResource.js')).default;
    const ThreatIntel = (await import('../models/ThreatIntel.js')).default;

    const userEntity = await createOrUpdateEntity('User', userId.toString(), 'User', { userId: userId.toString() }, userId, 0, 'Low');

    const providers = await CloudProvider.find({}).lean();
    const resources = await CloudResource.find(filters.provider ? { cloudProvider: filters.provider } : {}).lean();
    const findings = await CloudFinding.find({}).sort({ createdAt: -1 }).limit(100).lean();
    const images = await ContainerImage.find({}).sort({ createdAt: -1 }).limit(50).lean();
    const kubeResources = await KubernetesResource.find({}).sort({ lastScanned: -1 }).limit(100).lean();
    const threatIntel = await ThreatIntel.find({}).limit(50).lean();

    for (const provider of providers) {
      const entityType = provider.provider === 'aws' ? 'AWSAccount' : provider.provider === 'azure' ? 'AzureTenant' : 'GCPProject';
      const providerEntity = await createOrUpdateEntity(
        entityType,
        `${provider.provider}:${provider.accountId}`,
        `${provider.name || provider.accountName}`,
        { accountId: provider.accountId, region: provider.region, provider: provider.provider, status: provider.status, riskScore: provider.riskScore },
        userId,
        provider.riskScore || 0,
        provider.riskScore >= 70 ? 'High' : provider.riskScore >= 50 ? 'Medium' : 'Low'
      );

      if (userEntity && providerEntity) {
        await createRelationship(userEntity.entityId, providerEntity.entityId, 'manages', 60, 0.8, userId, { source: 'CloudProvider' });
      }

      for (const resource of resources.filter((r) => r.providerAccountId === provider.accountId)) {
        const resourceEntity = await createOrUpdateEntity(
          'CloudAsset',
          `cloud:${provider.provider}:${resource.resourceId}`,
          resource.name || resource.resourceId,
          { resourceType: resource.resourceType, provider: resource.cloudProvider, region: resource.region, riskScore: resource.riskScore, isPublic: resource.isPublic, tags: resource.tags },
          userId,
          resource.riskScore || 0,
          resource.riskScore >= 80 ? 'Critical' : resource.riskScore >= 60 ? 'High' : resource.riskScore >= 30 ? 'Medium' : 'Low'
        );

        if (providerEntity && resourceEntity) {
          await createRelationship(providerEntity.entityId, resourceEntity.entityId, 'contains', 70, 0.9, userId, { source: 'CloudResource' });
        }

        if (resource.riskScore >= 70) {
          await createRelationship(resourceEntity.entityId, userEntity.entityId, 'monitored_by', 60, 0.7, userId, { source: 'CloudResource' });
        }

        for (const finding of findings.filter((f) => f.resourceId === resource.resourceId)) {
          const findingEntity = await createOrUpdateEntity(
            'SecurityAlert',
            `cloudfinding:${finding._id}`,
            finding.title,
            { checkId: finding.checkId, category: finding.checkCategory, severity: finding.severity, description: finding.description, recommendation: finding.recommendation },
            userId,
            finding.riskScore,
            finding.severity === 'Critical' ? 'Critical' : finding.severity === 'High' ? 'High' : finding.severity === 'Medium' ? 'Medium' : 'Low'
          );
          if (resourceEntity && findingEntity) {
            await createRelationship(resourceEntity.entityId, findingEntity.entityId, 'has_finding', 80, 0.95, userId, { source: 'CloudFinding' });
          }
        }
      }
    }

    for (const finding of findings) {
      const findingEntity = await createOrUpdateEntity(
        'SecurityAlert',
        `cloudfinding:${finding._id}`,
        finding.title,
        { checkId: finding.checkId, category: finding.checkCategory, severity: finding.severity, description: finding.description, recommendation: finding.recommendation, provider: finding.cloudProvider },
        userId,
        finding.riskScore,
        finding.severity === 'Critical' ? 'Critical' : finding.severity === 'High' ? 'High' : finding.severity === 'Medium' ? 'Medium' : 'Low'
      );

      const relatedIntel = threatIntel.find((t) => JSON.stringify(t).includes(finding.title.substring(0, 10).toLowerCase()));
      if (relatedIntel && findingEntity) {
        const intelEntity = await createOrUpdateEntity(
          'ThreatIntel',
          `ti:${relatedIntel._id}`,
          `${relatedIntel.iocType}: ${relatedIntel.ioc}`,
          { ioc: relatedIntel.ioc, iocType: relatedIntel.iocType, classification: relatedIntel.classification },
          userId,
          relatedIntel.reputationScore || 50,
          relatedIntel.classification === 'malicious' ? 'High' : 'Medium'
        );
        if (intelEntity) {
          await createRelationship(findingEntity.entityId, intelEntity.entityId, 'indicates_threat', 65, 0.8, userId, { source: 'CloudFinding-ThreatIntel' });
        }
      }
    }

    for (const image of images) {
      const imageEntity = await createOrUpdateEntity(
        'Image',
        `image:${image.imageName}:${image.imageTag}`,
        `${image.imageName}:${image.imageTag}`,
        { riskScore: image.riskScore, riskLevel: image.riskLevel, source: image.source, vulnerabilityCount: image.vulnerabilities?.length || 0, secretCount: image.secrets?.length || 0 },
        userId,
        image.riskScore || 0,
        image.riskScore >= 80 ? 'Critical' : image.riskScore >= 60 ? 'High' : image.riskScore >= 30 ? 'Medium' : 'Low'
      );

      for (const vuln of image.vulnerabilities || []) {
        const cveEntity = await createOrUpdateEntity(
          'CVE',
          `cve:${vuln.cveId}`,
          vuln.cveId,
          { cvssScore: vuln.cvssScore, severity: vuln.severity, title: vuln.title, pkgName: vuln.pkgName, installedVersion: vuln.installedVersion, fixedVersion: vuln.fixedVersion },
          userId,
          vuln.cvssScore ? Math.round(vuln.cvssScore * 10) : 50,
          vuln.severity === 'Critical' ? 'Critical' : vuln.severity === 'High' ? 'High' : vuln.severity === 'Medium' ? 'Medium' : 'Low'
        );
        if (imageEntity && cveEntity) {
          await createRelationship(imageEntity.entityId, cveEntity.entityId, 'contains_vulnerability', 85, 0.95, userId, { source: 'ContainerImage' });
        }
      }

      for (const secret of image.secrets || []) {
        const secretEntity = await createOrUpdateEntity(
          'CloudSecret',
          `container-secret:${image.imageName}:${secret.type}`,
          `Secret: ${secret.type}`,
          { file: secret.file, match: '***', description: secret.description, severity: secret.severity },
          userId,
          secret.severity === 'Critical' ? 90 : secret.severity === 'High' ? 75 : 50,
          secret.severity === 'Critical' ? 'Critical' : secret.severity === 'High' ? 'High' : 'Medium'
        );
        if (imageEntity && secretEntity) {
          await createRelationship(imageEntity.entityId, secretEntity.entityId, 'contains_secret', 80, 0.9, userId, { source: 'ContainerImage' });
        }
      }
    }

    const pods = kubeResources.filter((r) => r.kind === 'Pod');
    const namespaces = kubeResources.filter((r) => r.kind === 'Namespace');
    const clusters = kubeResources.filter((r) => r.kind === 'KubernetesCluster');
    const serviceAccounts = kubeResources.filter((r) => r.kind === 'ServiceAccount');

    for (const ns of namespaces) {
      const nsEntity = await createOrUpdateEntity('Namespace', `ns:${ns.clusterName}:${ns.name}`, `Namespace: ${ns.name}`, { clusterName: ns.clusterName, labels: ns.labels }, userId, 0, 'Low');
      if (userEntity && nsEntity) {
        await createRelationship(userEntity.entityId, nsEntity.entityId, 'owns', 50, 0.7, userId, { source: 'KubernetesResource' });
      }

      for (const pod of pods.filter((p) => p.namespace === ns.name)) {
        const podEntity = await createOrUpdateEntity('Pod', `pod:${ns.clusterName}:${ns.name}:${pod.name}`, `Pod: ${pod.name}`, { clusterName: pod.clusterName, namespace: pod.namespace, labels: pod.labels, riskScore: pod.riskScore }, userId, pod.riskScore || 0, pod.riskScore >= 80 ? 'Critical' : pod.riskScore >= 60 ? 'High' : 'Low');

        if (nsEntity && podEntity) {
          await createRelationship(nsEntity.entityId, podEntity.entityId, 'contains', 70, 0.9, userId, { source: 'KubernetesNamespace' });
        }

        for (const finding of pod.findings || []) {
          const findingEntity = await createOrUpdateEntity('SecurityAlert', `k8sfinding:${pod._id}:${finding.checkId}`, finding.title || finding.checkId, { severity: finding.severity, category: finding.category, namespace: pod.namespace, pod: pod.name }, userId, finding.riskScore || 50, finding.severity === 'Critical' ? 'Critical' : finding.severity === 'High' ? 'High' : 'Medium');
          if (podEntity && findingEntity) {
            await createRelationship(podEntity.entityId, findingEntity.entityId, 'has_finding', 85, 0.95, userId, { source: 'K8sFinding' });
          }
        }
      }

      for (const sa of serviceAccounts.filter((s) => s.namespace === ns.name)) {
        const saEntity = await createOrUpdateEntity('CloudSecret', `sa:${ns.clusterName}:${ns.name}:${sa.name}`, `ServiceAccount: ${sa.name}`, { clusterName: sa.clusterName, namespace: sa.namespace, roleRef: sa.spec?.roleRef }, userId, 0, 'Low');
        if (nsEntity && saEntity) {
          await createRelationship(nsEntity.entityId, saEntity.entityId, 'has_service_account', 60, 0.8, userId, { source: 'Namespace' });
        }
      }
    }

    for (const image of images) {
      const containerEntity = await createOrUpdateEntity('Container', `container:${image.imageName}:${image.imageTag}`, `${image.imageName}:${image.imageTag}`, { source: image.source, riskScore: image.riskScore, vulnerabilityCount: image.vulnerabilities?.length || 0 }, userId, image.riskScore || 0, getThreatLevel(image.riskScore || 0));
      const imageEntity = await createOrUpdateEntity('Image', `image:${image.imageName}:${image.imageTag}`, `${image.imageName}:${image.imageTag}`, { riskScore: image.riskScore }, userId, image.riskScore || 0, getThreatLevel(image.riskScore || 0));
      if (containerEntity && imageEntity) {
        await createRelationship(containerEntity.entityId, imageEntity.entityId, 'uses_image', 80, 0.95, userId, { source: 'Container' });
      }
    }

    logger.info('[knowledgeGraph] Cloud subgraph built', { userId, providers: providers.length, resources: resources.length, images: images.length, kubeResources: kubeResources.length });
    return { success: true, providers: providers.length, resources: resources.length, images: images.length, findings: findings.length, kubeResources: kubeResources.length };
  } catch (err) {
    logger.error('[knowledgeGraph] buildCloudSubgraph failed', { error: err.message });
    return { success: false, error: err.message };
  }
}

function getThreatLevel(score) {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 30) return 'Medium';
  return 'Low';
}

export async function predictCloudThreats(userId) {
  try {
    const CloudFinding = (await import('../models/CloudFinding.js')).default;
    const recentFindings = await CloudFinding.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const threatIndicators = [];
    const criticalCount = recentFindings.filter((f) => f.severity === 'Critical').length;
    const highCount = recentFindings.filter((f) => f.severity === 'High').length;

    if (criticalCount >= 3) {
      threatIndicators.push({ indicator: 'Multiple critical cloud misconfigurations', weight: 0.35, detail: `Count: ${criticalCount}` });
    }
    if (highCount >= 5) {
      threatIndicators.push({ indicator: 'Multiple high severity cloud findings', weight: 0.3, detail: `Count: ${highCount}` });
    }

    const privEsc = recentFindings.filter((f) => f.checkCategory === 'privilege_escalation' || f.checkCategory === 'iam_misconfiguration');
    if (privEsc.length >= 2) {
      threatIndicators.push({ indicator: 'Privilege escalation paths detected', weight: 0.25, detail: `Count: ${privEsc.length}` });
    }

    const publicStorage = recentFindings.filter((f) => f.checkCategory === 'public_storage');
    if (publicStorage.length >= 1) {
      threatIndicators.push({ indicator: 'Public storage exposure', weight: 0.2, detail: `Count: ${publicStorage.length}` });
    }

    const openSGs = recentFindings.filter((f) => f.checkCategory === 'open_security_groups');
    if (openSGs.length >= 2) {
      threatIndicators.push({ indicator: 'Multiple open security groups', weight: 0.2, detail: `Count: ${openSGs.length}` });
    }

    const confidence = Math.min(1, Math.round(threatIndicators.reduce((sum, i) => sum + i.weight, 0) * 100) / 100);

    return {
      threats: confidence >= 0.3 ? threatIndicators : [],
      confidence,
      isSuspicious: confidence >= 0.3,
    };
  } catch (err) {
    logger.error('[knowledgeGraph] predictCloudThreats failed', { error: err.message });
    return { threats: [], confidence: 0, isSuspicious: false };
  }
}

export default {
  createOrUpdateEntity,
  createRelationship,
  buildGraphFromUserData,
  buildUebaSubgraph,
  buildCloudSubgraph,
  predictCloudThreats,
  getGraph,
  getEntityDetails,
  findAttackPaths,
  searchGraph,
  generateGraphInsights,
  deleteEntity,
  clearUserGraph,
  predictInsiderThreats,
};
