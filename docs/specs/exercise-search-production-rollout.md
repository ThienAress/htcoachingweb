# Exercise Library Search production rollout

## Objective

Nâng chất lượng tìm kiếm tại Public Exercise Library `/exercises` mà không làm
thay đổi Search của Workout Planner, Admin, HLV, HT Assistant hoặc API dùng chung.
Rollout phải tìm trên toàn catalog, giữ filter hiện tại, ưu tiên precision và có
feature flag để rollback độc lập.

## Assumptions

1. Chỉ Public Exercise Library dùng Search V2 trong scope này.
2. Staging là target đầu tiên; production chỉ được xét sau exact-SHA staging
   acceptance và khi Netlify không còn chặn release.
3. Không thêm dependency, không đổi schema và không ghi dữ liệu.
4. Legacy substring Search được giữ ít nhất một release làm fallback.
5. Full-catalog retrieval và Search ranking có hai feature flag độc lập để rollback.

## Current Evidence

- `client/src/hooks/useExercisesLogic.js` chỉ tải `getExercises(1, 500)`.
- API giới hạn mỗi page tối đa 500 bản ghi, trong khi snapshot catalog production
  có 1.374 bài; Search local hiện không nhìn thấy toàn bộ catalog.
- Offline pilot dùng 11 bài và 12 query, chưa có Precision@5/MAP hoặc forbidden-result
  judgments.
- Probe read-only trên snapshot catalog phát hiện false positive đáng kể do fuzzy
  một edit và normalization `đ → d`, gồm collision `lưng/lunge` và `đẩy/dây`.
- UI tính Search đồng bộ theo mỗi lần gõ; candidate trên 1.374 bài cần pre-index và
  browser performance evidence trước khi bật production.

## Tech Stack

- React 19, Vite 8, TanStack Query 5.
- Pure JavaScript Search helper; không thêm package fuzzy-search.
- Node `22.23.1` cho focused tests và quality benchmark.
- Vitest/client unit, Node test cho benchmark và Playwright cho interaction E2E.

## Affected Surfaces

### Search algorithm

- `client/src/pages/ExercisesPage/exerciseLibraryFilters.js`
- `client/src/pages/ExercisesPage/ExerciseLibrary.jsx`
- New `client/src/pages/ExercisesPage/__tests__/exerciseLibraryFilters.test.js`

### Catalog completeness

- `client/src/services/exercise.service.js`
- `client/src/services/__tests__/exercise.service.test.js`
- `client/src/hooks/useExercisesLogic.js`

### Feature flags

- `client/src/config/featureFlags.js`
- `client/src/config/__tests__/featureFlags.test.js`
- `client/.env.example`
- `netlify.toml` only if existing deploy-context convention requires it.

### Quality evidence

- `scripts/search-quality/fixture.mjs`
- `scripts/search-quality/metrics.mjs`
- `scripts/search-quality/benchmark.mjs`
- `scripts/search-quality/benchmark.test.mjs`
- `scripts/search-quality/pilot.mjs`
- `scripts/search-quality/pilot.test.mjs`
- `e2e/mock-api.cjs`
- `e2e/exercises-library.spec.js`

## Required Behavior

1. Empty hoặc whitespace query giữ source order hiện tại.
2. Filter muscle group và difficulty chạy trước ranking; `unrated` tiếp tục nhận
   `null`/`undefined` như hiện tại.
3. Ranking ưu tiên theo thứ tự:
   - exact phrase trong `name`;
   - exact/prefix token trong `name`;
   - exact token trong `muscleGroup`;
   - exact token trong `description`;
   - fuzzy chỉ là fallback khi strict stage không có kết quả.
4. Fuzzy chỉ áp dụng cho token tối thiểu 5 ký tự với threshold chặt; `lưng` không
   được khớp `lunge` và `đẩy` không được khớp bừa `dây`.
5. Synonym là alias phrase có kiểm soát, ví dụ `hít đất → chống đẩy`; không bung
   thành các token phổ biến độc lập.
6. Token có thể phân bố qua nhiều field, nhưng exact match trong cùng field được boost.
7. Query tối đa 120 ký tự, bounded token count và không log raw query.
8. Normalized index được tạo lại chỉ khi catalog hoặc language đổi; mỗi lần gõ không
   tokenize lại toàn bộ catalog.
9. Tie-break deterministic theo source order.
10. `vi` và `en` được kiểm thử trên chính dữ liệu sau translation.
11. Catalog loader đọc tuần tự các page `limit=500`, validate pagination, dedupe `_id`
    và có page/record bound. Nếu payload hoặc latency vượt ngân sách được duyệt thì
    STOP và thiết kế endpoint Search riêng thay vì nới endpoint dùng chung.
12. Search V2 và full-catalog loading mặc định fail closed về legacy cho tới khi
    staging acceptance pass.

## Quality Gates

Corpus mở rộng phải gồm:

- Vietnamese có/không dấu, `đ`, English locale và progressive prefix typing.
- Cross-field query, punctuation, whitespace, short query và boundary 120 ký tự.
- Collision `lưng/lunge`, `đẩy/dây`, expected no-result `bay trên không`.
- Exact muscle/difficulty/unrated/no-hit combinations.
- Explicit relevant IDs và forbidden top-result IDs.

Candidate chỉ pass khi đồng thời đạt:

- Recall@5 và MRR không thấp hơn target P2 hiện có.
- Precision@5 hoặc MAP@5 đạt target được khóa trong implementation plan.
- Expected no-result accuracy bằng 1 trên adversarial corpus.
- Không có forbidden result trong top five.
- Browser interaction không có input jank đáng kể trên mobile viewport test.

## Testing Strategy

1. TDD failing tests cho strict ranking, collision và fallback behavior.
2. TDD failing service test cho pagination/dedupe/bounds.
3. Unit test feature flags fail closed.
4. E2E gõ thật, filter, clear, empty state, `aria-live`, keyboard và mobile.
5. Node `22.23.1`: client unit, Search benchmark/pilot, lint và client release build.
6. UI regression gate và manual `vi/en` responsiveness review.
7. Independent code review trước `$ship staging`.

## Boundaries

### Always

- Giữ API response/error contract hiện có.
- Không đổi server Search semantics, Planner modal Search, Admin/HLV Search hoặc
  HT Assistant Search.
- Không log raw query hoặc catalog payload.
- Tách worktree/branch khỏi shared dirty working tree trước Git write.

### Ask first

- Thêm endpoint Search riêng hoặc MongoDB index/schema.
- Thay đổi Netlify environment flags.
- Push branch, tạo PR hoặc deploy staging/production.

### Never

- Copy nguyên pilot hiện tại vào production.
- Dùng production database cho test ghi dữ liệu.
- Bypass exact-SHA promotion, live staging cleanup hoặc QA release evidence.
- Stage-all/commit-all từ shared working tree.

## Rollout And Rollback

1. Hai flags mặc định legacy/off.
2. Bật full-catalog loader và Search V2 trên preview/staging exact SHA.
3. Chạy live read-only UX acceptance; không cần production data mutation.
4. Chỉ bật production sau `$ship production` và promotion evidence pass.
5. Rollback Search: tắt Search V2, rebuild và redeploy.
6. Rollback tải catalog: tắt flag riêng; không có migration hoặc data rollback.

## Success Criteria

- Full catalog được tải hoặc Search server riêng được duyệt; không còn giới hạn 500
  bị trình bày như Search toàn catalog.
- Quality gates gồm cả recall và precision pass trên corpus mở rộng.
- Existing filters, empty state, result count, load-more và accessibility không regress.
- Search V2 chỉ ảnh hưởng Public Exercise Library.
- Node 22 client QA, build, E2E, UI gate và independent review pass.
- Staging exact-SHA acceptance pass trước production; rollback flags được chứng minh.

## Open Questions For Approval

1. Duyệt phương án hai feature flags và staging-first hay muốn direct rollout?
2. Cho phép client tải tối đa ba page hiện tại để bao phủ 1.374 bài, với bounded
   page/record validation, hay yêu cầu thiết kế server Search riêng ngay từ đầu?
3. Có cho phép Git `fetch/worktree/branch/commit` trong worktree cô lập sau khi spec
   được duyệt không? Push/PR/deploy vẫn là bước xin phép riêng.
