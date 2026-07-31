# Spec: Điều hướng workspace theo vai trò

## Objective

Rút gọn dropdown tài khoản thành nơi mở workspace và thao tác cá nhân. Các nghiệp vụ
chi tiết của HLV/admin được tổ chức trong `Quản lý khách hàng`, thay vì trải dài trong
dropdown toàn site.

## Quyết định đã duyệt

1. Admin có hai workspace: `Quản trị hệ thống` và `Quản lý khách hàng`.
2. HLV hoặc user có gói HLV chỉ có workspace `Quản lý khách hàng`.
3. User thường giữ entry `Dashboard học viên`.
4. Ví, thông báo, tài khoản, profile công khai (nếu có) và đăng xuất vẫn nằm trong
   dropdown tài khoản.
5. `Quản lý khách hàng` chia bốn nhóm:
   - Tổng quan: Khách hàng của tôi.
   - Nghiệp vụ huấn luyện: Theo dõi sức khỏe, Check-in khách hàng, Coach Online,
     Lịch tập khách hàng, Giáo án tập luyện.
   - Tài nguyên chuyên môn: Hệ thống bài tập.
   - Tăng trưởng khách hàng: Khách hàng F1, chỉ hiển thị khi có quyền.
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

## Security và failure states

- `AdminRoute` tiếp tục bảo vệ toàn bộ `/trainer`.
- F1 sidebar fail closed: chỉ hiển thị sau khi `canAccessF1` trả về true.
- `F1Route` tiếp tục bảo vệ direct link; việc ẩn menu không thay thế backend/route guard.
- Không fetch danh sách client mới và không lọc ownership ở frontend.
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
- HLV chỉ thấy `Quản lý khách hàng`; không thấy `Quản trị hệ thống`.
- Không còn danh sách nghiệp vụ chi tiết trong account dropdown desktop/mobile.
- Trainer sidebar hiển thị đúng bốn nhóm và 8 entry theo quyền.
- Các nghiệp vụ chính mở bên trong TrainerLayout; route cũ vẫn render được.
- F1 không xuất hiện khi thiếu entitlement và direct route vẫn được `F1Route` kiểm tra.
- Unit test navigation, client lint, build và UI check pass.
