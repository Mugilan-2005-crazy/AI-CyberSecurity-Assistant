import logger from '../../utils/logger.js';

export async function logAnalysis(ioc, iocType, reputationScore, classification, threatPriority, userId) {
  try {
    logger.info('[threatIntelAudit] IOC analysis recorded', {
      ioc: iocType === 'email' ? '[redacted]' : ioc,
      iocType,
      reputationScore,
      classification,
      threatPriority,
      userId: userId || 'anonymous',
    });
  } catch (err) {
    logger.warn('[threatIntelAudit] Log failed', { error: err.message });
  }
}

export default { logAnalysis };
