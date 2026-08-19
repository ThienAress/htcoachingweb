# Plan 056: Isolate Skill Radar và harden production recovery/monitoring

> Triển khai code theo fail-closed contract. Không bật worker, mua hạ tầng,
> upload backup hay restore production khi chưa có phê duyệt target/chi phí riêng.

## Status

- **Priority**: P0 → P1
- **Effort**: L
- **Risk**: HIGH (production operations)
- **Depends on**: Plan 053
- **Category**: reliability | operations | disaster recovery
- **Planned at**: 2026-08-16
- **Current status**: IN PROGRESS

## Why This Matters

Production hiện có release backup đã restore-test nhưng chưa recover được
ngoài workstation, Atlas M0 không có cloud backup/PITR, Skill Radar đang
chung lifecycle với các cron có thể mutation, và Render Free có thể spin down
sau 15 phút idle. Monitor run `31925606642` đã timeout ở API liveness trong
khi protected monitor ngay sau đó pass. Sau rollout đầu, run `31932200989`
lại gặp `fetch failed` ở client bootstrap trong khi protected monitor vẫn pass.
Vì vậy smoke cần cả cold-start budget riêng và bounded retry cho mọi read-only
surface mà không che lỗi kéo dài.

## Scope

**In scope**:

- Tách Skill Radar thành process entrypoint riêng, fail closed khi thiếu flag/token.
- Loại Skill Radar khỏi global web cron lifecycle và graceful shutdown.
- Thêm cold-start timeout budget chỉ cho health probe đầu tiên; retry vẫn bounded.
- Cập nhật runbook off-device recovery, PITR decision và cost boundary.
- QA, deploy code-only an toàn, manual smoke và quan sát issue #56.

**Approval/target required**:

- Upload archive/key ra off-device destination và restore drill từ bản sao đó.
- Upgrade Atlas lên tier hỗ trợ cloud backup/PITR.
- Upgrade Render hoặc tạo paid Background Worker.
- Bật Skill Radar worker, vì first tick có thể ghi snapshot Radar production.
- Mọi production delete, restore, cleanup, backfill hoặc SePay operation.

## Steps

### Step 1: Worker isolation contract

Viết regression test cho config fail-closed và lifecycle idempotent. Tạo
`worker:skill-radar` entrypoint chỉ connect Mongo, start/stop Radar cron và disconnect;
web server không import/start/stop Radar cron nữa.

**Verify**: focused Vitest pass; source-boundary test chứng minh web process không sở
hữu Radar cron.

### Step 2: Monitor cold-start regression

Ghi test cho timeout policy: attempt đầu của health probe có budget 90 giây,
các attempt sau quay lại 30 giây; tổng retry vẫn bị giới hạn. Client,
manifest, OAuth, Blog, Recipe, detail và sitemap read-only checks đều dùng cùng
bounded retry. Không nới timeout mặc định toàn bộ monitoring library.

**Evidence**: run `31925606642` timeout `api liveness` lúc 30 giây; run
`31932200989` fail transient client fetch; protected metrics pass trong cả hai job.

### Step 3: DR/PITR readiness

Giữ `offDeviceRecoveryVerified=false` và
`continuousRecoveryAvailable=false` cho tới khi có evidence thật. Runbook phải yêu
cầu archive mã hóa ở destination khác workstation, key custody độc lập và
isolated restore từ chính off-device copy.

### Step 4: Render decision và release

Deploy code-only trước. Không dùng synthetic keep-alive để giả vờ loại
cold start. Paid instance là phương án triệt để; chỉ thay instance type
sau khi owner duyệt exact monthly cost. Sau deploy chạy smoke/protected monitor và
quan sát tối thiểu 30 phút trước khi close issue #56.

## Test Plan

- Focused worker config/lifecycle tests.
- Production monitoring unit tests, bao gồm cold-start timeout policy.
- Server suite và ops suite.
- Secret scan, data-boundary scan, agent validation và `git diff --check`.
- Read-only manual production smoke/monitor sau deploy.

## Done Criteria

- [ ] Web process không còn start/stop Skill Radar cron.
- [ ] Worker entrypoint fail closed nếu thiếu explicit enable flag/token.
- [ ] Cold-start/public probes có bounded retry phù hợp và persistent failure vẫn fail.
- [ ] DR manifest không khai khống off-device/PITR readiness.
- [ ] Code-only release pass QA và production read-only observation.
- [ ] Issue #56 chỉ close sau manual recovery evidence và owner criteria.

## STOP Conditions

- Cần payment, billing confirmation, destination upload hoặc key custodian chưa chỉ định.
- Cần ghi/xóa/restore production data hoặc bật Radar first tick.
- Thay đổi có thể che persistent outage hoặc làm monitor pass giả.
- Focused verification fail ba vòng sau evidence-based fixes.
