# Feature Spec: Hành trình public ưu tiên giá trị

Status: IMPLEMENTED / LOCAL VERIFIED — LIVE FOOD PREVIEW VÀ PRERENDER PENDING
Ngày soạn: 2026-08-05
Quyết định sản phẩm: được duyệt trong trao đổi với chủ dự án ngày 2026-08-05

## 1. Tóm tắt

Hành trình public cần cho khách vãng lai hiểu dịch vụ và nhận giá trị trước khi bị yêu cầu
đăng nhập. Thay đổi này tập trung vào ba điểm: Pricing minh bạch cách xác định chi phí,
Meal Plan cho xem một thực đơn mẫu, và TDEE chọn sẵn công thức phù hợp với phần lớn người dùng.

CTA Hero **“Nhận tư vấn miễn phí”** là entry chính và phải được giữ nguyên.

## 2. Mục tiêu

- Không chặn trang chủ bằng modal chọn Khách hàng/Huấn luyện viên.
- Cho phép đổi persona ngay trong section Pricing và nhớ lựa chọn hợp lệ.
- Nói rõ chi phí coaching khách hàng được xác định sau buổi đánh giá miễn phí.
- Cho khách chưa đăng nhập tạo một thực đơn mẫu trong một browser session.
- Chỉ yêu cầu đăng nhập khi khách muốn tạo lại, lưu hoặc cá nhân hóa sâu hơn.
- Chọn sẵn `Mifflin-St Jeor` trong TDEE nhưng không tự đoán mức vận động hoặc mục tiêu.

## 3. Ngoài phạm vi

- Không đổi CTA hoặc hành vi Hero.
- Không công khai bảng giá cố định cho coaching khách hàng.
- Không đổi giá, checkout, entitlement hoặc quota của gói dành cho HLV.
- Không mở API protected, không đổi auth/CSRF, schema, migration hoặc dữ liệu thật.
- Không biến anonymous Meal Plan thành quota bảo mật; đây là preview phía client theo session.
- Không tự chọn mục tiêu giảm cân, calorie adjustment hoặc mức vận động trong TDEE.

## 4. Yêu cầu trải nghiệm

### 4.1. Pricing

- Mặc định hiển thị gói Khách hàng khi chưa có lựa chọn hợp lệ trong `localStorage`.
- Selector `Khách hàng` / `Huấn luyện viên` nằm trực tiếp trong Pricing, có trạng thái được chọn
  rõ ràng, điều khiển bằng bàn phím và `aria-pressed`.
- Không tự mở modal persona sau animation Hero và không còn link mở lại modal ở cuối Pricing.
- Popup tiến độ Today chỉ được phép xuất hiện với người dùng đã đăng nhập ở customer mode.
- Mỗi card coaching khách hàng hiển thị: “Chi phí được xác định sau buổi đánh giá miễn phí”.
- CTA card khách hàng dẫn vào luồng đăng ký đánh giá hiện có; trang đăng ký lặp lại thông tin
  xác định chi phí sau đánh giá để không tạo kỳ vọng thanh toán sai.
- Trainer pricing vẫn hiển thị giá catalog và checkout hiện tại, không bị thay đổi.

### 4.2. Meal Plan preview

- Khách chưa đăng nhập có macro hợp lệ được tạo một thực đơn mẫu trong browser session.
- Sau lần tạo thành công, UI giải thích thực đơn đang là bản xem thử và đăng nhập dùng để lưu,
  tạo lại, chọn món yêu thích hoặc cá nhân hóa sâu hơn.
- Lần tạo tiếp theo của guest mở Login Modal; không gọi endpoint ghi nhận quota.
- Người đã đăng nhập tiếp tục đi qua `useMealPlanAccess` và `recordGeneration` như hiện tại.
- Saved Meal Plans vẫn chỉ render cho user đủ điều kiện theo feature flag.
- Guest không được dùng lựa chọn món yêu thích như một đường vòng để tạo thêm preview.

### 4.3. TDEE safe default

- Form mới và thao tác Đặt lại đều có `formula = "Mifflin-St Jeor"`.
- Dữ liệu local cũ có `formula` trống được normalize sang mặc định mới; công thức hợp lệ đã lưu
  vẫn được giữ nguyên.
- UI giải thích đây là lựa chọn phù hợp với phần lớn người trưởng thành và vẫn cho đổi công thức.
- `activity`, `goal` và `customCalorieAdjustment` vẫn trống cho đến khi người dùng chọn.

## 5. Contract và lưu trữ

| Dữ liệu | Nguồn/cơ chế | Thay đổi |
|---|---|---|
| Pricing persona | `localStorage.pricingViewMode` | Chỉ nhận `customer`/`trainer`, fallback `customer` |
| Guest preview | `sessionStorage` | Cờ boolean theo browser session, không gửi server |
| TDEE form | `localStorage.tdeeForm` | Normalize formula trống sang `Mifflin-St Jeor` |
| Authenticated quota | Meal Plan access API | Không đổi |
| Coaching registration | React Router state + register flow | Không đổi payload thương mại |

Mọi truy cập Web Storage phải fail-safe khi storage không khả dụng.

## 6. Acceptance criteria

- [x] Tải homepage mới không có persona modal; Pricing mặc định ở Khách hàng.
- [x] Selector inline chuyển đúng hai catalog và chỉ lưu giá trị hợp lệ.
- [x] Hero CTA hiện có được giữ nguyên, không có diff trong `Hero.jsx` hoặc key `hero.cta_primary`.
- [x] Customer cards và registration summary cùng nói rõ giá xác định sau đánh giá miễn phí.
- [ ] Guest có macro tạo được đúng một preview/session; logic/session tests pass nhưng local Food API
  không sẵn sàng để smoke trọn lần sinh thực đơn thật trong browser.
- [x] Authenticated quota, save và trainer checkout không đổi contract.
- [x] TDEE mới/reset/legacy-empty dùng Mifflin; activity và goal vẫn trống.
- [ ] Unit tests, client lint, Vite compile, bundle budget và UI smoke pass; full `npm run build`
  chưa kết thúc postbuild vì sandbox chặn dynamic fetch/prerender.
