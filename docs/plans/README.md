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
| 007 | Deploy Customer Dashboard lên staging và xác minh từ xa | P1 | S | 003H, 004, 005, 006 | READY TO DEPLOY — LOCAL GATES PASS |

## Dependency Notes

- Plan 001 keeps pricing, entitlements, email grants and retention in one lifecycle because all flows create or consume `TrainerSubscription` records.
- Plan 002 depends on Plan 001 because it hardens the trainer catalog, checkout and deposit policies introduced or touched by that lifecycle.
- Plan 003 depends on Plans 001–002 because eligibility và trainer assignment phải ổn định trước khi tổng hợp lịch, coaching, workout, journal và progress vào một protected dashboard.
- Plan 004 depends on Plan 003H because homepage discovery chỉ được mở sau khi route, privacy và hardening của Today Dashboard đã hoàn tất local.
- Plan 005 depends on Plan 004 because lỗi được phát hiện trong full regression gate khi bàn giao homepage entry.
- Plan 006 depends on 003H và 004 vì nó tái cấu trúc presentation của Today đã harden và thay entry homepage hiện có bằng customer shell.
- Plan 007 depends on 003H–006 vì staging chỉ được deploy sau khi Dashboard, homepage entry và regression accessibility đã hoàn tất local.

## Findings Considered and Rejected

- Refactor toàn bộ `Pricing.jsx`: rejected vì đây là known issue ngoài phạm vi; chỉ sửa khu vực trainer plans.
- Chạy migration hoặc retention cleanup trên dữ liệu thật: rejected trong implementation local; chỉ tạo migration/dry-run có cờ xác nhận.
- Viết lại Booking, OnlineCoaching hoặc WorkoutPlan cho Today Dashboard: rejected; Plan 003 bắt buộc compose/reuse các nguồn canonical hiện tại.
