# Phase 4 - Observability, query performance và index safety

Ngày chốt: 2026-07-19

## Kết luận

Phase 4 đã hoàn thành phần code và kiểm thử cục bộ. Server có request correlation,
structured logging có redaction, health/readiness, metrics admin-only, telemetry
cho HTTP/AI/Knowledge Base/database và các query quan trọng đã có projection,
pagination/limit cùng compound index tương ứng.

Migration index, query explain và Atlas Vector Search chưa được chạy trên database
thật. Đây là chủ ý an toàn, vì các thao tác đó phải đi qua backup và staging.

## 1. Logging và request correlation

- Mỗi request nhận X-Request-Id hợp lệ từ upstream hoặc UUID mới.
- Response luôn trả X-Request-Id để đối chiếu browser, API gateway và server log.
- Production log là JSON có timestamp, level, service và event ổn định.
- Logger giới hạn chuỗi dài, số phần tử mảng và xử lý circular references.
- Password, token, cookie, authorization, email, phone, CCCD, chữ ký và ID nhạy
  cảm được redaction không phân biệt hoa thường.
- Stack trace chỉ được ghi ngoài production.

Regression test mới xác nhận accessToken, refreshToken, csrfToken, newPassword và
email đều bị che cả trong object lồng nhau và mảng.

## 2. Operational endpoints

### GET /api/ops/health

- Không cần đăng nhập để load balancer kiểm tra readiness.
- Trả 200 khi Mongoose readyState là connected.
- Trả 503 khi database chưa sẵn sàng.
- Không trả connection string hoặc chi tiết hạ tầng.

### GET /api/ops/metrics

- Bắt buộc access token và role admin.
- Cache-Control là no-store.
- Trả uptime, memory, counters, bounded summaries và HTTP route aggregates.
- Route/status được chuẩn hóa và giới hạn tối đa 200 keys để tránh high cardinality.
- Mỗi summary giữ tối đa 500 samples trong memory.

Metrics hiện có:

- HTTP requests, 5xx và duration.
- Server errors.
- AI requests/completed/errors/aborts/tool calls/tool failures/moderation blocks.
- AI total latency và tool latency.
- KB embedding failures/no-hit/vector fallback/search latency.
- Check-in idempotency hits và transaction aborts.
- Coaching revision conflicts và cleanup failures.
- Content cleanup failures.
- Database query latency.

Các metrics này là process-local. Khi chạy nhiều instance, hệ thống monitoring cần
scrape hoặc tổng hợp từng instance; restart process sẽ reset samples.

## 3. Query performance và data shape

- Blog public list bỏ trường content nặng, có pagination và limit.
- Related blog queries có projection và giới hạn tối đa bốn bài.
- Recipe public list, related recipes và admin listing có projection/pagination.
- Order actor list và check-in options có limit, chỉ lấy trường UI cần.
- Coaching client list/timeline và trainer client lookup có giới hạn cứng.
- Knowledge Base list/search/conversation mining có projection và giới hạn scan.
- Các query nóng được bọc trackDbQuery; query vượt DB_SLOW_QUERY_MS ghi warning có
  pattern thay vì dữ liệu người dùng.

## 4. Compound indexes

Migration Phase 4 khai báo 10 indexes:

| Collection | Index |
| --- | --- |
| blogposts | status, category, publishedAt desc |
| orders | trainerId, createdAt desc |
| orders | userId, createdAt desc |
| checkins | orderId, time desc |
| coachingdays | userId, date desc |
| coachingdays | trainerId, userId, date desc |
| knowledgeentries | status, category, usageCount desc, updatedAt desc |
| recipes | isPublished, createdAt desc |
| recipes | isPublished, category, createdAt desc |
| recipes | isPublished, area, createdAt desc |

Mỗi index trong migration đều có declaration tương ứng trong Mongoose schema.
Integration test sẽ fail nếu migration và schema lệch nhau.

## 5. Migration và query-plan tooling

Các lệnh sau chỉ chạy trên staging sau backup:

~~~powershell
cd server
$env:CONFIRM_PHASE4_INDEX_MIGRATION = "yes"
npm run migrate:phase4
npm run verify:phase4-indexes
$env:ALLOW_PHASE4_EXPLAIN = "true"
npm run explain:phase4
~~~

- Migration yêu cầu MONGO_URI và confirmation flag rõ ràng.
- Verify script đối chiếu đủ tên index trên từng collection.
- Explain script đo returned/docs examined/keys examined/execution time cho query
  Blog, Recipe, Knowledge Base, Order và Coaching.
- Script trả exit code lỗi khi docs examined vượt 20 lần số document trả về.
- Không drop index cũ tự động; tránh thay đổi phá hoại trong rollout.

## 6. Knowledge Base vector search

- Đã có tài liệu Atlas index 768 dimensions, cosine similarity.
- Filter fields là status, embeddingStatus và category.
- Chỉ bật KB_VECTOR_INDEX sau khi Atlas báo index ready và dữ liệu embedding hợp lệ.
- Khi vector search lỗi, app tăng vector fallback counter và quay về bounded fallback.
- Fallback bị giới hạn bởi KB_MAX_SCAN_ENTRIES, không quét collection vô hạn.

Chi tiết triển khai: docs/atlas-vector-index.md.

## 7. Kiểm chứng

- Phase 4 integration kiểm tra request ID, health readiness, admin-only metrics và
  tính đồng bộ giữa 10 migration indexes với schema.
- Metrics unit tests kiểm tra counter, percentile, route cardinality và KB no-hit.
- Safe logger regression test kiểm tra redaction case-insensitive.
- Toàn bộ server: 18 test files, 91/91 tests pass.
- Node syntax và diff integrity được kiểm tra ở vòng chốt Phase 5.

## 8. File thay đổi trong Phase 4

### Observability runtime

- server/server.js
- server/src/middlewares/requestTelemetry.js
- server/src/middlewares/errorHandler.js
- server/src/observability/metrics.js
- server/src/observability/queryTelemetry.js
- server/src/routes/ops.routes.js
- server/src/utils/safeLogger.js
- server/src/config/db.js

### Metrics wiring và query bounds

- server/src/controllers/ai.controller.js
- server/src/controllers/blog.controller.js
- server/src/controllers/coaching.controller.js
- server/src/controllers/knowledgeBase.controller.js
- server/src/controllers/order.controller.js
- server/src/controllers/recipe.controller.js
- server/src/services/ai/aiLogger.js
- server/src/services/ai/embedding.service.js

### Model indexes

- server/src/models/BlogPost.js
- server/src/models/Checkin.js
- server/src/models/CoachingDay.js
- server/src/models/KnowledgeEntry.js
- server/src/models/Order.js
- server/src/models/Recipe.js

### Migration, scripts và tests

- server/package.json
- server/src/migrations/20260719-phase4-index-performance.js
- server/src/scripts/verifyPhase4Indexes.js
- server/src/scripts/explainPhase4Queries.js
- server/src/controllers/__tests__/phase4.observability.integration.test.js
- server/src/observability/__tests__/metrics.test.js
- server/src/utils/__tests__/safeLogger.test.js
- docs/atlas-vector-index.md
- docs/phase-4-fix-report-2026-07-19.md

## 9. Việc cần làm trên staging/production

1. Tạo backup/snapshot và ghi snapshot ID.
2. Chạy migration Phase 1-4 theo thứ tự còn thiếu trên staging.
3. Chạy verify indexes và explain; xử lý query có ratio trên 20.
4. Tạo Atlas vector index, test fallback, sau đó mới bật KB_VECTOR_INDEX.
5. Kết nối /api/ops/metrics và JSON logs với nền tảng alert tập trung.
6. Cấu hình alert cho 5xx, P95 HTTP/DB/AI, AI errors/aborts, embedding failure,
   revision conflict, transaction abort và cleanup failure.

Không mục nào trong danh sách này đã được tự ý chạy trên database hoặc Atlas thật.
