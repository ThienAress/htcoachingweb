# Plan 081: Redesign Wallet deposit and Trainer profile safely

> **Hướng dẫn thực thi**: Follow từng step, giữ backend/ledger là nguồn sự thật và
> chạy verification đã ghi trước khi chuyển bước. Không deploy hoặc ghi dữ liệu thật.
>
> **Drift check**: `git diff --` toàn bộ file in-scope phải trống trước khi agent sửa;
> nếu có thay đổi mới từ task khác trong cùng file thì dừng workstream đó để root tích hợp.

## Status

- **Priority**: P0/P1
- **Complexity**: COMPLEX
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: 002, 018, 029, 051
- **Category**: feature
- **Planned at**: 2026-09-05
- **Lifecycle**: DONE
- **Verification**: LOCAL FULL
- **Rollout**: NOT STARTED
- **Owner**: root
- **Updated at**: 2026-09-05

## Why This Matters

Wallet hiện có policy min/max server-authoritative nhưng chưa có bonus và giao diện
khó đọc; thêm thưởng sai lớp có thể làm wallet ledger, SePay settlement hoặc reversal
sai tiền. Profile HLV đã có dữ liệu và SEO tốt nhưng presentation chưa đạt thiết kế
đã duyệt. Plan này hoàn tất hai hành vi độc lập, giữ compatibility dữ liệu cũ và gom
release local mà không chạm production đang được triển khai bởi task khác.

## Current State

- `server/src/constants/depositPolicy.js` giữ min 5.000đ/max 100 triệu cố định.
- `server/src/controllers/deposit.controller.js` tạo `DepositRequest.amount` và QR,
  chưa snapshot bonus.
- `server/src/services/bankTransactionSettlement.service.js` cộng incoming amount;
  manual approval/reversal cũng đang dùng `deposit.amount`.
- `client/src/pages/wallet/MyWallet.jsx` là dark UI và nhập tiền trong modal.
- `client/src/pages/admin/DepositManagement.jsx` chưa có policy editor.
- `client/src/pages/TrainerProfile.jsx` đã giữ content, i18n, SEO, customer stories và
  hỗ trợ `previewData`, nhưng chỉ có một presentation hiện tại.
- `client/src/pages/admin/TrainerProfileEditor.jsx` đã có live preview; không cần upload
  file thiết kế hoặc đổi Trainer schema cho layout HT Signature.

Canonical product contract nằm tại
`docs/specs/wallet-deposit-bonus-and-trainer-profile-redesign.md`. Contract SePay và
append-only ledger tiếp tục theo `docs/specs/automatic-wallet-deposit-settlement.md`.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Wallet server focused | `npm run test:unit:server -- deposit` | exit 0 |
| Wallet client focused | `npm run test:unit:client -- depositPolicy` | exit 0 |
| Client unit | `npm run test:unit:client` | exit 0 |
| Server unit | `npm run test:unit:server` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Client build | `$env:SKIP_DYNAMIC_ROUTES='true'; npm run build --prefix client` | exit 0 |
| UI regression | `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high` | no new high |
| Secrets | `npm run security:secrets` | exit 0 |
| Data boundaries | `npm run security:data-boundaries` | exit 0 |
| Agent rules | `npm run agents:validate` | exit 0 |
| Diff hygiene | `git diff --check` | no output |

## Scope

### In scope

- Dedicated deposit policy model/service/controllers/routes and audit entry.
- Additive DepositRequest bonus snapshots with legacy fallback; no backfill.
- Manual/automatic settlement, incoming review approval, reversal, summaries and
  reconciliation updated to reason about transfer amount versus credited amount.
- Wallet policy/client helpers, user Wallet UI, Admin policy editor, i18n and tests.
- Trainer Profile presentation and small extracted section components/tests.
- Spec, plan, traceability and verification evidence updates.

### Out of scope

- Deploy/restart, production/staging writes, migration/backfill or SePay configuration.
- Changing fixed thresholds/max amount, wallet purchase/refund behavior or provider.
- Dynamic upload/execution of Figma/HTML/JavaScript or multiple Trainer templates.
- Changing Trainer content/model/public route/SEO contract.

## Steps

### Step 1: Snapshot a server-authoritative tier reward on every new invoice

Add a singleton policy with default rates, public read and protected Admin update.
Resolve the highest eligible tier on the server and persist bonus fields/version when
creating DepositRequest. Legacy records continue to resolve as 0% without migration.

**Behavior**: Policy defaults and Admin changes produce deterministic snapshots; an
existing invoice never changes when rates change.

**Blast radius**: deposit policy constant/model/service/controller/routes,
DepositRequest, create/read DTO, AuditLog and focused tests.

**Depends on**: none.

**Verify**: focused policy and deposit create integration tests pass.

### Step 2: Credit and reverse the frozen credited amount without breaking SePay

Use the deposit snapshot for exact-match auto settlement and legacy manual approval.
Store enough settlement metadata for incoming credits to assert/reverse the original
ledger amount. Preserve actual-amount/no-bonus behavior for mismatch review and update
summary/reconciliation expectations with legacy fallback.

**Behavior**: Exact 200.000đ at 20% credits 240.000đ once; retry is idempotent; reversal
subtracts 240.000đ; mismatched manual incoming credits only actual bank amount. Hai
incoming thật cùng amount đều nhận snapshot bonus; đảo một giao dịch không đảo giao
dịch còn lại và chỉ đảo giao dịch cuối mới chuyển deposit sang `reversed`.

**Blast radius**: admin deposit controller, settlement/incoming helpers/services,
DepositRequest/IncomingBankTransaction read model where required, reconciliation and
financial integration tests.

**Depends on**: Step 1.

**Verify**: focused deposit, SePay settlement, reversal and reconciliation tests pass.

### Step 3: Ship the light Wallet flow and editable Admin bonus cards

Extend the client policy normalizer/services/query invalidation. Rebuild MyWallet as a
light, direct invoice form with three auto-selected cards, bonus preview, accessible QR
modal and history breakdown. Add three Admin rate cards and a single atomic save flow.

**Behavior**: Customer understands transfer/bonus/credited amounts before and after
submit; Admin update refreshes policy and clearly applies only to new invoices.

**Blast radius**: client wallet/admin services, policy helper/tests, MyWallet,
DepositManagement, i18n and presentation tests.

**Depends on**: Steps 1–2.

**Verify**: focused client tests, client lint and build pass.

### Step 4: Apply HT Signature presentation to the existing Trainer content

Refactor presentation into small sections. Use sample 3 for hero/methodology/profile
language and sample 1 for customer transformation storytelling. Keep every conditional
section, CTA, translation, structured data and `previewData` path; add no sample claims.

**Behavior**: Published and Admin-preview profiles render the same real content in the
new responsive design; absent data stays absent.

**Blast radius**: TrainerProfile and extracted presentation components/tests only.

**Depends on**: none; may execute independently of Steps 1–3.

**Verify**: focused client tests, client lint, build and UI regression gate pass.

### Step 5: Integrate, review and close local release evidence

Review cross-layer contracts, run focused suites first and expand to release gates.
Update plan/traceability lifecycle only with actual results. Do not deploy.

**Behavior**: One local working tree contains both approved UI changes with financial
invariants intact and machine-readable verification evidence.

**Blast radius**: tests/evidence/docs; no production configuration.

**Depends on**: Steps 1–4.

**Verify**: commands in Test Plan and `git diff --check`.

## Test Plan

- Server policy unit: boundaries, rate validation, highest eligible tier, integer bonus.
- API integration: auth/role/CSRF, atomic rate update, policy version, snapshot immutability.
- Financial integration: auto/manual exact credit, mismatch no bonus, idempotency,
  reversal, multiple incoming transactions and legacy deposits.
- Client unit: normalize extended policy, select tier and preview values.
- Trainer presentation: no hardcoded sample identity/claims and conditional sections.
- Full client/server unit only after focused tests pass; then lint/build/UI/security gates.

## Done Criteria

- [x] All success criteria in the canonical spec have implementation and tests.
- [x] No existing DepositRequest requires migration/backfill.
- [x] Wallet ledger/reversal/reconciliation agree on credited amount.
- [x] Wallet and Trainer UI are responsive with loading/empty/error/disabled/focus states.
- [x] No sample content, runtime HTML import, debug log or hardcoded secret is added.
- [x] Focused tests, client lint/build, UI/security/agent/diff gates have recorded results.
- [x] `docs/plans/README.md`, plan state and traceability match actual lifecycle.
- [x] Rollout remains NOT STARTED; no deploy/restart or production write occurred.

## Verification Evidence

Chạy local ngày 2026-09-05 trên `HEAD 833ed32f75d9126a7afa6da3f29aaf0f634447af`
với working tree dirty do nhiều plan đang cùng tồn tại; review và chỉnh sửa chỉ giới hạn
trong surface Plan 081.

- Focused client: 3 files, 19 tests pass; targeted ESLint pass.
- Focused server: 6 files, 63 tests pass.
- Full client unit: 147 files, 660 tests pass.
- Full server unit/integration với 2 workers: 452 suites, 1.160 tests pass.
- Client lint: exit 0, còn một warning React Hook Form tại
  `TrainerTransferPanel.jsx` ngoài phạm vi Plan 081.
- Client release command: exit 0; Vite compile và bundle budget pass. Do local không có
  `VITE_API_URL` và outbound Google Fonts bị chặn, prerender static-only skip 9/9 route;
  artifact này không dùng để deploy production.
- UI regression gate: exit 0, không có high-confidence blocking finding; một advisory
  tại `EmailNotificationsTab.jsx` ngoài phạm vi.
- Secret scan, repository data boundary và `git diff --check`: pass.
- Agent traceability của Plan 081: pass. Full `agents:validate` còn fail vì generated
  `project-inventory.json` stale do thay đổi governance/product surface của các task khác;
  không cập nhật snapshot ngoài phạm vi trong task này.
- E2E: SKIP vì không có local API, test account và bank settlement fixture đang chạy.
  Residual risk là chưa có browser E2E cho customer Wallet/Admin policy flow.
- Code review ba trục Standards, Spec/Contract và Security/Operations: không còn finding
  in-scope; các guard legacy, idempotency, reversal và multi-credit đã có regression tests.
- Không chạy migration/backfill, không ghi staging/production và không deploy/restart.

### Follow-up UI refinement ngày 2026-09-05

- Bổ sung hướng dẫn nạp ví 5 bước theo đúng flow hiện có: chọn bậc, nhập tiền, tạo hóa
  đơn, quét QR/chuyển đúng thông tin và chờ hệ thống đối soát cộng ví. Không thêm cam kết
  SLA không tồn tại trong contract.
- Đổi nhận diện và primary actions sang brand token `--color-primary: #ff5500`; giữ
  emerald cho thưởng/credited/success và cyan cho trạng thái reversal để màu vẫn đúng
  ngữ nghĩa tài chính.
- Re-run full client unit 147 files/660 tests, client lint, UI regression gate và client
  release build: exit 0. Browser sạch chuyển `/wallet` về `/login`, nên review render có
  xác thực vẫn cần smoke test bằng phiên người dùng trước rollout.

## STOP Conditions

- An in-scope file gains overlapping edits from the active production task.
- Bonus requires mutating or deleting an existing ledger entry.
- Existing SePay contract cannot distinguish transfer amount from credited amount safely.
- A legacy deposit would receive retroactive bonus without an explicit snapshot.
- Trainer redesign requires copying sample content or adding unsupported fake data.
- Focused verification fails three rounds for the same root cause.

## Maintenance Notes

- Future threshold/min/max editing is a separate financial policy change with explicit
  compatibility and abuse review.
- Future Figma designs must be converted into reviewed React presets; never execute an
  uploaded document as runtime code.
- Reviewer should scrutinize exact-match versus mismatch bonus, ledger reversal amount,
  policy versioning and legacy fallback before any rollout.
