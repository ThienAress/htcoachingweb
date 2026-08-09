# Ma trận quyền truy cập và quota dịch vụ — 2026-08-07

## Kết luận nhanh

Trong phạm vi 8 nhóm dịch vụ số chính được định nghĩa bên dưới, hệ thống hiện có **3 dịch vụ có
quota/preview sản phẩm rõ ràng**: Gợi ý thực đơn, Meal Scan và AI Assistant. TDEE không có quota.
User có gói tập và HLV được mở unlimited cho Gợi ý thực đơn, đồng thời nhận quota Meal Scan và AI Assistant
cao hơn user thường theo registry canonical.

Ví dụ “TDEE + gợi ý thực đơn có 3 lượt” không phải contract hiện tại:

- TDEE và tính macro chạy hoàn toàn ở client, không giới hạn lượt
  (`client/src/pages/TdeeCalculator/tdee.helpers.js:40`, `:69`, `:92`).
- Guest được một preview Meal Plan theo `sessionStorage`, không phải hard quota backend
  (`client/src/pages/MealPlan/MealPlan.jsx:102`, `client/src/utils/publicJourney.js:43`).
- User đăng nhập chưa có gói chỉ có **1 lượt Meal Plan tổng cộng** theo field
  `mealPlanGenerations` (`server/src/routes/mealplanAccess.routes.js:11`, `:45`, `:69`).
- User có Order `approved`, HLV legacy hoặc user có TrainerSubscription active được Meal Plan
  unlimited (`server/src/routes/mealplanAccess.routes.js:20`, `:26`, `:36`).

## Định nghĩa nhóm dùng để đếm

Để số lượng không bị phóng đại theo từng page/endpoint nhỏ, báo cáo gom thành 8 nhóm dịch vụ:

1. Nội dung công khai: blog, công thức, hồ sơ HLV và kết quả khách hàng.
2. Thư viện bài tập.
3. TDEE và tính macro.
4. Gợi ý thực đơn.
5. Lưu/cá nhân hóa thực đơn.
6. Meal Scan.
7. AI Assistant.
8. Workspace theo vai trò: Today/coaching cho khách có gói hoặc quản lý khách hàng cho HLV.

Các form liên hệ, đăng ký đánh giá và góp ý bài tập là lead/feedback commands nên không tính như
dịch vụ tiêu hao. Giới hạn 5 lần/15 phút hoặc 5 lần/giờ của các form là chống abuse, không phải quota
thương mại (`server/src/middlewares/rateLimit.js:33`, `:45`, `:56`).

## Bảng tổng số theo nhóm người dùng

| Nhóm người dùng | Free, không business quota | Free nhưng có lượt/preview | Mở do gói/role | Chưa dùng được hoặc không có dữ liệu |
|---|---:|---:|---:|---:|
| Chưa đăng nhập | 3 | 3 | 0 | 2 |
| Đã đăng nhập, chưa có gói | 4 | 3 | 0 | 1 |
| User có gói tập active | 4 | 2 | 2 | 0 |
| Huấn luyện viên có quyền active | 4 | 2 | 2 | 0 |

Giải thích số đếm:

- Ba nhóm free cho guest là Nội dung công khai, Thư viện bài tập và TDEE/macro.
- User đăng nhập có thêm Lưu/cá nhân hóa thực đơn.
- Ba nhóm có lượt của guest/user thường là Gợi ý thực đơn, Meal Scan và AI Assistant.
- User có gói/HLV được Gợi ý thực đơn unlimited, nên chỉ còn Meal Scan và AI Assistant có lượt.
- Nhóm workspace chỉ có giá trị đầy đủ khi có Order active hoặc quyền HLV active.

## Ma trận chi tiết

| Dịch vụ | Chưa đăng nhập | Đã đăng nhập, chưa gói | User có gói tập | HLV | Enforcement hiện tại |
|---|---|---|---|---|---|
| Nội dung công khai | Free, không business quota | Như guest | Như guest | Như guest | Blog/recipe/exercise có public GET; ví dụ `server/src/routes/blog.routes.js:46`, `recipe.routes.js:28` |
| Thư viện bài tập | Free, không business quota | Free | Free | Free | Public GET tại `server/src/routes/exercise.routes.js:16` |
| TDEE + macro | Free, không giới hạn | Free, không giới hạn | Free, không giới hạn | Free, không giới hạn | Tính tại client, không gọi API quota |
| Gợi ý thực đơn | 1 preview/browser session | 1 lượt tổng/tài khoản | Unlimited khi có Order `approved` | Unlimited với role trainer hoặc subscription active | Guest là client preview; user quota nằm ở `mealplanAccess.routes.js` |
| Lưu/cá nhân hóa thực đơn | Không; yêu cầu login | Có, chưa có business quota | Có, chưa có business quota | Có, chưa có business quota | Route chỉ dùng `protect`; mutation limiter 60/15 phút là abuse guard (`server/src/routes/savedMealPlan.routes.js:28`) |
| Meal Scan | 2 lượt/24 giờ/IP | 3 lượt/24 giờ/user | 10 lượt/24 giờ/user | 10 lượt/24 giờ/user | Limit động từ `server/src/constants/serviceAccessPolicies.js`, enforce tại `server/src/middlewares/aiRateLimit.js` |
| AI Assistant | 5 tin/giờ/IP; không gửi ảnh | 15 tin/giờ/user | 30 tin/giờ/user | 30 tin/giờ/user | Limit động từ registry, enforce tại `server/src/middlewares/aiRateLimit.js` |
| Workspace theo vai trò | Không | Login được nhưng customer workspace không có coaching data active | Today, lịch, coaching, giáo án, check-in theo Order/session | Quản lý khách, sức khỏe, lịch, giáo án, Order, Contract, Check-in theo subscription/role | Today chỉ mở source khi Order `approved` còn buổi (`server/src/services/todayDashboard.service.js:41`); HLV đi qua `requireTrainerAccess` |

### Ý nghĩa của “user có gói tập active”

Với Today Dashboard, active được xác định đúng bằng Order `approved` và `sessions > 0`
(`server/src/services/todayDashboard.service.js:41`). Khi hết buổi, dashboard chuyển sang history/inactive.
Đây là entitlement theo quan hệ coaching, không phải số lượt API.

Meal Plan và quota dịch vụ giờ dùng chung tier resolver: coaching customer phải có Order `approved` và
`sessions > 0`; Order hết buổi quay về tier user thường.

Today UI còn phụ thuộc `VITE_TODAY_PLATFORM_ENABLED=true`; nếu biến không được cấu hình rõ, feature flag
fail closed (`client/src/config/featureFlags.js:4`).

## Ma trận riêng cho gói HLV

| Gói HLV | Thời hạn/chu kỳ | Tối đa khách | Core trainer workspace | F1 CRM & AI |
|---|---|---:|---|---|
| Free | 30 ngày | 3 | Có | Không |
| Tiêu chuẩn | Tháng/năm | 5 | Có | Không |
| Chuyên nghiệp | Tháng/năm | 20 | Có | Có |
| Cao cấp | Tháng/năm | 50 | Có | Có |

Nguồn canonical là `server/src/constants/trainerPlans.js:6-39`; frontend chỉ hiển thị F1 khi entitlement
`f1CrmAi === true` (`client/src/utils/trainerEntitlements.js:1`). F1 không unlimited tuyệt đối về storage:
mặc định tối đa 30 media/khách, 3 media/scope/type và 100 MB/khách
(`server/src/services/f1MediaLifecycle.service.js:20-29`). F1 generation còn có abuse limiter 20/giờ,
không phải lượt bán riêng.

## Các điểm cần chốt trước khi thiết kế quota mới

1. **Paid tier đã có resolver server-authoritative.** User thường và paid/HLV có quota khác nhau; mọi thay đổi
   tiếp theo phải đi qua registry, không chỉ đổi UI.
2. **Meal Plan vẫn có hai cơ chế phù hợp hai actor.** Guest preview là `sessionStorage`, có thể reset và không phải
   security quota; user thường là lifetime counter ở MongoDB. Nên chốt quota theo ngày/tháng/lifetime.
3. **Order entitlement đã thống nhất cho policy dịch vụ.** Tier coaching customer yêu cầu `sessions > 0`;
   các feature ownership khác vẫn phải giữ authorization riêng.
4. **Rate limiter dùng memory theo process.** Khi Render scale nhiều instance, quota IP/user có thể không
   đồng nhất toàn cụm. Hard commercial quota cần shared store hoặc usage ledger.
5. **Không nên gọi abuse throttles là lượt dịch vụ.** Các mức 60/15 phút cho journal/schedule/saved plan
   chỉ ngăn spam; hiển thị chúng trong pricing sẽ gây hiểu nhầm.

## Đề xuất thứ tự phát triển

1. Chốt product policy cho ba dịch vụ tốn chi phí: Meal Plan, Meal Scan, AI Assistant.
2. Tạo một entitlement resolver canonical cho guest, user, coaching customer và trainer plan.
3. Tách `business quota` khỏi `abuse rate limit`; response trả `limit`, `remaining`, `resetAt` thống nhất.
4. Chuyển quota cần chính xác sang shared store/ledger rồi mới quảng bá unlimited hoặc bán thêm lượt.
5. Sau đó mới bổ sung bảng quota vào Pricing và Account để user thấy số lượt còn lại.
