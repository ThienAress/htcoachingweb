# Spec: Điều hướng workspace theo vai trò

## Objective

Rút gọn dropdown tài khoản thành nơi mở workspace và thao tác cá nhân. Các nghiệp vụ
chi tiết của HLV/admin được tổ chức trong `Quản lý khách hàng`, thay vì trải dài trong
dropdown toàn site.

## Quyết định đã duyệt

1. Admin có hai workspace: `Quản trị hệ thống` và `Quản lý khách hàng`.
2. HLV hoặc user có gói HLV dùng workspace `Quản lý khách hàng`; bên trong workspace có thêm nhóm
   `Quản trị` giới hạn theo chính HLV đó.
3. User thường giữ entry `Dashboard học viên`.
4. Ví, thông báo, tài khoản, profile công khai (nếu có) và đăng xuất vẫn nằm trong
   dropdown tài khoản.
5. `Quản lý khách hàng` chia năm nhóm:
   - Tổng quan: Khách hàng của tôi.
   - Nghiệp vụ huấn luyện: Theo dõi sức khỏe, Check-in khách hàng, Coach Online,
     Lịch tập khách hàng, Giáo án tập luyện.
   - Tài nguyên chuyên môn: Hệ thống bài tập.
   - Tăng trưởng khách hàng: Khách hàng F1, chỉ hiển thị khi có quyền.
   - Quản trị: Đơn hàng, Hợp đồng HLV và Lịch sử Check-in. Ba màn hình này chỉ đọc/ghi dữ liệu có
     `trainerId` là actor hiện tại; admin vẫn có phạm vi toàn hệ thống trong `/admin`.
6. Route cũ tiếp tục hoạt động; route mới dưới `/trainer/...` là entry canonical trong
   workspace cho các nghiệp vụ có thể nhúng an toàn.
7. Không thay đổi API, schema, ownership hoặc entitlement.

## Role matrix

| Vai trò | Dropdown workspace | Quản lý khách hàng |
|---|---|---|
| Admin | Quản trị hệ thống, Quản lý khách hàng | Đủ nhóm; luôn có F1 |
| Trainer legacy | Quản lý khách hàng | Nhóm chung; F1 theo entitlement |
| User có gói HLV | Quản lý khách hàng | Nhóm chung; F1 theo entitlement |
| User thường | Dashboard học viên | Không được truy cập |

## Route contract

| Nghiệp vụ | Workspace route | Route cũ giữ tương thích |
|---|---|---|
| Khách hàng của tôi | `/trainer` | — |
| Theo dõi sức khỏe | `/trainer/health` | — |
| Check-in khách hàng | `/trainer/checkin` | `/checkin` |
| Coach Online | `/trainer/coaching` | Giữ nguyên path |
| Lịch tập khách hàng | `/trainer/schedule` | `/training-schedule` |
| Giáo án tập luyện | `/trainer/workout-plans` | `/workout-plans` |
| Chi tiết giáo án | `/trainer/workout-plans/:id` | `/workout-plans/:id` |
| Hệ thống bài tập | `/exercises` | Giữ nguyên |
| Khách hàng F1 | `/f1-customers` | Giữ nguyên |
| Đơn hàng của HLV | `/trainer/orders` | Admin vẫn dùng `/admin/orders` |
| Hợp đồng của HLV | `/trainer/contracts` | Admin vẫn dùng `/admin/contracts` |
| Lịch sử Check-in | `/trainer/checkin-history` | Admin vẫn dùng `/admin/dashboard` |

## Security và failure states

- `AdminRoute` tiếp tục bảo vệ toàn bộ `/trainer`.
- F1 sidebar fail closed: chỉ hiển thị sau khi `canAccessF1` trả về true.
- `F1Route` tiếp tục bảo vệ direct link; việc ẩn menu không thay thế backend/route guard.
- Không fetch danh sách client mới và không lọc ownership ở frontend.
- Order do trainer tạo luôn được backend gán `trainerId` từ actor; trainer chỉ sửa order của mình,
  không được đổi owner/trạng thái và không được gọi delete endpoint. Admin giữ quyền xóa có guard hiện có.
- Contract list/create/update/send/cancel của trainer luôn ràng buộc `trainerId` ở backend; delete contract
  vẫn chỉ dành cho admin. Không dựa vào việc ẩn menu để bảo vệ dữ liệu.
- Nếu không xác minh được subscription, không hiển thị F1; các nghiệp vụ chung vẫn dùng được.

## UX và accessibility

- Dropdown desktop không còn accordion nghiệp vụ dài.
- Desktop và mobile dùng cùng role matrix, cùng nhãn workspace và cùng mục cá nhân.
- Sidebar có active state theo prefix cho route detail.
- Group header có `aria-expanded`; link và button có vùng bấm tối thiểu 44px,
  hover và focus-visible.
- Product navigation dùng slate/cyan hiện có; không thêm gradient text, glass card
  hoặc animation ngoài state transition 150–250ms.

## Success criteria

- Admin chỉ thấy hai workspace trong phần workspace của dropdown.
- HLV chỉ thấy `Quản lý khách hàng`; không thấy `Quản trị hệ thống`; nhóm `Quản trị` trong trainer
  workspace chỉ có ba entry scoped.
- Không còn danh sách nghiệp vụ chi tiết trong account dropdown desktop/mobile.
- Trainer sidebar hiển thị nhóm `Quản trị` với đúng ba entry: Đơn hàng, Hợp đồng HLV, Lịch sử Check-in.
- Hai trainer không thể list, sửa, tạo hợp đồng hoặc thao tác dữ liệu thuộc trainer còn lại.
- Trainer có thể tạo và sửa order của mình nhưng không thấy nút xóa; direct DELETE trả 403.
- Các nghiệp vụ chính mở bên trong TrainerLayout; route cũ vẫn render được.
- F1 không xuất hiện khi thiếu entitlement và direct route vẫn được `F1Route` kiểm tra.
- Unit test navigation, client lint, build và UI check pass.
