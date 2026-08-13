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
| 027 | Hoàn thiện hành trình public ưu tiên giá trị | P1 | M | 003C, 004, 018 | IMPLEMENTED / LOCAL VERIFIED — LIVE FOOD PREVIEW + PRERENDER PENDING |
| 028 | Xây dựng SEO & Conversion Analytics an toàn | P1 | XL | 019, 020, 027 | IN PROGRESS — 028A–028C LOCAL VERIFIED |
| 028A | Instrument public SEO/conversion measurement | P1 | M | 028 | DONE / LOCAL VERIFIED — LIVE GA4 PENDING |
| 028B | Build Admin SEO analytics read model | P1 | L | 028A | DONE / NODE 22 LOCAL VERIFIED — LIVE GOOGLE + STRICT PRERENDER PENDING |
| 028C | Link explicit business conversions | P1 | L | 028B | DONE / NODE 22 LOCAL VERIFIED — STAGING INDEX APPLY + STRICT PRERENDER PENDING |
| 028D | Pilot OpenSEO read-only MCP | P1 | M | 028B | TASKS APPROVED — OPS APPROVALS REQUIRED |
| 029 | Quản lý ảnh Homepage theo stable key | P1 | M | 027, 028A | COMPLETE |
| 030 | Modernize agent workflows with composable, enforced skills | P1 | L | 017 | COMPLETE / VERIFIED |
| 031 | Mở HT Assistant theo ngữ cảnh toàn website cho guest | P1 | L | 019, 020, 021, 026A, 027 | IMPLEMENTED / LOCAL VERIFIED — FULL SERVER + PRERENDER ENV BLOCKED |
| 032 | Mở quản trị riêng theo từng huấn luyện viên | P1 | L | 016, 019, 023, 031 | COMPLETE / LOCAL VERIFIED |
| 033 | Chuẩn hóa quyền truy cập và hạn mức dịch vụ | P1 | L | 026A, 027, 030, 031, 032 | COMPLETE / FOCUSED VERIFIED — FULL SERVER + PRERENDER ENV BLOCKED |
| 034 | Đồng bộ quyền lợi gói HLV và mở soạn thảo bảng trong Blog | P1 | M | 033 | DONE / LOCAL VERIFIED |
| 035 | Xây dựng Upstream Skill Radar và trang Admin Radar công nghệ | P1 | L | 017, 030 | IMPLEMENTED / LOCAL VERIFIED — AUTHENTICATED VISUAL PENDING |
| 036 | Thích nghi các finding từ baseline Upstream Skill Radar | P1 | L | 030, 035 | IMPLEMENTED / LOCAL VERIFIED — PRERENDER ENV BLOCKED |
| 037 | Bật provider đã phê duyệt và hoàn tất production indexes | P1 | M | 025, 028C, 033 | IN PROGRESS |
| 038 | Ổn định HT Assistant, lưu thực đơn, HLV mặc định và SEO | P0 | L | 003C, 024A, 026C, 031, 033 | RELEASE CANDIDATE VERIFIED — STAGING PENDING |
| 039 | Theo dõi vòng đời cải tiến và xuất báo cáo PDF | P1 | M | 033, 038 | RELEASE CANDIDATE VERIFIED — STAGING PENDING |
| 040 | Tách analytics production, lọc đối tượng và cá nhân hóa Meal Plan an toàn | P0/P1 | XL | 028A–028C, 033, 038, 039 | IMPLEMENTED / LOCAL VERIFIED — PRODUCTION DATA ROLLOUT PENDING |
| 041 | Tinh gọn danh mục Food production cho Meal Plan eat-clean | P0 | M | 040 | PRODUCTION CURATED / API VERIFIED |
| 042 | Hoàn thiện dị ứng, Food DB và giá ước tính trong Meal Plan | P0/P1 | L | 040, 041 | IN PROGRESS |
| 043 | Đồng bộ catalog test công khai vào local và staging | P1 | M | 041, 042 | COMPLETE / LOCAL + STAGING VERIFIED |
| 044 | Việt hóa quản trị Food và nạp giá thị trường vào local | P1 | L | 042, 043 | COMPLETE / LOCAL VERIFIED — FULL SERVER QA TIMEOUT |
| 045 | Đơn giản hóa giá Meal Plan và theo dõi phụ thuộc hệ thống | P1 | M | 033, 042, 044 | IMPLEMENTED / PARTIAL LOCAL VERIFIED — VITEST + BUILD ENV BLOCKED |
| 046 | Ổn định nền tảng, AI Memory có kiểm soát và motion discipline | P0/P1 | XL | 017, 020, 030, 031, 035, 038, 040 | LOCAL VERIFIED — PRODUCTION READINESS BLOCKED |
| 047 | Triển khai TDEE có độ tin cậy, độ phức tạp bài tập và Tiến trình cơ thể | P1 | L | 003F, 006, 016, 031, 046 | COMPLETED |
| 048 | Thêm nguồn Radar động và làm rõ phục hồi GitHub rate limit | P1 | L | 035, 036 | COMPLETE / LOCAL VERIFIED — AUTH VISUAL + PRODUCTION GITHUB PENDING |

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
- Plan 027 phụ thuộc 003C cho lưu Meal Plan, 004 cho homepage entry và 018 cho auth/server-state;
  thay presentation và anonymous client preview nhưng không đổi backend entitlement hoặc commercial contract.
- Plan 028 phụ thuộc 019–020 cho auth/security boundary và 027 cho public CTA journey; bổ sung đo lường,
  read model, admin dashboard rồi mới mở OpenSEO/MCP, không lưu raw IP hoặc làm public runtime phụ thuộc provider.
- Plan 028A–028D là các release gate của Plan 028: measurement → read model/dashboard → explicit conversion;
  OpenSEO chỉ pilot sau khi dashboard cache-first đã ổn định và vẫn tách khỏi core runtime.
- Plan 030 phụ thuộc 017 vì mở rộng agent governance đã harden bằng router, invocation metadata,
  domain memory, review và handoff có validator enforcement; không chạm product runtime.
- Plan 031 phụ thuộc auth/security/chat/public-journey đã harden để mở guest trong quota, giữ CSRF/ownership
  và đưa page context canonical vào cùng contract mà không làm public runtime đọc raw DOM.
- Plan 032 phụ thuộc workspace/auth/contract đã harden để mở Order, Contract và Check-in cho trainer theo
  owner filter backend; đồng thời giữ delete Order/Contract là quyền admin.
- Plan 033 phụ thuộc các quota, public preview, agent workflow và entitlement đã có để gom policy vào registry
  canonical, enforce theo tier và hiển thị cùng contract trong Admin mà không cần migration.
- Plan 034 phụ thuộc 033 để mở rộng cùng trang Admin bằng catalog quyền lợi HLV canonical, đồng thời bổ sung
  Tiptap TableKit độc lập với service quota và không mở mutation hoặc schema mới.
- Plan 035 phụ thuộc 017 và 030 vì mở rộng agent governance/validator hiện có bằng external upstream drift;
  dashboard chỉ đọc snapshot đã duyệt và không cho upstream tự sửa policy hoặc skill canonical.
- Plan 036 phụ thuộc 030 và 035 vì dùng workflow/validator hiện có cùng provenance Radar để thích nghi 13 finding có
  evidence; plan sửa đúng semantics baseline trước rồi mới thay local skill và không tự sửa canonical rules.
- Plan 037 phụ thuộc 025, 028C và 033 vì tái sử dụng packaged lookup, SEO/conversion index contracts và quota registry
  đã được xác minh; rollout giữ fail-closed cho provider trước khi áp production config/data operations.
- Plan 038 phụ thuộc Saved Meal Plan, Meal Scan, sitewide assistant và service-access policy hiện có để sửa đúng
  lifecycle SSE/access contract; plan không đổi quota, không persist Meal Scan và không thực hiện production write.
- Plan 039 phụ thuộc catalog Admin của 033 và các record cải tiến được thêm trong 038; plan tách current/history,
  sinh JSON/PDF read-only và không thêm schema hoặc mutation.
- Plan 040 phụ thuộc measurement/read model của 028A–028C, quota/catalog của 033, Saved Meal Plan hardening của 038
  và report lifecycle của 039; plan tách GA4 production, thêm bộ lọc đối tượng và Meal Plan constraints có nguồn.
- Plan 043 phụ thuộc catalog Food đã tinh gọn và contract Meal Plan/Food hiện tại; production chỉ là nguồn GET,
  còn mọi mutation bị khóa vào database local hoặc staging cô lập.
- Plan 044 phụ thuộc price contract và catalog test đã có; chỉ nạp observation có nguồn vào local, không thay macro
  hoặc mở rộng sang staging/production.
- Plan 047 phụ thuộc Progress Hub, Customer Dashboard, trainer workspace và HT Assistant đã có; plan chuẩn hóa
  estimate TDEE, thêm rubric Exercise optional và mở rộng read model cân nặng/vòng eo mà không backfill dữ liệu thật.
- Plan 048 phụ thuộc Radar nền và rate-limit semantics của 035–036; thêm nguồn GitHub động qua Admin/MongoDB nhưng giữ
  baseline Git-owned, không auto-install và không migration/backfill.

## Findings Considered and Rejected

- Refactor toàn bộ `Pricing.jsx`: rejected vì đây là known issue ngoài phạm vi; chỉ sửa khu vực trainer plans.
- Chạy migration hoặc retention cleanup trên dữ liệu thật: rejected trong implementation local; chỉ tạo migration/dry-run có cờ xác nhận.
- Viết lại Booking, OnlineCoaching hoặc WorkoutPlan cho Today Dashboard: rejected; Plan 003 bắt buộc compose/reuse các nguồn canonical hiện tại.
