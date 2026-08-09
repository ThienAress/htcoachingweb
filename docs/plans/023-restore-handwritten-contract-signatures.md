# Plan 023: Khôi phục chữ ký tay và hoàn thiện trải nghiệm hợp đồng

> **Trạng thái**: DONE / LOCAL VERIFIED — NOT DEPLOYED
>
> **Drift check**: Giữ nguyên toàn bộ thay đổi Plan 021 và `.vscode/`. Plan 022 chưa được commit hoặc deploy nên được thay thế trực tiếp, không migration và không thao tác dữ liệu thật.

## Mức độ và phạm vi

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: 002, 019, 020, 022
- **Category**: security / contracts / UI
- **Planned at**: 2026-08-03

## Lý do thay đổi

Nhà cung cấp SMS xác nhận cá nhân kinh doanh chưa đủ điều kiện đăng ký SMS Brandname theo quy trình hiện tại. Vì vậy luồng OTP/eSMS của Plan 022 không thể vận hành hợp lệ. Phương án an toàn là khôi phục chữ ký vẽ tay cho cả Bên A và Bên B, đồng thời giữ các cải tiến trình bày hợp đồng/PDF đã làm ở Plan 022.

## Product contract

- Bên A phải vẽ chữ ký trước khi phát hành hợp đồng.
- Bên B phải xem đến cuối tài liệu, tick đồng ý và vẽ chữ ký trước khi hoàn tất ký.
- `POST /api/contracts/:id/sign` nhận `signatureImage` và `acceptedTerms: true`; endpoint giữ JWT, CSRF và ownership backend.
- Chữ ký chỉ chấp nhận PNG/JPEG data URL hợp lệ, tối đa 512 KB.
- Ký dùng reserve atomic `viewed → signing → signed`; lỗi PDF/GridFS rollback về `viewed`.
- PDF cuối hiển thị chữ ký hai bên, tên, thời điểm ký, watermark/mã hợp đồng; file được hash SHA-256 và lưu GridFS.
- Không còn model, route, service, config, UI hoặc test OTP/eSMS trong runtime.

## Phạm vi file

- Backend contract service/controller/validation và contract tests.
- Frontend contract service, canvas chữ ký, trang ký của khách, modal hợp đồng admin, i18n và E2E contract.
- Tài liệu Plan 022/023 và plan index.

Ngoài phạm vi: migration, dữ liệu staging/production, auth/payment/wallet, public verification/QR, chữ ký số được chứng thực và mọi thay đổi Plan 021.

## Các bước

1. Đánh dấu Plan 022 là `SUPERSEDED / NOT DEPLOYED`, khóa contract của Plan 023.
2. Gỡ toàn bộ OTP/eSMS runtime và schema chưa deploy; khôi phục API chữ ký ảnh có ownership, consent và validation chặt.
3. Khôi phục canvas chữ ký Bên A/Bên B; giữ document viewer responsive và nâng UI emerald/zinc.
4. Chuyển PDF xác nhận OTP thành trang chữ ký hai bên, giữ watermark, mã hợp đồng, font tiếng Việt, SHA-256 và GridFS.
5. Viết/cập nhật tests, trace lại consumers và chạy QA/security gates.

## Done criteria

- [x] Không còn `sign/otp`, eSMS, OTP challenge hoặc signing evidence OTP trong runtime.
- [x] Admin không thể phát hành khi thiếu chữ ký Bên A.
- [x] Khách chỉ có thể ký sau khi xem hết, đồng ý điều khoản và vẽ chữ ký.
- [x] Ownership, CSRF, payload bound và state transition atomic được kiểm thử.
- [x] PDF cuối có chữ ký hai bên và hash SHA-256; lỗi lưu file rollback an toàn.
- [x] Lint, client/server tests, E2E, build, security scans và agent validation pass.
- [x] Không thay đổi hoặc làm mất công việc Plan 021.

## Verification evidence

- Timestamp: `2026-08-03T11:24:00+07:00`.
- Target revision: `e2fcc24e3818a867f05c87c0131a74ede06a9fcc`; working tree vẫn chứa Plan 021 và `.vscode/` được giữ nguyên.
- Focused server contract integration: PASS, 1 file và 4/4 tests.
- Focused client contract service: PASS, 1 file và 1/1 test.
- Client unit suite: PASS, 42 files và 229/229 tests.
- Server unit/integration suite: PASS, 86 files và 389/389 tests.
- E2E suite: PASS, 62/62 tests; contract-only rerun sau UI accessibility PASS 2/2.
- Client lint: PASS với 0 errors; 1 warning trong `Pricing.jsx` thuộc Plan 021, không phát sinh từ Plan 023.
- Full release build: PASS, 2.793 modules, prerender 784/784 routes và bundle budget PASS.
- Incremental release build sau UI check: PASS, static prerender 8/8 và bundle budget PASS; sitemap generated được khôi phục để không tạo diff ngoài phạm vi.
- Secret scan: PASS.
- Repository data-boundary scan: PASS, 0 violations.
- Agent validation: PASS, 22 skills và 5 rule files hợp lệ.
- Scoped `ui-check`: PASS; không còn finding HIGH/MED, touch target chính ≥44 px, dialog/form labels/focus states và mobile layout đã kiểm tra.
- `git diff --check`: PASS.
- Không gọi SMS, không migration, không ghi dữ liệu staging/production và không deploy.

## STOP conditions

- Cần migration hoặc ghi dữ liệu thật.
- Cần nới CSRF/JWT/ownership hoặc nhận ảnh không giới hạn để hoàn thành.
- Phát hiện dữ liệu OTP đã tồn tại trên staging/production.
- Cùng verification thất bại ba vòng sau các sửa có căn cứ.
