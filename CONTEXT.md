# HTCOACHINGWEB Domain Glossary

File này chỉ định nghĩa vocabulary nghiệp vụ dùng chung giữa user, code, specs và agents.
Không ghi implementation detail, file map, task status hoặc quyết định kiến trúc tại đây.

## Identity and access

### Public Visitor

Người chưa cần xác thực để dùng public routes và public tools. Không đồng nghĩa với một `User` record.

### User

Identity/tài khoản đã xác thực trong hệ thống. Một User record có thể mang role `user`, `trainer` hoặc `admin`;
không suy ra business capability chỉ từ tên model và không đồng nghĩa với Coaching Customer.

### Customer User

User có backend role `user`. Customer User có thể chưa từng coaching hoặc quan hệ coaching đã kết thúc;
chỉ trở thành Coaching Customer khi có quan hệ coaching hợp lệ.

### Trainer

Người cung cấp huấn luyện và dùng trainer workspace. Backend có thể công nhận qua role `trainer` hoặc
entitlement trainer đang active theo contract hiện có; frontend route không phải nguồn cấp quyền.

### Admin

Tài khoản có backend role `admin`, dùng admin workflows. Admin capability luôn phải được kiểm tra ở backend.

## Coaching

### Coaching Customer

User có `Order` coaching được duyệt, còn hiệu lực, còn session và được resolver chuẩn xác định quan hệ với Trainer.
Tránh dùng “client” nếu không rõ đang nói HTTP client hay Coaching Customer.

### Order

Nguồn canonical hiện có để xác định quan hệ coaching đang hoạt động giữa Coaching Customer và Trainer.
Snapshot trainer trong dữ liệu lịch sử không tự cấp quyền hiện tại.

### Default Lead Coach / HLV chính mặc định

Tài khoản được chủ hệ thống chỉ định để phụ trách khách coaching chưa phân công
cho HLV khác. Có thể đồng thời mang role admin; không đồng nghĩa mọi admin đều
là HLV phụ trách. Định danh bằng User ID, không dùng email làm quan hệ dữ liệu.

### Effective Coach / HLV phụ trách thực tế

HLV được phân công rõ trên đơn coaching; với đơn cũ chưa phân công, áp dụng HLV
chính mặc định hợp lệ trong giai đoạn tương thích. Đơn đã phân công không bị
fallback ghi đè. Quyền quản trị và người nhận thông báo coaching là hai khái niệm
khác nhau. Đây là quy ước đã chốt; runtime được triển khai theo spec riêng.

### F1 Customer

Hồ sơ nghiệp vụ F1 dùng cho intake/assessment/program. Chỉ liên hệ với User khi có reference rõ ràng;
không suy đoán liên kết bằng email hoặc số điện thoại.

### Trainer Subscription

Entitlement cho Trainer theo lifecycle/plan hiện hành. Không đồng nghĩa với `Order` coaching của khách hàng.

### HT Fitness+ Member

User có subscription HT Fitness+ đang active để tự sử dụng các công cụ số như HT Assistant, Meal Scan, Meal Plan,
TDEE, thư viện bài tập và theo dõi tiến trình. Đây là product entitlement riêng, không phải role mới, không đồng nghĩa
với Coaching Customer hoặc Trainer Subscription. Các plan hiển thị tiếng Việt là Nền tảng, Tăng tốc và Toàn diện;
English locale dùng Essential, Smart và Max.

## Daily coaching data

### Today Dashboard

Read-model và orchestration surface tổng hợp dữ liệu từ các domain hiện có. Không phải nguồn sở hữu mới
cho Workout, Meal Plan, Check-in, Habit hoặc Wellness data.

### Coaching Habit

Thói quen hằng ngày có definition/lifecycle riêng và completion theo ngày. Habit do Trainer/Admin giao và
Habit cá nhân của Coaching Customer có visibility/lifecycle khác nhau theo spec canonical.
Trong UI sức khỏe cho HLV và Coaching Customer, dùng nhãn `Thói quen khách hàng`; tên domain/API
`Coaching Habit` và semantics dữ liệu không đổi.

### Wellness Target

Mục tiêu do Trainer/Admin thiết lập để so sánh với actual wellness data; không tự đại diện cho completion của journal.

### TDEE Estimate

Ước tính tổng năng lượng tiêu hao hằng ngày từ BMR và bằng chứng vận động cả ngày. Đây là điểm bắt đầu cần theo dõi,
không phải phép đo chính xác hoặc mục tiêu calo tự động áp đặt.

### Exercise Technical Complexity

Độ phức tạp cố hữu của kỹ thuật một bài tập theo rubric đã duyệt. Không đồng nghĩa với mức tạ, cường độ buổi tập
hoặc mức phù hợp của bài đó với một Coaching Customer cụ thể.

### Body Progress

Chuỗi phép đo cơ thể có nguồn và thời điểm rõ ràng dùng để xem giá trị hiện tại cùng xu hướng. Dữ liệu thiếu không
được suy ra thành zero, điểm số hoặc chỉ số máy đo chưa được ghi nhận.

### Body Assessment

Kết quả đo thành phần cơ thể do HLV ghi nhận cho học viên theo kỳ, có ngày đo thực tế.
Khác báo cáo tuần tự nhập và Wellness Target. Nháp không hiển thị cho học viên;
chỉ kết quả đã gửi được dùng để xem/so sánh, lịch sử sửa không phải lần đo mới.

### Segmental Lean Mass / Khối nạc từng vùng

Khối lượng nạc do thiết bị báo cho từng vùng cơ thể, không đồng nghĩa với riêng cơ xương.
Phần trăm tham chiếu của thiết bị có thể vượt 100 và không phải tỷ lệ mỡ toàn thân.

### Waist–hip ratio / Tỷ lệ eo-hông

Thương số vòng eo chia vòng hông cùng lần ghi nhận, không đơn vị; không trộn số đo
giữa các kỳ và không dùng vòng bụng thay vòng eo của dữ liệu cũ.

## Documentation vocabulary

### Spec

Nguồn canonical cho behavior, acceptance criteria và scope của một feature.

### ADR

Bản ghi quyết định kiến trúc khó đảo ngược, gây bất ngờ nếu thiếu context và có trade-off thật.
