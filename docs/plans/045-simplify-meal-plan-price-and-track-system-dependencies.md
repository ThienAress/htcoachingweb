# Plan 045 — Đơn giản hóa giá Meal Plan và theo dõi phụ thuộc hệ thống

> Status: IMPLEMENTED / VERIFIED
> Priority: P1
> Date: 2026-08-11
> Depends on: 033, 042, 044

## Mục tiêu

1. Bỏ tổng chi phí theo bữa/ngày khỏi bảng thực đơn nhưng giữ giá tham khảo theo 100 g trong bảng thực phẩm.
2. Nhận diện `Ức gà`/`uc ga` tại mục dị ứng Khác và loại trừ nhóm gà trước khi tiêu quota.
3. Chuyển giá tham khảo từ điều kiện hai nguồn sang một nguồn bán lẻ còn hiệu lực; không xóa lịch sử giá.
4. Sắp xếp trang Admin `Quyền & hạn mức` theo thứ tự Tính năng cộng đồng, Quyền lợi gói HLV, Hạn mức công cụ, Phụ thuộc hệ thống.
5. Thêm bảng chỉ đọc tổng hợp dependency/devDependency từ `package.json`, `client/package.json` và `server/package.json`.

## Phạm vi và quyết định

- Không đổi schema, quota, quyền truy cập hoặc dữ liệu production/staging.
- Giá công khai dùng một quan sát còn hiệu lực gần nhất; lịch sử quan sát cũ vẫn được giữ để audit.
- Inventory package được bundle từ ba manifest tại build time, không gọi npm Registry từ trình duyệt và không tự tuyên bố package đang là bản mới nhất.
- Khuyến nghị nâng cấp chỉ là guardrail: kiểm tra lệch phiên bản giữa scope, package trước 1.0, `npm outdated`, security audit, changelog và regression test.
- `Ức gà` được canonical hóa thành nhóm `Gà`; đây là hard exclusion nên mọi Food thuộc nhóm gà đều bị loại.

## Các bước triển khai

1. Viết test cho MealTable không còn cột/tổng chi phí và parser nhận `Ức gà` ở cả client/server.
2. Viết test cho price summary/manifest một nguồn và cập nhật copy Admin Food.
3. Tạo inventory phụ thuộc chỉ đọc cùng bảng có tìm kiếm/lọc scope.
4. Sắp xếp lại bốn section của trang `Quyền & hạn mức` và kiểm tra thứ tự bằng test render.
5. Cập nhật spec liên quan, chạy focused tests, client lint/build, server tests tương ứng và `git diff --check`.

## Tiêu chí nghiệm thu

- MealTable chỉ còn Bữa ăn, Tinh bột, Đạm, Chất béo và Calo.
- `Ức gà`/`uc ga` không còn cảnh báo chưa nhận diện và Food gà bị loại khỏi generator.
- Một nguồn giá hợp lệ trong 90 ngày đã đủ để API trả `coverageStatus=sufficient`.
- Admin Food không còn hiển thị tiến độ `/2 nguồn` hoặc hướng dẫn cần hai nguồn.
- Trang `Quyền & hạn mức` có đúng thứ tự bốn section và inventory phản ánh đủ ba `package.json`.

## Không thuộc phạm vi

- Không tự nâng package, chạy migration/cleanup database hoặc ghi dữ liệu thật.
- Không xóa Food price observation cũ; cleanup lịch sử nếu cần phải có runbook và xác nhận target riêng.

## Verification evidence

- PASS: full client lint; focused client lint; `node --check` cho server/scripts; agent instruction validation; `git diff --check`.
- PASS: Node smoke test `uc ga → chicken`, một nguồn/giá, newest-observation và source tie-break.
- PASS: package snapshot có 3 manifest — Workspace 4, Frontend 52, Backend 36 package.
- PASS: export nghiên cứu giá phủ 405 Food, 38 Food có giá với đúng 38 observation, 367 Food để trống.
- BLOCKED: Vitest/Vite không khởi động trong sandbox do `spawn EPERM`; client build còn bị native Tailwind binary lỗi đọc và cùng `spawn EPERM`.
- BLOCKED: secret/data-boundary scripts không tự spawn được `git` trong sandbox. Không tuyên bố các gate bị chặn là pass.

### Follow-up — checkbox dị ứng

- Sửa lỗi mọi checkbox dị ứng làm rỗng catalog khi Food còn `unreviewed`.
- Metadata `contains`/`mayContain` vẫn được ưu tiên; khi metadata/scope thiếu, filter dùng cụm từ exact trong label và giữ
  dấu tiếng Việt để `Cá` không khớp `Cà chua`.
- Smoke test đủ 9 nhóm có sẵn đều loại đúng Food khớp và vẫn giữ đủ đạm, tinh bột, chất béo trong fixture.
