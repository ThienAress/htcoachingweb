# Catalog tính năng, phản hồi thao tác và nhóm Mục tiêu sức khỏe

## Bối cảnh

Catalog Admin `Tính năng cộng đồng & khách hàng` đang dừng ở snapshot 12/08/2026,
trong khi các luồng dinh dưỡng, tiến trình, bài tập, thói quen và công cụ HLV đã phát
triển thêm. Một số mutation chủ động chỉ hiển thị trạng thái inline nên người dùng có
thể không nhận ra request đã hoàn tất, đặc biệt khi mạng chậm. Trên workspace sức khỏe,
mục tiêu và thói quen cũng đang đứng thành hai section rời nhau dù cùng phục vụ một kế
hoạch sức khỏe.

## Quyết định sản phẩm

### 1. Catalog Admin

- Nguồn canonical tiếp tục là `server/src/constants/communityFeatureCatalog.js`.
- Mỗi tính năng phải thể hiện giá trị hiện có, đối tượng, ưu tiên cải thiện kế tiếp,
  kết quả gần nhất và mốc delivery có ngày.
- `Đã xác minh production` chỉ dùng khi có live evidence. Các thay đổi chỉ qua QA local
  dùng `Đã kiểm thử`; không nâng trạng thái theo suy đoán.
- Đợt rà soát này bổ sung kết quả từ TDEE, Meal Scan, Meal Plan, Recipe, thư viện bài
  tập, Today Dashboard, tiến trình và Trung tâm thực hành. Điều phối HLV là công cụ
  Admin-only nên không đưa vào catalog cộng đồng/khách hàng.
- Đề xuất tương lai nằm ở `currentImprovement`; catalog không tự cấp entitlement hoặc
  thay đổi quota.

### 2. Phản hồi submit/mutation

- Mọi mutation do người dùng chủ động xác nhận phải khóa action trong lúc chờ và phát
  toast thành công chỉ sau response thành công từ server.
- Thất bại server/network phải có toast lỗi; validation tại field vẫn hiển thị inline và
  không phát toast trước khi có request.
- Inline result có nội dung dài, retry hoặc conflict vẫn được giữ; toast là xác nhận ngắn,
  không thay thế thông tin phục hồi.
- Không phát toast cho autosave, polling, quota accounting, optimistic bookmark/toggle,
  hoặc đánh dấu đã đọc gắn với điều hướng khi trạng thái chính đã thay đổi rõ trên UI.
- Chỉ có một `ToastContainer` cấp ứng dụng. Toast phải nằm trên modal/drawer, đủ lâu để
  đọc và hoạt động trên cả Admin, HLV lẫn khách hàng.

### 3. Mục tiêu sức khỏe và thói quen

- `Mục tiêu sức khỏe` là section cha ở cả workspace HLV và nhật ký ngày của khách hàng.
- Các chỉ số ngủ, nước, bước nằm trong nhóm `Chỉ số mục tiêu`/`Sức khỏe hôm nay`.
- Coaching Habit dùng nhãn UI `Thói quen khách hàng`; model, API, query key và dữ liệu
  `CoachingHabit` giữ nguyên.
- Banner HLV dùng câu: `Báo cáo từ khách hàng rất quan trọng. Bạn nhớ kiểm tra mỗi ngày
  để kịp thời lưu ý và hỗ trợ khách hàng nhé.`

## Phạm vi

### Trong phạm vi

- Catalog canonical, report JSON/PDF consumer và focused tests.
- Toast container cấp ứng dụng, Trung tâm thực hành và các submit/mutation chủ động còn
  thiếu feedback được phát hiện trong inventory client.
- Grouping/copy của Mục tiêu sức khỏe ở HLV và khách hàng, cùng component tests.
- Rule frontend canonical và agent validator.

### Ngoài phạm vi

- Schema, migration, seed, production/staging write, quota hoặc entitlement.
- Đổi semantics của Daily Journal, Wellness Target hoặc Coaching Habit.
- Toast cho autosave/background/read-on-navigation/optimistic toggle.
- Email nhắc buổi sáng; chỉ phân tích sau khi phần 1–4 đã hoàn tất.
- Commit, push, deploy hoặc thay đổi năm file hotfix observability/monitoring đang khóa.

## Acceptance criteria

1. Admin thấy catalog phiên bản mới với lịch sử đã làm, trạng thái không vượt evidence và
   đề xuất cải tiến kế tiếp cho các feature được rà soát.
2. Gửi mô phỏng thành công/thất bại có toast dễ nhận biết và vẫn có kết quả inline.
3. Mọi submit/mutation chủ động được audit không còn trường hợp chỉ im lặng sau response;
   exemption được ghi rõ, không phát toast trùng.
4. HLV và khách hàng đều thấy một section `Mục tiêu sức khỏe` chứa `Thói quen khách hàng`.
5. Banner HLV nhấn mạnh báo cáo khách hàng quan trọng bằng copy tự nhiên.
6. Không đổi API/data contract; focused tests, lint, compile, UI regression và
   `agents:validate` có evidence thật hoặc blocker được báo chính xác.
