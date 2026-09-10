# Spec: Email thông báo khách hàng và Dashboard tự quản lý

Status: APPROVED FOR IMPLEMENTATION
Ngày soạn: 2026-09-08
Đối tượng: khách hàng coaching, khách HT Fitness+ và user chưa có entitlement

## 1. Mục tiêu

Chuẩn hóa quyền nhận email nhắc sức khỏe/check-in và mở Customer Dashboard đúng theo
entitlement. Khách coaching có luồng hợp tác với HLV; khách chỉ có HT Fitness+ dùng dashboard
để tự quản lý và tuyệt đối không tạo báo cáo/notification cho HLV.

## Requirements

### REQ-001 — Email opt-in và consent hợp đồng

- `AC-001`: Hai email nhắc sức khỏe/check-in mặc định tắt, được kiểm tra eligibility và chỉ gửi
  khi preference tương ứng đã bật.
- `AC-002`: Hợp đồng có consent mới bật atomically cả hai preference khi ký; check-in và hợp đồng
  legacy/custom không được tự ý opt-in.

### REQ-002 — Trải nghiệm Tài khoản rõ trạng thái

- `AC-003`: Form email dùng state machine `Lưu → read-only → Cập nhật`, chặn lần lưu đầu khi chưa
  chọn và disable khi không đủ gói coaching.
- `AC-004`: Tab dùng tên chung **Email thông báo** và trạng thái hợp đồng `signed` hiển thị **Đã ký**.

### REQ-003 — Entitlement dashboard do server quyết định

- `AC-005`: Today, journal và weekly check-in phân biệt chính xác `coaching`, `self_managed` và
  `blocked`; mutation bị chặn server-side khi không có entitlement.
- `AC-006`: Progress self-managed chỉ tổng hợp dữ liệu tự lưu và tài khoản blocked nhận `403`.

### REQ-004 — Fitness+-only không tạo luồng HLV

- `AC-007`: UI self-managed ẩn Tập luyện và mọi CTA/comment/timeline/report thuộc HLV, nhưng vẫn
  cho tự nhập và tự lưu nutrition/journal/weekly data.
- `AC-008`: Full client unit suite bảo vệ các trạng thái điều hướng, form và dashboard mới.

### REQ-005 — Navigation và interaction thống nhất

- `AC-009`: CTA pricing dùng `/#pricing` với smooth hash scroll tôn trọng reduced motion; marker
  AI nở ngay khi hover/focus và click chỉ điều hướng.
- `AC-010`: Rule project canonical hóa form explicit-save và agent governance vẫn hợp lệ.

### REQ-006 — QA và an toàn bàn giao

- `AC-011`: Unit client/server, lint và build được chạy với kết quả hoặc blocker môi trường ghi rõ.
- `AC-012`: Secret scan, data-boundary scan và `git diff --check` không có lỗi do thay đổi.

## 2. Email thông báo khách hàng

### 2.1. Preference

`NotificationPreference` có hai opt-in độc lập, mặc định `false`:

- `morningHealthEmail`: email nhắc cập nhật Mục tiêu sức khỏe buổi sáng.
- `checkinEmail`: email thông báo check-in buổi tập do HLV thực hiện.

Email order và hợp đồng chờ ký không đi qua hai preference này. Check-in chỉ gửi email khi
`checkinEmail === true`; thiếu document/field phải fail closed.

### 2.2. Eligibility

Chỉ khách có Order coaching `approved`, `sessions > 0` và đã được gán HLV mới được đọc/chỉnh
hai tùy chọn email ở trạng thái thao tác. Server trả metadata `emailEligible` và từ chối mutation
khi không đủ điều kiện; frontend chỉ phản ánh contract này, không tự quyết định quyền.

### 2.3. Trải nghiệm Lưu/Cập nhật

- Tiêu đề tab: **Email thông báo**; nội dung mô tả cả nhắc sức khỏe và check-in.
- Trước lần lưu, form editable và CTA là **Lưu**.
- Nếu cả hai tùy chọn đều tắt khi bấm Lưu, không gọi API và hiện toast yêu cầu chọn ít nhất một mục.
- Sau response thành công, form khóa và CTA đổi thành **Cập nhật**.
- Bấm Cập nhật mở edit mode; CTA đổi thành **Lưu** và có thể lưu lựa chọn mới, kể cả tắt toàn bộ,
  vì đây là một cập nhật có chủ đích sau opt-in ban đầu.
- Khi không đủ eligibility, toàn bộ checkbox/CTA bị disable và giải thích cần gói coaching hợp lệ.
- Error giữ form editable; pending khóa thao tác; conflict tải lại dữ liệu server.

`customerEmailConfigured` là metadata server-controlled đánh dấu preference email đã từng được lưu
hoặc bật qua hợp đồng. Field mặc định `false` cho document cũ, không cần backfill; `revision` vẫn
dùng cho optimistic concurrency chung và không được dùng để đoán trạng thái riêng của email.

## 3. Consent trong hợp đồng

Hợp đồng mới có điều khoản mặc định:

> Học viên đồng ý để hệ thống gửi email nhắc cập nhật Mục tiêu sức khỏe buổi sáng và thông báo
> check-in buổi tập. Học viên có thể thay đổi các tùy chọn này bất cứ lúc nào trong mục Tài khoản.

Khi khách ký thành công hợp đồng còn chứa đúng điều khoản consent, server bật cả
`morningHealthEmail` và `checkinEmail`. Hợp đồng cũ hoặc hợp đồng đã xóa/sửa điều khoản này không
được tự động opt-in. Việc cập nhật preference và chuyển hợp đồng sang `signed` phải ở cùng
transaction để không tạo trạng thái ký một nửa.

## 4. Trạng thái hợp đồng

UI Tài khoản dùng key thuộc namespace hợp đồng và hiển thị tiếng Việt, tối thiểu `signed` là
**Đã ký**. Không render raw key như `status.signed`.

## 5. Customer Dashboard theo entitlement

Backend trả access contract canonical:

- `coaching`: Order active, còn buổi và có HLV; dùng đầy đủ module HLV.
- `self_managed`: có HT Fitness+ active nhưng không có coaching active; tự nhập và tự lưu.
- `blocked`: không có entitlement hợp lệ; không được đọc/ghi dữ liệu dashboard.

Nếu user đồng thời có coaching và HT Fitness+, `coaching` thắng để giữ đầy đủ quyền lợi.

### 5.1. Điều hướng và nhãn

- Có coaching active: header hiển thị **Dashboard học viên**.
- Chỉ có HT Fitness+ hoặc không có entitlement active: header hiển thị **Dashboard của tôi**;
  user chưa có entitlement vào dashboard sẽ thấy gate và CTA.
- CTA mua gói dùng `/#pricing`; scroll restoration phải nhận biết hash, chờ section render rồi
  smooth-scroll (tôn trọng reduced motion). Mọi CTA `/#pricing` hiện có dùng chung contract này.

### 5.2. Chế độ coaching

Giữ nguyên lịch tập, coaching trong ngày, giáo án, check-in, gửi dinh dưỡng/nhật ký/báo cáo và
notification cho HLV.

### 5.3. Chế độ self-managed (HT Fitness+-only)

- Ẩn hoàn toàn mục **Tập luyện** và các nguồn schedule/coaching/workout/attendance.
- Dinh dưỡng giữ chức năng tự nhập/tự lưu; không có CTA, lifecycle hoặc copy gửi HLV.
- Nhật ký chỉ cho khách tự nhập/tự lưu; không có submit/correction/comment/timeline liên quan HLV.
- Weekly body check-in cho phép tự lưu mà không cần `trainerId`; không gửi notification HLV.
- Tiến trình được tổng hợp từ dữ liệu khách tự lưu, kể cả journal/weekly record ở trạng thái draft.
- Mutation phải gate entitlement server-side. User `blocked` nhận `403` và không tạo record.

Model hiện tại cho phép `trainerIdAtCreation`/`trainerIdAtSubmission` nullable; không backfill và
không chạy migration trong thay đổi này.

## 6. AI Conversation Navigator

Mỗi marker câu hỏi không active nở từ chiều rộng ngắn sang chiều rộng dài ngay khi chính marker
được hover hoặc focus-visible; click vẫn chỉ làm nhiệm vụ điều hướng. Giữ panel preview hover,
keyboard focus, reduced-motion và contrast hiện có.

## 7. Pattern form canonical

Thêm rule project cho form cấu hình có explicit save:

1. `edit/new` → chọn dữ liệu → `Lưu`.
2. Server xác nhận → `read-only` → `Cập nhật`.
3. `Cập nhật` mở edit mode; có `Lưu` và `Hủy` khi phù hợp.
4. Không phát success khi input chưa hợp lệ/không có lựa chọn bắt buộc; error không được khóa form.

Không áp dụng máy móc cho autosave, search/filter, optimistic toggle hoặc transaction action.

## 8. Bảo mật và dữ liệu

- Server là nguồn sự thật cho entitlement, ownership và email preference.
- Không đổi Auth/CSRF/JWT/Payment/Wallet; mutating request tiếp tục qua CSRF hiện có.
- Không log email/payload sức khỏe; không ghi production và không migration/backfill.
- HLV không được truy cập record self-managed nếu không có quan hệ coaching active.

## 9. Acceptance criteria

- Hai checkbox email có contract, validation, UI và tests; check-in tôn trọng opt-in.
- Form Tài khoản chạy đúng state machine Lưu/Cập nhật và fail closed khi không đủ gói.
- Hợp đồng mới chứa consent; ký bật atomically hai preference; legacy contract không bị opt-in.
- Contract signed hiển thị “Đã ký”.
- Dashboard trả đúng `coaching/self_managed/blocked`; Fitness+-only không thấy hoặc kích hoạt luồng HLV.
- Journal, weekly check-in và progress self-managed hoạt động từ dữ liệu tự lưu; blocked user bị từ chối.
- CTA pricing smooth-scroll ổn định trong SPA; marker AI nở ngay khi hover/focus.
- Focused/full tests, lint, build, UI/AI/security/governance gates phản ánh đúng evidence thực tế.
