# Hướng Dẫn Sử Dụng F1 AI Rule Engine

Tài liệu này mô tả cách hoạt động của hệ thống **F1 AI Rule Engine**, giúp quản trị viên (Admin) tự định nghĩa và cập nhật các lời khuyên chuyên môn tự động sinh ra trong báo cáo AI Report dựa trên các số liệu đánh giá (Assessment) và thông tin ban đầu (Intake) của khách hàng.

## 1. Tổng Quan Hệ Thống

Hệ thống F1 (Dựa trên chuẩn NASM) của HTCoaching tự động phân tích dữ liệu của khách hàng qua 3 giai đoạn:
1. **Intake**: Thu thập thông tin sức khỏe, mục tiêu, hình ảnh tư thế.
2. **Assessment**: Đánh giá thực tế về tư thế, chuyển động (Overhead Squat), sức mạnh, sức bền, và tim mạch.
3. **AI Report**: Hệ thống tổng hợp dữ liệu từ 2 bước trên để đưa ra các `riskFlags`, `compensationFlags`, `strengthFlags`, v.v. Dựa trên các "Flags" này, hệ thống sẽ ánh xạ vào các **Rules (Quy tắc)** để tự động sinh ra lời khuyên huấn luyện (Training Notes).

Trước đây, hệ thống sử dụng `if/else` tĩnh trong mã nguồn. Hiện tại, hệ thống sử dụng **Database-driven Rule Engine**, cho phép thay đổi quy tắc từ giao diện Admin.

## 2. Các Toán Tử (Operators) Hỗ Trợ

Khi định nghĩa một Rule mới, bạn cần viết một mảng `conditions` (điều kiện) dưới dạng JSON. Các toán tử được hỗ trợ bao gồm:

- `EQUals`: Bằng tuyệt đối (So sánh chuỗi).
- `NOT_EQUals`: Không bằng.
- `GREATER_THAN`: Lớn hơn (So sánh số).
- `LESS_THAN`: Nhỏ hơn (So sánh số).
- `INCLUDES`: Có chứa phần tử (Dùng cho mảng các flags, hoặc chuỗi).
- `NOT_INCLUDES`: Không chứa phần tử.
- `EXISTS`: Trường dữ liệu tồn tại (khác null/undefined).
- `NOT_EXISTS`: Trường dữ liệu không tồn tại.
- `TRUE`: Giá trị boolean là `true`.
- `FALSE`: Giá trị boolean là `false`.

## 3. Cấu Trúc Ngữ Cảnh (Context Object)

Khi Rule Engine đánh giá một khách hàng, nó có quyền truy cập vào các trường dữ liệu sau (đây là các `field` bạn sẽ truyền vào JSON):

- `phase`: Cấp độ khuyên tập (VD: `"phase_1"`, `"phase_2"`, `"phase_3"`, `"pending_review"`).
- `flags.riskFlags`: Mảng các cảnh báo rủi ro (VD: `["medical_review_needed"]`).
- `flags.lifestyleFlags`: Mảng các cảnh báo lối sống (VD: `["sleep_low", "stress_high"]`).
- `flags.compensationFlags`: Mảng các lỗi bù trừ vận động (VD: `["knees_move_inward", "excessive_forward_lean"]`).
- `flags.strengthFlags`: Mảng lỗi sức mạnh (VD: `["core_strength_low"]`).
- `flags.enduranceFlags`: Mảng lỗi sức bền (VD: `["muscular_endurance_low"]`).
- `flags.cardioFlags`: Mảng lỗi tim mạch (VD: `["cardio_capacity_low", "resting_hr_elevated"]`).
- (Có thể chọc sâu vào dữ liệu Intake/Assessment bằng cách gọi `intake.healthScreening...` nếu cần).

## 4. Ví Dụ Mẫu (JSON Conditions)

Dưới đây là một số ví dụ cách điền trường **Điều kiện kích hoạt (JSON Array)** trên trang Admin.

### Ví dụ 1: Nhắc nhở khách ngủ ít
**Mục đích:** Kích hoạt lời khuyên nếu khách hàng bị flag `sleep_low`.

```json
[
  {
    "field": "flags.lifestyleFlags",
    "operator": "INCLUDES",
    "value": "sleep_low"
  }
]
```

### Ví dụ 2: Lỗi sập gối (Knee Valgus)
**Mục đích:** Khuyên khách hàng không tăng tạ bài Squat nếu có lỗi gối chụm vào trong HOẶC người đổ về trước.
*(Lưu ý: Nếu cần logic HOẶC (OR) trên cùng 1 field, bạn có thể tạo 2 rule riêng biệt để dễ quản lý, hoặc tuỳ biến mở rộng operator trong tương lai. Hiện tại 1 mảng JSON mặc định hiểu là VÀ (AND).*

```json
[
  {
    "field": "flags.compensationFlags",
    "operator": "INCLUDES",
    "value": "knees_move_inward"
  }
]
```

### Ví dụ 3: Đánh giá sức khoẻ Pending Review
**Mục đích:** Khách có bệnh lý cần kiểm tra y tế mới được tập.

```json
[
  {
    "field": "phase",
    "operator": "EQUals",
    "value": "pending_review"
  }
]
```

## 5. Quản Lý Rule Từ Trang Admin

Truy cập **Admin Panel > Quản lý > Quy tắc AI**.

Tại đây, bạn có thể:
1. Nhấn **Thêm Rule Mới**.
2. Đặt mã **Code** (VD: `RULE_SLEEP_LOW` - Chỉ dùng viết hoa và gạch dưới).
3. Đặt **Tên Rule**.
4. Chọn **Category** để phân nhóm logic.
5. Đặt độ ưu tiên **Priority** (Rule nào điểm cao hơn sẽ được sắp xếp đưa ra khuyên trước trong báo cáo).
6. Viết JSON vào ô **Điều kiện kích hoạt**.
7. Viết lời khuyên mà bạn muốn đưa ra vào ô **Nội dung Lời khuyên**.
8. Nhấn **Lưu Rule**.

*(Khi vừa thiết lập, mọi báo cáo AI Report sinh ra từ thời điểm đó sẽ tự động quét qua các quy tắc này)*.

## 6. Xử Lý Khi Database Trống (Fallback)

Hệ thống được thiết kế để không bao giờ bị sập hay trống trải. Trong trường hợp Database của F1AiRule bị xoá trắng hoặc đang bảo trì, hệ thống sẽ tự động fallback về bộ rules mặc định cứng (`hardcoded`) bên trong file `aiReport.helpers.js`. Bạn hoàn toàn có thể yên tâm sử dụng.
