import SecurityAlert from '../../models/SecurityAlert.js';
import { notify } from './notificationService.js';
import { correlateThreats } from '../threatIntel/threatCorrelation.js';
import { mapThreatToMITRE } from '../security/mitre/mitreMapper.js';
import { enrichScanWithThreatIntel } from '../threatIntel/threatCorrelation.js';
import logger from '../../utils/logger.js';

const RISK_THRESHOLD = Number(process.env.ALERT_RISK_THRESHOLD || 70);

function determineAlertType(trigger) {
  if (trigger.malware) return 'malware_detected';
  if (trigger.phishing) return 'phishing_attempt';
  if (trigger.riskThreshold) return 'risk_threshold';
  if (trigger.suspiciousLogin) return 'suspicious_login';
  if (trigger.repeatedAttack) return 'repeated_attack';
  if (trigger.threatIntelHit) return 'threat_intel_hit';
  if (trigger.cveMatch) return 'cve_match';
  return 'custom';
}

export async function evaluateAlertTriggers(triggers = []) {
  const alertsToCreate = [];

  for (const trigger of triggers) {
    const alertType = determineAlertType(trigger);
    const severity = (trigger.severity || 'MEDIUM').toUpperCase();
    const alert = await SecurityAlert.create({
      userId: trigger.userId,
      alertType,
      severity,
      title: trigger.title || `${trigger.alertType || 'Security'} Alert`,
      message: trigger.message || 'Automated alert triggered by security policy.',
      source: trigger.source || 'alertEngine',
      relatedIncident: trigger.relatedIncident || undefined,
      status: 'unread',
      metadata: trigger.metadata || {},
    });

    alertsToCreate.push(alert);
    logger.info('[alertEngine] Alert created', { alertId: alert._id, alertType, severity });
  }

  if (alertsToCreate.length > 0) {
    await Promise.all(
      alertsToCreate.map((alert) =>
        notify({
          userId: alert.userId,
          alertId: alert._id,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
        }).catch((err) => logger.warn(`[alertEngine] Notification failed: ${err.message}`))
      )
    );
  }

  return alertsToCreate;
}

export async function shouldAlertOnScan(scan, user) {
  if (!scan) return [];
  const triggers = [];

  if (scan.verdict === 'malicious') {
    triggers.push({
      userId: user?.id || user?._id,
      alertType: 'malware_detected',
      severity: scan.riskScore >= 80 ? 'CRITICAL' : 'HIGH',
      title: `Critical malware detected in ${scan.type} scan`,
      message: `Malware was detected in a recent ${scan.type} scan with risk score ${scan.riskScore}. Immediate action is recommended.`,
      source: 'scanService',
      relatedIncident: user?.incidentId || undefined,
      malware: true,
      metadata: { scanId: scan._id, scanType: scan.type, riskScore: scan.riskScore },
    });
  }

  const enriched = await enrichScanWithThreatIntel(scan);
  if (enriched.threatIntelHits > 0) {
    triggers.push({
      userId: user?.id || user?._id,
      alertType: 'threat_intel_hit',
      severity: enriched.cveMatches?.[0]?.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      title: `Threat intelligence match in ${scan.type} scan`,
      message: `Detected ${enriched.threatIntelHits} threat intelligence hit(s). ${enriched.cveMatches?.map((c) => c.id).join(', ') || ''}`,
      source: 'threatIntel',
      threatIntelHit: true,
      metadata: { scanId: scan._id, threatIntelHits: enriched.threatIntelHits, cveIds: enriched.cveMatches?.map((c) => c.id) || [] },
    });
  }

  return triggers;
}

export async function shouldAlertOnIncident(incident) {
  if (!incident) return [];
  const triggers = [];

  if (incident.severity === 'Critical') {
    const mitre = mapThreatToMITRE({ threats: [{ type: incident.threatType }], overallRiskScore: 100, verdict: 'critical' });
    triggers.push({
      userId: incident.userId,
      alertType: 'critical_incident',
      severity: 'CRITICAL',
      title: `Critical security incident: ${incident.threatType}`,
      message: `A critical incident was reported: ${incident.threatType}. MITRE technique: ${mitre.techniqueId || 'N/A'}.`,
      source: 'incidentTracker',
      relatedIncident: incident._id,
      repeatedAttack: true,
      metadata: { incidentId: incident._id, mitreId: mitre.techniqueId },
    });
  }

  return triggers;
}

export async function shouldAlertOnCorrelation(correlation, userId) {
  if (!correlation || correlation.confidenceScore < 0.2) return [];

  const triggers = [];

  if (correlation.confidenceScore > 0.7) {
    triggers.push({
      userId,
      alertType: 'risk_threshold',
      severity: 'CRITICAL',
      title: 'High confidence threat correlation detected',
      message: `AI threat correlation indicates critical risk (confidence ${Math.round(correlation.confidenceScore * 100)}%). Priority: ${correlation.threatPriority}.`,
      source: 'threatCorrelation',
      riskThreshold: true,
      metadata: { confidenceScore: correlation.confidenceScore, cveIds: correlation.cveMatches?.map((c) => c.id) || [] },
    });
  } else if (correlation.confidenceScore > 0.4) {
    triggers.push({
      userId,
      alertType: 'risk_threshold',
      severity: 'HIGH',
      title: 'Elevated threat correlation detected',
      message: `AI threat correlation indicates elevated risk (confidence ${Math.round(correlation.confidenceScore * 100)}%). Priority: ${correlation.threatPriority}.`,
      source: 'threatCorrelation',
      riskThreshold: true,
      metadata: { confidenceScore: correlation.confidenceScore },
    });
  }

  return triggers;
}

export async function runAlertPipeline(user, scans = [], incidents = []) {
  try {
    const correlation = await correlateThreats({ scans, incidents });

    const scanTriggers = [];
    for (const scan of scans) {
      scanTriggers.push(...(await shouldAlertOnScan(scan, user)));
    }

    const incidentTriggers = [];
    for (const incident of incidents) {
      incidentTriggers.push(...(await shouldAlertOnIncident(incident)));
    }

    const correlationTriggers = await shouldAlertOnCorrelation(correlation, user?.id || user?._id);

    const allTriggers = [...scanTriggers, ...incidentTriggers, ...correlationTriggers];
    const createdAlerts = await evaluateAlertTriggers(allTriggers);

    logger.info('[alertEngine] Pipeline completed', {
      totalTriggers: allTriggers.length,
      totalAlerts: createdAlerts.length,
      confidenceScore: correlation.confidenceScore,
    });

    return { alerts: createdAlerts, correlation };
  } catch (err) {
    logger.error('[alertEngine] Pipeline failed', { error: err.message });
    return { alerts: [], correlation: null, error: err.message };
  }
}

export const ALERT_LEVELS = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default { evaluateAlertTriggers, shouldAlertOnScan, shouldAlertOnIncident, shouldAlertOnCorrelation, runAlertPipeline, ALERT_LEVELS };
