# Implementation Plans — HTCoachingWeb

Generated on 2026-07-28. Execute plans in dependency order and pass every verification gate before moving on.

## Execution Order & Status

| Plan | Title | Priority | Effort | Depends on | Status |
|---|---|---:|---:|---|---|
| 001 | Hoàn thiện vòng đời gói HLV và bảo vệ AI output | P1 | L | — | IMPLEMENTED / VERIFIED |
| 002 | Loại bỏ drift giá và hợp đồng thương mại giữa FE/BE | P1 | L | 001 | DEPLOYED / VERIFIED ON STAGING |

## Dependency Notes

- Plan 001 keeps pricing, entitlements, email grants and retention in one lifecycle because all flows create or consume `TrainerSubscription` records.
- Plan 002 depends on Plan 001 because it hardens the trainer catalog, checkout and deposit policies introduced or touched by that lifecycle.

## Findings Considered and Rejected

- Refactor toàn bộ `Pricing.jsx`: rejected vì đây là known issue ngoài phạm vi; chỉ sửa khu vực trainer plans.
- Chạy migration hoặc retention cleanup trên dữ liệu thật: rejected trong implementation local; chỉ tạo migration/dry-run có cờ xác nhận.
