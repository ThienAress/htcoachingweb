# Plan 094A: Sửa nguồn, UI citation và các lỗi acceptance của HT Assistant

## Status

- Complexity: COMPLEX; risk: HIGH (AI output/sức khỏe, không sửa auth).
- Lifecycle: IN PROGRESS; verification: STAGING; rollout: LIVE (PR #190; acceptance chưa đạt).
- Owner: root; updated at: 2026-10-04; depends on: 094.

## Why This Matters

Staging SHA `32cf6e8` đã được xác minh nhưng test UI đạt 7 PASS/4 PARTIAL/4 FAIL.
Nguồn không liên quan, card/chữ khác nhau và draft workout/refinement không hữu ích.
User yêu cầu nguồn chọn lọc, avatar nguồn có thể click, nội dung có cơ sở khoa học
và khoảng 90% bộ 15 câu đạt; target nguyên là 14/15, không nới oracle.

## Current State và ranh giới

Candidate sạch `161f5a5` có cùng tree merge staging; implementation dùng checkout
candidate hiện có, giữ root dirty nguyên trạng. CitationChip đã deploy nhưng chỉ
nhận webSources metadata; KB sources được controller nối thành Markdown dài.
Controller có shortcut web-required→KB và fallback workout/seven-day thiếu chi tiết.
Spec canonical: `docs/specs/ht-assistant-reliability.md`, AC-030–035.

In scope: AI router/controller/output boundary/intake/meal/exercise helpers và tests;
ChatBubble/CitationChip/citation/WebSourcesCard, source avatar assets có provenance;
spec/plan/traceability và evidence. Không sửa schema/auth/CSRF/quota/provider model,
không migration/seed/production write hoặc thay baseline UI để làm CI xanh.

## Steps và ownership

### Step 1: Nguồn chọn lọc, đúng claim

   Root owns requestRouter/systemPrompt/controller,
   các controller integration tests và module citation policy mới. Reproduce exact
   Ronaldo/high-stakes/irrelevant-KB prompts RED; giữ web-required; clear stale citation;
   chỉ phát validated source metadata trên final assistant turn cần nguồn.
### Step 2: UI nguồn gọn và accessible

   UI worker owns client ChatWidget citation files/tests,
   avatar component/assets nếu cần. Không sửa backend, hook SSE hoặc auth. Kiểm chip
   metadata-only, avatar fallback, malicious URL, history binding, mobile/focus states.
### Step 3: Bài tập và draft lịch ràng buộc

   Exercise worker owns exerciseRequest,
   exerciseCatalogCompatibility, searchExercises tool, module workoutDraft mới và tests.
   Không sửa controller/router (root tích hợp). Giữ canonical card/text set; fallback
   cung cấp plan thực tế khi constraints rõ, không bịa catalog hoặc nới thiết bị.
### Step 4: Đổi món trong phạm vi

   Meal worker owns mealRequestConstraints/suggestMeal và tests,
   module scoped substitution mới nếu cần. Không sửa controller/conversation write service.
   Reproduce tofu→fish; giữ foods khác, macro/tolerance, safety, price/provenance.
### Step 5: Intake và ví dụ 7 ngày

   Root owns tdeeIntake và fallback output modules;
   giữ duration range; plan mẫu rõ thực phẩm/khẩu phần và bài tập, không prescription cá nhân.
### Step 6: Tích hợp/review/verification

   Root tích hợp worker diffs, impact map, review độc lập;
   QA full theo skill, AI eval/tool validator/UI gate/secrets/data-boundaries/docs privacy.
   Render local desktop/mobile và canonical E2E. Staging rollout/live UI cần đúng SHA
   của bản vá mới, không test lại alias cũ rồi gọi đó là kiểm chứng bản sửa.

   REQ-001–009 là compatibility gates kế thừa của spec; tests/commands cũ được
   map vào Step 6 để phát hiện regression, không coi việc map là bằng chứng đã
   chạy live acceptance của các đợt trước. REQ-010 map vào Steps 1–6 cho bản vá này.

## Verification commands

Từ candidate root: `npm run test:unit`, `npm run build --prefix client`,
`npm run test:ai-eval`, `node .agents/scripts/validate-tools.mjs`,
`npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high`,
`npm run security:secrets`, `npm run security:data-boundaries`,
`npm run security:docs-privacy`, `npm run agents:validate`, `npm run test:e2e`.
Focused worker/controller tests qua `npx vitest run` tại layer tương ứng.
Expected: exit 0; E2E thiếu môi trường phải báo NOT RUN/BLOCKED, không gọi PASS.

## Done criteria và STOP

- AC-030–035 map tới tests/commands trong traceability; không phát nguồn vô căn cứ.
- UI source/avatar click/focus hoạt động, nguồn cần thiết hiện đúng turn, ordinary link không giả citation.
- Follow-up/workout/safety/intake/seven-day regression PASS; target 14/15 live riêng.
- Không thay dữ liệu thật hoặc deploy production; bảo toàn dirty root và guard/cost bounds.
- Không commit/push/deploy khi chưa chứng minh quyền cho lần promotion cụ thể.
- Dừng mutation nếu cần schema change/nới guard/ghi DB ngoài target đã xác nhận.
- Sau tối đa 3 vòng sửa có căn cứ mà gate vẫn fail, báo evidence/blocker; không đánh PASS giả.

## Evidence

Implementation local đã tích hợp. Client 926 tests, release build, targeted AI E2E
12 tests và AI eval 73/73 đạt; full server sau privacy correction cuối đạt
296 files / 3338 tests, exit 0, đủ 10/10 batch. Local gate: GO FOR STAGING.
Báo cáo [096](../reports/096-ai-remediation-local-qa-2026-10-04.md) ghi exact commands,
execution logs, bounded review và proof gaps. Chưa commit/push/deploy, chưa chạy
15 câu live UI trên bản vá; không suy QA local thành mục tiêu 14/15 đã đạt.

## Follow-up sau promotion #190 — 2026-10-04

PR #190 đã merge SHA `2578b4fd9db492ce2b17dba84698446b5daf9639`;
CI 5/5, Netlify READY và Render LIVE cùng SHA. Round3 thu đủ 15 lượt UI,
13 conversations, cleanup verified/residue 0. Không chạy lại chỉ vì resume.
Raw automated grade 9 PASS/6 FAIL chưa phải final semantic grade. Hai flags
duration/WHO cần manual adjudication theo frozen rubric; không đổi rubric.

Các bước tiếp theo (giữ scope và guard ở trên):

1. Root chốt baseline report 097 từ captures/screenshots, tách semantic score
   khỏi lỗi lexical harness và đề cập mô tả kneeling push-up mâu thuẫn.
2. UI implementer owns `citation.js`, `CitationChip.jsx`, `SourceAvatar.jsx`
   và citation tests: reproduce generic “Nguồn” trên redirect citation; hiển thị
   host thật, không giả publisher từ title hoặc tải favicon bên ngoài.
3. Root owns controller/intake regression: lời hỏi dữ kiện luôn nói TDEE là
   ước tính, nhóm kinh nghiệm/thiết bị rõ; không tạo numeric target cá nhân.
4. Read-only planners điều tra search timeout/cost bounds và chuẩn bị đề xuất
   Food/Exercise có nguồn, exact records/fields, preview, rollback, verification.
   Không tăng timeout/retry/quota hoặc gắn reviewed=true thiếu evidence.
5. Chạy focused RED→GREEN, client/server affected checks, AI/UI/security gates;
   local code mới chưa được deploy. Review bản vá và proposal trước promotion
   tiếp theo. Mutation catalog thật cần explicit approval staging riêng theo
   AGENTS.md; mọi thao tác production ngoài phạm vi.

Done criteria vẫn ≥14/15 live; PARTIAL/dependency failure là non-PASS. Báo cáo
và local remediation là checkpoint khi dữ liệu có nguồn hoặc approval còn thiếu.
