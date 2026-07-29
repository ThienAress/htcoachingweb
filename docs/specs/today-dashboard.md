# Feature Spec: Today Dashboard

Status: APPROVED / IMPLEMENTED — Release A–H local verified; staging và F1 baseline linking pending
Ngày soạn: 2026-07-28
Đối tượng chính: khách hàng đang thuê huấn luyện viên
Phạm vi tài liệu: yêu cầu sản phẩm, kiến trúc, dữ liệu, bảo mật và tiêu chí nghiệm thu; Release A–H đã triển khai, F1 baseline chỉ được làm khi có explicit identity link được duyệt

## 1. Tóm tắt

Today Dashboard là màn hình trung tâm theo từng ngày dành cho khách hàng đang được huấn luyện. Màn hình này không thay thế các tính năng lịch tập, bài tập, meal plan hay check-in hiện có. Nó tổng hợp trạng thái từ các nguồn dữ liệu chuẩn, cho phép khách hàng ghi lại dữ liệu trong ngày và tạo lịch sử có thể đối chiếu khi khách hàng và huấn luyện viên cần trao đổi.

Giá trị cốt lõi:

- Khách hàng mở một nơi duy nhất để biết hôm nay cần làm gì.
- Dữ liệu mục tiêu và kết quả thực tế được đặt cạnh nhau nhưng vẫn giữ nguồn dữ liệu chuẩn.
- Mỗi thay đổi quan trọng có người thực hiện, thời gian và lịch sử chỉnh sửa.
- Huấn luyện viên theo dõi đúng khách hàng mình đang quản lý.
- Dữ liệu theo ngày hỗ trợ review tuần và xem tiến trình dài hạn.

## 2. Vấn đề cần giải quyết

Các tính năng hiện tại đang tồn tại ở nhiều màn hình:

- Lịch hẹn và lịch tập nằm trong `TrainingSchedule`.
- Bài HLV giao, trạng thái hoàn thành, phản hồi và video nằm trong `CoachingDay`.
- Cấu trúc giáo án, sets, reps, tempo, mức tạ và đánh giá nằm trong `WorkoutPlan`.
- Meal Plan được tạo ở frontend và lựa chọn thực phẩm đang lưu cục bộ.
- Thông tin nền như mục tiêu, cân nặng, giấc ngủ và stress có một phần trong F1.

Khách hàng phải tự ghép các mảnh thông tin. Khi phát sinh câu hỏi sau vài ngày, hệ thống chưa có một timeline thống nhất để trả lời:

- Hôm đó HLV giao gì?
- Khách thực hiện thực tế ra sao?
- Ăn uống, giấc ngủ, stress và mức đau thế nào?
- Dữ liệu được cập nhật lúc nào và bởi ai?

## 3. Mục tiêu

### 3.1. Mục tiêu sản phẩm

- Hiển thị kế hoạch và trạng thái trong ngày trên một dashboard mobile-first.
- Tái sử dụng và deep-link tới luồng hiện có thay vì sao chép chức năng.
- Cho phép quick log những dữ liệu chưa có nguồn lưu trữ phù hợp.
- Lưu lịch sử theo ngày và revision để hỗ trợ trao đổi, review và tranh chấp.
- Tạo nền cho Progress và Weekly Check-in ở các phase sau.

### 3.2. Mục tiêu kỹ thuật

- Một read model tổng hợp dữ liệu nhưng không trở thành nguồn dữ liệu chuẩn thứ hai.
- Mọi mutation tiếp tục đi qua service/domain đang sở hữu dữ liệu.
- API xác định quyền từ session và quan hệ coaching phía server.
- Ngày được chuẩn hóa theo `Asia/Ho_Chi_Minh`.
- Thiết kế hỗ trợ optimistic locking, idempotency, audit và privacy lifecycle.

## 4. Không thuộc phạm vi

- Không viết lại lịch đặt buổi tập, coaching plan hoặc workout plan.
- Không xây hệ thống chẩn đoán y khoa.
- Không tự động ghép F1 với User chỉ dựa trên email.
- Không đưa trang Today vào sitemap, prerender hoặc kết quả tìm kiếm.
- Không lưu ảnh tiến độ/ảnh bữa ăn ở phase đầu.
- Không gửi email notification ở MVP.
- Không thay đổi cơ chế tính session hoặc entitlement hiện tại.

## 5. Người dùng và quyền truy cập

### 5.1. Khách hàng đang coaching

Điều kiện mặc định để dùng đầy đủ Today Dashboard:

- Đã đăng nhập.
- Có `Order` được duyệt, còn hiệu lực theo quy tắc hiện có.
- Có `sessions > 0`.
- Server xác định được HLV phụ trách bằng resolver chuẩn.

Quyền:

- Xem dữ liệu của chính mình.
- Ghi và sửa journal trong cửa sổ cho phép.
- Xem lịch sử chỉnh sửa của chính mình.
- Gửi weekly check-in và trao đổi với HLV.

### 5.2. Người dùng chưa có hoặc đã kết thúc coaching

Người chưa từng có coaching có thể mở `/today`, nhưng chỉ thấy:

- Giải thích lợi ích.
- Trạng thái chưa có gói/HLV.
- CTA tới luồng phù hợp.

Khách đã từng coaching nhưng hiện không còn active order nhận trạng thái `inactive`.
Họ vẫn được xem dữ liệu của chính mình ở ngày quá khứ trong thời hạn lưu trữ nhưng
không được tạo actual log mới ngoài policy. Không tạo journal coaching hoặc hiển thị
dữ liệu riêng tư của người khác cho trạng thái `never_coached`.

### 5.3. Huấn luyện viên

Chỉ được xem và phản hồi dữ liệu của khách hàng có quan hệ coaching đang hoạt động do server xác minh. Không lấy `clientId` từ frontend làm bằng chứng quyền truy cập.

Khi quan hệ coaching kết thúc:

- HLV mất quyền truy cập ngay.
- Khách hàng vẫn xem dữ liệu của mình trong thời hạn lưu trữ.
- Admin chỉ truy cập khi có quyền hỗ trợ phù hợp và hành động được audit.

### 5.4. Admin

Có quyền hỗ trợ có kiểm soát, phục vụ điều tra lỗi hoặc tranh chấp. Các hành động nhạy cảm phải ghi audit log.

## 6. Nguồn dữ liệu chuẩn và nguyên tắc tái sử dụng

| Nhu cầu | Nguồn chuẩn hiện có | Cách dùng trong Today |
|---|---|---|
| Lịch hẹn/buổi tập | `TrainingSchedule` | Đọc tóm tắt, hiển thị trạng thái, deep-link sang màn hình booking/lịch |
| Bài HLV giao theo ngày | `CoachingDay` | Đọc bài tập và completion; mutation vẫn qua coaching API |
| Sets/reps/tempo/kg mục tiêu | `WorkoutPlan` | Hiển thị tóm tắt và deep-link; không copy thành journal |
| Kết quả/feedback buổi tập đã có | `CoachingDay`/`WorkoutPlan` theo contract thực tế | Dùng đúng nguồn sở hữu field; không tạo field trùng |
| Điểm danh/session | `Checkin` | Chỉ đọc trạng thái liên quan; không dùng làm body progress |
| Sinh meal plan | Meal generator frontend hiện có | Tái sử dụng thuật toán; khi lưu thì tạo snapshot bất biến |
| Công thức/thực phẩm | `Recipe`, `Food`, bookmark hiện có | Tham chiếu bằng ID và snapshot phần cần thiết |
| Thông tin nền ban đầu | `F1Intake`, `F1Customer` | Chỉ dùng sau khi có liên kết User rõ ràng |
| Quan hệ khách–HLV | `resolveClientTrainer()` và `Order` | Là nguồn xác thực quyền, không tin role/ID gửi từ client |

Nguyên tắc bắt buộc:

- Today là lớp tổng hợp/read model, không phải bản sao của domain khác.
- Card hiện có chức năng chỉnh sửa đầy đủ phải dẫn về màn hình gốc.
- Chỉ tạo model mới cho dữ liệu chưa có nơi lưu phù hợp.
- Aggregator trả ID, summary, capability và deep link; không trả raw document hoặc URL media riêng tư không cần thiết.

## 7. Trải nghiệm người dùng

### 7.1. Điều hướng

Customer Dashboard dùng một product shell riêng, tách các nhiệm vụ theo progressive disclosure:

- `/dashboard`: entry canonical, chuyển tới tổng quan ngày hiện tại theo giờ Việt Nam.
- `/dashboard/today/:dateKey`: tổng quan ngắn theo ngày, `dateKey` dạng `YYYY-MM-DD`.
- `/dashboard/today/:dateKey/training`: lịch, coaching, giáo án và điểm danh.
- `/dashboard/today/:dateKey/nutrition`: thực đơn và ghi bữa ăn.
- `/dashboard/today/:dateKey/journal`: wellness, habit, ghi chú, trao đổi và timeline.
- `/dashboard/progress`: tiến trình tổng hợp và Weekly Check-in.
- `/today`, `/today/:dateKey` và `/progress`: compatibility redirects; không được xóa khi notification,
  bookmark hoặc client cũ còn dùng deep link này.
- `/weekly-checkin/:weekKey`: check-in tuần.
- `/trainer/clients/:clientId/today/:dateKey`: góc nhìn HLV.

Tất cả page route phải lazy-load. Các trang này là private, có `noindex` và không nằm trong sitemap/prerender.

### 7.2. Bố cục Today

Customer Dashboard shell có 5 mục ổn định: **Hôm nay**, **Tập luyện**, **Dinh dưỡng**,
**Nhật ký** và **Tiến trình**. Desktop dùng sidebar; mobile dùng bottom navigation. Không copy
toàn bộ mật độ navigation của Admin Panel.

Trang tổng quan không nhúng form đầy đủ. Nó chỉ hiển thị ngày, completion, việc tiếp theo,
attention state và các hàng điều hướng có trạng thái ngắn. Form/editor thuộc module nào phải nằm
trong module đó; route con giữ nguyên `dateKey` khi người dùng chuyển mục.

1. **Header theo ngày**
   - Ngày hiện tại, chuyển ngày trước/sau.
   - Nút quay về hôm nay.
   - Completion ring và trạng thái `not_started`, `in_progress`, `completed`, `submitted`.
   - Phân biệt rõ ngày quá khứ, hiện tại và tương lai.

2. **Attention banners**
   - Sắp đến giờ tập.
   - Còn mục bắt buộc chưa hoàn thành.
   - HLV có phản hồi mới.
   - Khách báo mức đau cao.
   - Lỗi tải một phần dữ liệu.

3. **Lịch hôm nay**
   - Giờ, HLV, hình thức, địa điểm và trạng thái.
   - CTA mở chi tiết/đặt lịch hiện có.
   - Không cho sửa booking trực tiếp nếu luồng booking đã xử lý đầy đủ.

4. **Bài tập hôm nay**
   - Bài HLV giao từ `CoachingDay`.
   - Tóm tắt mục tiêu sets/reps/kg/tempo từ nguồn chuẩn.
   - Kết quả thực tế và completion nếu contract hiện tại hỗ trợ.
   - CTA mở màn hình coaching/workout hiện có.
   - Rest day là trạng thái hợp lệ, không phải empty error.

5. **Dinh dưỡng**
   - Mục tiêu calo/macro.
   - Meal plan đã lưu/được giao cho ngày.
   - Trạng thái từng bữa: planned, eaten, skipped, substituted.
   - Quick log ghi chú thực tế; không tự khẳng định độ chính xác dinh dưỡng.

6. **Wellness**
   - Giấc ngủ, nước, bước chân.
   - Energy, hunger, stress, soreness và pain.
   - UI dùng scale nhất quán, giải thích rõ ý nghĩa hai đầu thang điểm.
   - Mức đau cao chỉ hiển thị cảnh báo liên hệ HLV/chuyên gia; không chẩn đoán.

7. **Habits**
   - Danh sách thói quen được giao hoặc khách tự theo dõi.
   - Trạng thái hoàn thành và streak có điều kiện.
   - Không phạt streak khi habit không được lên lịch ngày đó.

8. **Ghi chú và trao đổi**
   - Ghi chú riêng của khách.
   - Comment theo context: workout, meal, wellness hoặc toàn ngày.
   - Phân biệt note cá nhân với nội dung chia sẻ cho HLV.

9. **Timeline hoạt động**
   - Ai thay đổi gì, lúc nào.
   - Hiển thị event có ý nghĩa, không lộ payload kỹ thuật hoặc PII dư thừa.
   - Revision quan trọng có thể mở để đối chiếu.

10. **Quick actions trên mobile**
    - Log wellness.
    - Hoàn thành bài tập.
    - Log bữa ăn.
    - Thêm ghi chú.

11. **Progressive disclosure**
    - Overview trả lời “hôm nay cần làm gì tiếp theo”, không cố hiển thị toàn bộ dữ liệu.
    - Training, Nutrition và Journal tái sử dụng component/service hiện có trong route con.
    - Comment ở đúng context; notification và account giữ ở shell/header, không chiếm primary nav.
    - Một module lỗi không làm mất sidebar/bottom nav hoặc module khác.

### 7.3. Trạng thái giao diện bắt buộc

- Loading skeleton theo section.
- Full empty: chưa có gói coaching.
- Partial empty: không có lịch, rest day, chưa có meal plan hoặc habit.
- Partial error: một section lỗi không làm mất toàn dashboard.
- Unauthorized/relationship ended.
- Offline hoặc request timeout.
- Save success, save error và retry.
- Revision conflict `409`: báo dữ liệu đã thay đổi, tải bản mới và cho người dùng quyết định nhập lại.
- Ngày tương lai: chỉ xem kế hoạch, hạn chế actual logs.
- Ngày quá khứ: áp dụng edit window.

## 8. Dữ liệu mới dự kiến

Tên model chỉ là đề xuất; implementation phải tuân theo `schema-change`.

### 8.1. `DailyJournal`

Một document cho mỗi `clientId + dateKey`.

Nhóm field:

- Ownership: `clientId`, `trainerIdAtCreation`.
- Date: `dateKey`, `timezone`.
- Wellness: sleep, water, steps, energy, hunger, stress, soreness, pain.
- Nutrition execution: trạng thái bữa ăn và ghi chú ngắn.
- Habit completion: tham chiếu habit và trạng thái.
- Notes: private/shared có giới hạn độ dài.
- Lifecycle: `status`, `submittedAt`, `reviewedAt`.
- Concurrency: `revision`.
- Audit timestamps.

Index dự kiến:

- Unique `{ clientId: 1, dateKey: 1 }`.
- Query `{ trainerIdAtCreation: 1, dateKey: -1 }` chỉ hỗ trợ tra cứu lịch sử; quyền hiện tại vẫn phải re-check quan hệ.
- TTL không dùng trực tiếp nếu retention cần audit/dry-run.

### 8.2. `DailyJournalRevision`

Append-only:

- `journalId`, `revision`.
- `actorId`, `actorRole`.
- `changedAt`, `reason`.
- Allowlisted before/after hoặc field-level diff.
- `requestId`.

Không lưu token, raw request, URL media có chữ ký hoặc dữ liệu nhạy cảm ngoài phạm vi.

### 8.3. `SavedMealPlan`

Snapshot bất biến của kết quả generator tại thời điểm lưu:

- Owner/client.
- Macro target và thông số đầu vào cần thiết.
- Meals, foods, quantities và totals đã chuẩn hóa.
- `generatorVersion`.
- Ngày được gán.
- Nguồn: self-generated hoặc trainer-assigned.

Không gọi lại generator mỗi khi xem lịch sử vì kết quả/thuật toán có thể thay đổi.

### 8.4. `CoachingHabit`

- Owner/client và creator.
- Tên, mô tả, lịch áp dụng, mục tiêu.
- Ngày bắt đầu/kết thúc.
- Active/archived.
- Không sao chép completion; completion nằm trong journal theo ngày.

### 8.5. `WeeklyCheckin`

- `clientId`, `trainerIdAtSubmission`, `weekKey`.
- Tổng hợp tuần bằng snapshot/version.
- Câu trả lời của khách.
- Review và phản hồi của HLV.
- Lifecycle: draft, submitted, reviewed, reopened.
- Unique `{ clientId: 1, weekKey: 1 }`.

### 8.6. `CoachingComment`

- Context target allowlist.
- Author và recipient scope.
- Nội dung có giới hạn.
- Created/edited timestamp.
- Soft-delete/tombstone để giữ mạch trao đổi và audit.

## 9. API contract dự kiến

### 9.1. Aggregation

`GET /api/today-dashboard/day/:dateKey`

Contract canonical v1:

```json
{
  "success": true,
  "data": {
    "contractVersion": 1,
    "dateKey": "2026-07-28",
    "timeZone": "Asia/Ho_Chi_Minh",
    "eligibility": {
      "status": "active",
      "orderId": "id",
      "trainer": { "_id": "id", "name": "..." }
    },
    "summary": {
      "dayStatus": "in_progress",
      "completionPercent": 60,
      "formulaVersion": "today-v1",
      "attentionFlags": []
    },
    "capabilities": {
      "canViewSources": true,
      "canEditJournal": false,
      "canSubmitDay": false,
      "canComment": false
    },
    "sections": {
      "schedule": { "status": "ready", "source": "training_schedule", "items": [], "deepLink": "/book-training", "error": null },
      "coaching": { "status": "empty", "source": "coaching_day", "day": null, "deepLink": "/online-coaching", "error": null },
      "workout": { "status": "empty", "source": "workout_plan", "items": [], "deepLink": "/workout-plans", "error": null },
      "attendance": { "status": "empty", "source": "checkin", "items": [], "deepLink": "/my-history", "error": null }
    },
    "partialErrors": []
  }
}
```

Yêu cầu:

- Read-only.
- Server suy ra user và quan hệ coaching.
- Mỗi section có `source`, `deepLink`, `status`, payload riêng và `error` đã redact.
- Không trả field nội bộ không cần cho UI.
- Partial failure được chuẩn hóa, không biến toàn response thành 500 nếu section độc lập lỗi.
- `401/403` là lỗi toàn request, không được hạ thành partial error.
- Response private đặt `Cache-Control: private, no-store`.

### 9.2. Daily Journal

- `GET /api/daily-journals/:dateKey`
- `PUT /api/daily-journals/:dateKey`
- `POST /api/daily-journals/:dateKey/submit`
- `POST /api/daily-journals/:dateKey/corrections`
- `POST /api/daily-journals/:dateKey/review`
- `GET /api/daily-journals/:dateKey/revisions?page=1&limit=20`

Mutation gửi:

- `expectedRevision`.
- `requestId` cho idempotency.
- Patch theo allowlist.

Server:

- Validate date/window/value range.
- Check ownership/relationship.
- Update có điều kiện theo revision.
- Tạo revision trong cùng transaction khi cần.
- Trả `409` khi revision cũ.

### 9.3. Meal Plan, Habit, Weekly Check-in và Comment

Các endpoint chi tiết được chốt ở phase tương ứng, nhưng bắt buộc:

- Service layer sở hữu business logic.
- Server validate và tính lại tổng macro quan trọng; không tin totals từ client.
- Trainer mutation kiểm tra khách đang thuộc quyền quản lý.
- Comment validate context ownership.
- Error contract nhất quán với API hiện tại.

## 10. Quy tắc nghiệp vụ

### 10.1. Ngày và thời gian

- Canonical timezone: `Asia/Ho_Chi_Minh`.
- `dateKey` được tính bằng helper server hiện có.
- Không dùng UTC date substring trực tiếp để xác định “hôm nay”.
- Event timestamp vẫn lưu UTC; UI render theo timezone phù hợp.

### 10.2. Completion

Completion là chỉ báo hỗ trợ, không phải điểm sức khỏe.

- Chỉ tính các mục áp dụng cho ngày.
- Rest day không bị tính thiếu workout.
- Công thức phải đặt ở server, có `formulaVersion`.
- UI không tự tính công thức khác server.

### 10.3. Edit window

Đề xuất để duyệt:

- Khách sửa ngày hiện tại và 7 ngày gần nhất.
- Sau khi submit, chỉnh sửa yêu cầu lý do.
- HLV không sửa dữ liệu actual của khách; chỉ review/comment.
- Admin correction đặc biệt phải có reason và audit.

### 10.4. Quan hệ coaching

- Full access yêu cầu active approved `Order` và resolver chuẩn.
- Snapshot `trainerIdAtCreation` phục vụ lịch sử, không cấp quyền hiện tại.
- Mọi trainer read/mutation đều re-check quan hệ đang hoạt động.

### 10.5. F1 baseline

- Không auto-link theo email.
- Chỉ đọc F1 khi có explicit `userId` hoặc mapping đã được xác nhận.
- Việc bổ sung liên kết F1 là schema change riêng, có index/backfill/dry-run/rollback.

## 11. Bảo mật, quyền riêng tư và an toàn

- Route bắt buộc authentication, CSRF cho mutation và rate limit phù hợp.
- Mọi object-by-ID phải kiểm tra ownership/IDOR.
- Không nhận `trainerId` hoặc `clientId` như bằng chứng quyền.
- Validate số, enum, độ dài text và date range phía server.
- Log bằng `safeLog`, không log raw health notes hoặc PII.
- Private media chỉ triển khai khi có signed access, ownership và deletion lifecycle.
- Cập nhật export/delete/retention khi tạo collection chứa dữ liệu người dùng.
- Retention đã duyệt: cấu hình được, mặc định 365 ngày sau khi coaching kết thúc; enforcement
  chỉ bật sau khi collection có lifecycle timestamp, target và privacy/operations gate tương ứng.
- Notification không chứa chi tiết nhạy cảm ở push/email.
- Trang private dùng `noindex`, không sitemap và không prerender.

## 12. Progress và Weekly Review

Progress không chỉ là cân nặng:

- Training adherence.
- Meal adherence.
- Sleep/energy/stress trend.
- Body metrics khi có nguồn hợp lệ.
- Habit completion.
- Weekly check-in status.

Quy tắc:

- Mỗi metric ghi rõ nguồn và khoảng thời gian.
- Không suy diễn nhân quả hoặc chẩn đoán.
- Missing data không được biến thành zero.
- Formula/version do server cung cấp.
- Weekly snapshot giữ nguyên dữ liệu tại thời điểm submit để lịch sử không đổi ngoài ý muốn.

## 13. Notifications

MVP dùng in-app:

- Sắp đến lịch tập.
- HLV có comment/review.
- Weekly check-in đến hạn.
- Journal còn mục quan trọng chưa hoàn thành.

Email chỉ xem xét sau, theo opt-in và preference. Mọi notification phải chống gửi trùng bằng event/idempotency key.

## 14. Observability

Theo dõi:

- Aggregation latency tổng và theo section.
- Partial error rate.
- Journal save conflict rate.
- Unauthorized access attempts.
- Save/submit/review success rate.
- Adoption: mở Today, quick log, weekly completion.

Không đưa nội dung note hoặc dữ liệu sức khỏe thô vào analytics.

## 15. Tiêu chí nghiệm thu tổng thể

- Khách đủ điều kiện xem được kế hoạch hôm nay từ các nguồn hiện có.
- Không có document lịch/bài tập/workout bị nhân bản vào Today.
- Card dẫn về đúng flow gốc để thao tác chuyên sâu.
- Khách không thể xem/sửa journal của người khác bằng cách đổi ID/date.
- HLV chỉ xem khách đang quản lý.
- Một section lỗi không làm hỏng toàn dashboard.
- Ngày hiển thị nhất quán theo giờ Việt Nam.
- Journal mutation chống lost update và request lặp.
- Timeline chỉ ra được actor, time và thay đổi quan trọng.
- Người dùng chưa có coaching nhận onboarding hợp lý.
- Private routes không xuất hiện trong sitemap/prerender.
- New collections tham gia đầy đủ privacy export/deletion/retention.
- Mobile, loading, empty, error, offline và accessibility states được kiểm tra.

## 16. Các quyết định đã duyệt

1. Edit window: 7 ngày.
2. Retention sau coaching: cấu hình mặc định 365 ngày, chỉ bật enforcement sau khi
   có lifecycle timestamp canonical và privacy gate của collection tương ứng.
3. HLV mất quyền ngay khi quan hệ coaching hết hiệu lực.
4. Ảnh tiến độ và ảnh bữa ăn hoãn khỏi MVP.
5. F1 chỉ liên kết thủ công/có xác nhận, không auto-link email.
6. Notification phase đầu chỉ in-app.
7. Today MVP ưu tiên tổng hợp + quick log, chưa có gamification phức tạp.
8. Tuần bắt đầu vào thứ Hai theo `Asia/Ho_Chi_Minh`.
9. Pain threshold mặc định là 7/10 và chỉ tạo safety copy, không chẩn đoán.
10. Habit do khách tự tạo mặc định private; chỉ chia sẻ khi khách chủ động bật.
11. Release A chỉ đọc dữ liệu hiện có, không tạo model/index/migration mới.
12. Mọi release tạo dữ liệu người dùng phải hoàn thành export/delete/retention và
   no-store cache gate trước khi bật write.
13. Customer Dashboard là navigation/presentation shell; `/dashboard` canonical nhưng các deep link
    `/today` và `/progress` cũ phải tiếp tục hoạt động qua redirect.
14. Overview dùng progressive disclosure; editor Wellness, Nutrition và Habit không cùng xuất hiện
    trên một trang tổng quan.
15. Menu tài khoản khách hàng chỉ có một entry vào Customer Dashboard. Các route chuyên sâu cũ vẫn
    canonical nhưng được mở từ module Tập luyện hoặc Dinh dưỡng; public Tools menu không bị thay đổi.

## 17. Định nghĩa hoàn thành của feature

Feature chỉ được xem là hoàn thành khi:

- Tất cả phase đã duyệt đạt acceptance criteria.
- API, schema, privacy lifecycle và migration đều có test.
- UI đạt mobile, keyboard, screen reader cơ bản và reduced motion.
- Customer Dashboard giữ đúng module/date khi điều hướng, legacy deep links vẫn tới đúng nội dung.
- Security/data-boundary scans pass.
- Staging được pilot bằng dữ liệu test.
- Có rollback/feature flag và tài liệu vận hành.
- Không còn nguồn dữ liệu trùng hoặc đường ghi tắt bỏ qua domain service.
