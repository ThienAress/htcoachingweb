import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommendModel } from './session-governor.mjs';
import { planWorker } from './worker-routing.mjs';

const capable = { 'gpt-5.6-luna': ['low', 'medium'], 'gpt-5.6-terra': ['medium', 'high'], 'gpt-5.6-sol': ['high', 'xhigh'], 'gpt-6-astra': ['high', 'xhigh'] };
const eligible = { task: 'lookup', risk: 'low', complexity: 'simple', independent: true,
  substantial: true, boundedContext: true, verifiable: true, runtimeAllows: true, capabilities: capable };

test('precision-heavy or ambiguous complex plans select Astra, ordinary complex plan can use Sol', () => {
  assert.equal(recommendModel('planning', 'medium', 'complex').model, 'gpt-5.6-sol');
  assert.equal(recommendModel('planning', 'medium', 'complex', { precision: 'high' }).model, 'gpt-6-astra');
  assert.equal(recommendModel('planning', 'medium', 'complex', { ambiguity: 'high' }).effort, 'xhigh');
  assert.equal(recommendModel('debugging', 'high', 'complex').model, 'gpt-6-astra');
  assert.throws(() => recommendModel('lookup', 'low', 'simple', { precision: 'typo' }));
});
test('tiny, serial, missing verification, runtime-forbidden work is never dispatched', () => {
  for (const field of ['independent', 'substantial', 'boundedContext', 'verifiable', 'runtimeAllows']) {
    assert.equal(planWorker({ ...eligible, [field]: false }).action, 'root');
  }
  assert.equal(planWorker({ ...eligible, alreadyKnown: true }).action, 'root');
});
test('bounded substantial lookup produces explicit Luna spawn settings', () => {
  assert.deepEqual(planWorker(eligible), {
    action: 'delegate', role: 'ht-explorer', model: 'gpt-5.6-luna', reasoning_effort: 'low', fork_turns: 'none',
    executionVerified: false, reason: 'independent_bounded_work',
  });
});
test('unsupported or unknown availability cannot silently fallback', () => {
  assert.equal(planWorker({ ...eligible, capabilities: {} }).action, 'needs_selection');
  assert.equal(planWorker({ ...eligible, capabilities: { 'gpt-5.6-luna': ['medium'] } }).action, 'needs_selection');
});
test('explicit worker model preserved, but unsafe security downgrade requires selection', () => {
  assert.equal(planWorker({ ...eligible, explicitWorker: { model: 'gpt-5.6-sol', effort: 'high' } }).model, 'gpt-5.6-sol');
  assert.equal(planWorker({ ...eligible, task: 'security', risk: 'high', explicitWorker: { model: 'gpt-5.6-luna', effort: 'low' } }).action, 'needs_selection');
});
test('root picker is not a worker override and never gets switched', () => {
  assert.equal(planWorker({ ...eligible, rootModel: 'gpt-6-astra', rootEffort: 'high' }).model, 'gpt-5.6-luna');
  assert.equal(planWorker({ ...eligible, task: 'planning', complexity: 'complex', precision: 'high' }).role, 'ht-architect');
});
test('explicit same-model work stays at root and non-default implementer requires explicit model dispatch', () => {
  assert.equal(planWorker({ ...eligible, allWorkSameModel: true }).action, 'root');
  const result = planWorker({ ...eligible, task: 'implementation', complexity: 'complex', precision: 'high' });
  assert.equal(result.model, 'gpt-6-astra');
  assert.equal(result.role, 'ht-implementer');
  assert.equal(result.explicitModelDispatchRequired, true);
});
