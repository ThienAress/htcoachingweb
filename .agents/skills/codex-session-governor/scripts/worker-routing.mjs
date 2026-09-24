import { recommendModel } from './session-governor.mjs';

// Produces a dispatch plan, never launches subprocesses, changes root model or grants permissions.
export function planWorker(input) {
  const recommendation = recommendModel(input.task, input.risk, input.complexity, input);
  if (input.allWorkSameModel === true) {
    return { action: 'root', reason: 'preserve_explicit_single_model_request', executionVerified: false };
  }
  if (![input.independent, input.substantial, input.boundedContext, input.verifiable, input.runtimeAllows].every((value) => value === true) || input.alreadyKnown === true) {
    return { action: 'root', reason: 'delegation_gate_not_met', executionVerified: false };
  }
  const selected = input.explicitWorker || recommendation;
  const security = input.task === 'security' || input.risk === 'critical';
  if (security && (selected.model !== 'gpt-6-astra' || !['high', 'xhigh', 'max', 'ultra'].includes(selected.effort))) {
    return { action: 'needs_selection', reason: 'explicit_worker_conflicts_with_security_preference', executionVerified: false };
  }
  if (!Object.hasOwn(input.capabilities || {}, selected.model) || !Array.isArray(input.capabilities[selected.model]) || !input.capabilities[selected.model].includes(selected.effort)) {
    return { action: 'needs_selection', reason: 'model_or_effort_not_verified_available', executionVerified: false };
  }
  const writeTask = ['implementation', 'mechanical'].includes(input.task);
  const role = writeTask ? 'ht-implementer' : selected.model === 'gpt-5.6-luna' ? 'ht-explorer'
    : selected.model === 'gpt-5.6-terra' ? 'ht-implementer'
      : selected.model === 'gpt-6-astra' ? (security ? 'ht-security' : 'ht-architect') : 'ht-planner';
  return { action: 'delegate', role, model: selected.model, reasoning_effort: selected.effort,
    fork_turns: 'none', executionVerified: false, reason: 'independent_bounded_work',
    ...(writeTask && (selected.model !== 'gpt-5.6-terra' || selected.effort !== 'medium') ? { explicitModelDispatchRequired: true } : {}),
  };
}
