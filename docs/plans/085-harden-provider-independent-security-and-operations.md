# Plan 085: Harden bảo mật và vận hành không phụ thuộc provider

> **Hướng dẫn thực thi**: Làm TDD theo từng step. Không gọi provider live, chạy migration/restore,
> thay production evidence hay bật backup. Giữ nguyên các thay đổi Wallet/Admin đang có của user.

## Status

- **Priority**: P0
- **Complexity**: COMPLEX
- **Effort**: XL
- **Risk**: HIGH
- **Depends on**: 023, 024A, 053A, 056, 066, 074, 082
- **Category**: security | privacy | recovery | observability | dependencies
- **Planned at**: 2026-09-06
- **Lifecycle**: DONE
- **Verification**: PRODUCTION
- **Rollout**: LIVE
- **Owner**: root
- **Updated at**: 2026-09-07

## Why This Matters

Bảy finding có thể được harden trong code ngay cả khi HTCOACHING vẫn dùng các gói miễn phí. Chúng
chặn implicit consent, dependency có advisory, migration dựa vào chuỗi evidence tự khai, restore
không chứng minh PDF GridFS, Cloudinary backup dễ giữ residual version và thiếu usage signals cho
Auth/provider.

## Scope

**In scope**: Meal Scan opt-in; `fast-uri` lock; shared backup-bound migration guard; GridFS/PDF
restore verifier; Cloudinary backup privacy gate; Auth cutover counters; Gemini/Resend/Cloudinary/
SePay/Netlify usage units; spec/runbook/traceability/tests.

**Out of scope**: provider live API/dashboard, billing price, production data, backup/restore drill,
migration/backfill, schema change, deploy và các file Wallet/Admin đang do user sở hữu.

## Steps

### Step 1: Enforce Meal Scan consent và vá dependency

Viết test đỏ cho service/dialog, chuyển consent thành checkbox per-request default-off và truyền
boolean qua service. Pin dependency override 3.x patched, refresh lock bằng npm local và xác minh tree.

**Verify**: Meal Scan client tests; `npm ls fast-uri ajv --prefix server --omit=dev`.

### Step 2: Bind migration guard với current backup manifest

Mở rộng shared guard để production apply bắt canonical manifest, exact backup ID và freshness;
refactor hai helper riêng hiện có về shared seam và truyền manifest vào toàn bộ migration entrypoint.

**Verify**: migration safety và migration index tests; source scan không còn backup helper drift.

### Step 3: Tạo GridFS/PDF restore verifier read-only

Tạo module verifier dependency-injected và CLI chỉ kết nối target được operator truyền; kiểm file,
chunks, PDF signature và SHA-256. Cập nhật backup runbook để gate này bắt buộc trước khi ghi evidence.

**Verify**: synthetic verifier tests và CLI contract test; không kết nối database thật.

### Step 4: Khóa Cloudinary backup-version privacy lifecycle

Tạo policy deterministic cho media classes, thêm production-readiness gate fail closed và cập nhật
retention/runbook. Không implement live purge hay bật backup.

**Verify**: policy/readiness tests chứng minh sensitive classes luôn blocked và active delete không
được coi là backup purge.

### Step 5: Instrument Auth và provider usage

Thêm bounded metric registry và counters tại Auth, Gemini Chat/Meal Scan, Resend delivery seam,
Cloudinary upload/delete seams, SePay provider call và Netlify build batching. Không thêm labels động.

**Verify**: focused metrics/Auth/provider tests, Prometheus snapshot và no-sensitive-log assertions.

### Step 6: Cross-check AI, security, QA và handoff

Chạy AI check, focused/full QA phù hợp, dependency/security/data-boundary/agent validations và diff
review. Cập nhật lifecycle/evidence theo kết quả thật; không đổi rollout thành deployed.

**Verify**: commands trong traceability manifest cùng `git diff --check`.

## Done Criteria

- [x] Consent Meal Scan default-off và không thể gửi nếu chưa opt in.
- [x] `fast-uri` resolve bản 3.x đã vá.
- [x] Production migrations bind exact fresh canonical backup evidence.
- [x] Restore verifier kiểm toàn bộ GridFS/PDF invariants.
- [x] Cloudinary sensitive backup versions bị policy/readiness block.
- [x] Auth và năm provider có bounded usage counters, test và runbook.
- [x] AI/security/QA/governance checks phản ánh evidence thật; implementation phase
  không chạm provider/production và rollout sau đó đi qua Plan 084.

## Verification Evidence

- Server full suite: `npm run test:unit:server` — PASS, 218 files / 1.252 tests. Vitest phải
  SIGKILL một worker sau khi đã báo toàn bộ test pass; command kết thúc exit 0.
- Client Meal Scan focused: 3 files / 9 tests PASS. Full client suite trước vòng chốt đạt
  671/672; một failure thuộc `TrainerProfilePresentation.test.jsx` đang được thay đổi ngoài Plan 085.
- Cloudinary focused sau review: 6 files / 35 tests PASS, gồm avatar upload seam fail closed.
- Client compile-only Vite build PASS; lint PASS với một warning cũ ở `TrainerTransferPanel.jsx`.
  Release build không pass: sitemap/Vite hoàn tất nhưng prerender thiếu `VITE_API_URL`; các sitemap
  do build sinh ngoài scope đã được phục hồi. E2E không chạy vì không có dev/test environment phù hợp.
- `npm run security:audit --prefix server`, secret scan, repository boundary, docs privacy,
  `npm run agents:validate`, governance tests, AI tool validation, dependency tree và
  `git diff --check` đều PASS. Governance có một test symlink SKIP do Windows Developer Mode.
- Review độc lập không còn finding Medium/High. Residual Low: GridFS verifier dùng RAM theo tổng
  PDF; restore drill phải STOP nếu không đủ memory headroom và nâng sang cursor/streaming trước.
- Candidate `b510a0753637c8cdbe47980423f31d397a7842ec` pass staging acceptance,
  production promotion/observation và production smoke 11/11. Backup release,
  disaster-recovery verification và Recovery Readiness run `34122279148` đều pass.
- Các gate phải trả phí hoặc cần external-state riêng vẫn chủ động hoãn: Atlas PITR,
  global Cloudinary backup và provider paid features. Việc này không phủ định rollout
  của code fail-closed/readiness/observability hiện đã live.

## STOP Conditions

- Cần credential, provider API/dashboard, production data/write hoặc owner/legal quyết định retention.
- Dependency update buộc major ngoài 3.x hay tạo breaking tree.
- Verifier cần in private bytes/metadata hoặc không thể chứng minh target cô lập.
- Thay đổi đụng Auth cookie/token semantics, entitlement quota, schema hay file user đang sửa.

## Maintenance Notes

- Process-local counters là tín hiệu usage ngắn hạn; khi scale nhiều instance phải scrape/aggregate
  ngoài process trước khi dùng cho billing alert.
- GridFS verifier hiện dùng snapshot arrays để giữ CLI/test deterministic; dataset lớn phải dùng
  cursor/streaming trước restore drill nếu không đủ memory headroom.
- Backup readiness chỉ được cập nhật sau restore drill thật; code xanh không tạo recovery point mới.
- Cloudinary active delete và backup-version purge là hai evidence độc lập.
- Global Cloudinary backup luôn fail readiness cho tới khi đủ upload inventory, public opt-in và
  avatar active-delete lifecycle; không bật dashboard backup chỉ vì public canary đã pass.
