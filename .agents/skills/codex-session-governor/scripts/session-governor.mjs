import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findRollout, inspectRollout } from './session-telemetry.mjs';

export function recommendModel(task = 'implementation', risk = 'medium', complexity = 'moderate', traits = {}) {
  if (!['lookup', 'mechanical', 'implementation', 'planning', 'debugging', 'security'].includes(task) ||
      !['low', 'medium', 'high', 'critical'].includes(risk) || !['simple', 'moderate', 'complex'].includes(complexity)) throw new Error('invalid_routing_input');
  const { precision = 'normal', ambiguity = 'normal', verifiability = 'high' } = traits;
  if (!['normal', 'high'].includes(precision) || !['normal', 'high'].includes(ambiguity) || !['low', 'high'].includes(verifiability)) throw new Error('invalid_routing_traits');
  const demanding = complexity === 'complex' && (precision === 'high' || ambiguity === 'high' || verifiability === 'low' || risk === 'high');
  let model = 'gpt-5.6-terra', effort = 'medium';
  if (task === 'security' || risk === 'critical') { model = 'gpt-6-astra'; effort = complexity === 'complex' ? 'xhigh' : 'high'; }
  else if (demanding) { model = 'gpt-6-astra'; effort = 'xhigh'; }
  else if (precision === 'high' || ambiguity === 'high' || verifiability === 'low') { model = 'gpt-5.6-sol'; effort = 'high'; }
  else if (risk === 'high' || ['planning', 'debugging'].includes(task) || complexity === 'complex') { model = 'gpt-5.6-sol'; effort = complexity === 'complex' ? 'xhigh' : 'high'; }
  else if (['lookup', 'mechanical'].includes(task) && risk === 'low' && complexity === 'simple') { model = 'gpt-5.6-luna'; effort = task === 'lookup' ? 'low' : 'medium'; }
  return { model, effort, advisoryOnly: true };
}

export function healthDecision(telemetry, symptom = 'none') {
  if (!['none', 'history-broken', 'resume-failed'].includes(symptom)) throw new Error('invalid_symptom');
  const pct = telemetry.context?.percent;
  const logMB = telemetry.totalLogMB ?? telemetry.logMB;
  const reasons = [];
  if (symptom !== 'none') reasons.push(symptom);
  if (logMB >= 200) reasons.push('large_log_local_heuristic');
  if (pct != null && pct >= 85) reasons.push('high_recent_context_estimate');
  if (reasons.length) return { action: 'new_task', reasons, policy: 'local_heuristic_not_openai_limit' };
  if (logMB >= 50) reasons.push('growing_log_local_heuristic');
  if (pct != null && pct >= 70) reasons.push('elevated_recent_context_estimate');
  if (telemetry.compactions?.recent >= 3) reasons.push('recent_compaction_cluster');
  const action = reasons.length ? 'checkpoint' : telemetry.logFresh === false || pct == null || !telemetry.model?.name && telemetry.status === 'measured' ? 'unknown' : 'continue';
  return { action, reasons, policy: 'local_heuristic_not_openai_limit' };
}

export function footer(telemetry, symptom = 'none') {
  const decision = healthDecision(telemetry, symptom);
  const label = { continue: 'có thể tiếp tục', checkpoint: 'nên checkpoint', new_task: 'nên chuyển task mới sau checkpoint', unknown: 'chưa đủ số liệu để kết luận' }[decision.action];
  const model = telemetry.model?.name ? `${telemetry.model.name}/${telemetry.model.effort || '?'}${telemetry.model.status === 'stale_configuration' ? ' (metadata cũ)' : ''}` : 'không xác định';
  const total = telemetry.totalLogMB ?? telemetry.logMB;
  const size = total == null ? 'không xác định' : `${total.toFixed(2)} MB log${telemetry.verifiedSegments > 1 ? `/${telemetry.verifiedSegments} phần` : ''}${telemetry.logFresh === false ? ' (nguồn cũ)' : ''}`;
  const ctx = telemetry.context?.percent == null ? '?' : `~${telemetry.context.percent}%`;
  const at = telemetry.sampledAt ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(telemetry.sampledAt)) : '?';
  return `Phiên [đo ${at}]: ${size} | ctx gần nhất ${ctx} | model ghi nhận: ${model} | ${label}.`;
}

async function main() {
  const args = process.argv.slice(2);
  const options = {};
  const values = new Set(['--thread-id', '--rollout', '--codex-home', '--task-type', '--risk', '--complexity', '--symptom', '--precision', '--ambiguity', '--verifiability']);
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === '--footer') options.footer = true;
    else if (values.has(key) && args[index + 1] && !args[index + 1].startsWith('--')) options[key.slice(2)] = args[++index];
    else throw new Error('invalid_cli_option');
  }
  const threadId = options['thread-id'] || process.env.CODEX_THREAD_ID;
  const home = options['codex-home'] || process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const located = options.rollout ? { status: 'located', path: path.resolve(options.rollout) } : await findRollout(threadId, home);
  const telemetry = located.status === 'located' ? await inspectRollout(located.path, threadId) : located;
  if (telemetry.status === 'measured' && located.totalLogBytes != null) {
    telemetry.verifiedSegments = located.verifiedSegments;
    telemetry.totalLogBytes = located.totalLogBytes - located.selectedLogBytes + telemetry.logBytes;
    telemetry.totalLogMB = Number((telemetry.totalLogBytes / 1e6).toFixed(2));
    telemetry.selection = located.selection;
  }
  const recommendation = options['task-type'] ? recommendModel(options['task-type'], options.risk, options.complexity, { precision: options.precision, ambiguity: options.ambiguity, verifiability: options.verifiability }) : null;
  if (options.footer) process.stdout.write(footer(telemetry, options.symptom) + '\n');
  else process.stdout.write(JSON.stringify({ ...telemetry, decision: healthDecision(telemetry, options.symptom), recommended: recommendation }) + '\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { process.stdout.write(JSON.stringify({ status: 'unknown', reason: 'governor_command_failed' }) + '\n'); process.exitCode = 1; });
}
