# Plan 066: Harden promotion release và live acceptance staging

> **Hướng dẫn thực thi**: triển khai theo từng behavior slice, chạy RED → GREEN
> trước khi chuyển bước. Production chỉ đọc; staging mutation chỉ được chạy khi
> exact database lock và cleanup verifier đã pass.

## Status

- **Priority**: P0
- **Effort**: L
- **Risk**: HIGH — release infrastructure, staging data mutation, production monitoring
- **Depends on**: 053A, 055, 056, 065
- **Category**: operations / tests / security / observability
- **Planned at**: 2026-08-24
- **Status**: IMPLEMENTED / LOCAL + LIVE STAGING ACCEPTANCE VERIFIED — DEPLOY WORKFLOWS PENDING

## Why This Matters

CI hiện kiểm tra code tốt nhưng chưa tạo một chain-of-custody bắt buộc từ SHA
qua deploy staging, acceptance, recovery evidence và quan sát production. Live
acceptance để lại một số record tổng hợp; HTTP alert dùng lifetime counter nên
có thể báo đỏ lâu sau khi sự cố kết thúc. Plan này biến năm nâng cấp đã duyệt
thành gate fail-closed có evidence theo từng release.

## Current State

- `server/src/config/stagingOperationSafety.js` đã khóa `APP_ENV=staging`, exact
  database và confirmation variable.
- `server/src/scripts/stagingAcceptance.js` chạy flow thật nhưng chỉ gọi
  `cleanupFailedRun()` trong `catch`; Booking, Deposit và ledger có thể còn sau
  success, không có residue verifier.
- `.github/workflows/staging-security.yml` chỉ chạy health/security read-only.
- `server/src/observability/metrics.js` giữ bounded samples nhưng không có time
  window; `http_5xx` active khi lifetime `http.errors > 0`.
- `.github/workflows/production-monitor.yml` đã read-only và lưu artifact 8 ngày.
- `scripts/lib/backup-readiness.mjs` đã kiểm archive/isolated restore/off-device;
  PITR hiện không có và chỉ là warning trung thực.
- `.agents/skills/pre-deploy` và `.agents/skills/ship` chưa bắt release manifest,
  staging cleanup proof hoặc post-deploy observation.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Staging safety | `npm run test:unit:server -- src/config/__tests__/stagingOperationSafety.test.js` | exit 0 |
| Metrics | `npm run test:unit:server -- src/observability/__tests__/metrics.test.js` | exit 0 |
| Operations contracts | `npm run test:ops` | exit 0 |
| Agent contracts | `npm run agents:validate` | exit 0 |
| Secrets/boundaries | `npm run security:secrets` và `npm run security:data-boundaries` | exit 0 |
| Authorized live acceptance | `npm run acceptance:staging --prefix server` với staging env/confirmation | exit 0 và residue 0 |

## Scope

**In scope**:

- Staging acceptance safety/cleanup modules, focused tests và package commands.
- Staging post-deploy acceptance workflow và secret-free artifacts.
- Release evidence validator/generator, tests, template và promotion gate workflow.
- Rolling observability/production monitor contracts và focused tests.
- Recovery gate integration, release runbook/checklist.
- Canonical release rule, `pre-deploy`, `ship`, workflow map và validator-compatible docs.

**Out of scope**:

- Product UI/API/schema, migration/backfill, seed/cleanup customer data.
- Git commit/push/merge hoặc deploy.
- Production mutation, production acceptance write hoặc database restore.
- PITR/paid service, canary, Kubernetes và container registry rollout.

## Steps

### Step 1: Khóa và dọn mọi live staging acceptance run

Viết RED tests cho production denial, canonical marker và cleanup verifier. Tách
registry theo run, đăng ký mọi ID/state baseline; chạy cleanup trong `finally` và
fail nếu còn record hoặc fixture state lệch baseline.

**Behavior**: success/failure đều kết thúc bằng `cleanupVerified=true`, residue 0;
production target bị chặn trước connect/request.

**Verify**: focused staging safety/cleanup tests pass.

### Step 2: Tạo release candidate evidence và staging workflow

Viết RED Node tests cho closed schema, exact SHA/deploy identities, CI/acceptance
status, cleanup proof, rollback targets và backup linkage. Thêm CLI/workflow tạo
artifact theo release; missing/unknown ID fail-closed.

**Behavior**: một candidate artifact đủ tự chứa để reviewer biết code nào đã CI,
deploy staging, acceptance và có thể rollback về đâu.

**Verify**: release evidence tests và workflow source contract pass.

### Step 3: Chuyển monitor sang rolling operational signals

Viết RED clock-based tests cho 5 phút, 5xx rate/P95/heap và expiry. Mở rộng
Prometheus/snapshot; production monitor đọc readiness và provider endpoint,
không thêm method mutating.

**Behavior**: lỗi cũ tự rời cửa sổ; sustained current error/latency/heap/provider
issue mới kích hoạt gate và artifact chứa đủ signal điều tra.

**Verify**: metrics tests và `scripts/production-monitoring.test.mjs` pass.

### Step 4: Ghép recovery và post-deploy observation vào promotion gate

Gate manual nhận manifest đúng SHA, bắt cả release + off-device recovery current,
rollback target và environment approval. Post-deploy mode bắt deploy IDs/SHA cùng
candidate, monitor evidence và observation timestamps; không tự deploy.

**Behavior**: stale backup, missing off-device copy, mismatched SHA/deploy hoặc
thiếu observation đều NO-GO; PITR false chỉ được mô tả đúng, không nâng thành PASS.

**Verify**: operations contract suite pass với các negative cases.

### Step 5: Canonical hóa workflow và chạy acceptance đã được phép

Thêm một canonical release-promotion rule/runbook rồi liên kết từ `pre-deploy`,
`ship`, workflow map/checklist. Chạy agent validator/security gates. Sau khi local
safeguards xanh, chạy live acceptance vào `htcoaching_staging`, giữ artifact và
xác minh residue 0; không truy cập production bằng mutation.

**Behavior**: lần release sau tự động gặp cùng gate, không phụ thuộc trí nhớ chat.

**Verify**: agent validator, security scans, focused/full operations QA và live
staging acceptance đều có evidence chính xác.

## Test Plan

- Staging: exact DB, encoded DB name, production origin, missing confirmation,
  marker format, tracked-ID cleanup, baseline restore, forced failure residue.
- Release: invalid field, short SHA, SHA mismatch, unknown deploy ID, stale CI,
  cleanup false/nonzero, missing rollback, backup ID mismatch, invalid observation.
- Metrics: inside/outside window, low sample threshold, sustained 5xx, P95,
  heap ratio, rolling counter expiry và bounded memory.
- Monitor: Prometheus parse, readiness/provider normalization và GET-only source
  contract.
- Agent system: skill links/commands/frontmatter và canonical workflow drift.

## Done Criteria

- [x] Các success criteria có thể kiểm chứng local trong spec đạt.
- [x] Live acceptance chỉ ghi `htcoaching_staging` và cleanup verifier báo 0.
- [x] Không production mutation, deploy, migration, schema hoặc paid service.
- [x] Release candidate/post-deploy artifacts fail-closed và secret-free.
- [x] Monitoring rolling signals có regression tests.
- [x] `pre-deploy`/`ship`/rule/runbook/validator đồng nhất.
- [x] Verification evidence thật được ghi vào plan và README status được cập nhật.

## Verification Evidence

- TDD RED được xác nhận cho cleanup orchestration module, rolling metrics và
  release-evidence module trước implementation.
- Focused server: staging operation/safety + metrics `14/14` pass.
- Operations contracts: `52/52` pass, gồm backup/recovery, deployment identity,
  release manifest, workflow boundary, monitoring, Docker và source backup.
- `npm run agents:validate`: 29 skills, 6 rule files, 0 warning/error.
- Secret scan, repository data-boundary scan, Node syntax, YAML parse và
  `git diff --check`: pass.
- Recovery tại thời điểm verify: backup
  `production-logical-backup-20260823T173906Z`, age `15.41h`, release +
  off-device disaster recovery ready; PITR/continuous recovery vẫn unavailable.
- Live staging acceptance qua Doppler config `htcoaching-server/stg`: target
  probe xác nhận exact database `htcoaching_staging` và approved staging API.
  Run `91c7569b-1171-4d63-ac93-82c1227f30f0` pass `8/8` flows; cleanup xác minh
  `residue=0` cho blog, recipe/bookmark, check-in/order baseline, coaching,
  schedule/command/claim, booking, deposit/ledger/audit và wallet fixture state.
- Staging có một finding ví tồn tại trước run và không tăng sau run:
  `SUBSCRIPTION_LEDGER_CARDINALITY` (`baseline=1`, `delta=0`). Regression test
  buộc acceptance chỉ tính issue mới do run tạo ra, không che finding baseline.

## STOP Conditions

- Staging URI không resolve chính xác `htcoaching_staging` hoặc fixture không
  thể cô lập khỏi dữ liệu người dùng.
- Cleanup không thể chứng minh residue 0 sau tối đa ba vòng sửa có căn cứ.
- Hoàn thành cần production write/deploy, migration hoặc secret mới chưa được cấu hình.
- Recovery gate yêu cầu trả phí/PITR; defer và báo đúng blocker thay vì bật dịch vụ.

## Maintenance Notes

- Release manifest là evidence theo release, không phải file snapshot chung để
  sửa tay và tái dùng.
- Lifetime counters phục vụ tương thích/forensics; alert quyết định release phải
  dùng rolling window.
- Một artifact cleanup `verified=false` hoặc thiếu deploy ID luôn là NO-GO.
