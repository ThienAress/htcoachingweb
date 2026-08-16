# Plan 052: Harden AI evals, tool boundaries và scale readiness

> **Hướng dẫn thực thi**: chạy P0 theo từng behavior slice và dừng nếu checkpoint P0 local không đạt. Chỉ sau đó mới
> đọc skills schema/quota và triển khai P1. Không chạy migration, deploy, backup/restore hoặc ghi production.
>
> **Drift check**: baseline `staging@4a5897a`. Trước mỗi checkpoint chạy `git status --short`, `git diff --stat` và
> trace lại symbols. Nếu remote/local hoặc các contract trọng yếu đã đổi, dừng để reconcile.

## Status

- **Priority**: P0 → P1
- **Effort**: XL
- **Risk**: HIGH
- **Depends on**: 020, 031, 033, 038, 046
- **Category**: security + reliability + tests + infrastructure
- **Planned at**: 2026-08-13
- **Approval**: APPROVED — owner yêu cầu làm P0, khi pass tiếp tục P1
- **Implementation**: LOCAL COMPLETE / EXTERNAL ROLLOUT PENDING

## Why This Matters

HT Assistant đã có nhiều guard tốt nhưng chưa có một eval release gate canonical và tool output vẫn quay lại model dưới
dạng text không mang trust metadata. Hệ thống quota/rate limit hiện an toàn cho một process nhưng chưa phải shared
commercial usage contract khi scale. Recovery gate đã đúng nhưng evidence off-device/PITR vẫn thiếu; plan giữ fail-closed
thay vì tạo cảm giác DR đã sẵn sàng.

## Current State

- `server/src/controllers/ai.controller.js:475-529` thực thi tool và đưa `safeToolText` trực tiếp về model/history.
- `server/src/services/ai/tools/toolEngine.js:76-190` enforce auth/schema/timeout nhưng chưa chuẩn hóa model envelope.
- `server/src/services/ai/tools/searchKnowledge.tool.js:72-85` ghép grounding URL/title từ provider vào Markdown.
- `server/src/middlewares/aiRateLimit.js:27-105` dùng `express-rate-limit` memory store theo process.
- `server/src/services/ai/aiLogger.js` có metadata-safe log nhưng chưa có prompt contract fingerprint.
- `scripts/lib/backup-readiness.mjs` đã phân biệt release và disaster readiness; manifest hiện thiếu off-device/PITR.
- Không có `test:ai-eval` canonical trong root `package.json` hoặc CI.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| AI eval | `npm run test:ai-eval` | exit 0, toàn corpus pass |
| AI focused | `cd server && npx vitest run <files>` | exit 0 |
| Tool registry | `node .agents/scripts/validate-tools.mjs` | 11 tools, 0 warning |
| Ops | `npm run test:ops` | exit 0 |
| Backup audit | `npm run audit:backup-readiness` | exit 0, truthful status |
| DR gate | `npm run verify:disaster-recovery` | exit 1 cho tới khi external evidence đủ |
| QA | `npm run test:unit` | exit 0 |
| Release build | `npm run build --prefix client` | exit 0 khi env đầy đủ |

## Scope

**In scope**:

- AI eval corpus/runner/tests và CI/release wiring.
- Tool-result normalization, provider grounding URL normalization và regressions.
- DR runbook/gate documentation only; không tạo backup thật.
- P1 shared usage model/service/middleware/tests, prompt telemetry, parallel-safe execution và confirmation framework.
- Specs/plans/runbooks liên quan trực tiếp.

**Out of scope**:

- Provider/model migration, prompt copy từ vendor, multi-agent planner.
- Thay đổi quota số lượng/tier/giá hiện tại.
- Production migration/index apply, deploy, backup/restore, off-device upload hoặc PITR purchase/config.
- Mutating business tool thực tế.

## Steps

### Step 1: Tạo deterministic AI eval release gate

Tạo corpus versioned và runner offline fail-closed. Đánh giá các public seams hiện có: prompt/data boundary, guest tool
exposure, schema/cost bounds, medical guardrail và hostile reference handling. Wire command vào CI và release checklist.

**Behavior**: một command duy nhất phát hiện corpus drift hoặc guard bị xóa mà không gọi provider/network.

**Verify**: test runner/corpus, `npm run test:ai-eval`, `npm run agents:validate`.

### Step 2: Chuẩn hóa untrusted tool-result envelope

Thêm boundary module cho text/model envelope, áp dụng cả current turn và history replay. Normalize Google grounding
sources thành HTTPS-only bounded links. Giữ SSE/UI/history response backward-compatible.

**Behavior**: hostile tool result vẫn hiển thị như data nhưng không được model xem như instruction; unsafe URL bị loại.

**Verify**: focused boundary/tool/provider/controller tests + tool validator.

### Step 3: Re-validate disaster recovery without fabricating evidence

Cập nhật runbook/checklist với off-device/key/PITR procedure và chạy audit/DR modes. P0 local đạt khi tests/audit pass và
DR gate fail đúng blockers thật.

**Behavior**: release operator nhận output phân biệt release backup với disaster recovery và biết bước external kế tiếp.

**Verify**: `npm run test:ops`, audit exit 0, DR gate expected exit 1 với blocker codes đã biết.

### Step 4: P0 checkpoint

Chạy AI eval, focused/full server nếu cần, ops, secrets/data boundaries, agent validation và diff review. Nếu lỗi contract
P0 còn tồn tại, không mở Step 5.

### Step 5: Thêm shared usage ledger server-authoritative

Sau khi đọc `$service-access-policy` và `$schema-change`, thêm additive TTL bucket, atomic consumption service và nối vào
AI Chat/Meal Scan mà không đổi limit hiện tại. Giữ abuse limiter riêng, guest key pseudonymous và fail closed khi ledger
không available cho operation tốn phí.

**Verify**: schema/index, concurrent consumption, tier/guest/user, reset window, failure contract và route integrations.

### Step 6: Thêm prompt contract telemetry

Tạo canonical prompt contract version/fingerprint từ stable instruction source và ghi metadata vào AI logs/metrics; không
log prompt/runtime context.

**Verify**: deterministic hash/version tests và logger redaction tests.

### Step 7: Parallel hóa tool calls read-only an toàn

Registry khai báo capability; controller/runner chỉ chạy song song calls độc lập `readOnly && parallelSafe`, giữ output
order và abort/deadline. Calls khác tiếp tục tuần tự.

**Verify**: concurrency timing/order, auth/schema, abort và mixed read/write/confirmation tests.

### Step 8: Hoàn thiện confirmation challenge framework

Thêm challenge owner-scoped, TTL, one-time replay protection và API/CSRF contract; client card render/confirm/cancel.
Không đăng ký business mutation tool trong plan này.

**Verify**: HTTP ownership/CSRF/expiry/replay tests, client interaction/accessibility tests và build.

### Step 9: P1 integration, review và cleanup

Re-trace quota/tool/prompt consumers, chạy code review, QA, cleanup-delivery và cập nhật evidence/status. Báo riêng
external DR/migration/deploy blockers.

## Test Plan

- Corpus contract: schema, duplicate/unknown evaluator, positive/negative adversarial scenarios.
- Tool boundary: hostile instructions, delimiter, oversized text, unknown tool, history replay, unsafe grounding URLs.
- Usage: atomic threshold, concurrent requests, window reset, guest HMAC, tier consistency, DB failure.
- Prompt telemetry: stable same-version hash, no prompt/user data in log payload.
- Parallel tools: wall-clock overlap, deterministic result order, abort, one failing call, non-parallel fallback.
- Confirmation: auth, owner isolation, CSRF, tamper, expiry, replay và cancel.

## Done Criteria

- [x] P0 eval/tool/ops/security gates pass; DR external state được phản ánh đúng.
- [x] P1 shared usage/prompt/parallel/confirmation contracts pass focused và full applicable tests.
- [x] Client release build pass hoặc blocker môi trường được ghi đúng, không nâng thành PASS.
- [x] Không có migration/deploy/production write/secret.
- [x] `git diff --check`, agent validator và cleanup pass.
- [x] Plan/index/evidence được cập nhật theo kết quả thật.

## Local Verification Evidence — 2026-08-13

- Baseline: `staging@4a5897a`; local và `origin/staging` không ahead/behind tại thời điểm khóa implementation.
- P0/P1 focused: server `13 files / 68 tests`, client `3 files / 17 tests`, tool validator `11 tools / 0 warnings`,
  deterministic eval `9/9`.
- Full QA sau review cuối: server `148 files / 732 tests`, client `84 files / 419 tests`, Chromium E2E `79/79`,
  client lint PASS. AI confirmation E2E targeted riêng cũng PASS `3/3`.
- Release build: Vite PASS, prerender `785/785`, bundle budget PASS. Ba navigation wait warning vẫn tạo output và command
  kết thúc exit `0`; generated sitemap được khôi phục về baseline vì không thuộc scope.
- Operations/security: ops `26/26`, secret scan, repository data boundaries, commercial contracts, runtime logging,
  agent validator và `git diff --check` đều PASS.
- Backup release gate PASS với evidence hiện có. Disaster-recovery gate expected exit `1` vì
  `OFF_DEVICE_RECOVERY_UNVERIFIED`; continuous/PITR recovery vẫn unavailable.
- Không chạy preflight/apply index trên staging/production, không deploy, migration, backup/restore hoặc production write.
  Full server lần đầu bị ổ C thiếu disk cho MongoMemoryServer; rerun với test-only `TEMP/TMP` trên ổ D đã PASS đầy đủ.

## STOP Conditions

- Remote staging khác baseline trước khi implementation có thể reconcile.
- Shared quota cần đổi limit/tier semantics hoặc hai nguồn canonical cùng ghi mà không xác định được owner.
- Cần production index/migration, backup/restore, credential hoặc external paid service.
- Confirmation framework buộc mở mutating business tool ngoài scope.
- Cùng một verification fail ba vòng sau các sửa có evidence.

## Maintenance Notes

- Eval gate offline là regression/security contract, không thay thế benchmark live model định kỳ.
- Abuse throttle và commercial usage là hai lớp khác nhau.
- Prompt fingerprint là observability identifier, không phải secret/security boundary.
- Chỉ parallelize tool được capability registry cho phép; default là tuần tự.
