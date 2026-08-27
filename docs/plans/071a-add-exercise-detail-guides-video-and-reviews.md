# Plan 071A: Thêm chi tiết bài tập, hướng dẫn setup, video và đánh giá

> **Hướng dẫn thực thi**: Follow plan step by step và chạy verification của từng
> behavior slice trước khi chuyển bước. Không migration/backfill hoặc ghi production.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 047, 071
- **Category**: feature | ui | api | schema | seo | tests
- **Planned at**: 2026-08-26
- **Status**: DONE / LOCAL VERIFIED — LIVE CLOUDINARY + STRICT PRERENDER PENDING

## Outcome

Thay detail dialog ít thông tin bằng trang chi tiết giống cấu trúc công thức: giữ
tên, ảnh, nhóm cơ, mô tả và đánh giá kỹ thuật của Admin; hiển thị toàn bộ các bước
setup theo chiều dọc; phát video do Admin upload; và đặt đánh giá từ người tập ở
một section độc lập. Bài cũ vẫn hoạt động khi chưa có hướng dẫn hoặc video.

## Scope

- Exercise schema/API: `instructions`, video metadata và public DTO.
- `ExerciseReview` model/service/controller/routes với một review/user/exercise.
- Admin editor: thêm/xóa/sắp xếp bước, chọn/upload/thay/xóa video.
- Public `/exercises/:id/:slug?`: hero, video, toàn bộ hướng dẫn, related actions và
  community review section riêng.
- Exercise service/query keys, locale, route, sitemap dynamic source và prerender.
- Focused model/integration/component/service/build-script tests.

Không đổi rubric technical difficulty, entitlement, auth/CSRF core, planner/PDF,
ảnh hiện có hoặc dữ liệu production.

## Steps

### 1. Khóa contract bằng test

- Model cho phép tối đa 30 bước có thứ tự và không làm hỏng document legacy.
- Public detail không lộ `videoPublicId`; write API validate unknown fields.
- Upload chỉ Admin, file video hợp lệ, có CSRF; replace/delete cleanup đúng asset.
- Review public-read, user-authored write/delete, unique user/exercise, rating 1–5,
  comment tối đa 1000 và DTO không lộ email.

### 2. Triển khai backend

- Mở rộng Exercise schema/validation/allowlist và cascade review khi xóa Exercise.
- Tạo middleware upload riêng, controller/service upload Cloudinary và cleanup.
- Tạo review model/service/controller và gắn route tĩnh trước `/:id`.

### 3. Triển khai public detail và Admin

- Card thư viện điều hướng tới URL detail thay vì mở dialog.
- Detail page lazy-loaded, có SEO/JSON-LD, loading/error/not-found, video optional,
  numbered steps dạng vertical timeline và tuyệt đối không có prev/next step.
- Review section đứng độc lập sau nội dung chuyên môn, có average/count/list và form.
- Admin form quản lý steps và upload video sau khi Exercise đã có ID.

### 4. SEO, QA và cleanup

- Đăng ký dynamic exercise routes cho sitemap/prerender và cache API detail/reviews.
- Chạy focused tests, lint, client/server unit phù hợp, client build, UI regression,
  desktop/mobile review, diff check, code review và cleanup-delivery.

## Done Criteria

- [x] Tất cả setup steps hiển thị cùng lúc; không có `Bước trước/Bước tiếp`.
- [x] Admin upload/thay/xóa video; public phát video có controls và không autoplay.
- [x] `Đánh giá từ người tập` là section riêng, không trộn technical difficulty.
- [x] Bài cũ không cần backfill; public DTO không lộ private media metadata/PII.
- [x] Có migration guarded cho hai index `ExerciseReview` vì production tắt `autoIndex`; apply staging/production vẫn là bước vận hành cần khóa đúng target và xác nhận riêng.
- [x] Route detail, sitemap/prerender và states desktop/mobile có evidence.
- [x] Focused tests, lint/build/UI gate và diff hygiene đạt hoặc blocker được ghi rõ.

## Verification Results

- Backend focused Vitest: **26/26 pass** cho Exercise schema/write API, review
  auth/CSRF/ownership/public DTO/cascade và upload middleware/route boundary. Một
  lần rerun bị MongoMemoryServer timeout trước collection, retry kế tiếp pass.
- Client + build-script focused Vitest: **24/24 pass**; component/service subset
  riêng trước đó đạt **10/10**.
- `npm run lint --prefix client`: **pass**.
- `npm run build --prefix client`: **exit 0**, Vite compile và bundle budget pass.
  Sandbox thiếu `VITE_API_URL`/network nên non-strict postbuild dùng sitemap cache và
  prerender 0/38; dynamic source/cache behavior được chứng minh bằng focused tests.
- UI regression gate: **0 finding mới**, 0 high-confidence blocking.
- Playwright Chromium: **2/2 assertion pass** cho desktop flow và mobile overflow;
  local runner phải dừng `Ctrl+C` sau khi in đủ kết quả vì web servers không teardown.
- `git diff --check`: pass; không có whitespace error, chỉ có cảnh báo line-ending
  của worktree Windows.
- Live Cloudinary upload/delete và strict production prerender chưa chạy vì cần
  credential/network thật; route, cleanup và fallback contract đã có test/local build.

## STOP Conditions

- Cần migration/backfill hoặc ghi dữ liệu thật để hoàn thành.
- Cần đổi auth/CSRF/JWT, entitlement hoặc Cloudinary credential contract.
- File cùng scope nhận thay đổi chồng lấn mới không thể tích hợp an toàn.
- Một root cause verification fail lặp lại ba vòng mà chưa thu hẹp được.
