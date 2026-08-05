# Implementation Plans — HTCoachingWeb

Generated on 2026-07-28. Execute plans in dependency order and pass every verification gate before moving on.

## Execution Order & Status

| Plan | Title | Priority | Effort | Depends on | Status |
|---|---|---:|---:|---|---|
| 001 | Hoàn thiện vòng đời gói HLV và bảo vệ AI output | P1 | L | — | IMPLEMENTED / VERIFIED |
| 002 | Loại bỏ drift giá và hợp đồng thương mại giữa FE/BE | P1 | L | 001 | DEPLOYED / VERIFIED ON STAGING |
| 003 | Xây dựng Today Dashboard thành trung tâm đồng hành hằng ngày | P1 | XL | 001, 002 | IMPLEMENTED / LOCAL VERIFIED — STAGING + F1 LINK PENDING |
| 003A | Ship Today Dashboard read-only từ nguồn canonical hiện có | P1 | L | 003 | IMPLEMENTED / VERIFIED |
| 003B | Daily Journal, wellness quick log và privacy lifecycle | P1 | L | 003A | IMPLEMENTED / VERIFIED |
| 003C | Lưu và version hóa meal plan từ nguồn Food canonical | P1 | L | 003B | IMPLEMENTED / VERIFIED |
| 003D | Gắn meal plan và ghi bữa ăn nhanh theo ngày | P1 | L | 003C | IMPLEMENTED / VERIFIED |
| 003E | Coaching habit assignment, completion và streak | P1 | L | 003D | IMPLEMENTED / VERIFIED |
| 003F | Weekly Check-in và Progress Hub | P1 | XL | 003E | IMPLEMENTED / VERIFIED |
| 003G | Coach collaboration, notifications và audit | P1 | XL | 003F | IMPLEMENTED / LOCAL VERIFIED |
| 003H | Privacy, performance và staged rollout hardening | P1 | L | 003G | IMPLEMENTED / LOCAL VERIFIED — STAGING PENDING |
| 004 | Mở Today Dashboard từ trang chủ mà không cạnh tranh popup | P1 | S | 003H | IMPLEMENTED / VERIFIED |
| 005 | Khôi phục accessibility gate cho Trainer và F1 mobile | P1 | S | 004 | IMPLEMENTED / VERIFIED |
| 006 | Chuyển Today thành Customer Dashboard theo module | P1 | L | 003H, 004 | IMPLEMENTED / VERIFIED |
| 007 | Deploy Customer Dashboard lên staging và xác minh từ xa | P1 | S | 003H, 004, 005, 006 | DEPLOYED / VERIFIED ON STAGING |
| 008 | Đồng bộ đầy đủ tài khoản test vào local và staging | P1 | S | 007 | DEPLOYED / VERIFIED ON STAGING |
| 009 | Việt hóa Customer Dashboard và trực quan hóa tiến trình | P1 | M | 003F, 006, 008 | IMPLEMENTED / VERIFIED |
| 010 | Tách tiến độ hoàn thành theo module của Customer Dashboard | P1 | M | 003B, 003C, 006, 009 | IMPLEMENTED / LOCAL VERIFIED — PRERENDER BLOCKED |
| 011 | Thêm mục tiêu sức khỏe do HLV và admin thiết lập | P1 | L | 008, 009, 010 | IMPLEMENTED / LOCAL VERIFIED - MIGRATION NOT RUN |
| 012 | Tách quản lý học viên khỏi Coach Online | P1 | M | 009, 010, 011 | IMPLEMENTED / LOCAL VERIFIED |
| 013 | Đơn giản hóa quản lý mục tiêu và thói quen của học viên | P1 | M | 011, 012 | DONE / LOCAL VERIFIED |
| 014 | Chuẩn hóa thói quen hằng ngày và báo cáo tuần theo tháng | P1 | M | 013 | DONE / LOCAL VERIFIED |
| 015 | Mở luồng Theo dõi sức khỏe từ Nghiệp vụ huấn luyện | P1 | S | 012, 014 | DONE / LOCAL VERIFIED |
| 016 | Rút gọn dropdown và gom nghiệp vụ vào Quản lý khách hàng | P1 | M | 012, 015 | IMPLEMENTED / LOCAL VERIFIED — VISUAL MANUAL PENDING |
| 017 | Harden agent governance và loại bỏ instruction drift | P1 | M | — | DONE / VERIFIED |
| 018 | Chuẩn hóa TanStack Query v5 và vòng đời server state | P1 | L | 001, 002, 003H | DONE / LOCAL VERIFIED |
| 019 | Harden auth và F1 authorization | P1 | M | — | DONE / LOCAL VERIFIED |
| 020 | Codify security review governance | P1 | M | 019 | DONE / LOCAL VERIFIED — STAGING PENDING |
| 021 | Harden mobile AI chat and trainer Free eligibility | P1 | M | 001, 002, 018 | DONE / LOCAL VERIFIED — MANUAL IOS PENDING |
| 022 | Thay chữ ký tay bằng xác nhận hợp đồng qua OTP | P1 | L | 002, 019, 020 | SUPERSEDED BY 023 / NOT DEPLOYED |
| 023 | Khôi phục chữ ký tay và hoàn thiện trải nghiệm hợp đồng | P1 | L | 002, 019, 020, 022 | DONE / LOCAL VERIFIED — NOT DEPLOYED |
| 024 | Thêm trang Quét món ăn với ước tính calo và macro | P1 | L | 017, 019 | DONE / LOCAL VERIFIED — ALPHA DATA GATE PENDING |

| 024A | Harden Meal Scan cho món ăn toàn cầu và xác nhận có kiểm soát | P1 | L | 024 | DONE / LOCAL VERIFIED — WEIGHED HOLDOUT PENDING |
| 025 | Thêm provenance Food DB, packaged-food lookup và authenticated Meal Scan E2E | P1 | L | 024A | COMPLETE / LOCAL VERIFIED |
| 026 | Mở Meal Scan anonymous có quota và căn giữa hành trình sử dụng | P1 | M | 024, 024A, 025 | DONE — AUTH QUOTA SUPERSEDED BY 026A / NOT DEPLOYED |
| 026A | Giới hạn chi phí Meal Scan và mặc định mock ở development | P1 | S | 026 | IMPLEMENTED / LOCAL VERIFIED — CAP AMOUNT PENDING |
| 026B | Thu thập thành phần khai báo và đơn giản hóa kết quả Meal Scan | P1 | M | 026A | IMPLEMENTED / LOCAL VERIFIED |
| 026C | Tính thành phần khai báo vào tổng Meal Scan | P1 | M | 026B | RELEASE CANDIDATE VERIFIED — STAGING PENDING |

## Dependency Notes

- Plan 001 keeps pricing, entitlements, email grants and retention in one lifecycle because all flows create or consume `TrainerSubscription` records.
- Plan 002 depends on Plan 001 because it hardens the trainer catalog, checkout and deposit policies introduced or touched by that lifecycle.
- Plan 003 depends on Plans 001–002 because eligibility và trainer assignment phải ổn định trước khi tổng hợp lịch, coaching, workout, journal và progress vào một protected dashboard.
- Plan 004 depends on Plan 003H because homepage discovery chỉ được mở sau khi route, privacy và hardening của Today Dashboard đã hoàn tất local.
- Plan 005 depends on Plan 004 because lỗi được phát hiện trong full regression gate khi bàn giao homepage entry.
- Plan 006 depends on 003H và 004 vì nó tái cấu trúc presentation của Today đã harden và thay entry homepage hiện có bằng customer shell.
- Plan 007 depends on 003H–006 vì staging chỉ được deploy sau khi Dashboard, homepage entry và regression accessibility đã hoàn tất local.
- Plan 008 depends on 007 vì dữ liệu test phải được đồng bộ vào đúng runtime đã deploy để kiểm tra Customer Dashboard end-to-end.
- Plan 009 depends on 003F, 006 và 008 vì biểu đồ dùng read model tiến trình, product shell và snapshot local đã xác minh.
- Plan 012 depends on 009-011 vì workspace tái sử dụng progress presentation, module completion và wellness targets đã hoàn tất.
- Plan 015 depends on 012 và 014 vì nó tái sử dụng client workspace, ownership
  Order hiện có và contract Habit/Wellness đã ổn định.
- Plan 016 depends on 012 và 015 vì nó dùng Trainer workspace và health entry hiện có
  làm nền để tổ chức lại toàn bộ điều hướng nghiệp vụ.
- Plan 017 độc lập với product roadmap; chỉ harden instruction system và không chạm Doppler/environment.
- Plan 018 phụ thuộc 001–002 cho subscription/wallet contracts và 003H cho private cache hardening;
  wallet/account runtime chỉ được triển khai sau khi spec riêng được duyệt.
- Plan 019 độc lập với product roadmap; harden OAuth state, cookie-only token contract, dev-login và
  F1 ownership mà không đổi schema hoặc dữ liệu.
- Plan 020 phụ thuộc 019 để biến security findings và regression evidence thành threat model, coverage
  ledger, bounded Codex Security workflow và release gates trước khi promote staging/main.
- Plan 021 phụ thuộc 001–002 cho trainer lifecycle/commercial contract và 018 cho subscription snapshot;
  đồng thời sửa độc lập runtime viewport/theme của AI Chat mà không đổi schema hoặc dữ liệu thật.
- Plan 022 phụ thuộc 002 cho contract thương mại, 019 cho ownership/auth và 020 cho security evidence;
  thay chữ ký ảnh bằng OTP nhưng giữ tương thích documents/PDF lịch sử.
- Plan 023 thay thế Plan 022 trước khi deploy vì tài khoản cá nhân chưa đủ điều kiện SMS Brandname; khôi phục chữ ký tay hai bên nhưng giữ UI/PDF và security hardening hữu ích.
- Plan 024 phụ thuộc 017 cho agent/AI governance và 019 cho cookie-only auth; feature
  không lưu ảnh, không đổi schema và tách endpoint Meal Scan khỏi chat SSE.

- Plan 024A phụ thuộc 024 vì nó harden provider/result contract và review workflow hiện có;
  vẫn không lưu ảnh/kết quả hay coi benchmark synthetic là nutrition ground truth.
- Plan 025 phụ thuộc 024A vì nó mở rộng review local-only bằng provenance và packaged-food reference;
  không backfill dữ liệu thật, không gọi external source là canonical và không deploy.
- Plan 026 phụ thuộc 024–025 vì nó mở anonymous access trên endpoint Meal Scan đã harden, giữ review
  và barcode boundaries hiện có, đồng thời chỉ thay presentation của public page.
- Plan 026A phụ thuộc 026 vì nó đổi authenticated quota sang 10 lượt/24 giờ, giữ anonymous 2 lượt/24 giờ, tách dev mock khỏi production provider và không chạm wallet.
- Plan 026B phụ thuộc 026A vì nó thêm bước khai báo/khóa/xác nhận trước request nhưng giữ nguyên quota,
  privacy, mock-development và cost boundaries đã harden.
- Plan 026C phụ thuộc 026B vì nó biến dữ liệu khai báo đang chỉ hiển thị thành breakdown server-authoritative,
  cộng vào total/macro score và đánh dấu rõ mục không có nutrition source mà không đổi schema.

## Findings Considered and Rejected

- Refactor toàn bộ `Pricing.jsx`: rejected vì đây là known issue ngoài phạm vi; chỉ sửa khu vực trainer plans.
- Chạy migration hoặc retention cleanup trên dữ liệu thật: rejected trong implementation local; chỉ tạo migration/dry-run có cờ xác nhận.
- Viết lại Booking, OnlineCoaching hoặc WorkoutPlan cho Today Dashboard: rejected; Plan 003 bắt buộc compose/reuse các nguồn canonical hiện tại.
