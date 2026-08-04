import logger from '../../utils/logger.js';
import { analyzeThreats } from '../../services/agent/threatAnalyzer.js';
import { mapThreatToMITRE } from '../../services/security/mitre/mitreMapper.js';
import { getAllThreatFeeds, normalizeThreat } from './threatFeedService.js';
import { searchCVE, matchAgainstThreat } from './cveService.js';

const CVSS_WEIGHT = 0.25;
const MITRE_WEIGHT = 0.2;
const FEED_WEIGHT = 0.2;
const SCAN_WEIGHT = 0.25;
const INCIDENT_WEIGHT = 0.1;

export async function correlateThreats({ scans = [], incidents = [], includeMitre = true }) {
  try {
    const feeds = await getAllThreatFeeds();
    const feedThreats = [
      ...feeds.phishingDomains.map((d) => normalizeThreat({ ...d, type: 'phishing' })),
      ...feeds.malwareHashes.map((d) => normalizeThreat({ ...d, type: 'malware' })),
      ...feeds.suspiciousIps.map((d) => normalizeThreat({ ...d, type: 'suspicious_ip' })),
    ].filter(Boolean);

    const threatAnalysis = analyzeThreats(scans, {}, includeMitre);
    const scanScore = threatAnalysis.overallRiskScore / 100;

    let mitreScore = 0;
    if (includeMitre && threatAnalysis.mitreMapping) {
      mitreScore = threatAnalysis.mitreMapping.confidence || 0;
    }

    const incidentScore = incidents.length > 0 ? Math.min(1, incidents.length / 10) : 0;

    let feedScore = 0;
    const matchedFeedThreats = [];
    if (scans.length > 0) {
      for (const scan of scans) {
        for (const feed of feedThreats) {
          if (typeof scan.input === 'string' && scan.input.includes(feed.id)) {
            feedScore = Math.max(feedScore, 0.8);
            matchedFeedThreats.push(feed);
            break;
          }
        }
      }
    }

    const { data: cveMatches } = await Promise.all(
      scans.slice(0, 3).map(async (scan) => {
        const results = await matchAgainstThreat({ id: scan.input, description: scan.type, category: scan.type });
        return results[0] || null;
      })
    ).then((p) => ({ data: p.filter(Boolean) }));

    const cveScore = cveMatches.length > 0 ? Math.min(1, cveMatches.reduce((acc, cve) => acc + (cve.cvssScore / 100), 0) / cveMatches.length) : 0;

    const confidenceScore = Math.min(1, [
      scanScore * SCAN_WEIGHT,
      mitreScore * MITRE_WEIGHT,
      feedScore * FEED_WEIGHT,
      cveScore * CVSS_WEIGHT,
      incidentScore * INCIDENT_WEIGHT,
    ].reduce((a, b) => a + b, 0));

    const threatPriority = confidenceScore > 0.7 ? 'Critical' : confidenceScore > 0.4 ? 'High' : confidenceScore > 0.15 ? 'Medium' : 'Low';
    const recommendedEscalation = confidenceScore > 0.7 ? 'immediate' : confidenceScore > 0.4 ? 'urgent' : confidenceScore > 0.15 ? 'schedule' : 'monitor';

    const correlation = {
      confidenceScore: Math.round(confidenceScore * 100) / 100,
      threatPriority,
      recommendedEscalation,
      components: {
        scanScore: Math.round(scanScore * 100) / 100,
        mitreScore: Math.round(mitreScore * 100) / 100,
        feedScore: Math.round(feedScore * 100) / 100,
        cveScore: Math.round(cveScore * 100) / 100,
        incidentScore: Math.round(incidentScore * 100) / 100,
      },
      cveMatches,
      matchedFeedThreats,
      mitreMapping: threatAnalysis.mitreMapping,
      threatAnalysis,
    };

    logger.info('[threatCorrelation] Threat correlation completed', {
      confidenceScore: correlation.confidenceScore,
      threatPriority,
      cveHits: cveMatches.length,
    });

    return correlation;
  } catch (err) {
    logger.error('[threatCorrelation] Correlation failed', { error: err.message });
    return {
      confidenceScore: 0,
      threatPriority: 'Low',
      recommendedEscalation: 'monitor',
      components: { scanScore: 0, mitreScore: 0, feedScore: 0, cveScore: 0, incidentScore: 0 },
      cveMatches: [],
      matchedFeedThreats: [],
      mitreMapping: null,
      threatAnalysis: null,
      error: err.message,
    };
  }
}

export async function enrichScanWithThreatIntel(scan) {
  const cveMatches = await matchAgainstThreat(scan);
  return {
    ...scan,
    cveMatches,
    threatIntelHits: cveMatches.length,
  };
}

export default { correlateThreats, enrichScanWithThreatIntel };
