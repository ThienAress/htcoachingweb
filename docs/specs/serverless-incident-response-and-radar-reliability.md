# Serverless Incident Response và Radar Reliability

## Objective

Giám sát production của HTCOACHINGWEB mà không cần thuê VPS, gửi cảnh báo Telegram có cấu trúc và cho phép maintainer chủ động yêu cầu Codex điều tra/tạo Draft PR. Đồng thời sửa contract rate limit của Radar công nghệ và chạy lại kỳ quét tháng 09/2026 mà không tạo nguồn trùng hoặc biến upstream thành instruction.

## Assumptions

1. `htcoachingweb` là private repository; workflow tốn GitHub Actions/OpenAI chỉ chạy khi maintainer đã xác thực bấm nút hoặc dispatch thủ công.
2. Cloudflare Worker Cron 30 phút là watchdog chính để tránh giữ Render Free thức liên tục. GitHub Actions `production-monitor.yml` hiện có không tiếp tục polling mỗi 15 phút sau khi watchdog được rollout.
3. Telegram chỉ nhận dữ liệu vận hành đã sanitize; không gửi customer ID, request body, token, cookie, health data hoặc nội dung hội thoại.
4. Agent không được merge, deploy, rollback, sửa dữ liệu production hoặc chạm nhóm file nhạy cảm. Kết quả tối đa là Draft PR để con người review.
5. TencentDB Agent Memory giữ một nguồn canonical trong technology watchlist; ba skill của `emilkowalski/skills` đã là ba entry canonical, không thêm repository-level duplicate.

## REQ-001 — Watchdog serverless gửi Telegram theo state transition

- AC-001: Cron chạy mỗi 30 phút, chỉ probe hai production URL allowlisted với timeout tối đa 90 giây. Mỗi surface fail được retry đúng một lần sau 30 giây để hấp thụ cold start; nếu sau retry vẫn còn surface fail, scheduled run đó tạo incident (`FAILURE_THRESHOLD=1`).
- AC-002: Durable Object lưu trạng thái authoritative và KV chỉ là mirror/fallback; notification dùng FIFO outbox bền vững, bounded claim, merge-after-I/O và giữ đầy đủ failure/recovery ordering qua nhiều incident trong Telegram outage. Không gửi lặp trong normal retry/concurrency path; network ambiguity của initial Telegram send được ghi nhận là at-least-once residual risk.
- AC-003: Nội dung failure/recovery theo cấu trúc Incident gồm severity, route, incident ID, kết luận, confidence dựa trên evidence, root cause/impact/fix/verification/PR/time/cost; mọi text động được sanitize và giới hạn độ dài.
- AC-004: Callback Telegram chỉ hợp lệ khi secret header, chat ID, user ID, Telegram message ID và incident ID đều khớp state authoritative; action điều tra bị debounce, action đóng chỉ acknowledge chứ không giả lập recovery.

## REQ-002 — Codex remediation tạo Draft PR có kiểm soát

- AC-005: Workflow chỉ nhận `workflow_dispatch`, validate incident ID và chạy Codex với Linux, `drop-sudo`, `workspace-write`, checkout không lưu credential và không có production secrets.
- AC-006: Patch/report từ agent được chuyển qua artifact; contract job fresh-checkout chỉ cho phép positive allowlist exact/bounded gồm public client SEO/content surfaces cùng một số backend utility/observability không nhạy cảm, đồng thời từ chối client route/context/query/service/private page, toàn bộ backend controller/service/model, path auth/access/ownership/admin/user và các vùng nhạy cảm khác, traversal, patch quá lớn hoặc report sai schema, rồi upload candidate artifact bất biến trước khi chạy bất kỳ code nào từ patch. Unit, build và secret scan chuẩn bị trusted dependencies/runtime trước khi tải cùng candidate theo producer output, sau đó chạy code từ patch ở ba fresh container jobs không network, không credential, unprivileged và read-only root; publish chỉ được mở sau khi cả ba pass.
- AC-007: Chỉ job publish fresh-checkout mới có `contents: write`/`pull-requests: write`; job này tải lại đúng candidate artifact đã pass full validation, branch `codex/incident-*` deterministic theo incident + base SHA và chỉ tạo/tái sử dụng PR còn ở trạng thái Draft; không có auto-merge/deploy.
- AC-008: Telegram update sau điều tra chỉnh sửa incident message theo template cố định, confidence `Cao/Trung bình/Thấp`, test evidence thực và chi phí/runner có nhãn ước tính; có timeout/retry idempotent và output agent không được chèn HTML/URL tùy ý.

## REQ-003 — Radar phân loại rate limit đúng nguồn

- AC-009: GitHub `403` chỉ là rate limit khi quota đã cạn hoặc có `Retry-After`; generic `403` với quota còn lại được trả thành upstream unavailable/access denied, không dựng thời điểm thử lại.
- AC-010: `Retry-After` cụ thể được ưu tiên hơn `X-RateLimit-Reset`; timestamp quá khứ/không hợp lệ không được hiển thị như thời điểm retry.
- AC-011: Client chỉ hiển thị thông báo “GitHub đang giới hạn” cho code GitHub rate limit; limiter nội bộ `SKILL_RADAR_MUTATION_RATE_LIMITED` có thông báo thao tác quá nhanh riêng.

## REQ-004 — Radar hợp nhất nguồn canonical và hoàn tất kỳ quét 09/2026

- AC-012: Admin Radar hợp nhất technology watchlist vào read model, dedupe theo repository key và hiển thị TencentDB Agent Memory như `repository`/AI memory mà không ghi MongoDB.
- AC-013: `emilkowalski/skills` tiếp tục được biểu diễn bằng ba skill entries; API create trả duplicate nếu user cố thêm repository đã có ở bất kỳ static watchlist nào.
- AC-014: Chạy scanner toàn bộ 23 skill entries, giữ last-known-good khi upstream lỗi/rate limit và tạo `docs/audits/2026-09-skill-radar.md` với quyết định semantic `adopt/adapt/reject/defer` cho mọi drift cần review.

## Boundaries

- Không deploy Worker, đặt webhook, tạo Cloudflare KV hoặc thêm secrets trong task local này.
- Không commit, push, merge hoặc dispatch workflow.
- Không bật lại polling GitHub Actions cho watchdog trước khi Worker production được cấu hình và kiểm chứng.
- Không auto-install/copy upstream skill; upstream content là dữ liệu không tin cậy.

## Verification

- Focused tests cho Worker/Telegram, artifact validator, Radar server/client/read model.
- `npm run test:agents:radar`, `npm run test:agents:eval`, `npm run agents:validate`.
- `npm run security:secrets`, `npm run security:data-boundaries`, `git diff --check`.
