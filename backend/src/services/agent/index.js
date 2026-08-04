/**
 * services/agent/index.js
 * ============================================================
 * Barrel export for the Autonomous AI Security Agent.
 */

import { runSecurityAgent, feedScanResult } from './securityAgent.js';
import { analyzeThreats } from './threatAnalyzer.js';
import { generateRecommendations } from './recommendationEngine.js';
import {
  setContext,
  getContext,
  clearContext,
  appendScan,
  getRecentScans,
  getRiskTrend,
} from './agentMemory.js';

export const agent = {
  runSecurityAgent,
  feedScanResult,
  analyzeThreats,
  generateRecommendations,
  memory: {
    setContext,
    getContext,
    clearContext,
    appendScan,
    getRecentScans,
    getRiskTrend,
  },
};

export default agent;
