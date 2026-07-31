# Plan 014: Chuẩn hóa thói quen hằng ngày và báo cáo tuần theo tháng

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — thay đổi canonical week key nhưng không đổi schema
- **Depends on**: 013
- **Category**: feature
- **Planned at**: 2026-07-31
- **Status**: DONE / LOCAL VERIFIED

## Why This Matters

Habit do HLV giao đang dùng form chọn ngày dù mặc định đủ bảy ngày, khiến người dùng
hiểu nhầm là chỉ áp dụng cho ngày đang xem. Weekly Check-in dùng tuần Thứ Hai–Chủ Nhật
đi xuyên tháng nên không khớp cách học viên theo dõi từng tuần trong một tháng.

## Current State

- `CreateHabitForm.jsx` hiển thị bảy nút ngày cho cả trainer và client.
- `habitFormToPayload` lấy `startDateKey` từ ngày workspace và cho phép subset ngày.
- `weeklyCheckinAccess.service.js` bắt `weekStartDateKey` phải là Thứ Hai.
- `TodayJournal.jsx` tính Monday week start từ ngày đang xem.
- `WeeklyCheckinFields.jsx` chỉ hiển thị số Bám kế hoạch 1–10, không có diễn giải.

## Contract

- Trainer/admin Habit là daily: đủ 7 ngày, bắt đầu ngày tạo, không có `endDateKey`.
- Assigned Habit chỉ hiển thị khi client còn Order approved với `sessions > 0`; self Habit vẫn giữ.
- Tuần trong tháng: đoạn đầu từ ngày 1 đến Chủ Nhật, đoạn giữa Thứ Hai–Chủ Nhật,
  đoạn cuối kết thúc ngày cuối tháng. Ví dụ 07/2026: 1–5, 6–12, 13–19, 20–26, 27–31.
- `weekStartDateKey` tiếp tục là key lưu trữ, nhưng mang nghĩa period start trong tháng.
- Bám kế hoạch giữ số 1–10 để tương thích, thêm nhãn: 1–3 Cần hỗ trợ thêm;
  4–6 Chưa ổn định; 7–8 Bám khá tốt; 9–10 Bám rất tốt.

## Scope

- Client/server date utilities và tests.
- Weekly edit window, trainer overview/attention consumers.
- Weekly Check-in month selector, range label và adherence label.
- Trainer Habit form, server normalization và active Order read filter.
- Spec, plan và focused regression.

## Out of Scope

- Schema migration/backfill hoặc rewrite WeeklyCheckin cũ.
- Hard-delete Habit khi Order hết buổi.
- Thay quyền, CSRF, retention hoặc notification contract.
- Xử lý Windows Defender trước khi ba product changes hoàn tất.

## Steps

1. Viết RED tests cho July 2026 periods, edit window, daily Habit và adherence labels.
2. Thêm monthly period utilities client/server và chuyển mọi current/previous consumer.
3. Force trainer Habit daily; lọc assigned Habit khi Order không còn buổi.
4. Thêm week tabs/range label và adherence interpretation trong Product UI.
5. Chạy focused/full related tests, ESLint, Vite build và diff check.

## Done Criteria

- [x] Trainer không còn chọn từng ngày khi giao Habit; payload/server luôn đủ bảy ngày.
- [x] Assigned Habit không còn áp dụng khi Order hết buổi; self Habit không bị mất.
- [x] July 2026 hiện đúng năm period 1–5, 6–12, 13–19, 20–26, 27–31.
- [x] Mỗi period có draft/submission riêng theo existing unique key.
- [x] Bám kế hoạch có nhãn coaching-friendly và vẫn lưu số 1–10.
- [x] Related tests, lint, Vite build và diff check pass.

## STOP Conditions

- Cần migration/backfill dữ liệu thật hoặc rewrite WeeklyCheckin cũ.
- Hai period sinh cùng `weekStartDateKey` cho một client.
- Cần nới ownership/write window/CSRF để feature hoạt động.

## Maintenance Notes

- Monday-only code mới là regression; dùng monthly week period utility canonical.
- Dữ liệu Monday cũ vẫn đọc được theo key cũ nhưng không tự gộp vào period mới.
## Verification — 2026-07-31

- Server Weekly/overview/notification/privacy regression: 7 files, 25 tests passed.
- Server Coaching Habit integration: 1 file, 8 tests passed.
- Server date utility, including month boundary: 1 file, 5 tests passed.
- Client Habit/Weekly form regression: 2 files, 12 tests passed.
- Client Progress chart regression: included in focused run; 10 tests across 2 files passed.
- Full client ESLint: passed.
- Vite production bundle: passed, 2,781 modules transformed.
- git diff --check: passed.
- Browser visual QA was not available: Browser policy blocked localhost and the standalone
  server lacked Doppler-provided Google OAuth/Resend environment variables. No secret or
  runtime configuration was weakened to bypass this limitation.