# Plan 010: Tách tiến độ hoàn thành theo module của Customer Dashboard

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — thay đổi read contract Today Dashboard và UI dùng contract
- **Depends on**: 003B, 003C, 006, 009
- **Category**: feature | API contract | UI
- **Planned at**: 2026-07-30
- **Status**: IMPLEMENTED / LOCAL VERIFIED — FULL PRERENDER BLOCKED BY LOCAL DYNAMIC SOURCES

## Mục tiêu

Loại bỏ việc dùng một tỷ lệ hoàn thành chung cho Tập luyện, Dinh dưỡng và Nhật ký. Ngày không có nhiệm vụ
không được tự động hiển thị 100%. Nhật ký được tính theo mức độ nhập dữ liệu, không đánh giá tốt/xấu từ
chỉ số sức khỏe.

## Contract và công thức đã duyệt

- Nâng Today read contract lên `contractVersion: 2`, `formulaVersion: "today-v2"`.
- Thêm `summary.moduleProgress.training|nutrition|journal` với `completed`, `total`, `percent`, `state`.
- Tập luyện tính lịch tập, bài coaching và giáo án trong ngày; điểm danh chỉ là bằng chứng, không cộng thêm mẫu số.
- Dinh dưỡng chỉ áp dụng khi có thực đơn hợp lệ; mỗi bữa trong thực đơn được xem là hoàn tất khi đã ghi
  `eaten`, `changed` hoặc `skipped` đúng phiên bản thực đơn.
- Nhật ký có 8 trường wellness, mỗi trường 10%; trạng thái `submitted` thêm 20%.
- Module không có nhiệm vụ trả `percent: null`, `state: "not_applicable"`.
- Tổng quan giữ `summary.completionPercent` để tương thích UI, tính trung bình các module có áp dụng.

## Các bước

1. Viết test RED cho công thức module và validation contract phía client.
2. Tạo service công thức thuần, bổ sung meal keys canonical vào nguồn Today và trả contract v2.
3. Cập nhật adapter fail-closed khi `moduleProgress` sai shape.
4. Cập nhật thanh tiến độ theo route và trạng thái rỗng có nội dung rõ ràng.
5. Bật `TODAY_JOURNAL_WRITES_ENABLED=true` chỉ trong `server/.env.development` local.
6. Chạy focused/full tests, lint, build, security scans, UI check và `git diff --check`.

## Test plan

- Không có nhiệm vụ tập luyện không được thành 100%.
- Nhật ký 0/3/8 trường lần lượt 0/30/80%; đủ 8 trường và đã gửi là 100%.
- Thực đơn có bữa được ghi một phần/toàn bộ cho tỷ lệ tương ứng; entry trùng không được đếm hai lần.
- Adapter từ chối contract v2 thiếu hoặc sai `moduleProgress`.
- UI hiển thị đúng phần trăm module hoặc copy “Không có nhiệm vụ”/“Chưa có thực đơn áp dụng”.

## Done criteria

- [x] Ba module không còn dùng chung một tỷ lệ hoàn thành.
- [x] Ngày/module không có nhiệm vụ không hiển thị 100%.
- [x] Công thức chỉ đo mức độ hoàn tất, không suy diễn chất lượng sức khỏe.
- [x] Local có thể nhập và gửi Nhật ký sau khi restart server.
- [x] Unit, lint, Vite compile, bundle và security gates pass; full prerender được ghi blocker riêng.

## Ngoài phạm vi

- Mục tiêu/ngưỡng sức khỏe cá nhân.
- Chấm điểm mức độ ngủ, uống nước, bước chân tốt hay xấu.
- Schema/migration và thay đổi dữ liệu production.

## Verification evidence

- Focused client: 2 file, 10 test pass.
- Focused server: 3 file, 20 test pass.
- Full client: 33 file, 182 test pass.
- Full server: 76 file, 341 test pass.
- Client lint: pass.
- Vite production compile: pass; bundle budget: pass.
- Secret scan và repository data-boundary scan: pass.
- Scoped UI check và `git diff --check`: pass.
- Full `npm run build --prefix client`: Vite compile hoàn tất nhưng postbuild prerender timeout vì bốn nguồn động local
  trả `ECONNABORTED` và hai blog route chờ navigation 30 giây; không phải lỗi compile của Dashboard.