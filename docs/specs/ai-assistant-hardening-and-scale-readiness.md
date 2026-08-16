# Spec: HT Assistant hardening và scale readiness

## Objective

Nâng HT Assistant từ các regression test rời rạc thành một hệ thống có release gate đo được, giữ mọi dữ liệu từ
tool/provider ở trust boundary không tin cậy, và chuẩn bị các seam cần thiết trước khi scale nhiều process. Công việc
được thực hiện theo hai checkpoint: toàn bộ P0 local phải đạt trước khi mở P1; không deploy, migration hay ghi dữ liệu
production trong spec này.

## Assumptions

1. Yêu cầu “làm tiếp F1” được hiểu là làm tiếp **P1** trong roadmap đã thống nhất.
2. P0 local được coi là đạt khi eval/tool/security/ops gates pass và disaster-recovery validator vẫn fail closed đúng
   với evidence thật đang thiếu; không sửa manifest để tạo trạng thái PASS giả.
3. Off-device backup, recovery-key độc lập và PITR là thao tác hạ tầng thật, cần target/credential/owner approval riêng.
4. P1 chỉ thêm shared usage accounting nếu có một nguồn server-authoritative và backward-compatible; abuse throttling
   theo process vẫn là lớp riêng, không được gọi là business quota.
5. AI tool hiện tại là read-only. Confirmation flow phải hoàn chỉnh trước khi tool mutation đầu tiên được đăng ký,
   nhưng spec này không tự thêm tool mutation.

## Tech Stack liên quan

- Server: Express 5, Mongoose 9, Vitest 4, Gemini provider, AJV tool schemas.
- Client: React 19, SSE chat hook, generative UI cards, Vitest 4.
- Operations: Node scripts, GitHub Actions, MongoDB logical backup readiness manifest.

## Commands

- AI eval: `npm run test:ai-eval`
- AI tool validation: `node .agents/scripts/validate-tools.mjs`
- Focused server tests: `cd server && npx vitest run <files>`
- Ops tests: `npm run test:ops`
- Backup audit: `npm run audit:backup-readiness`
- Disaster-recovery gate: `npm run verify:disaster-recovery` (expected fail until external evidence exists)
- Full local QA: `npm run test:unit`, `npm run build --prefix client`

## P0 Contract

### AI eval và adversarial release gate

- Có corpus machine-readable cho golden behavior, prompt injection, indirect injection, medical boundary, tool
  exposure và cost bounds.
- Default gate deterministic, offline, không cần secret/provider và không log raw conversation.
- Corpus/schema/runner fail closed khi scenario thiếu expected contract, trùng ID hoặc evaluator không biết loại case.
- CI và release checklist gọi cùng command canonical.
- Live/provider eval (nếu bổ sung) phải opt-in rõ ràng và không được tự dùng production conversation.

### Tool-result trust boundary

- Mọi tool result đưa lại vào model phải nằm trong structured envelope ghi rõ untrusted data; tool text không thể tự
  biến thành system/developer instruction.
- Text, tool name và payload đưa vào model đều có size/type bounds.
- URL từ Google grounding chỉ chấp nhận HTTPS, giới hạn số nguồn, loại credential/fragment và escape Markdown label.
- UI vẫn nhận public text/card contract tương thích; history hiện có không cần migration.
- Regression test phải bao phủ delimiter escape, hostile instruction, unsafe URL, oversized output và history replay.

### Disaster recovery

- Không viết lại backup subsystem đã có. Audit/release/disaster modes tiếp tục phản ánh evidence thật.
- Runbook nêu chính xác cách tạo encrypted off-device copy, key recovery độc lập và lựa chọn PITR; không chứa secret.
- Local P0 gate chứng minh manifest hiện tại release-ready nhưng disaster-recovery-not-ready vì đúng blockers.

## P1 Contract

### Shared usage ledger

- Business usage của `ai_chat` và `meal_scan` được ghi atomically vào shared MongoDB state theo actor/service/window.
- Guest actor chỉ lưu HMAC pseudonymous key; không lưu raw IP. User actor dùng owner ID.
- Unique index đảm bảo một bucket/actor/service/window; update dùng atomic increment và trả `limit`, `remaining`,
  `resetAt` canonical.
- Abuse limiter vẫn tồn tại độc lập. Khi shared ledger lỗi, paid/provider-cost operation fail closed; không tự cho qua.
- Schema additive, có TTL, không backfill và không chạy migration production trong task này.
- Hai collection mới là `serviceusagebuckets` và `aitoolconfirmations`; correctness dựa trên `_id` deterministic/opaque,
  còn năm secondary indexes (TTL + owner query) được rollout bằng migration guarded riêng.

### Prompt/version observability

- Mỗi request AI log một prompt contract version/hash ổn định, không log prompt hoặc dữ liệu user.
- Metrics/eval evidence có thể so sánh behavior theo version.

### Parallel read-only tools

- Chỉ các tool được registry đánh dấu read-only + parallel-safe mới có thể chạy đồng thời.
- Kết quả giữ đúng thứ tự function call để provider correlation không đổi.
- Mọi call vẫn có timeout, auth, schema validation và abort; mutation/confirmation luôn tuần tự.

### Confirmation flow

- Registry có contract confirmation rõ; server phát challenge opaque, bounded và owner-scoped thay vì tin lại raw
  parameters từ browser.
- Client render confirmation card accessible và chỉ resume qua endpoint có auth/CSRF/expiry/replay protection.
- Vì chưa có mutating AI tool, flow được kiểm tra bằng synthetic test tool/test fixture; không mở mutation production.

## Boundaries

- Always: ownership tại execution time, schema validation, CSRF cho mutation, safe logging, bounded context/cost.
- Ask first: production migration/index apply, backup/restore/off-device copy, PITR purchase/config, deploy.
- Never: đặt secret trong prompt/corpus/manifest; log raw chat/health/financial data; biến prompt thành security boundary;
  tắt limiter hiện có; chạy nhiều write tool song song.

## Testing Strategy

- TDD từng behavior qua runner/tool engine/HTTP contract công khai.
- P0: corpus contract tests, tool envelope/unit/provider/controller regressions, ops/backup tests.
- P1: model/index/service concurrency tests, route authorization/CSRF/quota tests, client card interaction tests,
  parallel ordering/abort tests và prompt telemetry tests.
- Cuối mỗi checkpoint chạy focused gates, rồi QA full tương xứng với cả server và client.

## Success Criteria

- `npm run test:ai-eval` deterministic và được CI/release checklist gọi.
- Hostile KB/page/tool/provider content không đổi policy/quyền tool và unsafe grounding URL không tới browser.
- P0 focused + ops + security gates pass; DR external blockers được báo đúng, không bị che.
- Shared usage ledger chống concurrent over-consumption trên nhiều process theo contract test.
- Prompt version/hash xuất hiện trong safe telemetry, không chứa prompt content.
- Parallel execution chỉ áp dụng tool read-only/parallel-safe và chứng minh giảm critical path bằng deterministic test.
- Confirmation challenge owner-scoped, CSRF-protected, expiring và one-time trong tests.
- Không migration/deploy/production write; mọi external blocker được bàn giao rõ.

## Open Questions

Không có blocker cho local implementation. Destination off-device, key custodian và MongoDB/Atlas PITR tier là quyết
định vận hành ngoài phạm vi local và phải được owner phê duyệt riêng.
