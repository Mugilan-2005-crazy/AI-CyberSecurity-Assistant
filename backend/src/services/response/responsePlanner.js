import incidentResponseAgent, { investigateIncident } from './incidentResponseAgent.js';
import logger from '../../utils/logger.js';

const PRIORITY_ORDER = { Critical: 4, High: 3, Medium: 2, Low: 1 };

function sortActions(actions) {
  return [...actions].sort((a, b) => {
    return (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
  });
}

function groupActionsByCategory(actions) {
  const groups = {};
  for (const action of actions) {
    const category = action.category || 'containment';
    if (!groups[category]) groups[category] = [];
    groups[category].push(action);
  }
  return groups;
}

export function generateResponsePlan(incidentId, userId) {
  return investigateIncident(incidentId, userId);
}

export function getPrioritizedActions(incidentId, userId) {
  try {
    const plan = {
      priority: 'Medium',
      phases: [],
      actions: [],
      estimatedSteps: 0,
    };

    const actions = generateResponsePlan(incidentId, userId);
    if (!actions || !actions.recommendedActions) {
      return plan;
    }

    const prioritized = sortActions(actions.recommendedActions);
    const grouped = groupActionsByCategory(prioritized);

    const phaseOrder = ['containment', 'notification', 'remediation', 'monitoring'];
    for (const phase of phaseOrder) {
      if (grouped[phase] && grouped[phase].length > 0) {
        plan.phases.push({
          phase,
          actions: grouped[phase],
          actionCount: grouped[phase].length,
        });
      }
    }

    plan.actions = prioritized;
    plan.priority = actions.priority || 'Medium';
    plan.estimatedSteps = prioritized.length;

    logger.info('[responsePlanner] Response plan generated', {
      incidentId,
      priority: plan.priority,
      stepCount: plan.estimatedSteps,
    });

    return plan;
  } catch (err) {
    logger.error('[responsePlanner] Failed to generate response plan', { error: err.message });
    return {
      priority: 'Medium',
      phases: [],
      actions: [],
      estimatedSteps: 0,
      error: err.message,
    };
  }
}

export function getResponseBySeverity(severity) {
  const baseActions = {
    Critical: [
      { action: 'Immediate containment - isolate affected systems', priority: 'Critical', category: 'containment' },
      { action: 'Activate incident response team', priority: 'Critical', category: 'notification' },
      { action: 'Preserve forensic evidence', priority: 'Critical', category: 'containment' },
      { action: 'Notify executive leadership', priority: 'Critical', category: 'notification' },
      { action: 'Engage external security firm if needed', priority: 'High', category: 'remediation' },
    ],
    High: [
      { action: 'Contain the threat scope', priority: 'High', category: 'containment' },
      { action: 'Notify affected users', priority: 'High', category: 'notification' },
      { action: 'Reset compromised credentials', priority: 'High', category: 'remediation' },
      { action: 'Increase monitoring on affected systems', priority: 'Medium', category: 'monitoring' },
    ],
    Medium: [
      { action: 'Investigate the incident further', priority: 'Medium', category: 'containment' },
      { action: 'Notify security team', priority: 'Medium', category: 'notification' },
      { action: 'Apply security patches if applicable', priority: 'Medium', category: 'remediation' },
    ],
    Low: [
      { action: 'Document the incident', priority: 'Low', category: 'monitoring' },
      { action: 'Review for potential patterns', priority: 'Low', category: 'monitoring' },
    ],
  };

  return baseActions[severity] || baseActions.Medium;
}

export function getActionCategoryLabel(category) {
  const labels = {
    containment: 'Containment',
    notification: 'Notification',
    remediation: 'Remediation',
    monitoring: 'Monitoring',
  };
  return labels[category] || category;
}

export default { generateResponsePlan, getPrioritizedActions, getResponseBySeverity, getActionCategoryLabel };