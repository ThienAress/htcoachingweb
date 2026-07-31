# HT Coaching Web - Phase 0 Fix Report

**Ngày hoàn tất:** 2026-07-19
**Phạm vi:** containment cho Check-in secrets, Recipe publish boundary, Coaching field ownership/upload, media URL và Gemini retry.

## Kết quả

- Check-in không còn serialize full `User`; response chỉ trả `_id`, `name`, `email`, `avatar`.
- `password` và `refreshToken` bị ẩn mặc định ở Mongoose schema.
- Refresh-token controller select secret rõ ràng bằng `.select("+refreshToken")`, đã có integration test.
- Public Recipe chỉ truy vấn `isPublished: true` cho list, detail, category, area, bookmark list và bookmark mutation.
- Client Coaching không thể thay thế trainer-owned fields như tên bài, sets, reps, weight và demo URL.
- Feedback được merge theo exercise `_id`; chỉ chấp nhận `completed`, `clientFeedbackNote`, `clientFeedbackVideo`.
- Feedback text/note/video URL có giới hạn và validation.
- Coaching upload giảm từ 100 MB xuống 25 MB; MIME và extension đều phải là video.
- URL Cloudinary tuyệt đối không còn bị prefix thêm server URL.
- Gemini retry sau response 400 thành công được tiếp tục stream thay vì rơi vào error branch.

## File đã thay đổi

### Server source

1. `server/src/models/User.js`
   - Thêm `select: false` cho password và refresh token.
2. `server/src/controllers/auth.controller.js`
   - Explicit select refresh token trong refresh flow.
3. `server/src/controllers/checkin.controller.js`
   - Dùng projection/lean và response DTO cho user.
4. `server/src/controllers/recipe.controller.js`
   - Áp dụng strict published boundary trên toàn bộ public/user read flow.
5. `server/src/controllers/coaching.controller.js`
   - Merge feedback theo field ownership, validate feedback text.
6. `server/src/utils/coachingFeedback.js`
   - Helper mới để parse, validate và merge exercise feedback an toàn.
7. `server/src/middlewares/coachingUpload.js`
   - Giới hạn 25 MB và kiểm tra MIME + extension.
8. `server/src/services/ai/providers/gemini.provider.js`
   - Sửa control flow retry 400.
9. `server/vitest.config.js`
   - Chạy test files tuần tự để các MongoMemory integration suite không dùng chung Mongoose connection đồng thời.

### Client source

10. `client/src/utils/mediaUrl.js`
    - Helper mới để resolve absolute/server-relative media URL.
11. `client/src/pages/customer/OnlineCoaching.jsx`
    - Dùng media helper và đồng bộ upload cap 25 MB.
12. `client/src/pages/trainer/TrainerCoaching.jsx`
    - Dùng media helper cho demo/feedback video và đồng bộ cap 25 MB.

Hai Coaching page đã có thay đổi của chủ dự án trước Phase 0. Patch chỉ thay import/helper, media `src` và giới hạn upload; không revert phần còn lại.

### Regression tests

13. `server/src/controllers/__tests__/phase0.security.integration.test.js`
    - Check-in secret, refresh flow, Recipe draft boundary và Coaching field ownership.
14. `server/src/middlewares/__tests__/coachingUpload.test.js`
    - Upload size và MIME/extension spoofing.
15. `server/src/services/ai/providers/__tests__/gemini.provider.test.js`
    - Initial 400, retry 200 và stream response.
16. `client/src/utils/__tests__/mediaUrl.test.js`
    - Absolute, relative, empty URL và API suffix.

## Verification

- Server Vitest: **8 files, 58 tests passed**.
- Client Vitest: **4 files, 84 tests passed**.
- Tổng: **142 tests passed**.
- Targeted client ESLint: **passed, 0 warning/error**.
- Vite production build: **passed, 2,535 modules transformed**.
- `node --check` cho server source/test và client utilities: **passed**.
- Scoped `git diff --check`: **passed**; chỉ có cảnh báo LF/CRLF của Git.

Không chạy lại Playwright trong Phase 0. Baseline gần nhất là 20 passed, 2 locale-dependent failures; Phase 5 sẽ làm deterministic harness.

## Rủi ro còn lại chuyển sang Phase 1

- Coaching trainer upsert vẫn có thể ghi đè client progress khi concurrent; cần revision/field-owned patch hoặc tách assignment/progress.
- Upload vẫn dùng `memoryStorage`; 25 MB chỉ là containment, chưa phải kiến trúc streaming/direct upload.
- Standalone feedback upload chưa gắn plan/exercise trước khi gửi Cloudinary.
- Check-in chưa có idempotency key và delete refund chưa dùng atomic `$inc`.
- Bookmark Recipe vẫn là toggle read-modify-save, chưa idempotent/atomic.
- Contract partial unique index và F1 Intake latest invariant chưa migration.
- Training reminder recurring occurrence chưa được redesign.

## Trạng thái Phase 0

**Hoàn tất.** Các P0 containment trong phạm vi phase đã có regression test. Phase 1 nên bắt đầu từ Coaching concurrency/ownership model, sau đó Check-in idempotency và Contract index migration.
