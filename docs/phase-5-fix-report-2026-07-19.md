# Phase 5 - E2E, CI và release operations

Ngày chốt: 2026-07-19

## Kết luận

Phase 5 đã hoàn thành phần test automation, CI definition và tài liệu vận hành có
thể thực hiện trong codebase. Bộ Playwright hiện bao phủ public, authentication,
authorization và các workflow nghiệp vụ quan trọng cho admin, trainer, customer.

Kết quả cuối:

- Chromium: 35/35 tests pass.
- Chromium + Firefox + WebKit: 105/105 tests pass với 3 workers.
- Client unit: 85/85 pass.
- Server unit/integration: 91/91 pass.
- Client lint: 0 warning, 0 error.
- Production build, 20-route prerender và bundle budget: pass.

## 1. E2E architecture

Playwright tự khởi động:

- Vite client tại 127.0.0.1:4174.
- Deterministic mock API tại 127.0.0.1:5100.
- VITE_API_URL trỏ client vào mock API.
- VITE_E2E bỏ intro animation để hành vi test không phụ thuộc timing.

Mock API dùng header x-e2e-role để tạo actor admin, trainer hoặc user. Nó mô phỏng
đúng response shape và mutation của các workflow được test, nhưng không thay thế
server integration tests với MongoDB. Hai tầng bổ sung cho nhau:

- Browser E2E kiểm tra routing, render, tương tác và request contract.
- Server integration dùng Supertest cùng MongoMemoryReplSet để kiểm tra middleware,
  authorization, transaction và data integrity với database cô lập.

## 2. Coverage theo workflow

| Spec | Coverage chính |
| --- | --- |
| auth | Redirect anonymous, load authenticated actor, logout |
| authorization | Admin route, trainer route, user bị từ chối |
| checkin | Trainer chọn owned order và gửi đúng một check-in |
| coaching | Customer tải bounded plan list và selected day |
| recipe-blog | Publish draft recipe, blog list không tải editor bundle |
| ai-chat | Lazy-load panel, gửi chat, parse SSE deterministic |
| knowledge-base | Hiện embedding failure và gửi regenerate |
| contract | Tải contract và gửi cancel transition |
| deposit-wallet | Approve pending deposit đúng một lần |
| homepage | Hero, navigation, title và console errors |
| public-pages | Routing, fallback 404 và SEO metadata |

## 3. AI chat race đã được loại bỏ

SSE mock phát conversation, text và done liên tiếp. Client sau done gọi lại
GET /api/ai/conversations/:id để reconcile dữ liệu đã lưu. Fixture cũ rơi vào
default response là mảng rỗng, khiến câu trả lời có thể xuất hiện rồi bị xóa trước
assertion.

Fix:

- Mock trả conversation hoàn chỉnh với user/assistant messages sau done.
- Firefox AI test được chạy lặp ba lần và pass 3/3.
- Full matrix giới hạn ba workers để Vite dev server phục vụ ba engine ổn định.
- Full matrix sau fix pass 105/105, không dùng retry cục bộ để che lỗi.

## 4. Browser matrix và artifacts

- PR/default E2E chạy Chromium để feedback nhanh.
- PW_FULL_BROWSER_MATRIX=true bật thêm Firefox và WebKit.
- CI retry một lần cho lỗi hạ tầng; local không retry.
- Screenshot chỉ lưu khi fail, video giữ khi fail, trace bật ở lần retry đầu.
- Nightly workflow upload Playwright report và test-results trong 14 ngày.

## 5. Continuous Integration

Workflow CI trên pull request và push main:

- Client: npm ci, lint, unit tests, production build, upload dist.
- Server: npm ci, toàn bộ tests.
- E2E: cài Chromium và chạy 35 browser tests.
- Concurrency hủy run cũ cùng branch để tiết kiệm tài nguyên.

Nightly workflow:

- Cài Chromium, Firefox và WebKit cùng system dependencies.
- Bật full browser matrix.
- Chạy 105 tests và luôn giữ artifacts.
- Có workflow_dispatch để chạy thủ công trước release.

Build CI dùng SKIP_DYNAMIC_ROUTES=true để không phụ thuộc production API trong lúc
compile. Release build thật vẫn fetch route động và phải kiểm tra sitemap/prerender.

## 6. Bounded load smoke

server/src/scripts/loadSmoke.js chỉ gửi GET và có guard:

- Mặc định chỉ cho localhost.
- Remote target cần ALLOW_REMOTE_LOAD_SMOKE=true.
- Request count giới hạn 1-500.
- Concurrency giới hạn 1-20.
- Có timeout, maximum error rate và maximum P95.
- Exit code 2 khi vượt ngưỡng.

Ví dụ staging, chỉ chạy sau phê duyệt:

~~~powershell
$env:LOAD_BASE_URL = "https://staging-api.example.com"
$env:ALLOW_REMOTE_LOAD_SMOKE = "true"
$env:LOAD_REQUESTS = "60"
$env:LOAD_CONCURRENCY = "5"
npm run load:smoke
~~~

Load smoke chưa được chạy vào staging/production trong phiên local này.

## 7. Release và incident readiness

Đã thêm:

- Release checklist từ pre-staging tới rollback.
- Incident severity, 15 phút đầu, diagnosis, containment và recovery.
- Backup/restore runbook, restore drill trên cluster cô lập.
- Atlas Vector Search rollout và fallback.

Các runbook cấm drop index trong incident, cấm restore đè production khi chưa có
approval và yêu cầu không đưa token/cookie/PII/raw AI conversation vào log.

## 8. Build và sitemap stability

- Sitemap và prerender API URL có thể cấu hình bằng environment.
- Fetch route động có timeout 10 giây.
- Nếu nguồn động lỗi, generator giữ sitemap tốt gần nhất thay vì ghi đè bằng
  danh sách tĩnh; REQUIRE_DYNAMIC_ROUTES=true cho phép release fail nghiêm ngặt.
- CI có deterministic static-route mode.
- Production build cuối compile thành công và prerender 20/20 route.
- Bundle budget chạy sau build và fail CI nếu entry/route/deferred PDF vượt ngưỡng.

Trong một lượt build, production API đã timeout ở một số sitemap request và
recipes trả 404; fallback giữ build thành công. Đây là trạng thái deployment ngoài
repo. Release phải deploy server trước client và xác nhận lại sitemap động.

## 9. File thay đổi trong Phase 5

### Browser E2E

- playwright.config.js
- e2e/mock-api.cjs
- e2e/ai-chat.spec.js
- e2e/auth.spec.js
- e2e/authorization.spec.js
- e2e/checkin.spec.js
- e2e/coaching.spec.js
- e2e/contract.spec.js
- e2e/deposit-wallet.spec.js
- e2e/homepage.spec.js
- e2e/knowledge-base.spec.js
- e2e/public-pages.spec.js
- e2e/recipe-blog.spec.js

### CI và deterministic build

- .github/workflows/ci.yml
- .github/workflows/e2e-nightly.yml
- client/scripts/generate-sitemap.js
- client/scripts/prerender.js
- client/scripts/check-bundle-budget.js
- client/package.json

### Load/release operations

- server/src/scripts/loadSmoke.js
- server/package.json
- docs/release-checklist.md
- docs/incident-runbook.md
- docs/backup-restore-runbook.md
- docs/atlas-vector-index.md
- docs/phase-5-fix-report-2026-07-19.md

## 10. Việc còn cần môi trường thật

1. Push branch để GitHub Actions chạy thực tế trên Ubuntu.
2. Chạy restore drill vào cluster staging cô lập và ghi RPO/RTO.
3. Chạy bounded load smoke trên staging trong cửa sổ được duyệt.
4. Cấu hình dashboard/alert provider nhận metrics và structured logs.
5. Chạy migration/index verify/explain sau backup.
6. Tạo Atlas vector index rồi mới bật KB_VECTOR_INDEX.
7. Deploy server trước client, kiểm tra endpoint recipes và sitemap động.

Các mục trên không phải code còn thiếu; chúng là bước triển khai có tác động tới
hạ tầng và dữ liệu thật, nên không được tự động thực hiện từ workspace local.
