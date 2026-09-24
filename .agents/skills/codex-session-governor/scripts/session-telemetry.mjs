import fs from 'node:fs/promises';
import path from 'node:path';

export const THREAD_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const HEAD_BYTES = 65536;
const TAIL_BYTES = 4 * 1024 * 1024;
const LINE_BYTES = 256 * 1024;
const MODEL = /^(?:gpt-[0-9]+(?:\.[0-9]+)?(?:-(?:astra|sol|terra|luna|codex|spark|mini|max|pro|chat|latest))*|gpt-reserve)$/;
const EFFORTS = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
const unknown = (reason) => ({ status: 'unknown', reason });
const safeModel = (value) => typeof value === 'string' && value.length <= 64 && MODEL.test(value) ? value : null;
const safeEffort = (value) => EFFORTS.has(value) ? value : null;
const stamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const positive = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;

// Discover only filenames within the session roots. Never infer identity from recency.
export async function findRollout(threadId, codexHome) {
  if (!THREAD_ID.test(threadId || '')) return unknown('no_thread_id');
  const matches = [];
  const resumedName = new RegExp(`-${threadId}(?:_[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})?\\.jsonl$`, 'i');
  let visited = 0;
  let capped = false;
  async function walk(dir, depth = 0) {
    if (depth > 6) { capped = true; return; }
    let entries;
    try {
      if ((await fs.lstat(dir)).isSymbolicLink()) return;
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) { if (error.code !== 'ENOENT') capped = true; return; }
    for (const entry of entries) {
      if (++visited > 20000) { capped = true; return; }
      if (entry.isSymbolicLink()) continue;
      const candidate = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(candidate, depth + 1);
      else if (entry.isFile() && entry.name.startsWith('rollout-') && resumedName.test(entry.name)) matches.push(candidate);
    }
  }
  for (const root of ['sessions', 'archived_sessions']) await walk(path.join(codexHome, root));
  if (capped) return unknown('discovery_incomplete');
  if (matches.length > 32) return unknown('too_many_rollout_segments');
  const verified = [];
  for (const candidate of matches) {
    let handle;
    try {
      if ((await fs.lstat(candidate)).isSymbolicLink()) continue;
      handle = await fs.open(candidate, 'r');
      const stat = await handle.stat();
      const buffer = Buffer.alloc(Math.min(stat.size, HEAD_BYTES));
      await handle.read(buffer, 0, buffer.length, 0);
      const meta = JSON.parse(buffer.toString('utf8').split('\n')[0].replace(/^\uFEFF/, ''));
      if (meta.type === 'session_meta' && meta.payload?.id === threadId) {
        verified.push({ path: candidate, size: stat.size, modified: stat.mtimeMs, name: path.basename(candidate) });
      }
    } catch { return unknown('segment_identity_unavailable'); }
    finally { if (handle) await handle.close(); }
  }
  if (!verified.length) return unknown('rollout_not_found');
  if (new Set(verified.map((item) => item.name)).size !== verified.length) return unknown('ambiguous_rollout');
  verified.sort((a, b) => b.modified - a.modified);
  if (verified.length > 1 && verified[0].modified === verified[1].modified) return unknown('ambiguous_rollout');
  return { status: 'located', path: verified[0].path, verifiedSegments: verified.length,
    totalLogBytes: verified.reduce((sum, item) => sum + item.size, 0), selectedLogBytes: verified[0].size,
    selection: 'latest_modified_with_verified_same_thread_identity' };
}

export async function inspectRollout(file, threadId, { now = new Date(), tailBytes = TAIL_BYTES } = {}) {
  if (!THREAD_ID.test(threadId || '')) return unknown('no_thread_id');
  if (!Number.isSafeInteger(tailBytes) || tailBytes < 1024 || tailBytes > TAIL_BYTES) return unknown('invalid_scan_budget');
  let handle;
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) return unknown('not_regular_rollout');
    handle = await fs.open(file, 'r');
    const initial = await handle.stat();
    const head = Buffer.alloc(Math.min(initial.size, HEAD_BYTES));
    await handle.read(head, 0, head.length, 0);
    const headLine = head.toString('utf8').split('\n')[0];
    let meta;
    try { meta = JSON.parse(headLine.replace(/^\uFEFF/, '')); } catch { return unknown('unreadable_session_identity'); }
    if (meta.type !== 'session_meta' || meta.payload?.id !== threadId) return unknown('session_identity_mismatch');
    const length = Math.min(initial.size, tailBytes);
    const buffer = Buffer.alloc(length);
    const start = initial.size - length;
    const read = await handle.read(buffer, 0, length, start);
    const lines = buffer.subarray(0, read.bytesRead).toString('utf8').split('\n');
    if (start > 0) lines.shift();
    const unfinished = lines.pop(); // Snapshot may end inside a writer's partial record.
    let skipped = unfinished ? 1 : 0;
    let parsed = 0;
    let context = null;
    let usage = null;
    let compactCount = 0;
    let compactRecent = 0;
    let interrupted = 0;
    const modelHistory = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      if (Buffer.byteLength(line) > LINE_BYTES) { skipped++; usage = null; continue; }
      let record;
      try { record = JSON.parse(line); } catch { skipped++; usage = null; continue; }
      parsed++;
      const p = record.payload;
      if (!p || typeof p !== 'object') continue;
      const timestamp = stamp(record.timestamp);
      if (record.type === 'turn_context') {
        const next = { name: safeModel(p.model), effort: safeEffort(p.effort), recordedAt: timestamp,
          turnId: typeof p.turn_id === 'string' && /^[\w-]{1,80}$/.test(p.turn_id) ? p.turn_id : null };
        // Reset on each context boundary, including an effort/model switch in a turn.
        context = next;
        usage = null;
        modelHistory.push(next);
        if (modelHistory.length > 12) modelHistory.shift();
      } else if (record.type === 'event_msg' && p.type === 'task_started') {
        context = null;
        usage = null;
      } else if (record.type === 'compacted') {
        compactCount++;
        if (timestamp && now - new Date(timestamp) >= 0 && now - new Date(timestamp) <= 15 * 60000) compactRecent++;
        usage = null;
      } else if (record.type === 'event_msg' && p.type === 'turn_aborted') {
        interrupted++; // This can be an intentional stop, not evidence of corruption.
      } else if (record.type === 'event_msg' && p.type === 'token_count') {
        usage = { recordedAt: timestamp, inputTokens: p.info?.last_token_usage?.input_tokens,
          windowTokens: p.info?.model_context_window };
      }
    }
    const age = usage?.recordedAt ? now - new Date(usage.recordedAt) : Infinity;
    const recent = context?.recordedAt && usage?.recordedAt && usage.recordedAt >= context.recordedAt && age >= 0 && age <= 10 * 60000;
    const valid = recent && positive(usage.inputTokens) && positive(usage.windowTokens);
    const modelAge = context?.recordedAt ? now - new Date(context.recordedAt) : Infinity;
    const modelStatus = !context?.name ? 'unknown' : recent || modelAge >= 0 && modelAge <= 10 * 60000 ? 'recent_configuration' : 'stale_configuration';
    const final = await handle.stat();
    if (final.size < initial.size) return unknown('rollout_changed_during_read');
    return {
      status: 'measured', threadId, sampledAt: now.toISOString(),
      logBytes: initial.size, logMB: Number((initial.size / 1e6).toFixed(2)), logMiB: Number((initial.size / 1048576).toFixed(2)),
      logModifiedAt: initial.mtime.toISOString(),
      logFresh: now.getTime() - initial.mtimeMs >= 0 && now.getTime() - initial.mtimeMs <= 10 * 60000,
      model: { name: context?.name ?? null, effort: context?.effort ?? null, status: modelStatus,
        recordedAt: context?.recordedAt ?? null, turnId: context?.turnId ?? null, source: 'turn_context_configuration', backendExecutionVerified: false },
      context: { status: valid ? 'recent_estimate' : 'unknown', percent: valid ? Number((usage.inputTokens / usage.windowTokens * 100).toFixed(1)) : null,
        inputTokens: valid ? usage.inputTokens : null, windowTokens: valid ? usage.windowTokens : null,
        recordedAt: usage?.recordedAt ?? null, ageSeconds: Number.isFinite(age) ? Math.round(age / 1000) : null, source: 'last_input_tokens_not_live_context' },
      compactions: { observed: compactCount, recent: compactRecent, windowMinutes: 15, scope: start ? 'tail_only' : 'full_snapshot' },
      interruptedObserved: interrupted, modelHistory, modelHistoryScope: 'last_12_context_records_in_scan_not_all_workers',
      coverage: { bytesRead: head.length + read.bytesRead, partial: start > 0, skippedRecords: skipped, parsedRecords: parsed,
        fileGrewDuringRead: final.size > initial.size },
    };
  } catch { return unknown('rollout_unavailable'); }
  finally { if (handle) await handle.close(); }
}
