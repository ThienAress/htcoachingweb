# HT Coaching Web - Codebase Audit

Ngày đánh giá: 2026-07-18
Phạm vi: `client`, `server`, cấu hình root, unit test, production build và dependency audit.
Trạng thái: Báo cáo phân tích, chưa áp dụng sửa đổi vào source code.

## 1. Kết luận tổng thể

HT Coaching Web có nền móng tốt so với một dự án phát triển trong khoảng 4-5 tháng. Kiến trúc domain tương đối rõ, authentication có nhiều lớp bảo vệ, validation khá rộng và luồng ví/nạp tiền đã có transaction, idempotency, optimistic locking cùng audit log.

Rủi ro lớn nhất hiện tại không nằm ở dependency mà nằm ở logic ứng dụng và vận hành:

1. Một số thao tác contract và F1 chưa an toàn khi có nhiều request đồng thời.
2. Ảnh F1 đang nằm trên local disk, có thể mất khi deploy/restart hoặc chạy nhiều server instance.
3. CORS và OAuth redirect đang tin cậy toàn bộ `*.netlify.app`, rộng hơn nhu cầu production.
4. Bundle React lớn, đặc biệt là ExercisesPage, global ChatPanel và ảnh Hero.
5. Lint đang có lỗi thật có thể gây runtime error hoặc state không nhất quán.
6. Test hiện tại có nền tốt nhưng chưa phủ các luồng nghiệp vụ có rủi ro cao nhất.

Thứ tự nên xử lý: **Data integrity và storage -> security boundary -> lỗi runtime/lint -> performance -> observability và test mở rộng**.

## 2. Kết quả kiểm chứng

| Hạng mục | Kết quả |
| --- | --- |
| Client unit test | 80/80 test pass |
| Server unit test | 52/52 test pass |
| Tổng unit test | 132/132 test pass |
| Root dependency audit | 0 vulnerability được phát hiện |
| Client dependency audit | 0 vulnerability được phát hiện |
| Server dependency audit | 0 vulnerability được phát hiện |
| Client production build | Thành công |
| Client lint | Thất bại: 120 errors, 33 warnings |
| E2E | Chưa chạy trong đợt audit này |

`npm audit` sạch chỉ xác nhận chưa phát hiện CVE đã biết trong dependency. Kết quả này không thay thế việc review authorization, concurrency, upload và business logic.

## 3. Phân loại ưu tiên

- **P0 - Khắc phục ngay:** Có nguy cơ mất dữ liệu, tạo dữ liệu trùng, sai quyền hoặc gây lỗi production rõ ràng.
- **P1 - Ưu tiên cao:** Có ảnh hưởng đáng kể đến bảo mật, hiệu suất hoặc độ ổn định khi lượng người dùng tăng.
- **P2 - Cải thiện có kế hoạch:** Chưa phải sự cố tức thời nhưng làm tăng chi phí vận hành và rủi ro lâu dài.
- **P3 - Tối ưu thêm:** Nâng chất lượng phát triển, trải nghiệm và khả năng scale.

## 4. Những phần đã làm tốt

### 4.1 Authentication và security foundation

- Access token và refresh token được lưu bằng `httpOnly cookie`.
- Access token có thời hạn ngắn; refresh token có thời hạn riêng.
- Refresh token được hash trước khi lưu database.
- Có CSRF protection cho các mutation nhạy cảm như refresh/logout, booking và admin routes.
- So sánh CSRF token sử dụng `timingSafeEqual`.
- Có Helmet/CSP và global API rate limit trong production.
- Development auth bypass được giới hạn ngoài production.

Tham chiếu:

- `server/src/routes/auth.routes.js`
- `server/src/controllers/auth.controller.js`
- `server/src/middlewares/csrf.js`
- `server/server.js`

### 4.2 Wallet, deposit và trainer subscription

Đây là phần chắc tay nhất của codebase:

- Sử dụng MongoDB session/transaction.
- Có idempotency key và unique index cho transaction.
- Có optimistic locking thông qua trường `version` của wallet.
- Kiểm tra `modifiedCount` để phát hiện concurrent update.
- Deposit code là unique.
- Có partial unique index giới hạn pending deposit của user.
- Có audit log trong transaction.

Tham chiếu:

- `server/src/controllers/adminDeposit.controller.js`
- `server/src/controllers/trainerSubscription.controller.js`
- `server/src/models/Wallet.js`
- `server/src/models/WalletTransaction.js`
- `server/src/models/DepositRequest.js`

### 4.3 Authorization F1 Customer

- Non-admin chỉ lấy customer được assign cho trainer đó.
- Các thao tác đọc/sửa/xóa customer gọi helper kiểm tra ownership.
- Cascade delete sử dụng transaction.

Tham chiếu:

- `server/src/controllers/f1Customer/customer.controller.js`
- `server/src/controllers/f1Customer/shared.js`

### 4.4 Validation

Validation middleware đã bao phủ nhiều domain: intake, order, booking, contract, food và ObjectId. Đây là nền tốt để tiếp tục chuẩn hóa input tại server boundary.

Tham chiếu: `server/src/middlewares/validation.js`.

### 4.5 React foundation

- Phần lớn page route được lazy-load bằng `React.lazy`.
- Có `Suspense` ở route boundary.
- TanStack Query được cấu hình global với `staleTime` và tắt refetch khi focus.
- Auth context có sử dụng `useMemo` và `useCallback`.

Tham chiếu:

- `client/src/App.jsx`
- `client/src/main.jsx`
- `client/src/contexts/AuthContext.jsx`

## 5. Danh sách vấn đề P0 - Khắc phục ngay

### DATA-01: Contract có thể bị tạo trùng khi request đồng thời

**Hiện trạng:** Service kiểm tra contract theo `orderId`, sau đó mới gọi `Contract.create`. Model mới có index thường trên `orderId`, chưa có database constraint ngăn dữ liệu trùng.

**Rủi ro:** Hai request đồng thời có thể cùng vượt qua bước kiểm tra và tạo hai contract cho cùng một order.

**Hướng xử lý:**

- Thiết kế unique constraint cho một contract active trên mỗi `orderId`.
- Không chỉ dựa vào bước `find` trước `create`.
- Bắt Mongo duplicate-key error và trả response nghiệp vụ ổn định.
- Thêm integration test gửi nhiều create request đồng thời.

Tham chiếu:

- `server/src/services/contract.service.js` quanh hàm tạo contract.
- `server/src/models/Contract.js` tại index `orderId`.

### DATA-02: Contract signing chưa atomic

**Hiện trạng:** Luồng sign kiểm tra status, tạo PDF/GridFS, sau đó mới save trạng thái signed.

**Rủi ro:** Hai request sign đồng thời có thể tạo nhiều PDF, ghi đè metadata hoặc trả kết quả không nhất quán.

**Hướng xử lý:**

- Reserve trạng thái bằng atomic `findOneAndUpdate` với điều kiện status hiện tại.
- Có trạng thái trung gian như `signing`, hoặc khóa logic tương đương.
- Nếu tạo PDF lỗi, rollback/resume theo quy tắc rõ ràng.
- Chỉ một request được phép chuyển `sent/viewed -> signing/signed`.

Tham chiếu: `server/src/services/contract.service.js`, hàm `signContract`.

### DATA-03: Theo dõi tải contract có race condition

**Hiện trạng:** Code kiểm tra `clientDownloadedAt`, sau đó mới set giá trị.

**Rủi ro:** Request đồng thời có thể cùng vượt qua điều kiện và tạo event/trạng thái lặp.

**Hướng xử lý:** Dùng atomic update với filter gồm `_id`, `clientId` và `clientDownloadedAt: null`.

Tham chiếu: `server/src/services/contract.service.js`, hàm track client download.

### DATA-04: F1 code được sinh bằng `countDocuments() + 1`

**Hiện trạng:** Hai request tạo customer có thể đọc cùng một count.

**Rủi ro:** Duplicate code; request có thể fail ngẫu nhiên vì model đã có unique constraint.

**Hướng xử lý:**

- Dùng counter collection và atomic `$inc`; hoặc
- Sinh code độc lập với count rồi retry có giới hạn khi duplicate key.

Tham chiếu: `server/src/controllers/f1Customer/shared.js`, hàm `generateF1Code`.

### STAB-01: Ảnh F1 đang lưu trên local disk

**Hiện trạng:** Multer dùng `diskStorage`, server public thư mục `/uploads`, URL phụ thuộc protocol/host của request.

**Rủi ro:**

- File có thể mất khi Render/container restart hoặc redeploy.
- Nhiều server instance không nhìn thấy cùng một file.
- Database còn URL nhưng file vật lý không tồn tại.
- Backup database không bao gồm media.

**Hướng xử lý:**

- Chuyển F1 media sang Cloudinary, S3 hoặc object storage đang dùng chung.
- Database chỉ lưu provider key, secure URL và metadata.
- Có migration cho file đang tồn tại.
- Chỉ xóa record sau khi object storage xác nhận hoặc có retry job.

Tham chiếu:

- `server/src/middlewares/f1MediaUpload.js`
- `server/src/controllers/f1Customer/media.controller.js`
- `server/server.js` tại route `/uploads`.

### QUAL-01: Lint có lỗi có khả năng ảnh hưởng runtime

**Kết quả:** 120 errors và 33 warnings.

Các lỗi đáng chú ý:

- `App.jsx` mutate `window.isIntroDone` trong render.
- ChatPanel set state đồng bộ trong effect và thiếu dependencies.
- `ExerciseListModal` truy cập function trước declaration.
- `ExercisesPage` đọc ref trong render.
- `WorkoutPlanDetail` có các identifier chưa định nghĩa như `t`, `i18n`, `formatDate`.

**Hướng xử lý:**

- Sửa toàn bộ `no-undef` và lỗi render/hook trước.
- Phân loại React Compiler warning sau khi lỗi runtime đã sạch.
- Đưa lint vào CI và không cho merge khi còn error.

Tham chiếu:

- `client/src/App.jsx`
- `client/src/components/ChatWidget/ChatPanel.jsx`
- `client/src/pages/ExercisesPage/ExerciseListModal.jsx`
- `client/src/pages/ExercisesPage/ExercisesPage.jsx`
- `client/src/pages/trainer/WorkoutPlanDetail.jsx`

## 6. Danh sách vấn đề P1 - Ưu tiên cao

### SEC-01: Credentialed CORS cho toàn bộ `*.netlify.app`

**Hiện trạng:** Origin động cho phép mọi HTTPS subdomain của Netlify, trong khi API cho phép cookie credentials.

**Rủi ro:** Trust boundary rộng hơn production domain; một site Netlify không thuộc hệ thống có thể trở thành origin được CORS chấp nhận.

**Hướng xử lý:**

- Whitelist domain production cụ thể.
- Nếu cần preview deploy, cung cấp allowlist preview có kiểm soát qua environment variable.
- Không dùng wildcard logic cho public hosting domain kết hợp credential.
- Test CORS cho allowed origin, denied origin và request không có Origin.

Tham chiếu: `server/server.js`, cấu hình `corsOptions`.

### SEC-02: OAuth state chưa được ký

**Hiện trạng:** State chứa `clientUrl` dưới dạng JSON base64. Callback chấp nhận localhost, production client hoặc bất kỳ `*.netlify.app`.

**Rủi ro:** State có thể bị chỉnh sửa; redirect boundary phụ thuộc vào allowlist rộng.

**Hướng xử lý:**

- Ký state bằng HMAC hoặc lưu nonce server-side.
- Thêm `issuedAt`, expiry ngắn và one-time nonce.
- Redirect target phải map từ server-side allowlist, không tin URL do client cung cấp.
- Thu hẹp Netlify preview origin như SEC-01.

Tham chiếu: `server/src/routes/auth.routes.js`, phần Google OAuth state/callback.

### SEC-03: Upload ảnh chỉ tin MIME do client gửi

**Hiện trạng:** F1 upload kiểm tra `mimetype.startsWith("image/")`.

**Rủi ro:** Client có thể giả MIME; file không phải ảnh có thể được lưu và public.

**Hướng xử lý:**

- Kiểm tra magic bytes bằng parser phù hợp.
- Decode và re-encode ảnh ở server/provider.
- Giới hạn dimension, dung lượng và format.
- Sinh tên file server-side, không sử dụng tên gốc để quyết định loại file.

Tham chiếu: `server/src/middlewares/f1MediaUpload.js`.

### DATA-05: Intake và customer được cập nhật riêng lẻ

**Hiện trạng:** Save/submit intake và cập nhật customer status/lastIntakeId không luôn nằm trong cùng transaction.

**Rủi ro:** Một bước thành công, bước còn lại thất bại, tạo dữ liệu nửa chừng.

**Hướng xử lý:** Dùng transaction cho các cập nhật đa document và thêm retry cho transient transaction error.

Tham chiếu: `server/src/controllers/f1Customer/intake.controller.js`.

### DATA-06: Order update chưa có state machine chặt

**Hiện trạng:** Admin update cho phép sửa trực tiếp `status`, `sessions`, `totalSessions`, `trainerId`; approve không khóa theo current status.

**Rủi ro:** Có thể chuyển trạng thái ngược hoặc bỏ qua bước nghiệp vụ, ví dụ completed quay về pending.

**Hướng xử lý:**

- Khai báo transition map rõ ràng.
- Atomic update có filter current status.
- Audit ai thay đổi, từ trạng thái nào sang trạng thái nào.
- Tách endpoint command như approve/cancel/complete thay vì generic status update.

Tham chiếu: `server/src/controllers/order.controller.js`.

### DATA-07: Training schedule cần kiểm tra quan hệ trainer-client

**Hiện trạng:** Tạo schedule kiểm tra client tồn tại và update/delete kiểm tra owner schedule, nhưng chưa đủ bằng chứng rằng client đó thuộc trainer qua approved order/subscription.

**Rủi ro:** Trainer có quyền truy cập có thể tạo hoặc chuyển schedule sang client không thuộc phạm vi quản lý.

**Hướng xử lý:**

- Kiểm tra active/approved relationship giữa trainer và client khi create và khi đổi clientId.
- Đóng gói kiểm tra vào shared authorization helper.
- Thêm test IDOR giữa hai trainer.

Tham chiếu:

- `server/src/controllers/trainingSchedule.controller.js`
- `server/src/routes/trainingSchedule.routes.js`

### PERF-01: ExercisesPage chunk quá lớn

**Kết quả build:** Khoảng 1,579 KB minified và 525 KB gzip.

**Tác động:** Tải, parse và execute JS chậm trên mobile; route có thể phản hồi muộn dù API nhanh.

**Hướng xử lý:**

- Lazy-load PDF/export dependency chỉ khi user bấm export.
- Tách modal/editor lớn thành dynamic imports.
- Kiểm tra `@react-pdf/renderer` và các thư viện nặng bằng bundle analyzer.
- Đặt route chunk budget khoảng 250-300 KB gzip, điều chỉnh theo dữ liệu thực tế.

### PERF-02: Main bundle chứa global ChatPanel

**Kết quả build:** Main chunk khoảng 842 KB minified và 267 KB gzip.

**Hiện trạng:** App import ChatPanel sớm và mount trên nhiều authenticated route, dù user chưa mở chat.

**Hướng xử lý:**

- Giữ một chat trigger nhẹ trong main bundle.
- Dynamic import panel, history, markdown renderer và AI chat logic khi mở lần đầu.
- Chỉ load conversations sau khi panel thực sự mở.

Tham chiếu:

- `client/src/App.jsx`
- `client/src/components/ChatWidget/ChatPanel.jsx`

### PERF-03: Hero image quá lớn

**Kết quả build:** `hero2` khoảng 3 MB.

**Tác động:** LCP chậm, tốn băng thông và ảnh hưởng mạnh trên mạng di động.

**Hướng xử lý:**

- Chuyển sang AVIF/WebP với JPEG fallback nếu cần.
- Sinh nhiều kích thước và dùng `srcset/sizes`.
- Preload duy nhất ảnh LCP đầu tiên.
- Lazy-load các slide còn lại.
- Đặt image budget theo viewport, thường dưới 200-350 KB cho ảnh hero mobile/desktop đã tối ưu.

Tham chiếu: `client/src/sections/Hero.jsx`.

### PERF-04: Hero timer bị tạo lại theo slide

**Hiện trạng:** Effect autoplay phụ thuộc `currentIndex`, nên interval được clear/tạo lại mỗi lần đổi slide.

**Tác động:** Không phải bottleneck lớn nhất nhưng gây churn và làm logic autoplay khó ổn định.

**Hướng xử lý:** Dùng functional state update và dependency ổn định theo số lượng slide/pause state.

Tham chiếu: `client/src/sections/Hero.jsx`.

### PERF-05: Chat render toàn bộ lịch sử message

**Hiện trạng:** Message list map toàn bộ history.

**Tác động:** DOM và markdown rendering tăng tuyến tính khi conversation dài.

**Hướng xử lý:** Pagination/cursor cho history, giới hạn window message và virtualize khi dữ liệu đủ lớn.

Tham chiếu: `client/src/components/ChatWidget/ChatPanel.jsx`.

### PERF-06: Nhiều page fetch thủ công và reload toàn bộ danh sách

**Hiện trạng:** F1Customers, KnowledgeBase và MyWallet quản lý loading/data/error bằng nhiều state riêng; mutation thường gọi lại fetch toàn bộ.

**Tác động:** Request dư, UI chớp loading, cache phân tán và dễ stale state.

**Hướng xử lý:**

- Chuẩn hóa query key bằng TanStack Query.
- Dùng mutation + targeted invalidation hoặc optimistic update.
- Dedupe request và giữ previous data khi phân trang/filter.

Tham chiếu:

- `client/src/pages/F1Customers.jsx`
- `client/src/pages/KnowledgeBase.jsx`
- `client/src/pages/MyWallet.jsx`

## 7. Danh sách vấn đề P2 - Cải thiện có kế hoạch

### SEC-04: Global JSON body limit 50 MB

**Rủi ro:** Endpoint JSON thông thường có thể nhận payload rất lớn, tăng memory/CPU pressure và bề mặt DoS.

**Hướng xử lý:** Đặt global limit thấp, ví dụ 1-2 MB; endpoint cần payload lớn dùng parser/limit riêng hoặc upload trực tiếp object storage.

Tham chiếu: `server/server.js`.

### SEC-05: Rate limit chỉ bật trong production

**Rủi ro:** Staging không phản ánh production; lỗi cấu hình `NODE_ENV` có thể vô tình tắt limiter.

**Hướng xử lý:** Bật theo explicit configuration, có default an toàn và integration test kiểm tra limiter.

### SEC-06: Request không có Origin được CORS cho qua

Đây không mặc định là lỗ hổng vì server-to-server và mobile client có thể không gửi Origin. Tuy nhiên cần phân loại endpoint rõ ràng:

- Browser mutation phải dựa vào CSRF và origin policy.
- Webhook/server integration phải có signature/API authentication riêng.
- Không coi thiếu Origin là bằng chứng request đáng tin.

### SEC-07: Mongo sanitize không xử lý query

**Hiện trạng:** Custom sanitizer xử lý body/params; query bị bỏ qua do behavior Express 5.

**Rủi ro:** Query handler nào truyền object trực tiếp vào Mongo có thể mở ra operator injection.

**Hướng xử lý:** Parse query thành DTO primitive cụ thể, dùng validation schema và không truyền `req.query` trực tiếp vào Mongoose.

Tham chiếu: `server/server.js`.

### SEC-08: Public exercise suggestion mutation cần quyết định CSRF rõ ràng

Endpoint public có limiter và optional auth nhưng không dùng CSRF. Nếu request chỉ tạo anonymous suggestion và không dựa vào cookie identity thì có thể chấp nhận. Nếu server gắn suggestion với logged-in user dựa trên cookie, cần thêm CSRF hoặc tách hẳn anonymous/authenticated behavior.

Tham chiếu: `server/src/routes/exerciseSuggestion.routes.js`.

### STAB-02: Logging chưa tập trung

**Hiện trạng:** Nhiều `console.log/error` nằm rải trong controller/service.

**Rủi ro:** Khó theo dõi một request xuyên hệ thống, log có thể chứa PII hoặc payload nhạy cảm, khó đặt alert.

**Hướng xử lý:**

- Structured logger với level.
- Request/correlation ID.
- Redact token, cookie, email, phone và health data.
- Central error middleware thống nhất error code.
- Kết nối error monitoring và alert cho payment/deposit/contract failure.

### STAB-03: Cần xác nhận backup và restore database/media

Không thể kết luận chính sách hạ tầng chỉ từ source code. Trước production cần có:

- Automated Mongo backup.
- Retention policy.
- Restore drill định kỳ.
- Backup hoặc lifecycle policy cho media.
- Runbook xử lý transaction/deposit bị treo.

### STAB-04: Mongo transaction phụ thuộc deployment topology

Các luồng wallet dùng transaction đúng hướng, nhưng MongoDB phải chạy replica set/sharded cluster phù hợp. Cần startup health check hoặc deployment documentation để tránh chạy production trên topology không hỗ trợ transaction.

### DATA-08: Search dùng regex từ input

**Rủi ro:** Regex phức tạp hoặc input không escape có thể tiêu tốn CPU và cho kết quả ngoài ý muốn.

**Hướng xử lý:** Escape regex metacharacter, giới hạn độ dài search và cân nhắc text index cho dữ liệu lớn.

Tham chiếu: `server/src/controllers/booking.controller.js`.

### PERF-07: Home render/import nhiều section cùng lúc

Home route đã lazy ở cấp page, nhưng các below-the-fold section vẫn đi cùng Home chunk. Có thể lazy-load section nặng phía dưới viewport bằng dynamic import kết hợp IntersectionObserver, nhưng không nên chia nhỏ quá mức nếu section nhẹ.

Tham chiếu: `client/src/pages/Home.jsx`.

### QUAL-02: Test chưa phủ các luồng rủi ro cao nhất

Các test hiện có tạo nền tốt cho auth, CSRF và deposit. Cần bổ sung:

- Concurrent contract create/sign/download.
- F1 code collision/retry.
- F1 media ownership và file validation.
- Training schedule IDOR giữa hai trainer.
- Order state transitions.
- Intake transaction rollback.
- Refresh token rotation/reuse behavior.
- CORS origin matrix.
- Rate limit và upload size limit.

### QUAL-03: Chưa thấy CI workflow trong repo

**Hướng xử lý:** Thiết lập pipeline tối thiểu chạy install lockfile, lint, unit test, production build và selected E2E. Migration/index deployment cần có bước kiểm tra riêng.

### QUAL-04: E2E cần tập trung vào critical journey

Ưu tiên các journey:

1. Login/refresh/logout và Google OAuth callback.
2. User tạo deposit, admin approve/reject, wallet balance chính xác.
3. Tạo/approve order, tạo và ký contract.
4. Trainer truy cập đúng customer F1 và không truy cập customer trainer khác.
5. Booking public có CSRF/rate limit đúng hành vi mong đợi.

## 8. React render checklist chi tiết

Không nên `memo` mọi component theo thói quen. Thứ tự tối ưu nên dựa trên đo lường:

1. Giảm network payload: ảnh và chunk.
2. Lazy-load thư viện chỉ dùng sau interaction.
3. Giảm số request và chuẩn hóa cache.
4. Giảm DOM cho list dài.
5. Sau đó mới dùng React Profiler để xác định component re-render đắt.

Checklist:

- [ ] Dynamic import PDF/export feature.
- [ ] Dynamic import full ChatPanel khi mở.
- [ ] Tối ưu Hero AVIF/WebP/srcset.
- [ ] Sửa mutation trong render ở App.
- [ ] Sửa effect dependencies và state cascade trong ChatPanel.
- [ ] Pagination/virtualization cho chat và exercise list.
- [ ] Chuyển F1Customers/KnowledgeBase/MyWallet sang TanStack Query.
- [ ] Dùng stable query keys và targeted invalidation.
- [ ] Chạy React Profiler cho Home, ExercisesPage và ChatPanel.
- [ ] Thêm bundle analyzer và bundle budget vào CI.

## 9. Server-side data integrity checklist

- [ ] Unique/partial unique constraint cho contract active theo order.
- [ ] Atomic state transition khi create/sign/download contract.
- [ ] Counter hoặc duplicate-key retry cho F1 code.
- [ ] Transaction cho intake + customer update.
- [ ] Order state transition map và audit log.
- [ ] Ownership check cho training schedule create/update.
- [ ] Escape search regex và giới hạn input.
- [ ] Kiểm tra mọi multi-document mutation có cần transaction hay không.
- [ ] Mọi retryable mutation quan trọng có idempotency key.
- [ ] Xác nhận production Mongo hỗ trợ transaction.
- [ ] Migration/index script có rollback/runbook.

## 10. Security checklist

- [ ] Thu hẹp credentialed CORS allowlist.
- [ ] Ký OAuth state, nonce một lần và expiry.
- [ ] Kiểm tra file magic bytes và re-encode ảnh.
- [ ] Giảm global body limit.
- [ ] Phân loại rõ endpoint browser, public và webhook.
- [ ] Rà soát CSRF cho mọi cookie-authenticated mutation.
- [ ] Validate query thành primitive DTO.
- [ ] Structured logging và redaction PII/token.
- [ ] Security headers/CSP được test trong production response.
- [ ] Secret rotation và incident runbook được lưu ngoài source code.

## 11. Roadmap triển khai đề xuất

### Giai đoạn 1: 1-2 ngày - Chặn rủi ro trực tiếp

- Sửa lỗi lint/runtime quan trọng.
- Thêm unique/atomic behavior cho contract.
- Sửa generator F1 code.
- Thu hẹp CORS và ký OAuth state.
- Thêm order transition guard tối thiểu.
- Bật CI cho lint, unit test và build.

**Điều kiện hoàn thành:** lint không còn error; concurrent tests không tạo duplicate; origin ngoài allowlist bị từ chối.

### Giai đoạn 2: 3-5 ngày - Củng cố dữ liệu và storage

- Chuyển F1 media sang object storage.
- Transaction hóa intake/customer.
- Bổ sung schedule ownership.
- Kiểm tra file content thực.
- Viết integration test cho contract, F1, order và schedule.

**Điều kiện hoàn thành:** restart/deploy không làm mất media; rollback test không để dữ liệu nửa chừng; IDOR tests pass.

### Giai đoạn 3: Khoảng 1 tuần - Tối ưu frontend

- Split ExercisesPage/PDF/export.
- Lazy-load ChatPanel.
- Tối ưu Hero assets.
- Chuẩn hóa data fetching bằng TanStack Query.
- Virtualize list cần thiết.
- Đo Lighthouse và React Profiler trước/sau.

**Điều kiện hoàn thành:** route chunk đạt budget đã chọn; LCP mobile được cải thiện; không tăng request trùng.

### Giai đoạn 4: Vận hành lâu dài

- Structured logging, request ID và error monitoring.
- Backup/restore drill.
- Critical E2E trên CI.
- Load test API quan trọng.
- Release checklist và incident runbook.

## 12. Thứ tự ticket đề xuất

1. `DATA-01/02/03` - Contract uniqueness và atomic transitions.
2. `DATA-04` - F1 code concurrency.
3. `STAB-01 + SEC-03` - F1 object storage và file validation.
4. `QUAL-01` - Fix lint/runtime và CI gate.
5. `SEC-01/02` - CORS và OAuth state.
6. `DATA-05/06/07` - Intake transaction, order state machine, schedule ownership.
7. `PERF-01/02/03` - Exercises, ChatPanel và Hero payload.
8. `PERF-05/06` - Virtualization và TanStack Query migration.
9. `STAB-02/03/04` - Logging, backup và deployment verification.
10. `QUAL-02/04` - Integration/E2E coverage cho critical journeys.

## 13. Ghi chú phạm vi

- Báo cáo dựa trên source code và các lệnh kiểm chứng local tại thời điểm 2026-07-18.
- Không có quyền quan sát trực tiếp cấu hình Render/Netlify/Mongo production, secret manager, backup job hoặc monitoring dashboard; các mục hạ tầng được ghi là cần xác nhận, không khẳng định chúng đang thiếu.
- Chưa thực hiện penetration test, load test hoặc chạy full E2E trong đợt này.
- Chưa có source code nào được sửa ngoài việc thêm tài liệu audit này.
