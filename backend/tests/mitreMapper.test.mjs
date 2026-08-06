import { describe, test, expect } from '@jest/globals';
import {
  MITRE_TECHNIQUES,
  mapThreatToMITRE,
  buildIncidentResponse,
  enrichWithMITRE,
} from '../src/services/security/mitreMapper.js';

describe('MITRE ATT&CK Mapper (TASK 5)', () => {
  test('maps phishing to T1566.001 (Initial Access)', () => {
    const m = mapThreatToMITRE('phishing email attachment detected');
    expect(m).not.toBeNull();
    expect(m.id).toBe('T1566.001');
    expect(m.tactic).toBe('Initial Access');
    expect(m.tactics).toContain('Initial Access');
    expect(m.severity).toBe('high');
    expect(Array.isArray(m.recommendedResponse)).toBe(true);
    expect(m.recommendedResponse.length).toBeGreaterThan(0);
  });

  test('maps ransomware to T1486 (Impact)', () => {
    const m = mapThreatToMITRE('ransomware encrypted files shadow copy');
    expect(m.id).toBe('T1486');
    expect(m.severity).toBe('critical');
  });

  test('maps credential dumping to T1003.001 (Credential Access)', () => {
    const m = mapThreatToMITRE('mimikatz credential dump');
    expect(m.id).toBe('T1003.001');
    expect(m.tactic).toBe('Credential Access');
  });

  test('maps exfiltration to T1041 (Exfiltration)', () => {
    const m = mapThreatToMITRE('data exfiltration over C2');
    expect(m.id).toBe('T1041');
    expect(m.severity).toBe('critical');
  });

  test('maps exploit to T1190 (Initial Access)', () => {
    const m = mapThreatToMITRE('CVE exploit remote code execution found');
    expect(m.id).toBe('T1190');
  });

  test('maps malware to obfuscation T1027', () => {
    const m = mapThreatToMITRE('base64 encoded payload');
    expect(m.id).toBe('T1027');
  });

  test('returns null for benign/empty/invalid input', () => {
    expect(mapThreatToMITRE('clean benign traffic')).toBeNull();
    expect(mapThreatToMITRE('')).toBeNull();
    expect(mapThreatToMITRE(null)).toBeNull();
    expect(mapThreatToMITRE(undefined)).toBeNull();
    expect(mapThreatToMITRE(123)).toBeNull();
  });

  test('first-specific-match wins (phishing with link -> T1566.001 not T1071)', () => {
    const m = mapThreatToMITRE('phishing link');
    expect(m.id).toBe('T1566.001');
  });

  test('buildIncidentResponse rolls up max severity and dedupes steps', () => {
    const entries = [mapThreatToMITRE('phishing attachment'), mapThreatToMITRE('ransomware')].filter(Boolean);
    const ir = buildIncidentResponse(entries);
    expect(ir.severity).toBe('critical');
    expect(ir.steps.length).toBeGreaterThan(0);
    // no duplicate steps
    expect(new Set(ir.steps).size).toBe(ir.steps.length);
  });

  test('buildIncidentResponse returns low-severity default for empty input', () => {
    const ir = buildIncidentResponse([]);
    expect(ir.severity).toBe('low');
    expect(ir.steps.length).toBe(1);
  });

  test('enrichWithMITRE is purely additive (no existing fields mutated)', () => {
    const src = { detectedIssues: ['phishing email', 'mimikatz dump'], threatLevel: 'malicious' };
    const enriched = enrichWithMITRE(src);
    // enrichment output
    expect(enriched.techniqueCount).toBe(2);
    expect(Array.isArray(enriched.mitre)).toBe(true);
    expect(enriched.incidentResponse.severity).toBe('critical');
    expect(enriched).toHaveProperty('mitre');
    expect(enriched).toHaveProperty('incidentResponse');
    // source object untouched
    expect(src.threatLevel).toBe('malicious');
    expect(src).not.toHaveProperty('mitre');
  });

  test('covers a meaningful breadth of techniques (>15)', () => {
    expect(MITRE_TECHNIQUES.length).toBeGreaterThanOrEqual(15);
    // ids must be unique and well-formed (T####[.###])
    const ids = MITRE_TECHNIQUES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^T\d{4}(?:\.\d+)?$/);
    }
  });
});
