---
name: impact-check
description: Trace và kiểm tra toàn bộ ảnh hưởng liên đới của một thay đổi trong HTCOACHINGWEB. Dùng trước và sau khi sửa code, đặc biệt với API, schema, auth, payment, wallet, pricing, quota, status, route, UI state hoặc thay đổi chạm cả frontend và backend; bảo đảm không bỏ sót consumer, contract, validation, test, migration, SEO và security liên quan.
---

# Impact Check — HTCOACHINGWEB

## Nguyên tắc

Không coi file được yêu cầu sửa là toàn bộ phạm vi. Xác định symbol hoặc contract thay đổi, trace mọi producer và consumer, rồi kiểm tra từng lớp bị ảnh hưởng trước khi chỉnh code.

Không tự mở rộng sang refactor không liên quan. Chỉ thêm file vào phạm vi khi có đường phụ thuộc hoặc contract cụ thể và ghi rõ bằng chứng file:line.

## Quy trình bắt buộc

### 1. Chốt change surface

- Đọc AGENTS.md, Git status và diff hiện tại.
- Ghi rõ symbol, field, endpoint, enum, số tiền, quota, thời hạn hoặc UI behavior sẽ thay đổi.
- Phân loại rủi ro: data/schema, security, financial, API contract, UI-only, SEO hoặc infrastructure.
- Với auth, CSRF, JWT, payment hoặc wallet, đọc .agents/rules/security/security.md.
- Với Mongoose schema, dùng thêm $schema-change.
- Với AI assistant, dùng thêm $ai-chat-system và $ai-check.

### 2. Lập dependency map bằng code thật

Dùng rg để trace cả tên symbol lẫn giá trị contract; không chỉ dựa vào imports.

- Imports/exports, re-exports và dynamic imports.
- Frontend page/component/hook → service → axios path.
- Backend route → middleware → controller → service → model.
- Request fields, response shape, error code, HTTP status và pagination.
- Model fields, enum, indexes, virtuals, hooks, validation và query filters.
- Cron, background job, email, audit log, metrics và script vận hành.
- Unit, integration, E2E, fixtures, mocks và test helpers.
- Với public page: router, SEO component, JSON-LD, sitemap và prerender.
- Với external domain/header: Helmet CSP và CORS.

Nếu đổi tên hoặc thay literal, tìm cả tên cũ, tên mới và các giá trị tương đương.

### 3. Kiểm tra contract xuyên lớp

Đối chiếu producer với tất cả consumer cho:

- Money/currency, giá tháng/năm, phí, min/max và phép làm tròn.
- Quota, limit, duration, trial, retention và entitlement.
- Enum/status, transition hợp lệ, label, badge, progress và filter.
- Route/path/method, auth/role/ownership/CSRF và rate limit.
- Payload, optional/null/default, response envelope, error/loading/empty/disabled state.
- Pagination: page, limit, total, sentinel và giới hạn tối đa.

Ưu tiên một nguồn sự thật server-authoritative cho business contract. Frontend phải lấy dữ liệu từ API hoặc adapter đã validate và fail closed khi contract chưa biết. Với giao dịch tài chính, backend luôn tự tính canonical amount; dữ liệu FE chỉ dùng để xác nhận mismatch, không làm nguồn debit.

### 4. Kiểm tra dữ liệu và tương thích

Khi model/schema hoặc semantics dữ liệu đổi, trace:

- Backward compatibility với document cũ và client cũ.
- Default có che lấp dữ liệu cũ hay tạo hành vi sai không.
- Index/unique/partial index và race condition.
- Migration/backfill, rollback, idempotency và dry-run.
- Retention, cleanup, auditability và dữ liệu cần bảo lưu.

Không chạy migration/seed/cleanup trên staging hoặc production nếu user chưa xác nhận target.

### 5. Thiết kế verification trước khi sửa

- Viết hoặc xác định test tái hiện mismatch trước.
- Chọn test nhỏ nhất chứng minh từng cạnh contract, rồi mở rộng theo rủi ro.
- Với API: test happy path, invalid input, authorization, conflict/idempotency và response/error contract.
- Với UI: test loading, API error + retry, empty, disabled, stale data và accessibility cơ bản.
- Với constants thương mại: thêm boundary/contract gate để hardcode thứ hai làm CI fail.

### 6. Sửa và re-trace

- Sửa theo layering hiện có; không cho component gọi API trực tiếp.
- Sau mỗi thay đổi contract, chạy lại cùng truy vấn rg ở bước 2.
- So git diff --check và rà import/biến/code thừa do chính thay đổi tạo ra.
- Nếu xuất hiện consumer mới ngoài dependency map, cập nhật phạm vi và test trước khi tiếp tục.

### 7. Bàn giao impact matrix

Báo cáo ngắn theo bảng:

| Contract/symbol | Producer | Consumers đã kiểm tra | Test/gate | Kết quả |
|---|---|---|---|---|

Kèm:

- Files chính đã sửa.
- Side effect và compatibility.
- Lệnh đã chạy cùng kết quả thật.
- Phần chưa chạy hoặc blocker.

## STOP conditions

Dừng và hỏi user nếu:

- Hai nguồn sự thật đều đang ghi dữ liệu thật nhưng không thể xác định nguồn canonical.
- Cần đổi semantics dữ liệu, xóa/backfill dữ liệu hoặc nới bảo mật ngoài yêu cầu.
- Contract tài chính không thể chứng minh fail trước mutation.
- Cần thao tác staging/production có ghi dữ liệu mà chưa có target/test account được xác nhận.
- Cùng một verification fail ba vòng sau các sửa có căn cứ.
