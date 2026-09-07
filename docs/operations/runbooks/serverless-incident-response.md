# Serverless Incident Response Runbook

## Kiến trúc

Cloudflare Worker Cron gọi hai surface read-only cố định mỗi 30 phút:

- `https://htcoachingweb.io.vn/`
- `https://api.htcoachingweb.io.vn/api/ops/health/ready`

Mỗi surface có timeout tối đa 90 giây. Surface nào fail sẽ được Worker retry đúng một lần sau 30 giây để hấp thụ cold start của Render; nếu sau retry vẫn còn surface fail, scheduled run được tính là một failure và tạo incident ngay (`FAILURE_THRESHOLD=1`). Worker lưu state authoritative trong Durable Object, mirror best-effort sang KV và gửi một Telegram incident. Nó không đọc metrics token, database, log, request body hoặc dữ liệu người dùng. Khi cả hai surface PASS trở lại, Worker đưa recovery vào FIFO outbox sau failure tương ứng; nhiều incident phát sinh trong lúc Telegram outage vẫn được giữ và phát lại đúng thứ tự. Notification claim bị bỏ dở được reclaim sau timeout hữu hạn; mọi completion sau network I/O đều đọc lại và merge state mới nhất để không làm mất acknowledge/recovery.

Nút **Điều tra & tạo Draft PR** chỉ hoạt động khi Telegram webhook secret, chat ID, user ID, message ID và incident ID khớp state authoritative. Durable Object cấp lease tuần tự theo incident để hai callback đồng thời không dispatch hai workflow. Lease có trạng thái `reserved/dispatched/unknown` và không tự hết hạn: nếu GitHub trả kết quả mơ hồ, operator kiểm tra Actions thay vì tự dispatch lại. Worker gửi kèm probe facts đã giới hạn; Codex điều tra trong runner không có production secret. Patch gate dùng positive allowlist: client route/context/query/service/private page, backend controller/service/model và mọi path auth/access/ownership/admin/user đều bị từ chối. Contract job khóa patch/report thành candidate artifact bất biến trước khi chạy code từ patch; ba fresh jobs riêng tải đúng artifact đó để chạy unit, client compile và secret scan. Mỗi job chuẩn bị dependencies, Mongo test binary cần thiết và Docker image đã pin từ trusted base trước khi tải candidate; sau khi apply patch, code từ patch chỉ chạy trong container unprivileged, read-only root, không network và không nhận GitHub/Telegram/OpenAI credential. Checkout được bind-mount read-only trong cả ba container và mỗi container tự kiểm tra write probe trước khi chạy code từ patch; unit chỉ nhận Mongo binary cache Debian read-only cùng cache tạm giới hạn, còn compile sao chép source vào tmpfs `/scratch` và chỉ ghi artifact tại đó. Full release build/prerender tiếp tục là gate bắt buộc của CI Draft PR, không được suy diễn từ compile-only này. Publish chỉ tải lại original candidate sau khi cả ba pass. Artifact name do producer xuất cho consumer nên rerun failed jobs không bị lệch `run_attempt`. Branch được định danh theo incident + base SHA, workflow chỉ tái sử dụng PR còn mở và vẫn là Draft. Không có auto-merge, auto-deploy hoặc rollback.

Kết quả remediation chỉnh sửa chính Telegram incident message bằng `editMessageText`, có timeout và tối đa ba lần thử; Telegram trả “message is not modified” được coi là idempotent success. Initial `sendMessage` không có idempotency key của Telegram, nên một network failure mơ hồ vẫn có residual risk at-least-once; kiểm tra incident ID trước khi xử lý bản trùng.

## Chi phí và giới hạn

- Watchdog không cần VPS. Cấu hình SQLite Durable Object trong mẫu cùng Worker/KV dự kiến nằm rất xa quota miễn phí ở tải 48 Cron invocations/ngày; owner vẫn phải đối chiếu [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) và [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) tại thời điểm bật.
- Theo [Render Free docs](https://render.com/docs/free), service ngủ sau 15 phút không traffic và cold start khoảng một phút. Vì vậy lịch 30 phút ước tính giữ backend thức khoảng 12–12,8 giờ/ngày nếu không có traffic khác: khoảng 360–384 giờ trong tháng 09/2026, hoặc 372–397 giờ trong tháng 31 ngày, thay vì gần như cả tháng với probe 5 phút. Đây là ước tính vận hành, không phải cam kết billing.
- GitHub Actions và OpenAI API chỉ phát sinh khi maintainer bấm điều tra hoặc manual dispatch, không phát sinh ở mỗi health probe.
- Message báo cáo ghi runner duration đo được. Chi phí AI không được tự đoán; xem OpenAI usage dashboard theo API key/project.

## Cấu hình Worker — owner thực hiện

1. Tạo một Worker, một KV namespace production riêng và bật Durable Objects theo binding/migration trong config mẫu.
2. Copy `workers/production-watchdog/wrangler.toml.example` thành config deploy ngoài Git nếu cần, thay KV namespace ID thật.
3. Đặt Worker secrets, không ghi giá trị vào repo:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `TELEGRAM_WEBHOOK_SECRET`
   - `TELEGRAM_ALLOWED_USER_IDS` — danh sách Telegram numeric user ID, phân cách dấu phẩy
   - `GITHUB_DISPATCH_TOKEN` — fine-grained token chỉ cho repo `ThienAress/htcoachingweb`, quyền Actions write và Metadata read
4. Deploy Worker, xác minh `GET /health` trả `{ "ok": true }`.
5. Cấu hình Telegram `setWebhook` tới `https://<worker>/telegram/webhook` với cùng secret token.
6. Tạo GitHub repository secrets:
   - `OPENAI_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
7. Manual dispatch `incident-remediation.yml` chỉ với incident test hợp lệ trong môi trường kiểm thử; xác minh kết quả là no-patch hoặc Draft PR, không merge.

Các external GitHub Actions trong workflow được pin full commit SHA. Khi nâng phiên bản, xác minh SHA từ repository chính thức và chạy lại contract tests trước khi rollout.

Không paste token vào terminal history, issue, PR, artifact hoặc Telegram. Rotate ngay nếu nghi ngờ lộ secret.

## Rollout không gián đoạn monitoring

1. Giữ schedule hiện tại của `.github/workflows/production-monitor.yml` trong lúc cấu hình Worker.
2. Cho Worker chạy song song một observation window; xác minh healthy dedupe, một failure test có kiểm soát và recovery.
3. Chỉ sau owner approval mới bỏ `schedule` 15 phút khỏi GitHub workflow. Giữ `workflow_dispatch` để chạy deep monitor thủ công.
4. Nếu Worker lỗi, disable Cron trigger hoặc revoke `GITHUB_DISPATCH_TOKEN`; GitHub workflow không được tự bật merge/deploy.

## Incident handling

- `Đóng` trên Telegram là acknowledge, không phải recovery.
- Nếu agent trả `no_reproduction`/`no_safe_patch`, đọc report và điều tra log thủ công.
- Nếu có Draft PR, review scope, test, security và CI; merge/deploy vẫn theo release gate riêng.
- Với SEV-1/data exposure/auth/payment, không dùng auto-remediation; theo `incident-runbook.md` và rollback runbook.
