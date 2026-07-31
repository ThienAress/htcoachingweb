# Plan 003D: Gắn meal plan và ghi bữa ăn nhanh theo ngày

> Release D hoàn thành Task 3.2–3.3 của master Plan 003. Release này mở rộng `DailyJournal`
> theo hướng additive; không tạo collection mới, không upload ảnh và không tự suy luận macro cho
> mô tả thủ công.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH — nutrition history, optimistic concurrency, IDOR và snapshot integrity
- **Depends on**: 003C implemented/verified
- **Planned at**: 2026-07-29
- **Status**: IMPLEMENTED / VERIFIED

## Quyết định schema và compatibility

1. Thêm embedded `nutrition` vào `DailyJournal`; document cũ đọc như assignment rỗng và entries rỗng.
2. Không cần backfill hay index mới. Existing `{ clientId, dateKey }` index vẫn là access path chính.
3. `nutrition.assignment` chỉ lưu exact `SavedMealPlan` document/version cùng title snapshot; không copy
   toàn bộ foods/macros. API đọc exact plan để render meals.
4. `nutrition.entries` là bounded array tối đa 10 phần tử/ngày và được thay nguyên mảng bằng optimistic
   `expectedRevision`; stale write trả `409`.
5. Mỗi entry có `entryId` UUID, mode `follow_plan | recipe | manual`, status
   `eaten | changed | skipped`, label snapshot, note ngắn và server timestamp.
6. `follow_plan` phải tham chiếu meal key trong exact assigned plan. `recipe` chỉ nhận published Recipe
   canonical rồi snapshot name/slug. `manual` chỉ lưu description và không nhận macro/calorie claim.
7. Assignment và entries tham gia `DailyJournalRevision`; history submitted chỉ sửa qua correction có lý do.
8. Privacy/export/delete/retention hiện có của Daily Journal tự bao phủ embedded nutrition; user deletion
   inventory không cần collection mới.

## API contract

Tái sử dụng `PUT /api/daily-journals/:dateKey` và correction endpoint hiện có:

```json
{
  "expectedRevision": 2,
  "requestId": "uuid-v4",
  "patch": {
    "nutrition": {
      "assignment": { "savedMealPlanId": "object-id" },
      "entries": [
        {
          "entryId": "uuid-v4",
          "mode": "follow_plan",
          "plannedMealKey": "meal-1",
          "status": "eaten",
          "note": ""
        }
      ]
    }
  }
}
```

- Có thể gửi riêng `assignment` hoặc `entries`; field không gửi không bị reset.
- Gỡ assignment bằng `assignment: null`; entries lịch sử vẫn giữ snapshot.
- Mỗi dateKey dùng một command riêng nên có thể gắn cùng plan cho nhiều ngày mà vẫn giữ revision/idempotency
  độc lập và báo lỗi chính xác theo ngày.
- Response tiếp tục là Daily Journal DTO private/no-store.

## Tasks

- [x] Viết tests RED cho assignment exact version, IDOR, archive/revise immutability và stale revision.
- [x] Viết tests RED cho follow-plan, published recipe, manual log, max 10 entries và submitted correction.
- [x] Mở rộng `DailyJournal`, `DailyJournalRevision`, DTO, patch normalization và canonical nutrition service.
- [x] Mở rộng express-validator parity, timeline labels và Today Dashboard contract/backward compatibility.
- [x] Thêm client adapter/tests cho nutrition entries và service đọc exact Saved Meal Plan.
- [x] Thêm Nutrition Card mobile-first: assign/unassign, planned meal status, recipe/manual quick log.
- [x] Kiểm tra privacy export/delete/retention hiện có bao phủ nutrition và không tạo public/SEO surface.
- [x] Chạy impact re-trace, UI check, targeted/full QA/build/security gates.

## Done criteria

- [x] Assigned plan giữ exact version dù template bị revise/archive.
- [x] Plan/meal/recipe ID không thuộc scope hoặc không canonical bị reject ở backend.
- [x] Manual entry không hiển thị macro chính xác; không lưu client-supplied totals.
- [x] Tối đa 10 entries/ngày, duplicate entryId và payload quá dài bị reject.
- [x] Retry cùng requestId không ghi revision trùng; stale expectedRevision trả 409.
- [x] Submitted nutrition chỉ sửa qua correction có reason và có revision history.
- [x] UI có loading/empty/error/retry/disabled, keyboard focus và touch target tối thiểu 44px.
- [x] Không chạy migration, backfill, deploy, retention enforcement hoặc production write.

## Verification evidence — 2026-07-29

- Targeted backend: 4 files, 28 tests pass.
- Full client: 21 files, 140 tests pass.
- Full server: 55 files, 263 tests pass.
- Client ESLint pass.
- Production build, static prerender 8/8 và bundle budget pass; Today Dashboard 41.6KB raw/10.7KB gzip.
- Secret scan, repository data boundaries, commercial contracts và `git diff --check` pass.
- UI check pass sau khi bổ sung recipe-search empty state; không có finding HIGH/MED.
- Schema additive, không có index mới nên không cần migration/backfill.
- E2E browser chưa chạy vì không có signed-in dev session/dev servers trong gate local.

## STOP conditions

- Cần copy toàn bộ meal plan vào journal thay vì exact version reference.
- Cần tin macro/calorie client hoặc suy luận dinh dưỡng từ manual description.
- Cần public/private meal photo trước khi private-media lifecycle hoàn chỉnh.
- Cần nới ownership, edit window, CSRF hoặc optimistic concurrency hiện có.
