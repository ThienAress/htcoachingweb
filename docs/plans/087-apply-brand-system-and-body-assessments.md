# Plan 087: Apply brand system and body assessments

## Status

### UI follow-up 2026-09-10 — implemented, focused verified

Second refinement: user requests5 region colours hover/persistent click and
orange brand chart nodes/tooltip following WellnessMetricChart; percent delta
compact `+1%` with subtraction semantics explained. Scope BodySilhouette,
BodyAssessmentReport/History + focused tests; no backend/API change. Verify
Node browser diagnostic hover/click five regions, tooltip/% and mobile; scoped
Vitest/lint/compile/UI gate. Root handles directly because changes are tightly coupled.
Third refinement: all five regions initially neutral grey, no auto-highlight
Fourth refinement: year select in header row (accessible name only, no visible
Năm đo), unit aligned above Y labels, removed selected-point footer and unused
state; point tooltip remains hover/touch/keyboard.27tests/lint/compile/UI gate
PASS, browser tooltip/mobile checked. No release build/backend rerun.
Follow-up preference: user subsequently requested one initial highlighted group;
Report and input form now default to trunk/Bụng (orange), other4 remain grey.
27 component tests PASS; no other selection/hover logic changed.
from default history region; mouse hover transient, click selects one coloured
region. Rebuilt SVG silhouette proportions/hand/torso/leg contours closer to
provided reference without pixel-identical claim. Comparison delta restores kg.
27 focused tests PASS; scoped eslint/compile/UI gate PASS; browser diagnostic
checks initial uniform grey, hover vs clicked state, other4 regions grey,kg and
mobile no overflow. No API/data change or deployment.

User duyệt refinement từ hai screenshot preview: labels Phân bổ cơ nạc/mỡ,
Bụng alias trunk (chú thích giữ đúng semantics), bảng đối chiếu tách hai khung,
fitness silhouette, chart Y ticks/grid, năm + X ngày/tháng, bỏ history accordion.
Root owns Report/Silhouette/shared labels/AssessmentFields/test expectations;
worker ht-implementer Terra medium owns History + focused history tests.
Không thay schema/API/đơn vị hoặc dữ liệu thật. Hai phương án bảng đã xét:
7 cột grouped header hoặc hai bảng4 cột; chọn hai bảng responsive dễ đọc mobile.
Chart vẫn một vùng mỗi lần, thêm nút5 vùng để discover tay/chân rõ hơn.
Verify: focused client tests, scoped lint, compile-only, UI regression rồi
preview1440/390/320 tương tác, missing/single/year/click vùng. Không deploy.
Outcome:25 focused tests PASS, scoped ESLint PASS, Vite compile-only PASS,
UI regression0new PASS. Preview browser diagnostic checks all5 regions,
Y-axis existence, year control, keyboard point detail, removed table, single/
missing and no overflow1440/390/320; root viewed screenshots. No full release
build/server/E2E suite rerun for this presentation-only follow-up. Historical
QA087 evidence is stale after this change; do not reuse for release.

- Priority: P1
- Complexity: COMPLEX
- Effort: L
- Risk: HIGH (dữ liệu sức khỏe, publication, privacy)
- Depends on: 003F, 003H, 060, 062, 065, 086
- Category: migration (additive schema; không migration dữ liệu)
- Planned at: 2026-09-08
- Lifecycle: DONE
- Verification: LOCAL FULL
- Rollout: NOT STARTED
- Owner: root
- Updated at: 2026-09-09

User đã duyệt spec/plan/tasks và no-migration bằng xác nhận `ok` ngày 2026-09-08.
Implementation được chia brand, weekly, assessment backend; root sở hữu frontend
assessment, shared integration và QA. Không có quyền deploy hoặc ghi dữ liệu thật.
Spec: `docs/specs/brand-system-and-body-assessments.md`.

## Why this matters

Một logo dùng mọi nơi không phù hợp navbar/mobile/favicon. WeeklyCheckin chưa có
hông/bụng; kết quả đo HLV cần nguồn published riêng thay vì ghi đè báo cáo khách
hoặc WellnessTarget. Hai phía cần một lịch sử chính xác, không nhìn thấy draft.

## Current state / drift check

HEAD lúc lập plan: `196198a7c661e3c32fac6149a13475b5d30b93b4`.
Worktree dirty do Plan 086 và công việc trước; không coi toàn diff là của 087.
Trước code chạy `git status --short`, `git diff --stat`, đọc in-scope diff.
Nếu file tiếp tục bị agent/task khác ghi, dừng để khóa ownership.

- `client/src/sections/Header/Header.jsx:26`: import `logo.svg`; file đã có diff
  navigation/query access của 086, phải giữ nguyên.
- `client/src/sections/Footer/Footer.jsx:31`: một logo asset, alt cần sửa.
- `client/index.html:17`: favicon PNG/SVG/ICO/Apple/manifest cũ.
- `server/src/models/WeeklyCheckin.js:18`: weightKg, waistCm, bodyFatPercent,
  skeletalMusclePercent; hipCm/abdomenCm chưa có.
- `server/src/services/weeklyCheckinPatch.service.js:4`: BODY_RULES closed allowlist.
- `server/src/services/progressSources.service.js:183`: query và projection chỉ
  bốn số đo; đã thêm self_managed access branch trong diff 086.
- `client/src/pages/progress/ProgressSummary.jsx:15`: ba mục; dùng chung ở
  `TrainerClientOverview.jsx:547` và `ProgressPage.jsx:95`.
- `client/src/pages/trainer/TrainerHealthGoalsSection.jsx:6`: target + habits.
- `server/src/services/todayDashboardPrivacy.service.js:21`: explicit collection
  deletion list; model mới phải tham gia, không để sót khi xóa tài khoản.
- `server/server.js:263`: đăng ký weekly-checkins; route mới cần mount riêng.

Nguồn logo: Desktop `HTCoaching_Brand_Production/HTCoaching_Brand_Production`.
18 SVG preflight sơ bộ đạt, PNG nguồn có alpha hợp lý và hai preview đã xem.
Chỉ nhập asset runtime cần dùng + license; không copy toàn bộ nguồn EPS/PDF vào bundle.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Governance | `npm run agents:validate` | exit 0 |
| Client tests | `npm run test:unit:client` | exit 0 |
| Server tests | `npm run test:unit:server` | exit 0 |
| Lint | `npm run lint --prefix client` | exit 0 |
| Release build | `npm run build --prefix client` | exit 0, đủ lifecycle |
| UI gate | `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high` | exit 0 |
| Secrets | `npm run security:secrets` | exit 0 |
| Boundaries | `npm run security:data-boundaries` | exit 0 |
| E2E | `npm run test:e2e` | exit 0 hoặc SKIP có lý do môi trường |

Build/test do QA sở hữu; không chạy lại build cho từng agent. Focused Vitest
commands được chốt theo test mới mỗi slice. Không cài dependency để vượt blocker
nếu chưa có quyền. Không nâng compile-only thành release PASS.

## Scope / ownership

Sau khi plan được duyệt, chia workstream không chồng file:

### Agent brand

- New: `client/src/components/BrandLogo.jsx`, `client/src/assets/branding/`,
  `client/public/branding/`, `client/public/favicon/ht-v2/`, brand tests.
- Edit: Header, Footer, GlobalLoading, Login, MealPlan/LoginModal,
  `client/index.html`, Home/BlogDetail/CustomerStoryDetail JSON-LD logo.
- Own focused brand verification; không sửa progress/server/docs registry.

### Agent weekly

- Edit: WeeklyCheckin model; weeklyCheckinPatch/Dto/Privacy services,
  `coachingSubmissionFields.js`, notification missing-field label/allowlist
  consumers chỉ khi thực sự dùng field mới; tests tương ứng.
- Edit client: WeeklyCheckinFields, weeklyCheckinForm, WeeklyCheckinCard,
  TrainerWeeklyReview, BodyProgressReport, progressPresentation và tests.
- Provide patch instructions cho root đối với progressSources/progressReadModel
  và validation.js; không trực tiếp sửa hotspot root-owned.

### Agent assessment

- New isolated module family: `server/src/models/BodyAssessment*.js`,
  `server/src/services/bodyAssessment*.service.js`,
  `server/src/controllers/bodyAssessment.controller.js`,
  `server/src/routes/bodyAssessment.routes.js` và focused tests.
- New client service + `client/src/components/body-assessment/` cho form,
  diagrams, comparison/history; tests cùng thư mục.
- Không sửa shared files của root/weekly/brand; gửi integration instructions.

### Root integration/review

- Own `server/server.js`, `server/src/middlewares/validation.js`,
  `server/src/services/progressSources.service.js`, `progressReadModel.service.js`,
  `progress.service.js`, `todayDashboardPrivacy.service.js` và test app registration.
- Own `client/src/pages/progress/ProgressSummary.jsx`, `ProgressPage.jsx`,
  `client/src/pages/trainer/TrainerClientOverview.jsx`, TrainerHealthGoalsSection,
  scoped query cleanup và shared notification integration nếu cần.
- Own `CONTEXT.md`, spec/plan/index/machine state/traceability và QA evidence.
- Scope bổ sung đã trace: notification enum/type config và AuditLog enum cho
  publication/read/delete; dailyJournalRetentionPolicy registry cho deadline;
  e2e/mock-api overview + eligibility fixture, e2e/body-assessment.spec.js;
  existing body-progress/coaching spec supersession notes để tránh drift.
- Phân công thực tế: assessment agent chỉ backend; root form; weekly agent
  tiếp tục report/history và E2E; brand reviewer độc lập backend + rendered form.
- Read all diffs, resolve contracts; reviewer độc lập read-only sau tích hợp.

Các file test mirror được phép trong chính subtree sở hữu. Consumer mới ngoài
list phải có dependency evidence và update plan trước sửa, không refactor tiện tay.

Out of scope: `.env`, production scripts/data, Git write, billing, quotas,
AI Chat, logo hợp đồng/email/OG diện rộng, dashboard rebrand, OCR và upload phiếu.

## Steps

### Step 1: Hiển thị logo đúng vai trò và icon bundle đúng chuẩn

Behavior: desktop wordmark/mobile mark/footer lockup/login mark; favicon/PWA
không mất chi tiết/contrast; Organization logo không dùng OG.
Acceptance: AC-001/002. Depends on: approval; độc lập Step 2/3.
Verify: focused BrandLogo test + generated icon dimension/safe-zone tests;
root lint/release build/UI gate rồi inspect sáng/tối desktop/mobile và tab icon.
Asset generation là chuyển đổi từ vector được cung cấp, không thiết kế lại.

### Step 2: Ghi và xem số đo vòng theo báo cáo tuần

Behavior: thêm hông/bụng optional, group có summary, ratio cùng record;
submit/correction/history/notification thiếu fields giữ semantics.
Acceptance: AC-003. Depends on: approval.
Verify: RED HTTP round-trip hip/abdomen, ratio null/valid, invalid patch,
legacy record, correction, privacy export và client form/history tests; GREEN
minimal implementation; re-trace projections và queries chỉ có hông/bụng.
Mở rộng read model do root tích hợp sau agent gửi patch proposal.

### Step 3: HLV lưu nháp và gửi kết quả đo an toàn tới học viên

Behavior: HLV được phân công lưu draft theo kỳ, publish, sửa và republish;
học viên thấy published cũ trong lúc sửa; không phụ thuộc weekly submit.
Acceptance: AC-004/005/007. Depends on: approval; không phụ thuộc Step 2.
Verify: Supertest + MongoDB in-memory replica set qua HTTP; assert 401/403,
CSRF, wrong client, unknown keys, >100 reference %, null/negative, future date,
CAS concurrent publish, repeated requestId, changed payload, replay khi thu hồi
quyền, partial submission, immutable history và notification retry.
Privacy tests kiểm cả snapshots/receipts/revisions trong export/delete.
Không chạy endpoint privacy trên tài khoản thật.

### Step 4: Hiển thị một kết quả và so sánh cùng nguồn ở hai phía

Behavior: mục mới dưới Sức khỏe trung bình; form HLV trong Mục tiêu sức khỏe;
hai hình desktop, một hình/tab mobile, mode bảng; pair dates + delta + history vùng.
Acceptance: AC-006/008. Depends on: Step 3; root integrate shared shells.
Verify: synthetic UI fixture 0/1/nhiều lần đo, missing từng vùng, ngày sửa khác
ngày đo, device/basis mismatch, published vs draft, range/date selection, logout/
403 cache purge; keyboard/touch, no overflow và unsaved input khi đổi kỳ.
E2E deterministic theo semantic DOM: nhập → lưu nháp → publish → student read →
sửa nháp chưa lộ → republish → comparison; không dùng production auth.

### Step 5: QA, review độc lập và bàn giao

Behavior: chứng minh spec đúng, preserve 086 và không lộ dữ liệu.
Acceptance: mọi AC. Depends on: 1–4.
Chạy canonical client/server/lint/build/UI/security commands ở bảng trên.
Ghi HEAD + exact working-tree fingerprint và exit/test counts. E2E thiếu môi
trường ghi BLOCKED/SKIP, không giả PASS. Không đổi baseline để xanh gate.
Independent reviewer read-only Standards/Spec/Security; root vet và fix findings.
Update plan-state/traceability/evidence; không tuyên bố DONE nếu còn must-have.

## Done criteria

- [x] Approval gate + no-migration được xác nhận.
- [x] Mapping assets/icon QA đầy đủ, không làm mất diff Header 086.
- [x] Weekly optional fields và derived ratio end-to-end/legacy pass.
- [x] Draft/publish/history/replay/ownership/privacy end-to-end pass.
- [x] Hai phía dùng cùng published snapshot; comparison/mobile/keyboard pass.
- [x] QA/review có evidence; không có secret/debug/unused do task tạo ra.
- [x] Không write dữ liệu thật; code mới không tạo auto-migration khi khởi động.
- [x] Có migration index guarded, runtime index check và write flag fail-closed;
  chưa chạy migration trên staging/production.
- [x] Report chỉ rõ check chưa chạy, residual risks và rollout chưa thực hiện.

## Verification outcome — 2026-09-09

Chi tiết: `docs/reports/087-brand-body-assessment-delivery.md`.
Client 163 files/753 tests PASS; server canonical Node22.23.1 236 files/1421
tests PASS, thêm focused progress18 PASS sau test bổ sung; full E2E112 PASS.
Final release build exit0, bundle/search-index gate PASS; public-content prefetch
timeout dùng fallback hiện hữu. Full lint exit0 (một warning cũ ngoài scope).
UI gate 0 new blocking; secret/data-boundary/governance/diff checks PASS.
Windows Playwright teardown treo sau112 ca đạt; root xác minh và dừng đúng2
helper test, runner trả exit0. Không sửa test assertion hoặc skip để lấy PASS.
Build-generated sitemap date-only diff đã phục hồi bằng patch về bản trước task.
Không commit/push/deploy/migration hoặc ghi dữ liệu production.

## STOP conditions / migration decision

- Approval/no-migration đã được xác nhận; hỏi lại nếu cần đổi phạm vi dữ liệu.
- Cần ghi lại giá trị eo cũ, tự gán ngày đo/model máy hoặc thay quyền truy cập.
- Hai agent/task cùng sửa hotspot hoặc drift không reconcile được an toàn.
- Không có transaction/atomic publication và persisted replay proof trong tests.
- Designer asset không đạt small-size/safe-zone: sửa chuyển đổi/padding trong
  scope; không tự vẽ lại biểu tượng khác hoặc dùng PNG nền trắng.
- Cùng verification fail ba vòng có căn cứ: báo blocker, không bỏ test.

Không có backfill: hip/abdomen cũ là missing/null; nguồn BodyAssessment bắt đầu
rỗng. Migration index guarded đã được thêm sau release review nhưng chưa chạy;
mọi apply staging/production cần target, backup và approval theo runbook. Không
seed hoặc backfill.

## Maintenance notes

Giữ nguồn artwork + license tối thiểu để tái xuất icon. Không dùng % reference
như body-fat %. Thêm vùng hoặc thiết bị mới phải cập nhật schema/validation,
DTO/privacy, comparison semantics và fixtures cùng lúc. Không biến pending
notification thành publish failure giả khi snapshot đã committed.
