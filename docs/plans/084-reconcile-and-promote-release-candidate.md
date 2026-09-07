# Plan 084: Đối soát và promotion release candidate an toàn

> **Hướng dẫn thực thi**: Thực hiện tuần tự. Mọi gate phải tham chiếu cùng exact SHA; nếu gặp STOP
> condition thì dừng rollout, không bỏ qua staging và không đổi SKIP thành PASS.
>
> **Drift check (chạy đầu tiên)**: ghi nhận branch/HEAD, `origin/staging`, toàn bộ tracked/untracked
> change và các task gần đây. Nếu còn file không ánh xạ được tới Plan 077–084 thì STOP trước commit.

## Status

- **Priority**: P0
- **Complexity**: COMPLEX
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: 077, 078, 079, 080, 081, 082, 082A, 083
- **Category**: release | security | tests | operations
- **Planned at**: 2026-09-05
- **Lifecycle**: IN PROGRESS
- **Verification**: NONE
- **Rollout**: NOT STARTED
- **Owner**: root
- **Updated at**: 2026-09-07

## Why This Matters

Working tree hiện chứa nhiều thay đổi cross-layer từ nhiều task, trong khi branch local tách khỏi
`origin/staging`. Dùng bằng chứng QA cũ hoặc deploy trực tiếp sẽ không chứng minh được đúng artifact
đã kiểm tra. Plan này khóa provenance, tích hợp trên staging mới nhất, tạo evidence mới và giữ staging
là gate bắt buộc trước production.

## Current State

- Branch hiện tại `codex/product-security-features-20260901`, HEAD `833ed32f75d9126a7afa6da3f29aaf0f634447af`.
- Snapshot ban đầu: `origin/staging` có 24 commit phía trước merge-base và branch hiện tại có một commit
  riêng; working tree chứa Plans 077–083 cùng product/ops changes.
- Plan 078 còn ghi `IN PROGRESS` dù focused evidence đã pass; phải reconcile trạng thái trước candidate.
- `.codex-worktrees/` là working area ngoài candidate và phải bị loại khỏi Git index.
- Canonical rollout: `.agents/rules/workflow/release-promotion.md` và
  `docs/operations/runbooks/release-promotion.md`.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Git/provenance | `git status --short --branch` | mọi file có owner/scope |
| Agent governance | `npm run agents:validate` | exit 0 |
| Security | `npm run security:secrets && npm run security:data-boundaries && npm run security:docs-privacy` | exit 0 |
| Client QA | `npm run test:unit:client && npm run lint --prefix client && npm run build --prefix client` | exit 0 |
| Server QA | `npm run test:unit:server` | exit 0 |
| E2E | `npm run test:e2e` | exit 0 |
| Recovery | `npm run audit:backup-readiness && npm run verify:backup-release` | exit 0 |
| Diff hygiene | `git diff --check` | exit 0 |

## Scope

**In scope**:

- Xác minh provenance và hoàn tất lifecycle còn lệch của Plans 077–083.
- Tích hợp toàn bộ thay đổi đã chấp thuận lên nền `origin/staging` mới nhất trong branch release riêng.
- Sửa tối thiểu conflict/regression trực tiếp do tích hợp, kèm test.
- Local QA, CI, staging deploy/acceptance, production gate/deploy/observation theo runbook.
- Spec, Plan 084, plan index/state/traceability và release evidence liên quan.

**Out of scope**:

- `.codex-worktrees/`, credential, database dump, artifact tạm hoặc thay đổi từ task chưa xác định.
- Feature/refactor mới không trực tiếp chặn candidate.
- Migration/backfill production, thay đổi provider plan hoặc phá branch protection.

## Steps

### Step 1: Khóa provenance và candidate content

Đọc task `Đánh giá On-khá và cập nhật rules` cùng các task gần đây; map tracked/untracked files sang
Plans 077–083, loại working area và ghi rõ external state đã thay đổi.

**Behavior**: có danh sách candidate đầy đủ, không lẫn file tạm/secret hay thay đổi đã deploy cũ.

**Blast radius**: Git metadata read-only và lifecycle docs 077–084.

**Depends on**: none.

**Verify**: `git status --short --branch` và `npm run agents:validate` → exit 0 sau reconcile.

### Step 2: Tạo branch candidate trên staging mới nhất và review tích hợp

Bảo toàn patch local bằng commit có phạm vi, tạo worktree/branch release từ exact `origin/staging`,
cherry-pick patch và giải quyết conflict bằng spec/rule canonical. Đọc toàn diff cuối trên nền staging.

**Behavior**: candidate chứa lịch sử staging mới nhất cộng đúng phần chưa deploy, không conflict marker.

**Blast radius**: toàn bộ file candidate; chỉ sửa thêm file khi conflict/regression trực tiếp yêu cầu.

**Depends on**: Step 1.

**Verify**: `git merge-base --is-ancestor origin/staging HEAD` và `git diff --check` → exit 0.

### Step 3: Tạo QA và recovery evidence mới trên exact candidate

Chạy focused tests theo traceability rồi full client/server, lint, release build, E2E, SEO/UI,
governance, security/privacy/data-boundary, incident/ops và backup/recovery gates. Fix tối đa ba vòng
theo root cause; sau mỗi code change phải làm mới evidence liên quan.

**Behavior**: một candidate fingerprint có đủ evidence release, không tái sử dụng số liệu task cũ.

**Blast radius**: test/build artifacts local; source chỉ đổi khi sửa regression có bằng chứng.

**Depends on**: Step 2.

**Verify**: mọi command trong Commands You Will Need cùng focused traceability gates → exit 0.

### Step 4: Deploy và nghiệm thu staging exact SHA

Push branch candidate, tạo/merge PR vào staging theo branch protection, chờ CI và hai provider deploy
cùng exact SHA. Trigger staging acceptance bằng deploy IDs/CI URL/rollback IDs đúng contract; cleanup
residue phải bằng 0. Kiểm tra UI và smoke Auth/Wallet/Profile/SEO trên staging.

**Behavior**: staging đã chạy đúng artifact được QA và không để lại dữ liệu test.

**Blast radius**: GitHub, Netlify staging, Render staging và exact DB `htcoaching_staging`.

**Depends on**: Step 3.

**Verify**: CI + provider identity + `staging-acceptance` artifact đều PASS cho cùng SHA.

### Step 5: Promotion production và quan sát 30 phút

Chỉ sau staging PASS, chạy protected production approval gate và deploy exact SHA. Thực hiện cutover
Auth theo Plan 082/082A; production observation chỉ GET/HEAD tối thiểu 30 phút rồi chạy post-deploy gate.
Render Free phải dùng legacy-compatible bridge và exact-SHA Auth probe window đã rehearsal; suspend trong
build không hợp lệ vì staging đã chứng minh thao tác đó hủy deploy.

**Behavior**: production KEEP đúng candidate hoặc rollback theo exact compatible IDs khi gate fail.

**Blast radius**: GitHub main/protected environment, Netlify/Render production; không DB mutation.

**Depends on**: Step 4.

**Verify**: production provider identity, monitor window và post-deploy artifact → PASS cùng SHA.

## Test Plan

- Governance/traceability: validator, inventory, eval, Radar và docs privacy.
- SEO/nutrition: cohort, sitemap, prerender, unit normalization và migration dry-run tests.
- Wallet: policy boundaries, snapshot immutability, exact/mismatch settlement, reversal/idempotency.
- Auth: concurrent refresh, replay family revocation, absolute expiry, logout CSRF/cookie clearing.
- Incident: Worker transitions/outbox và Draft PR schema/forbidden patch scope.
- UI: Wallet/Profile responsive states; deterministic Playwright E2E và live staging smoke.

## Done Criteria

- [ ] Mọi file candidate có provenance; `.codex-worktrees/` và secret không nằm trong commit.
- [ ] Plan 078 cùng Plans 077–083 phản ánh lifecycle/evidence thật.
- [ ] Candidate chứa exact `origin/staging` mới nhất và không conflict/hygiene issue.
- [ ] Local full QA, release build, E2E, security/governance/ops và recovery gates pass.
- [ ] CI, Netlify staging và Render staging cùng exact SHA.
- [ ] Staging acceptance pass, cleanup residue bằng 0 và smoke critical flows pass.
- [ ] Protected production gate pass; exact SHA được deploy và quan sát read-only tối thiểu 30 phút.
- [ ] Plan/index/state/traceability được cập nhật với evidence và rollout cuối.

## STOP Conditions

- Còn file không xác định provenance/owner hoặc candidate vô tình chứa `.codex-worktrees/`/secret.
- Không thể tích hợp `origin/staging` mà phải bỏ một invariant Auth/Wallet/SEO/security đã duyệt.
- Cùng một release gate fail ba vòng sau sửa có căn cứ.
- CI/provider SHA lệch, staging acceptance residue khác 0 hoặc live test chạm sai database.
- Backup/recovery evidence hết hạn, production rollback ID không tương thích Plan 082 hoặc thiếu approval.
- Production monitor fail; dừng promotion/KEEP và theo rollback runbook.

## Maintenance Notes

- Số test từ task cũ chỉ dùng làm provenance, không dùng làm release evidence.
- Plan 082 yêu cầu drain/restart Auth đồng bộ; không rollback backend về binary pre-082.
- Plan 080 Worker external state phải được verify riêng; repository deployment không mặc nhiên chứng minh
  Worker secret/webhook hiện còn đúng.
