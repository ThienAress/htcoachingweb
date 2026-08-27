# Spec: Ảnh chữ ký Bên A và kỳ báo cáo tuần linh hoạt

## Objective

Cho phép HLV dùng ảnh chữ ký mẫu rõ nét khi phát hành hợp đồng, đồng thời tổ
chức lại Nhật ký thành báo cáo ngày/tuần và cho khách hàng bổ sung báo cáo của
ba tháng trước mà không làm mất giới hạn chỉnh sửa server-authoritative.

## Product contract

### Ảnh chữ ký Bên A

- Trên khu vực vẽ chữ ký Bên A có hành động `Tải ảnh chữ ký`.
- Ưu tiên PNG nền trong suốt; chấp nhận PNG, JPG/JPEG và WebP làm file nguồn.
- File nguồn tối đa 5 MB, được đọc và chuẩn hóa trên trình duyệt thành PNG tối
  đa 1.200 × 400 px và không vượt contract 512 KB hiện có.
- Ảnh sau chuẩn hóa trở thành `trainerSignature` của hợp đồng và được preview
  ngay dưới ô vẽ. Vẽ chữ ký mới thay thế ảnh đã tải; `Xóa & ký lại` xóa cả hai.
- Không thêm upload endpoint, storage hoặc schema. Backend tiếp tục chỉ nhận
  PNG/JPEG data URL đã validate qua `PUT /api/contracts/:id`.
- Tính năng tải ảnh chỉ mở cho Bên A trong màn soạn hợp đồng; luồng ký Bên B
  tiếp tục dùng chữ ký vẽ tay hiện tại.

### Kỳ báo cáo theo tháng

- Mỗi tháng dùng tuần Thứ Hai–Chủ Nhật làm nền.
- Phần lẻ đầu tháng được gộp vào tuần đầy đủ kế tiếp; phần lẻ cuối tháng được
  gộp vào tuần đầy đủ liền trước. Các tuần đầy đủ ở giữa giữ nguyên.
- Ví dụ tháng 8/2026 có các khoảng `1/8–9/8`, `10/8–16/8`, `17/8–23/8`,
  `24/8–31/8`.
- `weekStartDateKey` tiếp tục dùng ngày Thứ Hai của tuần đầy đủ làm storage key
  để ưu tiên tương thích dữ liệu cũ; `rangeStartDateKey` chỉ dùng trình bày.
- Document cũ ở các kỳ lẻ bị thay thế vẫn được giữ nguyên và tiếp tục có mặt
  trong lịch sử/tiến trình; không migration, xóa hoặc backfill dữ liệu thật.

### Cửa sổ nhập báo cáo

- UI cho chọn tháng hiện tại và ba tháng liền trước.
- Kỳ tương lai không được nhập.
- Kỳ hiện tại giữ lifecycle hiện có: lưu nháp, gửi, rồi tối đa một correction.
- Kỳ đã qua trong cửa sổ bốn tháng được nhập/gửi lần đầu nếu chưa có báo cáo;
  sau khi gửi thì khóa vĩnh viễn và không có correction.
- Trước khi mở form của kỳ đã qua, UI cảnh báo rõ báo cáo chỉ được gửi một lần.
- Backend quyết định cửa sổ và từ chối kỳ tương lai, kỳ quá ba tháng hoặc
  correction cho kỳ đã qua; frontend chỉ phản chiếu trạng thái.
- Dữ liệu cũ đã submitted/reviewed luôn chỉ đọc, kể cả `correctionCount` còn 0.

### Phân nhóm Nhật ký

- Trang Nhật ký có hai tab lớn: `Nhật ký báo cáo ngày` và
  `Nhật ký báo cáo tuần`.
- Tab ngày chứa `Sức khỏe hôm nay`, `Thói quen hôm nay` và
  `Hoạt động trong ngày`.
- Tab tuần chứa card được đổi tên thành `Kết quả tuần`.
- Bỏ dòng header dạng `Tuần 1: 1/8 - 2/8`; khoảng ngày chỉ xuất hiện trên các
  nút chọn kỳ.
- Deep-link `#weekly-report` tự mở tab tuần và giữ anchor hiện có.

## Compatibility and security

- Không đổi schema, route, auth, ownership, CSRF, idempotency hoặc revision
  audit của hợp đồng và WeeklyCheckin.
- Không lưu file chữ ký nguồn; chỉ lưu data URL đã chuẩn hóa theo contract cũ.
- Không chạy migration/seed/cleanup hoặc ghi local/staging/production trong
  implementation.

## Success criteria

- [ ] HLV tải ảnh hợp lệ, thấy preview, lưu/gửi hợp đồng và PDF dùng đúng ảnh.
- [ ] File sai định dạng/quá lớn hoặc PNG sau chuẩn hóa quá 512 KB bị chặn rõ.
- [ ] Tháng 8/2026 hiển thị đúng bốn khoảng đã chốt và frontend/backend đồng nhất.
- [ ] Khách chọn được tháng hiện tại cùng ba tháng trước.
- [ ] Kỳ quá khứ chưa có dữ liệu cảnh báo trước khi nhập, gửi một lần rồi khóa.
- [ ] Kỳ hiện tại vẫn cho đúng một correction; kỳ tương lai/quá cũ bị server từ chối.
- [ ] Nhật ký có hai tab, deep-link tuần mở đúng tab và không còn dòng header `Tuần N:`.
- [ ] Focused client/server tests, build, UI regression và security gates pass.

## Boundaries

- Always: server-authoritative period/correction policy, image type/size
  validation, accessible focus/error/disabled states và backward compatibility.
- Ask first: migration/backfill, lưu chữ ký dùng chung ngoài hợp đồng, chữ ký số
  được chứng thực hoặc ghi dữ liệu staging/production.
- Never: lưu file chữ ký raw, nới 512 KB backend, bỏ CSRF/ownership hoặc tự xóa
  WeeklyCheckin legacy.
