# Plan 046: Ổn định nền tảng, AI Memory có kiểm soát và motion discipline

> **Hướng dẫn thực thi**: chạy tuần tự từng phase. Chỉ chuyển phase khi code, focused tests và gate của phase hiện tại
> đạt. Không tự chạy backup/restore, migration/backfill, deploy hoặc bất kỳ thao tác ghi dữ liệu production nào.
>
> **Drift check**: trước mỗi phase chạy `git status --short`, kiểm tra lại consumer bằng `rg` và cập nhật plan nếu
> contract/file đã thay đổi kể từ 2026-08-11.

## Status

- **Priority**: P0/P1
- **Effort**: XL — nhiều workstream, bắt buộc chia phase tuần tự
- **Risk**: HIGH — recovery, release evidence, AI prompt/data boundary, dữ liệu hội thoại nhạy cảm và UI toàn site
- **Depends on**: 017, 020, 030, 031, 035, 038, 040
- **Category**: reliability + security + AI feature pilot + UI quality + tests
- **Planned at**: 2026-08-11
- **Approval**: APPROVED — owner đã duyệt toàn bộ ba đầu mục và yêu cầu làm tuần tự theo test gate
- **Implementation**: LOCAL VERIFIED — toàn bộ Phase 1–6 đã đạt local gate; production readiness vẫn BLOCKED

## Mục tiêu

1. Biến các rủi ro “vibe coding” còn lại thành guard, test và runbook có thể kiểm chứng.
2. Học kiến trúc từ TencentDB Agent Memory nhưng chỉ triển khai pilot explicit memory tối thiểu, owner-controlled.
3. Học motion discipline từ `emilkowalski/skills`, giữ stack hiện tại và pilot trên ChatWidget trước khi mở rộng.

## Quyết định đã chốt

1. Không nhập toàn bộ TencentDB Agent Memory, không tạo persona/L3 memory tự động và không thay provider/vector stack.
2. Personal memory tách khỏi Knowledge Base; guest không có long-term memory; authenticated user phải opt-in rõ ràng.
3. Memory phải có provenance, ownership, sửa/xóa, TTL, conflict lifecycle, context budget và golden evaluations.
4. Không lưu secret, payment, OTP hoặc raw health payload vào memory; mọi field nhạy cảm phải fail closed.
5. Không cài/copy nguyên bộ animation repo, không chuyển GSAP/CSS sang Motion/Sonner/Base UI.
6. Motion pilot dùng explicit properties, token duration/easing, interruptibility, pointer-hover gate và reduced motion.
7. Backup production thật, restore drill thật, migration/backfill và rollout cần target/credential/approval riêng.

## Current State

- Production có logical backup gần nhất được ghi nhận ngày 2026-07-24; không continuous và recovery key phụ thuộc cùng
  OS user. Repository chưa có machine-readable freshness/off-device recovery gate.
- Full server Vitest từng không kết thúc trong 120 giây và 300 giây dù focused suites pass.
- Knowledge Base được đưa vào system prompt như verified context nhưng chưa có untrusted-data instruction boundary tương
  đương page context; một số AI endpoints trả raw `err.message`.
- Production monitor dẫn sai rollback runbook và workflow auto-close issue trái với close criteria trong runbook.
- ChatWidget có animation chính chưa tôn trọng `prefers-reduced-motion`; codebase có nhiều `transition-all` nhưng không
  rewrite cơ học toàn bộ trong plan này.
- Conversation memory hiện tại chỉ là working context trong phiên; chưa có long-term explicit memory contract.

## Phạm vi và thứ tự thực thi

### Phase 1 — Recovery safeguards và operational correctness

- Tạo manifest backup-readiness không chứa secret và validator deterministic cho freshness, integrity, isolated restore,
  continuous coverage và independently recoverable off-device copy.
- Tách chế độ audit (luôn sinh report) khỏi release gate (fail closed khi backup stale/incomplete).
- Cập nhật backup/restore runbook và release checklist để không tiếp tục dùng backup lịch sử như recovery point hiện tại.
- Sửa production monitor trỏ đúng rollback runbook và không tự đóng incident issue trước owner review.

**Verify**:

- `node --test scripts/backup-readiness.test.mjs scripts/production-monitoring.test.mjs`
- `npm run audit:backup-readiness`
- Chạy release-mode gate và xác nhận nó từ chối manifest stale hiện tại bằng test/fixture, không cần truy cập production.
- `npm run security:secrets`

**STOP**: cần tạo backup mới, off-device copy, restore drill hoặc đọc credential/production data.

### Phase 2 — Chẩn đoán và ổn định server QA suite

- Dùng binary search/lane isolation để xác định test file, open handle hoặc worker contention làm full suite treo.
- Chỉ sửa sau khi có reproduction và root cause; thêm regression test hoặc deterministic test command.
- Giữ timeout đủ phát hiện hang nhưng không che test chậm bằng timeout vô hạn.

**Verify**:

- Focused reproduction phải đỏ trước fix và xanh sau fix.
- `npm run test:unit:server` phải kết thúc thành công hai lần liên tiếp.
- `npm run test:unit:client` để loại regression xuyên package nếu thay shared config.

**STOP**: lỗi chỉ tái hiện khi cần external provider/database thật hoặc ba vòng điều tra không tăng evidence.

### Phase 3 — HT Assistant KB/error hardening

- Đóng gói Knowledge Base retrieval như untrusted reference data; nội dung KB không được thay đổi system policy,
  tool permissions hoặc yêu cầu lộ secret.
- Chuẩn hóa error contract cho conversation/history endpoints; log nội bộ bằng `safeLog`, client chỉ nhận public error.
- Giữ SSE format, ownership, CSRF, guest capability và quota hiện tại.

**Verify**:

- Focused prompt-injection/KB tests và controller error-contract tests.
- `node .agents/scripts/validate-tools.mjs`
- `$ai-check` workflow: focused AI suites, tool/schema checks, client compile/build tương xứng.
- `npm run security:data-boundaries`

**STOP**: thay provider, quota, auth/cookie/CSRF hoặc cần đọc raw production conversation.

### Phase 4 — Monitoring, technical-debt guards và AI coding governance

- Bổ sung deterministic checks cho runbook link, incident lifecycle, bundle/dependency policy và các boundary đã audit.
- Ghi performance baseline/waiver rõ ràng; không tuyên bố cải thiện khi chưa có số đo.
- Cập nhật governance để feature phức tạp luôn có spec/plan, TDD, impact trace và verification evidence.
- Đưa TencentDB Agent Memory vào Architecture/AI Technology Radar; chỉ đưa các skill animation tương thích contract vào
  Skill Radar với quyết định `adapt`, không auto-install.

**Verify**:

- `npm run test:ops`
- `npm run agents:validate`
- `npm run test:agents:radar`
- `npm run security:secrets`
- `npm run security:data-boundaries`

### Phase 5 — Explicit AI Memory pilot

- Viết/cập nhật feature spec trước schema/code và trace model → service → controller → route → client consumer.
- Thêm memory owner-only cho authenticated user, mặc định tắt; create/update/delete/list có provenance và correction.
- Dùng allowlist category, bounded value/TTL/context budget, deterministic conflict resolution và audit metadata tối thiểu.
- Không tự extract từ hội thoại ở v1; chỉ lưu sau hành động explicit của user. Guest và tool output không được ghi memory.
- Context injection dùng data boundary riêng, projection tối thiểu và golden evaluation chống prompt injection/leakage.

**Verify**:

- Model/schema validation và index tests; ownership/IDOR, opt-in, correction/delete, TTL, conflict và isolation tests.
- Prompt budget/golden eval; guest/auth regression; export/delete-account lifecycle.
- Focused client/server tests, `$ai-check`, security scans và full server suite.

**STOP**: cần backfill/migration production, automatic extraction/persona, sensitive category hoặc benchmark chưa đạt.

### Phase 6 — Motion foundations và ChatWidget pilot

- Codify motion tokens/rules trong local UI guidance; giữ Tailwind/CSS/GSAP hiện tại.
- Refactor animation ChatWidget sang explicit properties, transform/opacity ưu tiên, correct transform-origin và trạng thái
  có thể interrupt.
- Tắt/giảm animation khi `prefers-reduced-motion`; hover animation chỉ áp dụng thiết bị có hover/fine pointer.
- Chỉ sửa `transition-all` nằm trong pilot/consumer trực tiếp; tạo inventory cho phần còn lại thay vì bulk rewrite.

**Verify**:

- Focused ChatWidget/component tests cho open/close, reduced motion và keyboard/focus behavior.
- `$ui-check` static + visual desktop/mobile cho ChatWidget.
- `npm run lint --prefix client`
- `npm run test:unit:client`
- `npm run build --prefix client`

## Cross-review và release gate

1. Chạy impact re-trace cho schema, AI API, delete/export lifecycle và UI consumers.
2. Chạy code review theo Standards, Spec/Contract và Security/Operations; sửa finding trong phạm vi.
3. Chạy QA evidence một lần cho full unit, E2E phù hợp, build/lint, security và agent validators.
4. Chạy cleanup-delivery, `git diff --check`, rà debug log/unused code/generated artifacts.
5. Tách rõ `LOCAL VERIFIED`, `PRODUCTION READINESS BLOCKED` và các manual/staging gate trong báo cáo cuối.

## Verification evidence — 2026-08-11

- Recovery/ops: `npm run test:ops` đạt 24/24; audit ghi backup gần nhất đã 432.48 giờ. Cả
  `verify:backup-release` và `verify:disaster-recovery` trả exit 1 đúng fail-closed contract.
- Server stability: full suite đạt 132/132 files, 650/650 tests dưới Node 22.23.1 canonical, single-thread shared
  replica-set lane. Còn warning `validateSync()` deprecation và SIGKILL fallback khi dừng MongoMemoryServer trên Windows.
- AI/security: focused KB/memory/prompt suites đạt; 11 tool schemas pass; secret scan và repository data-boundary scan
  không có violation. Cross-review bổ sung expiry filter trước TTL monitor và tuần tự hóa account-deletion queries trong
  cùng Mongo session.
- Client/motion: lint pass; 73/73 files, 362/362 tests; Vite compile 2.854 modules. Visual QA đạt ở 1280×720 và
  390×844, không horizontal overflow; Escape/focus return, inert hidden dialog và 44×44px header actions đã verify.
- Governance: technology/skill radar đạt 15/15; agent validator đạt 28 skills, 23 upstream entries, 0 warning.
- Release build: Vite compile hoàn tất nhưng `npm run build --prefix client` không hoàn tất postbuild vì sandbox chặn
  network và production prerender thiếu `VITE_API_URL`. Generated sitemap đã được khôi phục về HEAD.
- E2E: SKIP — không có full dev-server/test-data/auth environment. Browser QA local chỉ bao phủ guest ChatWidget,
  không được nâng thành full E2E hoặc release evidence.

## Production/manual blockers

1. Tạo backup mới, xác minh integrity + isolated restore, tạo independently recoverable off-device copy và cập nhật
   manifest bằng evidence thật. Hiện không có continuous/point-in-time recovery.
2. Chạy production index creation/rollout cho hai collection AI Memory trong cửa sổ được duyệt; không cần backfill vì
   collection mới, default-off. Không có migration/index production nào được chạy trong plan này.
3. Cung cấp production-like `VITE_API_URL`, network và dữ liệu test để chạy release prerender/bundle gate cùng E2E.

## Done Criteria

- [x] Recovery readiness có manifest/validator/test; backup stale hoặc thiếu off-device recovery bị release gate chặn.
- [x] Server full unit suite kết thúc ổn định trên canonical Node 22 lane; Phase 2 đã có hai lượt pass trước cross-review.
- [x] KB/reference content không thể nâng quyền instruction; AI endpoints không lộ raw internal error.
- [x] Monitoring/runbook/governance checks nhất quán và hai upstream repo có radar decision đúng taxonomy.
- [x] Explicit memory pilot đạt ownership, consent, delete, TTL, conflict, budget và security evaluations.
- [x] ChatWidget tôn trọng reduced motion, interaction/accessibility và không đổi animation stack.
- [x] Không có migration/backfill/deploy/production write hoặc secret mới.
- [x] Local QA evidence và mọi release/E2E/production blocker được báo cáo trung thực.

## Rollback

- Mỗi phase giữ diff độc lập về logic; rollback bằng cách hoàn tác đúng file của phase, không dùng Git destructive command.
- Memory pilot phải có feature flag/default-off hoặc contract tương đương để rollback application không cần xóa dữ liệu.
- Schema mới chỉ additive/index-compatible; không drop field/index trong plan này.
- Motion pilot rollback chỉ ảnh hưởng presentation, không thay API/state contract.

## Maintenance Notes

- Backup record lịch sử là evidence, không đồng nghĩa backup hiện tại còn đáp ứng RPO.
- Memory là user-controlled data, không phải Knowledge Base và không phải system instruction.
- Radar theo dõi upstream; local policy chỉ đổi sau review/adapt có bằng chứng.
- Animation chỉ có giá trị khi hỗ trợ orientation, feedback hoặc continuity; decoration lặp lại phải bị loại/giảm.
