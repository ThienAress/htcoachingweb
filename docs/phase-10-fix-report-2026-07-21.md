# Phase 10 Fix Report - Production Readiness

Date: 2026-07-21
Status: code hardening and repository branch remediation complete; release blocked pending Google credential revocation confirmation, GitHub Support purge and staging evidence

## 1. Kết quả

Phase 10 bổ sung production contract và operational safety mà không chạy migration,
không kết nối dữ liệu thật và không gọi provider mutation:

- production environment validation fail-closed;
- MongoDB ready trước khi server mở port;
- proxy hop explicit, CORS deny không log origin;
- liveness/readiness tách riêng và hỗ trợ draining;
- bounded HTTP lifecycle và graceful shutdown;
- explicit web/worker background-job mode;
- read-only staging security smoke;
- repository runtime/private-data scanner;
- secret scanner nhận diện Google App Password;
- bank transfer configuration chỉ lấy từ environment;
- production cấm AI mock providers;
- Dependabot và read-only GitHub Actions permissions.

## 2. P0 findings cần owner xử lý

### Suspected credential

`current_kb_entries.txt` chứa một dòng khớp định dạng Google App Password.
Giá trị không được đưa vào report/log.

Required action:

1. Revoke credential trong Google Account.
2. Xác định integration đã sử dụng nó.
3. Tạo credential mới trong secret manager nếu còn cần.
4. Sau approval, untrack file và đánh giá Git history cleanup.

Remediation update - 2026-07-22:

- [ ] **Revoke suspected credential:** the account owner must confirm the
  suspected Google App Password was removed in Google Account. Git history
  cleanup does not revoke a credential.
- [x] Delete `current_kb_entries.txt` from the local working tree and Git index.
- [x] Rewrite the file out of `main` and `staging`, then force-push the verified
  clean histories.
- [x] Purge the old blob from local `.git`; reachable path count is zero.
- [x] Confirm the public repository has zero forks.
- [ ] Ask GitHub Support to purge cached views and read-only PR refs `#7`
  through `#18`.

`npm run security:secrets` now passes.

### Tracked runtime uploads

`npm run security:data-boundaries` phát hiện 51 file dưới
`server/uploads` đang được Git track. Nhóm này gồm runtime media và có thể
chứa dữ liệu khách hàng/private health images.

Phase 10 không mở media, không xóa file và không thay đổi Git index. Proposed
action sau approval là untrack nhưng giữ local file, classify dữ liệu và quyết định
history rewrite theo runbook.

Remediation update - 2026-07-22:

- [x] Owner classified all 51 files as unused test data.
- [x] **Untrack 51 upload files** from Git.
- [x] Delete `server/uploads` locally: 51 files, 530.19 MB.
- [x] Rewrite `server/uploads` out of `main` and `staging`, then force-push.
- [x] Purge 14 unique media blobs from local `.git`.
- [x] `npm run security:data-boundaries` passes with zero violations.
- [ ] Ask GitHub Support to purge cached views and all 18 read-only PR refs
  (`#1` through `#18`).

Final clean remote heads:

- `main`: `cef64e95b4b1cf1ac5ecb80f8701373d16c28046`
- `staging`: `269c6d6689b75705557482461a11569222bd58fd`

## 3. Production configuration

File contract: `server/.env.production.example`
Checker: `npm run check:production-readiness`

Startup production sẽ reject:

- MongoDB missing/local/non-TLS;
- JWT/refresh secrets yếu, placeholder hoặc trùng nhau;
- HTTP/wildcard/mismatched origins;
- Google OAuth thiếu cấu hình;
- F1 storage không phải Cloudinary private;
- Cloudinary config thiếu;
- AI provider/image provider là mock hoặc thiếu key;
- consent/admin configuration thiếu.

Checker strict còn yêu cầu ops token, log hash, email provider, bank transfer,
proxy hop và background-job mode. Output không chứa secret values.

Production load `.env.production`, không ưu tiên
`.env.development`. Hosting environment variables vẫn có ưu tiên cao nhất.

## 4. Runtime lifecycle

- Server await MongoDB connection trước `listen`.
- `/api/ops/health/live` kiểm tra process.
- `/api/ops/health/ready` kiểm tra database và draining state.
- Legacy `/api/ops/health` giữ compatibility.
- SIGTERM/SIGINT/fatal error đánh dấu draining, dừng nhận connection mới và đóng
  MongoDB.
- Idle connections đóng ngay; active connections có bounded shutdown.
- Header/request/keep-alive/shutdown timeouts có default và env bounds.
- Max request headers là 100.

Theo tài liệu Express, trust proxy phải khớp topology và trusted proxy cuối phải
overwrite forwarding headers. Theo Node HTTP docs, non-zero header/request timeouts
giúp giới hạn slow-request DoS và close APIs hỗ trợ graceful drain.

## 5. Web và background jobs

`BACKGROUND_JOBS_ENABLED` giữ compatibility default enabled, nhưng strict
readiness yêu cầu explicit:

- web replicas: `false`;
- designated worker: `true`.

Phase 10 chưa chuyển jobs sang external queue và không thay đổi lịch/data policy.

## 6. Bank transfer fail-closed

Hard-coded bank name/code/account/holder đã bị xóa khỏi runtime source. Deposit
creation đọc:

- `BANK_NAME`;
- `BANK_CODE`;
- `BANK_ACCOUNT`;
- `BANK_HOLDER`.

Thiếu một field trả HTTP 503 trước khi tạo wallet hoặc deposit. Integration test
xác nhận không có partial database write.

## 7. Staging security smoke

Workflow manual `.github/workflows/staging-security.yml` chạy trong GitHub
Environment `staging`. Script chỉ gửi anonymous GET, không cookie/token và
không mutation.

Checks:

- health lifecycle;
- HSTS/Helmet/CSP;
- request/trace IDs;
- allowed và denied CORS;
- metrics authentication;
- F1 legacy media 404;
- JSON API 404.

Workflow chưa chạy vì chưa có approved staging URL/environment.

## 8. CI và repository controls

- Main CI có `contents: read` permission.
- Dependabot theo dõi root/client/server npm và GitHub Actions hàng tuần.
- `.gitignore` chặn runtime uploads, private data, DB exports và env profiles.
- Secret scanner phát hiện provider credentials và Google App Password format.
- Data-boundary scanner đếm category, không in private file names/content.

Data-boundary CI gate sẽ chỉ được bật sau khi owner-approved untracking làm scanner
về zero. Secret CI hiện fail đúng chủ đích cho tới khi credential file được xử lý.

## 9. Verification evidence

- Phase 10 targeted tests: 10/10 pass trước full suite.
- Deposit/config targeted tests: 19/19 pass.
- Server Vitest: 25 files, 129/129 pass.
- Client lint: pass.
- Client Vitest: 6 files, 87/87 pass.
- Runtime logging policy: pass.
- Production build: pass.
- Prerender: 20/20 pass.
- Bundle budget: pass.
- Chromium E2E: 45/45 pass.
- Syntax checks cho server/config/smoke scripts: pass.

Known non-code warnings:

- Dynamic sitemap sources không available local nên giữ sitemap 20 routes.
- Third-party Lit/phantom-ui dev warnings vẫn xuất hiện trong E2E.
- Full staging smoke, real production-readiness config và 3-browser current matrix
  chưa chạy.

Expected failing gates:

- Secret scan: 1 suspected credential file.
- Data-boundary scan: 51 tracked runtime uploads.

## 10. Việc không thực hiện

- Không untrack/xóa upload hoặc credential file.
- Không rewrite/force-push Git history.
- Không rotate credential thay owner.
- Không đọc media contents.
- Không chạy migration/verifier trên real/staging DB.
- Không gọi Cloudinary/AI/mail provider thật.
- Không chạy backup/restore, load test hoặc deploy.

## 11. File thay đổi Phase 10

### Root và CI

- `.gitignore`
- `.github/dependabot.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/staging-security.yml`
- `package.json`
- `scripts/check-repository-boundaries.mjs`
- `scripts/check-secrets.mjs`
- `server/check.js` (deleted obsolete debug script)

### Server configuration/runtime

- `server/.env.production.example`
- `server/package.json`
- `server/server.js`
- `server/src/config/db.js`
- `server/src/config/env.js`
- `server/src/config/productionReadiness.js`
- `server/src/config/__tests__/productionReadiness.test.js`
- `server/src/operations/runtimeState.js`
- `server/src/routes/ops.routes.js`
- `server/src/scripts/checkProductionReadiness.js`
- `server/src/scripts/securitySmoke.js`
- `server/src/scripts/__tests__/securitySmoke.test.js`
- `server/src/controllers/__tests__/phase10.production-readiness.integration.test.js`
- `server/src/__tests__/setup.js`

### Fail-closed domain configuration

- `server/src/controllers/deposit.controller.js`
- `server/src/controllers/__tests__/deposit.integration.test.js`
- `server/src/services/ai/providers/index.js`
- `server/src/services/aiImageGenerator.service.js`

### Docs

- `docs/phase-10-production-readiness-runbook.md`
- `docs/phase-10-fix-report-2026-07-21.md`
- `docs/release-checklist.md`

## 12. Exit criteria con thieu

Phase 10 is fully closed only when:

- [ ] The suspected credential is revoked/rotated and confirmed by the account owner.
- [x] Secret scanner reports zero findings.
- [x] The 51 tracked uploads are classified, deleted locally and rewritten out
  of branch history.
- [x] Data-boundary scanner reports zero findings.
- [ ] GitHub Support purges affected PR refs and cached views.
- [ ] Strict production-readiness checker passes in staging.
- [ ] Read-only staging security workflow passes.
- [ ] Full browser matrix, migrations/verifiers, provider checks and restore
  drill pass.
