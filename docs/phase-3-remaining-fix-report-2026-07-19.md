# Phase 3 Remaining Work - Báo cáo hoàn tất

Ngày chốt: 2026-07-19

## Kết luận

Toàn bộ việc ưu tiên cao còn có thể xử lý trong codebase ở cuối Phase 3 đã hoàn
thành. Client hiện lint sạch, các bundle nặng đã được tách khỏi đường tải ban đầu,
ảnh hero đã được tối ưu, và các luồng authenticated quan trọng đã có E2E ở Phase 5.

Hai việc phụ thuộc hạ tầng thật không được tự ý thực hiện:

- Tạo Atlas Vector Search index và bật KB_VECTOR_INDEX.
- Chạy migration/index verification/query explain trên staging hoặc production.

## 1. React render và data fetching

- Chuyển các request trạng thái dùng chung ở Header, AdminRoute, đăng ký booking và
  Exercise browser sang TanStack Query để có cache, dedupe và lifecycle rõ ràng.
- Loại bỏ các effect chỉ dùng để đồng bộ state có thể suy ra từ props/state khác.
- Chuyển reset page/sidebar/modal về đúng event handler.
- Dùng lazy initializer cho localStorage và state khởi tạo ở TDEE, meal plan,
  macro, contract, workout và schedule.
- Dùng useWatch/getValues đúng contract React Hook Form.
- Giữ bốn effect hydrate form từ server snapshot vì đây là side effect hợp lệ;
  mỗi vị trí có giải thích lint cục bộ, không tắt rule toàn dự án.

Kết quả: ESLint toàn client từ 48 warnings xuống 0 warning, 0 error.

## 2. Bundle và tài nguyên

- HT Assistant chỉ tải ChatPanel sau khi người dùng đã đăng nhập và bấm launcher.
- TipTap editor chỉ tải khi mở luồng chỉnh sửa; danh sách blog dùng preview nhẹ.
- React PDF vẫn là chunk deferred riêng, không nằm trên đường tải trang Exercises.
- Tách editor, markdown, query, animation và icon thành các vendor chunk ổn định.
- Thêm manifest và bundle budget tự động sau production build.
- Chuyển toàn bộ nơi dùng ba ảnh hero từ JPG sang WebP.

Kết quả build cuối:

| Hạng mục | Kích thước raw | Gzip | Trạng thái |
| --- | ---: | ---: | --- |
| Entry | 501.6 KB | 158.0 KB | Đạt budget |
| ChatPanel deferred | 51.8 KB | 13.8 KB | Chỉ tải khi mở |
| Editor vendor | 435.8 KB | 133.9 KB | Route deferred |
| React PDF | 1508.7 KB | 499.7 KB | Deferred PDF |

Ba JPG hero từng chiếm khoảng 3.7 MB trong dist đã được loại khỏi output. Ba WebP
tương ứng còn khoảng 531 KB tổng cộng. File JPG gốc vẫn được giữ trong source để
không phá lịch sử tài nguyên, nhưng không còn được import vào production bundle.

## 3. Ổn định UI

- Intro không còn khiến app khởi tạo state lặp không cần thiết; E2E có chế độ bỏ
  intro để test không phụ thuộc animation.
- Các danh sách quản trị reset page tại hành động filter/search thay vì effect.
- Countdown và dữ liệu modal được suy ra ổn định, tránh setState dây chuyền.
- GSAP option/callback được giữ bằng ref để không tái tạo animation ngoài ý muốn.

## 4. Việc ưu tiên cao cũ đã đi đâu

| Việc cũ | Trạng thái |
| --- | --- |
| Authenticated E2E admin/trainer/customer | Hoàn thành trong Phase 5 |
| API integration với MongoDB cô lập | Hoàn thành, dùng MongoMemoryReplSet |
| Giảm PDF/app/editor chunks | Hoàn thành phần đường tải quan trọng; PDF được defer |
| Xử lý 48 lint warnings | Hoàn thành, 0 warning |
| Metrics AI/KB/cleanup/conflict/query | Hoàn thành trong Phase 4 |
| Atlas vector index | Runbook hoàn thành; tạo index thật cần thao tác Atlas có phê duyệt |

## 5. Kiểm chứng

- Client lint: pass, 0 warning, 0 error.
- Client unit tests: 85/85 pass trên 5 test files.
- Server tests sau toàn bộ Phase 4-5: 91/91 pass trên 18 test files.
- Production build: pass, 2691 modules transformed.
- Prerender: 20/20 routes pass.
- Bundle budget: pass.
- Browser E2E: 35/35 Chromium và 105/105 full browser matrix pass.

## 6. File thay đổi cho phần còn lại Phase 3

### Bundle, lazy loading và asset

- client/package.json
- client/vite.config.js
- client/scripts/check-bundle-budget.js
- client/src/App.jsx
- client/src/components/BlogContentPreview.jsx
- client/src/components/ChatWidget/ChatPanel.jsx
- client/src/components/ChatWidget/DeferredChatPanel.jsx
- client/src/pages/admin/BlogManagement.jsx
- client/src/sections/Hero.jsx
- client/src/sections/About.jsx
- client/src/sections/Tools.jsx
- client/src/pages/CustomerStories.jsx
- client/src/assets/images/hero/hero1.webp
- client/src/assets/images/hero/hero2.webp
- client/src/assets/images/hero/hero3.webp

### React render, query và lint cleanup

- client/src/components/ChatIcons.jsx
- client/src/components/F1/F1IntakeWizard.jsx
- client/src/hooks/useGsap.js
- client/src/hooks/useMacroSet.js
- client/src/layouts/AdminLayout.jsx
- client/src/layouts/TrainerLayout.jsx
- client/src/pages/ContractSign.jsx
- client/src/pages/ExercisesPage/ExerciseListModal.jsx
- client/src/pages/MealPlan/CustomMealBuilder.jsx
- client/src/pages/MealPlan/FoodNutritionTable.jsx
- client/src/pages/MealPlan/MealPlan.jsx
- client/src/pages/RegisterPage/RegisterPage.jsx
- client/src/pages/TdeeCalculator/TdeeCalculator.jsx
- client/src/pages/TrainerProfile.jsx
- client/src/pages/account/AccountPage.jsx
- client/src/pages/admin/BookingManagement.jsx
- client/src/pages/admin/CheckinHistory.jsx
- client/src/pages/admin/ContractEditModal.jsx
- client/src/pages/admin/ContractManagement.jsx
- client/src/pages/admin/DepositManagement.jsx
- client/src/pages/admin/Orders.jsx
- client/src/pages/admin/TrainerManagement.jsx
- client/src/pages/admin/TrainerProfileEditor.jsx
- client/src/pages/admin/TrainerSubscriberManagement.jsx
- client/src/pages/admin/UserManagement.jsx
- client/src/pages/trainer/TrainingSchedule.jsx
- client/src/pages/trainer/WorkoutPlan.jsx
- client/src/pages/trainer/WorkoutPlanDetail.jsx
- client/src/pages/trainer/WorkoutPlanModal.jsx
- client/src/pages/wallet/MyWallet.jsx
- client/src/routes/AdminRoute.jsx
- client/src/sections/FeedBackSection/Feedback.jsx
- client/src/sections/Header/Header.jsx
- client/src/sections/Trainers.jsx
- client/src/sections/class/Classes.jsx

## 7. Rủi ro còn lại

- Entry và PDF chunk vẫn lớn về raw size, nhưng đã nằm trong budget và PDF chỉ tải
  theo nhu cầu. Nên theo dõi real-user LCP/INP trước khi tiếp tục chia nhỏ.
- Vite vẫn cảnh báo chunk trên 500 KB vì entry và PDF; đây là cảnh báo đã được
  kiểm soát bằng budget, không phải build failure.
- Production API đã có lúc timeout khi tạo sitemap và endpoint recipes cũ trả 404.
  Build vẫn có fallback và prerender 20 route, nhưng cần deploy server mới trước
  client rồi kiểm tra lại sitemap theo release checklist.
