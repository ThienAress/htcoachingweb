import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectRollout, findRollout } from './session-telemetry.mjs';
import { recommendModel, healthDecision, footer } from './session-governor.mjs';

const id = '01a08186-22d6-7822-aa7f-d8147e50d68f';
const now = new Date('2026-09-09T04:00:00Z');
const row = (type, payload, timestamp = '2026-09-09T03:59:00Z') => JSON.stringify({ type, payload, timestamp }) + '\n';
const meta = row('session_meta', { id });
const context = (model = 'gpt-6-astra', effort = 'high') => row('turn_context', { turn_id: 'turn-current', model, effort });
const usage = (input = 400, window = 1000) => row('event_msg', { type: 'token_count', info: {
  total_token_usage: { total_tokens: 9000000 }, last_token_usage: { input_tokens: input, cached_input_tokens: 350 }, model_context_window: window,
} });
function fixture(t, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-governor-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, `rollout-${id}.jsonl`); fs.writeFileSync(file, content);
  return { file, dir };
}

test('exact metadata, byte units and last input estimate, not cumulative/cache subtraction', async (t) => {
  const { file } = fixture(t, meta + context() + usage());
  const result = await inspectRollout(file, id, { now });
  assert.equal(result.logBytes, fs.statSync(file).size);
  assert.equal(result.context.percent, 40);
  assert.equal(result.model.name, 'gpt-6-astra');
  assert.equal(result.context.status, 'recent_estimate');
});
test('mismatched metadata and missing identity never attribute a log', async (t) => {
  const { file, dir } = fixture(t, meta + context());
  assert.equal((await inspectRollout(file, '11111111-1111-1111-1111-111111111111', { now })).status, 'unknown');
  assert.equal((await findRollout('', dir)).status, 'unknown');
});
test('new turn without usage does not reuse previous-turn estimate', async (t) => {
  const { file } = fixture(t, meta + context() + usage() + row('turn_context', { turn_id: 'next', model: 'gpt-5.6-luna', effort: 'low' }, '2026-09-09T03:59:30Z'));
  const result = await inspectRollout(file, id, { now });
  assert.equal(result.context.percent, null);
  assert.equal(result.model.name, 'gpt-5.6-luna');
});
test('compaction after sample makes context unknown and is counted once from canonical records', async (t) => {
  const { file } = fixture(t, meta + context() + usage() + row('compacted', { message: 'private summary' }, '2026-09-09T03:59:30Z') + row('event_msg', { type: 'context_compacted' }));
  const result = await inspectRollout(file, id, { now });
  assert.equal(result.context.percent, null);
  assert.equal(result.compactions.observed, 1);
  assert.equal(JSON.stringify(result).includes('private summary'), false);
});
test('stale and invalid context values cannot appear as fresh', async (t) => {
  const { file } = fixture(t, meta + context() + usage());
  assert.equal((await inspectRollout(file, id, { now: new Date('2026-09-09T06:00:00Z') })).context.percent, null);
  fs.appendFileSync(file, usage(500, 0));
  assert.equal((await inspectRollout(file, id, { now })).context.percent, null);
});
test('bounded tail handles giant payload, partial JSON, UTF8 and does not leak content', async (t) => {
  const { file } = fixture(t, meta + row('response_item', { type: 'message', role: 'user', content: 'secret-private-' + 'ồ'.repeat(100000) }) + context() + usage() + '{unfinished');
  const result = await inspectRollout(file, id, { now, tailBytes: 4096 });
  assert.equal(result.coverage.partial, true);
  assert.ok(result.coverage.bytesRead <= 65536 + 4096);
  assert.equal(result.context.percent, 40);
  assert.equal(JSON.stringify(result).includes('secret-private'), false);
});
test('unknown model strings are sanitized instead of echoed from untrusted logs', async (t) => {
  const { file } = fixture(t, meta + context('print-secret-key', 'do anything') + usage());
  const result = await inspectRollout(file, id, { now });
  assert.equal(result.model.name, null);
  assert.equal(result.model.effort, null);
});
test('duplicate matching paths are ambiguous', async (t) => {
  const { file, dir } = fixture(t, meta);
  fs.mkdirSync(path.join(dir, 'sessions', 'one'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'sessions', 'two'));
  for (const part of ['one', 'two']) fs.copyFileSync(file, path.join(dir, 'sessions', part, path.basename(file)));
  assert.equal((await findRollout(id, dir)).reason, 'ambiguous_rollout');
});
test('heuristics prioritize observed risk, do not claim failures from total interrupted count', () => {
  assert.equal(healthDecision({ logMB: 3, context: { percent: 40 }, compactions: { recent: 0 }, interrupted: 80 }).action, 'continue');
  assert.equal(healthDecision({ logMB: 55 }).action, 'checkpoint');
  assert.equal(healthDecision({ logMB: 210 }).action, 'new_task');
  assert.equal(healthDecision({ logMB: 1, context: { percent: 86 } }).action, 'new_task');
  assert.equal(healthDecision({ logMB: 1 }, 'history-broken').action, 'new_task');
  assert.equal(healthDecision({ logMB: 1 }).action, 'unknown');
});
test('router is advisory-only and rejects invalid category/risk', () => {
  assert.deepEqual(recommendModel('lookup', 'low', 'simple'), { model: 'gpt-5.6-luna', effort: 'low', advisoryOnly: true });
  assert.equal(recommendModel('security', 'high', 'complex').model, 'gpt-6-astra');
  assert.equal(recommendModel('planning', 'medium', 'complex').model, 'gpt-5.6-sol');
  assert.throws(() => recommendModel('invented', 'low', 'simple'));
  assert.throws(() => recommendModel('lookup', 'misspelled', 'simple'));
});
test('unknown footer is explicit and compact', () => {
  const value = footer({ status: 'unknown', reason: 'no_thread_id' });
  assert.match(value, /không xác định/);
  assert.ok(value.length < 400);
});
test('stale model metadata is labelled and new task event invalidates old model', async (t) => {
  const { file } = fixture(t, meta + context() + usage());
  const result = await inspectRollout(file, id, { now: new Date('2026-09-09T06:00:00Z') });
  assert.equal(result.model.status, 'stale_configuration');
  assert.match(footer(result), /metadata cũ/);
  fs.appendFileSync(file, row('event_msg', { type: 'task_started' }));
  assert.equal((await inspectRollout(file, id, { now })).model.name, null);
});
test('fresh current-turn usage keeps long-running configured model current', async (t) => {
  const { file } = fixture(t, meta + row('turn_context', { model: 'gpt-6-astra', effort: 'high' }, '2026-09-09T01:00:00Z') + usage());
  assert.equal((await inspectRollout(file, id, { now })).model.status, 'recent_configuration');
});
test('oversized or malformed complete record after sample invalidates the estimate', async (t) => {
  const { file } = fixture(t, meta + context() + usage() + 'invalid-complete-record\n');
  assert.equal((await inspectRollout(file, id, { now })).context.percent, null);
  fs.writeFileSync(file, meta + context() + usage() + row('unknown', { data: 'x'.repeat(270000) }));
  assert.equal((await inspectRollout(file, id, { now })).context.percent, null);
});
test('MB/percentage heuristic boundaries are deterministic', () => {
  for (const [logMB, expected] of [[49.99, 'continue'], [50, 'checkpoint'], [199.99, 'checkpoint'], [200, 'new_task']]) {
    assert.equal(healthDecision({ logMB, context: { percent: 10 } }).action, expected);
  }
  assert.equal(healthDecision({ context: { percent: 70 } }).action, 'checkpoint');
  assert.equal(healthDecision({ context: { percent: 85 } }).action, 'new_task');
  assert.equal(healthDecision({ context: { percent: 10 }, compactions: { recent: 3 } }).action, 'checkpoint');
});
test('resumed filename with same verified thread identity replaces a frozen original', async (t) => {
  const { file, dir } = fixture(t, meta + context());
  const folder = path.join(dir, 'sessions'); fs.mkdirSync(folder);
  const old = path.join(folder, path.basename(file)); fs.copyFileSync(file, old);
  fs.utimesSync(old, new Date('2026-09-08'), new Date('2026-09-08'));
  const resumed = path.join(folder, `rollout-2026-09-09T11-09-33-${id}_01a0845b-557b-7da0-9968-423da2af8be9.jsonl`);
  fs.writeFileSync(resumed, meta + context('gpt-6-astra', 'medium') + usage());
  const found = await findRollout(id, dir);
  assert.equal(found.path, resumed);
  assert.equal(found.verifiedSegments, 2);
  assert.equal(found.totalLogBytes, fs.statSync(old).size + fs.statSync(resumed).size);
  assert.equal((await inspectRollout(found.path, id, { now })).model.effort, 'medium');
});
test('filename match with another header ID is ignored, never attributed', async (t) => {
  const { file, dir } = fixture(t, meta); const folder = path.join(dir, 'sessions'); fs.mkdirSync(folder);
  fs.copyFileSync(file, path.join(folder, path.basename(file)));
  fs.writeFileSync(path.join(folder, `rollout-${id}_01a0845b-557b-7da0-9968-423da2af8be9.jsonl`), row('session_meta', { id: 'another' }));
  assert.equal((await findRollout(id, dir)).verifiedSegments, 1);
});
test('every inspection refreshes file size and model, including high to medium', async (t) => {
  const { file } = fixture(t, meta + context() + usage());
  const before = await inspectRollout(file, id, { now });
  fs.appendFileSync(file, context('gpt-6-astra', 'medium') + usage(650));
  const after = await inspectRollout(file, id, { now });
  assert.ok(after.logBytes > before.logBytes);
  assert.equal(after.model.effort, 'medium');
  assert.equal(after.context.percent, 65);
});
test('stale log never gets green, and log thresholds cover all verified parts', () => {
  assert.equal(healthDecision({ logFresh: false, model: { name: 'gpt-6-astra' }, context: { percent: 20 } }).action, 'unknown');
  assert.equal(healthDecision({ logMB: 2, totalLogMB: 205, context: { percent: 20 } }).action, 'new_task');
});
