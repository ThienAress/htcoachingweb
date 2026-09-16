# Plan 086: Chuẩn hóa email khách hàng và Dashboard tự quản lý

> **Hướng dẫn thực thi**: TDD theo từng vertical slice. Không chạy migration/backfill, không ghi
> production và không đổi Auth/Payment/Wallet. Server phải gate entitlement trước UI.

## Status

- **Priority**: P0
- **Complexity**: COMPLEX
- **Effort**: XL
- **Risk**: HIGH
- **Depends on**: 003H, 006, 023, 052A, 060, 062, 065, 068, 075, 076
- **Category**: notifications | contracts | entitlements | dashboard | UX | AI chat
- **Planned at**: 2026-09-08
- **Lifecycle**: DONE
- **Verification**: FOCUSED
- **Rollout**: NOT_STARTED
- **Owner**: root
- **Updated at**: 2026-09-08

## Why This Matters

Preference email hiện thiếu check-in và có phản hồi lưu gây hiểu nhầm; Dashboard lại đang đồng
nhất khách coaching với người tự quản lý HT Fitness+. Plan này gom quyền ở backend, làm rõ consent
và tách hoàn toàn luồng HLV khỏi Fitness+-only.

## Scope

**In scope**: preference check-in + eligibility; contract consent/auto opt-in; status locale;
dashboard access mode; self-managed journal/weekly/progress; conditional navigation/copy; hash
pricing scroll; AI marker hover; canonical Save/Update rule; tests/docs.

**Out of scope**: email order/contract chờ ký, pricing/quota/cost HT Fitness+, Auth/CSRF/JWT,
payment/wallet, production migration/data/deploy và refactor file lớn ngoài vùng thay đổi.

## Steps

### Step 1: Khóa spec, traceability và test email contract

Viết test đỏ cho preference DTO/validation/eligibility, check-in delivery và contract signing.
Thêm `checkinEmail`, backend eligibility fail closed và transaction consent opt-in.

**Verify**: notification, check-in và handwritten contract focused server tests.

### Step 2: Hoàn thiện Email thông báo trong Tài khoản

Viết test state machine; đổi copy/tab; render hai checkbox; implement `Lưu → read-only → Cập nhật`,
toast input trống và disabled eligibility. Sửa locale status hợp đồng.

**Verify**: NotificationPreferences, Account navigation và ContractsTab focused client tests.

### Step 3: Mở access mode self-managed ở backend

Mở rộng Today Dashboard eligibility bằng policy resolver. Journal/weekly write access nhận coaching
hoặc Fitness+; chỉ coaching tạo HLV notification. Gate progress và đọc draft theo đúng access mode.

**Verify**: Today Dashboard, journal, weekly, progress entitlement/service tests.

### Step 4: Tách trải nghiệm Fitness+-only ở frontend

Ẩn Training nav/module; bỏ submit/report/comment/timeline HLV khỏi Nutrition/Journal/Weekly ở
`self_managed`; giữ tự lưu và biểu đồ. Header chọn nhãn theo prompt eligibility contract.

**Verify**: dashboard layout/day/nutrition/journal/progress/header/navigation focused tests.

### Step 5: Chuẩn hóa navigation và interaction

Làm `ScrollRestoration` hash-aware cho mọi `/#pricing`; marker câu hỏi nở bằng hover/focus riêng.
Thêm rule form explicit-save canonical, không nhân bản policy trong skill.

**Verify**: hash scroll, motion/navigation source tests và `npm run agents:validate`.

### Step 6: QA, review và bàn giao

Chạy focused rồi full suites phù hợp, lint/build, UI regression, AI check, security scans và diff
review. Chỉ cập nhật lifecycle/evidence theo kết quả thật.

**Verify**: traceability commands, `git diff --check`, review + cleanup.

## Done Criteria

- [x] Email check-in default-off, eligibility server-side và delivery đúng opt-in.
- [x] Account email form đúng Lưu/Cập nhật, copy mới và disabled khi không có coaching.
- [x] Consent hợp đồng mới auto-opt-in atomic; legacy/custom clause không bị bật.
- [x] Contract status hiển thị tiếng Việt.
- [x] Dashboard phân biệt coaching/self-managed/blocked; Fitness+-only không có luồng HLV.
- [x] Self-managed data tạo tiến trình; blocked user không đọc/ghi được.
- [x] Pricing hash scroll và AI marker hover hoạt động, accessible/reduced-motion.
- [x] Rule explicit-save được validate; QA/review evidence được ghi lại.

## Verification Evidence

- `npm run test:unit:client` — PASS, 157 files / 704 tests.
- `npx vite build` trong `client/` — PASS compile-only; warning chunk size hiện hữu không chặn build.
- Focused server Vitest cho notification, contract, check-in, Today, journal, habits, weekly,
  progress, access policy và performance — PASS, 10 files / 101 tests.
- `npm run lint --prefix client` — PASS với 0 errors; còn 1 warning có sẵn ngoài scope tại
  `TrainerTransferPanel.jsx:91`.
- Focused pricing navigation — PASS, 1 file / 1 test; các focused client test trước đó cho
  notification, contract status, Dashboard, progress, hash scroll và AI motion đều PASS.
- UI regression gate — PASS, 0 finding high-confidence mới; 32 finding baseline được resolve.
- AI tool validator — PASS, 11/11 tools và không có orphan.
- Secret scan, repository data-boundary scan, agent validation và `git diff --check` — PASS.
- Release lifecycle `npm run build --prefix client` — BLOCKED ở prerender do thiếu
  `VITE_API_URL` và network/API/Google Fonts không khả dụng; Vite compile và bundle budget đã pass,
  nhưng không ghi release build PASS.
- Canonical full server runner — BLOCKED trước test vì máy đang dùng Node `24.15.0`, trong khi repo
  pin Node `22.23.1`; focused runner trực tiếp ở trên đã pass.
- E2E — SKIP vì không có dev servers cùng auth fixtures cô lập trong phiên này.

Schema preference chỉ thêm field optional theo dữ liệu cũ với default `false`; không cần migration
hoặc backfill. Rollout/deploy và mọi ghi dữ liệu production vẫn chưa bắt đầu.

## STOP Conditions

- Cần đổi payment/quota thương mại, production data/migration/deploy hoặc consent pháp lý khác câu
  đã duyệt trong request.
- Schema thực tế bắt buộc trainer ID không nullable hoặc cần backfill production.
- Entitlement canonical không thể phân biệt active coaching và Fitness+ mà không đổi Auth contract.
