# Plan 060: Tinh gọn nhật ký coaching, nutrition thủ công và wellness theo ngày

## Status

- **Priority**: P1
- **Effort**: XL
- **Risk**: HIGH — health journal lifecycle, Recipe schema và progress contract
- **Depends on**: 003F, 011, 016, 059
- **Status**: IMPLEMENTED / LOCAL VERIFIED — FULL SERVER RUNNER + PRERENDER ENV BLOCKED

## Scope

- Lịch sử check-in chọn 5/10/15 dòng và lưu preference cục bộ của HLV.
- Wellness form chỉ gửi một lần, khóa sau submit và cho đúng một correction.
- Giải thích thang điểm, timeline nêu tên field và bỏ hai daily-journal comment thread.
- Recipe nutrition do admin nhập tổng toàn công thức, gồm sáu field lõi và nutrient mở rộng.
- Progress wellness tách actual từng ngày khỏi tổng quan 7/30/90 ngày cho customer và trainer.

## Steps and verification

1. Thêm test contract/schema cho correction count, submit-with-patch, manual nutrition và wellness daily.
2. Implement backend theo transaction/ownership/validation hiện có; document cũ giữ tương thích.
3. Implement UI check-in preference, journal locked state, nutrition editor/panel và day/overview switch.
4. Chạy focused unit/integration, client lint/build, UI regression gate và manual responsive review.

## Stop conditions

- Không chạy migration, seed hoặc ghi dữ liệu local/staging/production.
- Không fallback sang nutrition tự tính khi admin chưa nhập.
- Không nới auth, CSRF, edit window hoặc trainer ownership.

## Verification evidence

- Client full unit: 104 files / 482 tests pass.
- Server focused integration/unit: 20/20 pass; final changed slices after cleanup: 15/15 pass.
- Client lint: pass. Vite compile: pass (2.887 modules).
- UI regression: 0 new findings; agent validation, secret scan và data-boundary: pass.
- Full server command exited code 1 after ~2.5 minutes without test failure/stack/summary.
- Postbuild prerender blocked by sandbox network and missing `VITE_API_URL`; compile completed before blocker.
