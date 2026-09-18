# Plan 092: Khôi phục HT Assistant ổn định trước khi mở rộng tiếp

> **Hướng dẫn thực thi**: Ưu tiên phục hồi hành vi đã tốt ở release trước
> `37c7828`, nhưng không revert mù toàn bộ file và không bỏ các guard bảo mật,
> privacy, quota hoặc ownership đã thêm. Mỗi step phải có test RED từ prompt production
> thực tế rồi mới patch. Chỉ deploy production sau hai lượt staging live liên tiếp đạt gate.
>
> **Drift check (chạy đầu tiên)**: Production incident được quan sát trên release
> `89ac30fc31aa49628b89b308ae4b53ad9c4c8c55`. Nếu các file AI in-scope đã đổi
> so với release đó, phải re-run sáu prompt incident và cập nhật expected contract trước
> khi sửa. Không chạm năm file sitemap/generated user-owned.

## Status

- **Priority**: P0
- **Complexity**: COMPLEX
- **Effort**: L
- **Risk**: HIGH — production chat, provider reliability và conversation continuity
- **Depends on**: 090, 090A
- **Category**: bug | reliability | tests | operations
- **Planned at**: 2026-09-16
- **Lifecycle**: IN PROGRESS
- **Verification**: STEP 6 LOCAL GREEN; STEP 7 LIVE STAGING PENDING
- **Rollout**: STAGING OBSERVED; PRODUCTION NOT STARTED
- **Owner**: root
- **Updated at**: 2026-09-18

## Why This Matters

Release hiện tại có nhiều guard/evidence hơn nhưng làm giảm độ hữu ích và độ ổn định:
Gemini `503 UNAVAILABLE` không được retry, KB/tool miss biến câu hỏi fitness rủi ro thấp
thành lời từ chối, router nhận nhầm prompt tiếng Việt và output chỉ có `}` vẫn được lưu.
Mục tiêu là đưa trải nghiệm tối thiểu trở lại mức release ổn định trước, sau đó giữ lại
những cải tiến mới chỉ khi chúng chứng minh không làm tăng tỷ lệ lỗi hoặc từ chối sai.

## Current State

- `server/src/services/ai/providers/gemini.provider.js:271-355` chỉ retry HTTP `400`;
  `429`, `503` và các `5xx` bị ném lỗi ngay. Production ghi nhiều `503 UNAVAILABLE`,
  không phải quota `429`.
- `server/src/controllers/ai.controller.js:666-678` thay câu trả lời bằng fallback nếu
  evidence bắt buộc thiếu; `814-838` đổi fitness KB miss rủi ro thấp thành
  `web_required`.
- `server/src/services/ai/requestRouter.js:65-80,273-292` có false positive:
  “Hãy tạo lịch tập tăng cơ 4 ngày mỗi tuần...” bị gắn `public_person_claim`.
- `server/src/services/ai/tools/searchExercises.tool.js:15-25` regex trực tiếp field DB;
  chưa chuẩn hóa alias tiếng Việt, equipment hoặc beginner intent.
- `server/src/services/ai/assistantOutput.js:114-133` cho `{` và `}` đơn lẻ đi qua như
  content hợp lệ.
- `client/src/hooks/useAiChat.js:780-914` fork conversation khi retry message đã lưu;
  malformed answer bị coi là completed nên Retry có thể tạo conversation mới.
- Production còn ghi `POST /api/ai/chat` `404` ở `chatPreflight` và một lần load
  conversation `401`, nên stale conversation/auth recovery cần contract rõ.
- Các test hiện tại xác nhận typed error cho Gemini `503`, chặn pseudo action hoàn chỉnh
  và retry/fork happy path, nhưng chưa yêu cầu phục hồi `503`, chặn orphan brace hoặc
  xử lý `401/404` trong chính chuỗi retry.
- Google quota không giảm là phù hợp với request bị chặn trước provider hoặc request
  `503` không sinh token; dashboard provider không được dùng làm bằng chứng duy nhất rằng
  application có/không gọi model.
- Live staging round 1 trên merge `586e8b39` (chứa nguyên candidate
  `ed839923`) chỉ có 5 câu PASS, 5 câu FAIL và 1 câu FAIL nhẹ. Câu 5
  được regrade thành PASS: hỏi dữ liệu cơ bản trước khi cá nhân hóa là hành vi
  đúng, không phải lỗi chất lượng.
- Ba câu dinh dưỡng lặp lại cùng một vi phạm: model công bố kcal/macro
  không khớp với chính danh sách món. Bữa sáng công bố `480–500 kcal`
  nhưng `47P/30C/5F` chỉ tương đương khoảng `353 kcal`; thực đơn
  `2.500 kcal` có tổng item `171P/185C/102F ≈ 2.342 kcal`; follow-up
  `2.200 kcal` có tổng item `167P/143C/93F ≈ 2.077 kcal` và không đủ
  `170g protein`.
- `suggestMeal.tool.js` hiện chỉ chia macro theo bữa, clamp/round khối lượng và
  xáo trộn `Math.random()`; tool không cộng lại kcal/macro, không xác minh
  sai số, không nhận dị ứng/không dung nạp/ngân sách và không trả structured
  totals. Hiện cũng không có focused test cho tool này.
- Router cung cấp đúng `suggest_meal`, `search_exercises` hoặc `search_knowledge`,
  nhưng provider vẫn ở function-calling `AUTO`; controller chấp nhận text cuối cùng
  ngay cả khi preferred tool chưa được gọi. Prompt `LUÔN gọi tool` vì vậy
  không phải runtime invariant.
- Câu Ronaldo được router test xác nhận đúng là `web_required` và
  `preferredTool=search_knowledge`. Lời fallback hiện tại có thể xuất hiện cả khi
  model không gọi tool lẫn khi Google Search trả về không có
  `groundingSupports`; UI không đủ evidence để phân biệt hai nhánh.
- Câu tìm năm bài ngực trả generic provider error. Chuỗi text này bao phủ
  `5xx`, network, empty stream và timeout, nên chưa được gọi đích danh là
  quota/model limit khi không có app-side outcome trace.
- Câu giáo án tại nhà vi phạm ràng buộc nhẹ: dù user chỉ có tạ đơn và
  dây kháng lực, output chọn hai bài press cần ghế mà không nêu phương án
  sàn/thay thế.
- Manual staging round 2 ngày 2026-09-18 cho thấy transport/retry đã tốt hơn,
  nhưng semantic/card gate vẫn RED: workout creation bị gộp vào
  `search_exercises`, card danh sách phẳng chỉ hiện một bài; staging chỉ có 31
  Exercise (3 bài ngực) so với production 1.374 Exercise (171 bài ngực); một
  document `__plan079_displaced__...` vẫn có thể lọt public/AI lookup.
- Câu follow-up đổi deficit `300 -> 700 kcal` có coaching advisory hợp lý nhưng
  vi phạm explicit invariant "giữ nguyên toàn bộ kế hoạch" khi tự sửa lịch tập.
  Runtime phải giữ nguyên phần user khóa và tách khuyến nghị thành advisory cần
  user đồng ý trước khi áp dụng.
- Câu Ronaldo route đúng `web_required`; guest bị chặn search theo policy hiện
  hành. Acceptance phải phân biệt guest-policy block với authenticated
  `provider_error`, `no_supported_source` và `grounded`, không gọi chung là model fail.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Runtime | `node --version` | đúng `v22.23.1` trước QA chính thức |
| AI eval | `npm run test:ai-eval` | exit 0, có incident prompts |
| Focused server | `cd server && npx vitest run src/services/ai/__tests__/requestRouter.test.js src/services/ai/__tests__/assistantOutput.test.js src/services/ai/providers/__tests__/gemini.provider.test.js src/controllers/__tests__/aiGuestAccess.integration.test.js` | exit 0 |
| Focused client | `cd client && npx vitest run src/services/__tests__/ai.service.test.js src/hooks/__tests__/useAiChat.streamCompletion.test.js` | exit 0 |
| Full unit | `npm run test:unit` | exit 0 dưới Node 22.23.1 |
| Client build | `npm run build --prefix client` | exit 0, không rewrite file protected |
| Security | `npm run security:secrets && npm run security:data-boundaries` | exit 0 |
| Agent docs | `npm run agents:validate` | exit 0 |
| Staging live | `npm run acceptance:staging:ai --prefix server` | incident suite pass và cleanup residue 0 |
| Diff hygiene | `git diff --check` | exit 0 |

## Scope

**In scope**:

- Cập nhật contract low-risk fitness trong
  `docs/specs/fitness-first-ai-and-knowledge-quality.md`.
- Provider resilience và telemetry trong
  `server/src/services/ai/providers/gemini.provider.js` cùng focused tests.
- Router/evidence/output/tool behavior trong `requestRouter.js`, `ai.controller.js`,
  `assistantOutput.js`, `searchExercises.tool.js` cùng tests.
- Conversation retry/auth/stale-ID recovery trong `client/src/hooks/useAiChat.js`,
  `client/src/services/ai.service.js` cùng tests.
- Incident corpus trong `server/src/services/ai/evals/corpus/ai-eval-corpus.v1.json`,
  staging acceptance và `e2e/ai-chat.spec.js` khi cần.
- Deterministic meal contract trong `server/src/services/ai/tools/suggestMeal.tool.js`,
  schema `suggest_meal`, structured tool result và focused tests cho kcal/macro,
  allergy/exclusion, budget provenance và follow-up scope.
- Runtime orchestration cho read-only preferred tools trong `ai.controller.js` và
  `gemini.provider.js`: không phụ thuộc model tự nguyện gọi tool khi route đã
  xác định tool bắt buộc.
- Safe metrics phân biệt `provider_attempted`, `provider_succeeded`,
  `provider_unavailable`, `provider_rate_limited` và `provider_not_required` mà không
  log raw prompt hoặc dữ liệu sức khỏe.
- Tách workout creation khỏi exercise lookup; draft workout text không được gắn
  `ExerciseListCard`, còn `get_workout_plan` tiếp tục chỉ đọc saved plan có auth.
- Loại staging displaced fixtures khỏi exercise lookup, lọc equipment trước final
  result limit và trả metadata `catalog_insufficient` khi không đủ số lượng yêu cầu.
- Semantic output contracts cho 11 prompt: scope preservation, numeric/card/source,
  context continuity và question-priority; không dùng router pass thay UX pass.
- Staging catalog readiness/dry-run contract cho Exercise/Food/allergen/price; chỉ
  apply khi target/confirmation/digest hợp lệ và không bịa provenance còn thiếu.

**Out of scope**:

- Đổi model/provider mặc định, quota thương mại hoặc mua tier Google/Atlas.
- Xóa Knowledge Base, hạ guard high-stakes/current/public-person hoặc mở web search cho guest.
- Re-embed/migration/seed hay ghi dữ liệu staging/production ngoài acceptance contract đã duyệt.
- Feature local khác của user và năm file protected:
  `client/public/sitemap-content.xml`, `client/public/sitemap-core.xml`,
  `client/public/sitemap-recipes.xml`, `client/public/sitemap.xml`,
  `client/src/generated/systemDependencyManifests.json`.
- Commit, push hoặc deploy khi chưa có yêu cầu riêng.

## Steps

### Step 1: Đóng băng incident thành regression contract

Đưa sáu prompt trong ảnh và toàn bộ bộ 11 câu kiểm thử của user vào corpus với expected
route, evidence policy, conversation identity và output-quality minimum. Thêm test RED cho:
false-positive `public_person_claim`, `{`/`}` đơn lẻ, tool no-hit, Gemini `503`, `401/404`
và retry malformed/failed turn.

**Behavior**: Các lỗi production hiện tại được tái hiện deterministic; test cũ pass không
còn đủ để tuyên bố release-ready.

**Blast radius**: eval corpus và focused test files; chưa đổi runtime.

**Depends on**: none.

**Verify**: test mới fail đúng từng root cause trên code hiện tại, không fail vì fixture/setup.

### Step 2: Khôi phục answer-first cho fitness rủi ro thấp

Sửa spec và router để stable, low-risk fitness dùng model prior khi KB/tool không có hit;
KB/tool là enrichment, không phải điều kiện được phép trả lời. Chỉ fail-closed với dữ liệu
time-sensitive, public-person claim, HT service server-authoritative hoặc high-stakes.
Sửa named-person detection để imperative như “Hãy tạo lịch...” không thể trở thành person.
Chuẩn hóa alias nhóm cơ/equipment/beginner cho exercise lookup; nếu catalog vẫn no-hit,
model trả kiến thức phổ thông có nhãn phù hợp thay vì lời từ chối giả.

**Behavior**: Ba prompt bữa sáng, năm bài ngực và kế hoạch bảy ngày đều nhận câu trả lời
hữu ích khi provider khỏe, không phụ thuộc web chỉ vì KB miss.

**Blast radius**: spec, router, controller, exercise tool, prompt/eval tests.

**Depends on**: Step 1.

**Verify**: router/output/tool focused tests và `npm run test:ai-eval` exit 0.

### Step 3: Làm provider failure có khả năng tự phục hồi

Thêm bounded retry cho transient `503`/selected `5xx` với exponential backoff + jitter nằm
trong deadline chung; `429` chỉ retry khi `Retry-After` hợp lệ và còn budget. Không retry
`400` vô hạn và không nhân đôi tool mutation. Khi exhaust, trả lỗi phân loại rõ, rollback
failed turn, refund quota theo contract và cho phép retry cùng conversation. Ghi metric
attempt/result để đối chiếu app logs với Google usage mà không log prompt.

**Behavior**: Một `503` thoáng qua không tạo banner lỗi; chuỗi `503` kéo dài hiển thị thông
báo provider tạm gián đoạn, không giả là quota và không yêu cầu đóng/mở chat.

**Blast radius**: Gemini provider, controller finalization/quota seam, observability và tests.

**Depends on**: Step 1.

**Verify**: provider/controller tests chứng minh success-after-retry, deadline, abort,
`Retry-After`, no duplicate persistence và quota settlement.

### Step 4: Chặn malformed output và giữ đúng conversation khi Retry

Coi empty, orphan brace và protocol fragment là incomplete/malformed; không persist như một
assistant answer completed. Failed/malformed/latest turn phải resend trong cùng conversation;
fork chỉ dành cho edit/retry một lượt thành công cũ. Sau refresh `401`, request giữ cùng
payload/request ID contract; nếu conversation `404`, reconcile owner state rồi phục hồi rõ
ràng, không âm thầm mất context hoặc tạo conversation mới ngoài contract.

**Behavior**: UI không bao giờ hiển thị chỉ `{`/`}`; nhấn Retry sau lỗi không tạo thread mới,
không cần đóng/mở widget.

**Blast radius**: output guard, controller persistence, AI service, chat hook và tests.

**Depends on**: Steps 1 và 3.

**Verify**: server/client focused suites và E2E retry/history scenarios exit 0.

### Step 5: Đóng các lỗ hổng output do live staging phát hiện

Trước khi chạy lại, chuyển các vi phạm live thành RED tests ở public seam:

1. `suggest_meal` phải trả structured items + totals do server tính, không chỉ trả
   prose. Tổng item, tổng macro và `4P + 4C + 9F` phải khớp trong dung sai
   rounding đã khai báo; kcal phải nằm trong tolerance user yêu cầu và protein
   không được thấp hơn minimum.
2. Tool schema phải nhận các constraint mà runtime thực sự enforce được. Dị ứng,
   không dung nạp và thực phẩm loại phải fail closed nếu catalog chưa review;
   ngân sách chỉ được công bố đạt khi có price provenance đủ, nếu không phải
   nói rõ chưa xác minh.
3. Khi router chọn một read-only canonical tool cho action rõ ràng, server phải
   enforce tool execution hoặc trả lời thiếu dữ liệu có cấu trúc; không được
   chấp nhận prose tự bịa số. Write/mutation tools không thuộc cơ chế này.
4. Với `web_required`, authenticated server phải thực thi đúng một
   `search_knowledge` canonical attempt thay vì chờ model chọn. Trace phải phân biệt
   `not_called`, `provider_error`, `no_supported_source` và `grounded`; nếu không có
   evidence, phần claim về người thật vẫn fail closed nhưng có thể đưa gợi ý
   fitness phổ thông được dán nhãn rõ là không phải routine đã xác minh.
5. Workout output phải validate ràng buộc equipment; không sinh bài cần ghế/máy
   nếu user không có, trừ khi ghi rõ biến thể thay thế không cần thiết bị đó.
6. Follow-up chỉnh thực đơn phải thao tác trên structured plan trước, không
   đọc prose cũ rồi ước lượng lại.

**Behavior**: Câu 1, 7 và 8 không thể công bố tổng sai; câu 2 vẫn có
tool-backed fallback hữu ích nếu chat model hỏng sau khi tool đã thành công; câu 9
thật sự thực thi search attempt và có outcome trace; câu 10 giữ đúng thiết bị.

**Blast radius**: meal/search/exercise read-only tools, tool schema, controller orchestration,
conversation memory, output/eval tests và staging acceptance assertions.

**Depends on**: Steps 1–4 và staging round 1 evidence.

**Verify**: RED → GREEN focused tests cho numeric invariant, mandatory read-only tool execution,
search outcome và equipment constraint; `npm run test:ai-eval` exit 0.

### Step 6: Đóng tám gap semantic/card/data sau manual staging round 2

1. Tách `WORKOUT_CREATION_PATTERN` khỏi `search_exercises`. Draft plan mới dùng
   model prior + equipment output guard và không emit flat exercise card;
   `get_workout_plan` vẫn là private saved-plan lookup.
2. `search_exercises` loại displaced fixtures bằng query và defense-in-depth,
   lấy đủ field cho equipment matching, lọc trước final limit, de-duplicate và
   báo `requestedCount/resultCount/catalogInsufficient` thay vì giả đủ dữ liệu.
3. Thêm invariant cho follow-up explicit: giữ nguyên mọi phần ngoài field user
   cho phép đổi; advisory coaching được nêu riêng và chỉ áp dụng sau đồng ý.
4. Giữ web search authenticated-only; response/trace phải phân biệt guest policy,
   provider error, no supported source và grounded, không quy chụp thành model limit.
5. Bổ sung regression cho sync/retry timing: lỗi trước/sau conversation event đều
   reconcile cùng conversation, không clear history hay tạo conversation mới ngoài ý muốn.
6. Staging catalog readiness kiểm Exercise coverage, Food safety provenance và
   fresh price coverage. Sync/apply vẫn fail closed nếu thiếu nguồn hoặc chưa có
   xác nhận target/digest; runtime trả lý do dữ liệu thiếu rõ ràng.
7. Thêm semantic output/card oracle cho 11 prompt ở deterministic seam; router-only
   eval không còn đủ điều kiện gọi là acceptance.
8. Siết chất lượng Q5/Q10/Q11: đủ ngày/cấu trúc, beginner/equipment phù hợp, diễn
   đạt deload không mơ hồ, TDEE là ước tính và câu hỏi ưu tiên dữ liệu cần thiết.

**Behavior**: Manual suite phân biệt được lỗi runtime, dữ liệu và policy; workout
không còn card sai ngữ nghĩa, follow-up không âm thầm đổi scope, retry không mất
conversation và mọi PASS đều có semantic invariant tương ứng.

**Blast radius**: router/prompt/controller/hook, exercise/meal tools, eval/acceptance,
staging readiness scripts và focused tests. Không đổi schema, auth, quota hay provider.

**Depends on**: Step 5 và manual staging round 2 evidence.

**Verify**: từng slice RED → GREEN; focused server/client + `npm run test:ai-eval`;
tool validator, protected-file hashes và `git diff --check` pass.

### Step 7: Chứng minh lại bằng live staging trước production

Chạy full QA dưới Node `22.23.1`, sau đó chạy chính 11 prompt user-visible trên staging với
provider thật hai lượt liên tiếp ở hai conversation mới. Acceptance phải lưu request ID,
route/evidence/tool outcome, provider outcome, latency và cleanup receipt nhưng không raw prompt
trong log. Oracle phải assert cả semantic invariants (tổng kcal/macro, hard constraints,
source, equipment, context continuity), không chỉ assert route hoặc response không rỗng.

**Behavior**: Không generic error, không refusal sai, không orphan fragment, không conversation
fork ngoài ý muốn; mọi request giải thích được vì sao có/không gọi provider/tool.

**Blast radius**: acceptance script/tests, release evidence và staging only.

**Depends on**: Step 5 GREEN và exact candidate đã deploy staging.

**Verify**: focused + full QA pass; hai staging runs pass `11/11`, cleanup `residue=0`.

### Step 8: Roll out nhỏ và quan sát trước khi mở rộng tính năng

Tạo release candidate chỉ chứa Plan 092, giữ immutable rollback target là release trước thay
đổi. Sau deploy, chạy smoke prompt subset và quan sát tối thiểu provider errors, false refusal,
malformed output, retry branch và p95 latency. Nếu bất kỳ P0 tái diễn, rollback; không tiếp tục
thêm tool/KB behavior cho tới khi cửa sổ quan sát đạt.

**Behavior**: Production tối thiểu bằng phiên bản ổn định cũ về khả năng trả lời, đồng thời giữ
privacy/safety của phiên bản mới.

**Blast radius**: release/operations; không migration hay data rewrite.

**Depends on**: Step 7 và owner approval cho deploy.

**Verify**: exact deploy identity, production smoke và observation report đều pass.

## Test Plan

- Router: exact Vietnamese incident prompts, negative named-person cases và true public-person cases.
- Provider: `503 -> 200`, repeated `503`, `429 + Retry-After`, abort/deadline và no retry cho non-transient error.
- Evidence: low-risk KB/tool miss vẫn trả lời; time-sensitive/high-stakes vẫn fail-closed đúng.
- Tool: `ngực/chest`, bodyweight/no-equipment, beginner và no-hit fallback.
- Output: `{`, `}`, incomplete fenced JSON, whitespace-only và valid ordinary punctuation.
- Conversation: provider rollback retry same ID, malformed retry same ID, past-success retry forks,
  refresh `401`, stale `404`, navigation race và no ghost turn.
- Live staging: 11 prompts x 2 consecutive runs; zero generic error/false refusal/orphan fragment.
- Meal live oracle: item totals khớp declared totals; target kcal trong tolerance; protein
  đạt minimum; allergy/exclusion được enforce; budget không được claim khi thiếu provenance.
- Required-tool oracle: route đã chọn read-only tool thì trace phải có exact tool
  outcome; `web_required` phân biệt no-call, provider error, no-support và grounded.

## Done Criteria

- [x] Reliability corpus có đủ 11 prompt user-visible: 6 prompt incident exact và 5 prompt adversarial synthetic do user cho phép tự thiết kế ngày 2026-09-17; mọi case có routing assertion. Năm case synthetic không được trình bày như prompt lịch sử từ screenshot.
- [x] Low-risk stable fitness không bị ép web/fail-closed chỉ vì KB hoặc exercise catalog miss.
- [x] Transient Gemini `503` được retry bounded; `429` và `503` được phân loại khác nhau.
- [x] `{`/`}`/whitespace đơn lẻ không được stream/persist như câu trả lời hoàn chỉnh.
- [x] Retry failed/latest malformed turn giữ nguyên conversation; branch chỉ cho lượt thành công cũ.
- [x] Metrics giải thích được provider attempt/success/failure, unavailable/rate-limited và static safety không cần provider.
- [ ] Focused tests, AI eval, full unit, client build, security và agent validation pass dưới Node 22.23.1.
- [ ] Hai lượt staging live liên tiếp pass `11/11`, cleanup residue 0.
- [x] Câu 1, 7 và 8 pass deterministic kcal/macro + hard-constraint oracle; không
  còn dùng prompt text như guard duy nhất.
- [x] Câu 9 có canonical search outcome trace và chỉ claim phần có grounded support.
- [x] Câu 10 giữ đúng equipment constraint hoặc nêu rõ biến thể thay thế.
- [x] Workout creation không chọn `search_exercises` và không emit flat exercise card;
  exercise lookup loại displaced fixtures, filter-before-limit và báo catalog thiếu.
- [x] Follow-up `300 -> 700 kcal` giữ nguyên workout plan; advisory thay đổi volume
  chỉ được đề xuất riêng, không tự áp dụng.
- [x] Retry lỗi trước/sau conversation event đều giữ đúng conversation identity.
- [x] Q9 guest/authenticated có outcome phân loại đúng; authenticated search có đúng
  một canonical attempt, guest không bị mô tả sai là provider/model failure.
- [x] Deterministic semantic contracts cover đủ 11 prompt; route-only pass không được
  nâng thành UX acceptance.
- [x] Staging catalog readiness nêu exact gap Exercise/Food/allergen/price và fail
  closed nếu thiếu provenance; không apply dữ liệu thật ngoài confirmation contract.
- [x] Năm file protected và feature local của user không bị thay đổi bởi implementation.
- [ ] Production chỉ rollout sau approval riêng và có rollback target được xác minh.

## Execution Evidence — 2026-09-17

- Steps 1–4: local implementation hoàn tất. Reliability corpus `2026-09-reliability-v16` PASS `62/62`: giữ 6 prompt incident exact, thêm 5 prompt adversarial user-authorized về thực đơn 2.500 kcal, follow-up 2.200 kcal, routine Ronaldo có nguồn, giáo án nhiều ràng buộc và yêu cầu hỏi đủ dữ liệu trước khi tính calo.
- Client unit dưới Node `22.23.1`: `172` files / `820` tests PASS. Focused chat service/hook: `25/25` PASS.
- Server unit dưới Node `22.23.1`: batches 1–7 PASS `224` files / `1657` tests; sau khi bump prompt contract, batch 8 PASS `32/1079`, batch 9 PASS `11/62`. Các file AI thay đổi sau đó được rerun focused `9/398` và output guard `17/17`, đều PASS.
- Sau final independent review và các regression bổ sung, focused integration mới nhất dưới Node `22.23.1` PASS: server `9` files / `420` tests, client `2` files / `25` tests, AI eval `62/62`. Review chốt `PASS WITH WARNINGS`; mọi actionable finding về planning grammar, nested protocol residue, provider fallback retry, evidence attribution và beginner ranking đã được sửa và có test.
- Staging baseline smoke trên frontend được user cho phép: `5/5` prompt nhận phản hồi không rỗng, không generic transport error và không orphan brace, nhưng `5/5` FAIL tiêu chí chất lượng. Thực đơn khai macro/tổng kcal sai và follow-up đổi thêm hạt ngoài phạm vi; câu Ronaldo bị từ chối toàn phần ở guest; giáo án 4 ngày bị từ chối khi exercise catalog miss; yêu cầu hỏi thêm dữ liệu bị gắn nhầm là cần thông tin mới nhất. Bundle staging quan sát là `index-DopM5_sV.js`, khác candidate local `index-BmD_m15S.js`, nên đây chỉ là baseline của deploy cũ, không phải acceptance của bản fix. Smoke đã dùng đủ 5 lượt guest/IP trong cửa sổ 24 giờ và tạo conversation guest TTL; không tạo KB/admin fixture và không có quyền cleanup formal.
- Từ baseline trên, prompt contract được bump lên `2026-09-17.v2` và thêm guard bắt buộc đối chiếu `4P + 4C + 9F`, giữ hard constraints và không âm thầm đổi ngoài phạm vi follow-up. Test mới được xác nhận RED trước patch rồi GREEN trong focused suite.
- Compile-only client dưới Node `22.23.1`: Vite PASS, `2957` modules. Client lint: `0` errors, `1` warning hiện hữu ngoài scope ở `TrainerTransferPanel.jsx`.
- Tool registry: `11` tools, `0` orphan, PASS. Secret scan, repository boundary scan và agent validation đều PASS; `git diff --check` PASS tại checkpoint implementation.
- Release build lifecycle đã được chạy dưới Node `22.23.1` qua wrapper backup/restore. Vite compile `2957` modules và bundle budget PASS, nhưng lifecycle tổng thể BLOCKED/FAIL ở prerender/search-index verification vì local thiếu `VITE_API_URL`, dẫn tới `0/54` route render. Wrapper báo `PROTECTED_RESTORE=PASS`; SHA-256 của cả năm file protected khớp snapshot trước build và `git diff --check` vẫn PASS. Không rerun bằng staging/production API khi chưa có authorization live rõ ràng.
- Focused Playwright dưới Node `22.23.1` với mock API local PASS `7/7`: deterministic/progressive SSE, navigation continuity, stop response, provider failure + Retry/Edit cùng conversation và confirmation card. Ports `4174`/`5100` đều trống trước khi chạy; không dùng MongoDB, Gemini hoặc credentials thật.
- Steps 5–7: formal live staging acceptance hai lượt liên tiếp, verified cleanup,
  provider/tool correlation, release candidate, production deploy và observation chưa pass.
- Manual live round 1 sau khi staging merge `586e8b39` đã chứa candidate
  `ed839923`: PASS câu 3, 4, 5, 6, 11; FAIL câu 1, 2, 7, 8, 9; FAIL nhẹ
  câu 10. Câu 5 được regrade PASS vì không đoán dữ liệu cá nhân là đúng
  product behavior. Round này là RED evidence cho Step 5, không phải release evidence;
  dừng trước backup, formal promotion gate và production deploy.

## Execution Evidence — 2026-09-18

- Step 5 local implementation hoàn tất: `suggest_meal` tạo structured meals/totals
  deterministic, đối chiếu tổng item/meal với `4P + 4C + 9F`, giữ minimum protein,
  fail closed cho allergy/exclusion thiếu provenance, và follow-up chỉ đổi món được
  chỉ định với gram trước → sau. Mandatory read-only tool execution, canonical web
  search outcome trace và equipment constraint đều có regression ở public seam.
- Node `22.23.1`: full server PASS `270` files / `2865` tests; focused AI PASS
  `12` files / `254` tests; AI eval `2026-09-reliability-v16` PASS `62/62`;
  client PASS `172` files / `820` tests; Vite compile-only PASS `2957` modules.
- Tool validator PASS `11` tools / `0` orphan. Agent validation, secret scan,
  repository-boundary scan và `git diff --check` đều PASS. Full server runner có
  force-exit warning sau khi JSON report đã ghi ở một số batch, nhưng mọi batch và
  command tổng đều exit `0`; đây là teardown warning còn theo dõi, không phải test fail.
- SHA-256 của năm file protected khớp trước/sau compile-only; implementation không
  stage, commit hoặc sửa nội dung các file đó. Hai report debug tạm trong
  `server/.local-data/` đã được xóa.
- `ChatConversation.answerTrace.webSearchOutcome` là field optional có default
  `not_called`; document cũ vẫn tương thích và không cần migration/backfill.
- Chưa deploy exact candidate mới lên staging, nên Step 7 vẫn PENDING. Release build
  lifecycle vẫn giữ blocker đã ghi ngày 2026-09-17 do local thiếu `VITE_API_URL`;
  không nâng compile-only thành release evidence và chưa đủ điều kiện production.
- Step 6 local GREEN sau vòng RED → GREEN cuối: scope guard xử lý phủ định tự nhiên,
  runtime-enforce cả invariant tổng quát “giữ nguyên mọi thứ ngoài field được phép đổi”
  (đã có controller integration ngoài trường hợp thâm hụt) và chặn mutation dinh dưỡng
  ngoài phạm vi. Mixed meal/workout chỉ nhận supplement workout-only, retry đúng một lần
  rồi ghép canonical meal với fallback tĩnh; query bodyweight dùng cùng predicate với
  readiness và đã được chứng minh bằng Exercise schema thật trên MongoMemory, không còn
  `DocumentArray CastError`.
- Broad review phát hiện và đã đóng hai gap cuối: generic locked-scope trước đây chỉ được
  runtime-enforce cho thâm hụt; semantic meal oracle trước đây chưa cộng lại
  `foods → meal → plan`. Regression được xác nhận RED trước fix rồi GREEN; evaluator v18
  giờ fail khi item và totals mâu thuẫn thay vì tin top-level totals.
- Independent re-review cuối PASS: scope parser/validator nhận cả cách nói giảm số buổi
  và thay bài tập bằng text; fallback giữ invariant, mutation thêm bị chặn. Meal numeric
  evaluator đã tách thành module riêng và toàn bộ file mới dưới 300 dòng.
- Node `22.23.1`: full server PASS `275` files / `2929` tests; full client PASS
  `173` files / `825` tests; AI eval v18 PASS `73/73`, gồm `11` semantic fixtures và
  không giả runtime capture thành live acceptance; release/workflow contracts PASS `29/29`.
- Vite compile-only PASS `2957` modules. Lint `0` error / `1` warning hiện hữu ngoài scope
  tại `TrainerTransferPanel.jsx`; UI regression gate `0` finding mới. Tool validator
  PASS `11` tools / `0` orphan; secret scan, repository-boundary scan, agent validation
  và `git diff --check` PASS.
- Focused Playwright local/mock chạy đủ `7/7` assertions PASS nhưng command rerun không
  tự thoát sau teardown và phải interrupt; không nâng lượt này thành exit-0 evidence.
  Step 7 vẫn cần exact candidate được deploy staging và hai lượt live `11/11` liên tiếp.

## STOP Conditions

- Code in-scope đã lệch release incident nhưng corpus chưa được cập nhật theo behavior mới.
- Fix yêu cầu hạ privacy/high-stakes/ownership/CSRF/quota guard.
- Provider console và app metrics không thể correlate bằng request/outcome metadata an toàn.
- Một trong 11 prompt còn generic error, false refusal, malformed output hoặc unexpected fork ở staging.
- Cleanup staging có residue khác 0 hoặc acceptance cần dùng raw production conversation.
- Verification fail hai vòng sau root-cause fix, hoặc implementation đòi đổi provider/model/tier.
- Bất kỳ step nào chạm năm file protected hay feature local ngoài scope.

## Maintenance Notes

- Không dùng “tests pass” làm đồng nghĩa với “UX pass”; incident corpus và live provider gate là
  hai lớp bắt buộc khác nhau.
- Mọi evidence/tool mới phải chứng minh degradation path vẫn hữu ích cho low-risk trước khi bật.
- Google quota dashboard có thể trễ và không tính request không sinh token; app-side outcome metric
  mới là nguồn đầu tiên để phân biệt “không gọi model” với “provider từ chối”.
- Sau khi Plan 092 ổn định, chỉ tái giới thiệu cải tiến theo từng behavior slice nhỏ, mỗi slice có
  exact prompt regression và staging observation riêng.
