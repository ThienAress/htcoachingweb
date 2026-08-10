# Plan 038: Ổn định HT Assistant, lưu thực đơn, HLV mặc định và SEO

> **Hướng dẫn thực thi**: triển khai theo từng behavior slice có test RED trước. Không deploy, đổi quota,
> chạy migration hoặc ghi dữ liệu production trong plan này.
>
> **Drift check**: working tree đang có thay đổi chưa commit của task thêm cột `Ưu tiên` vào bảng
> `Tính năng cộng đồng & khách hàng`. Khi triển khai phải giữ nguyên các thay đổi đó, không ghi đè
> `.vscode/` và chỉ tích hợp phần catalog F0 sau khi các test runtime tương ứng đã pass.

## Status

- **Priority**: P0
- **Effort**: L
- **Risk**: HIGH — SSE lifecycle, quota trust, access policy, production config và crawl/index contract
- **Depends on**: 003C, 024A, 026C, 031, 033
- **Category**: bugfix | ux | access-policy | operations | seo
- **Planned at**: 2026-08-10
- **Execution**: RELEASE CANDIDATE VERIFIED — STAGING PENDING

## Why This Matters

Production đang có bốn nhóm lỗi làm giảm niềm tin trực tiếp:

1. Đổi sang cuộc trò chuyện khác sẽ hủy request AI đang chạy. Quota đã được middleware tính trước,
   nên người dùng mất một lượt nhưng không nhận được câu trả lời hoàn chỉnh.
2. Người dùng đã đăng nhập có thể tạo thực đơn nhưng `POST /api/saved-meal-plans` trả `409` khi Order
   chưa có `trainerId` và không có HLV mặc định hợp lệ. UI còn đưa các từ kỹ thuật như `snapshot`,
   `phiên bản` và lỗi phân công HLV ra cho khách hàng.
3. Contract admin làm HLV mặc định đã được thống nhất nhưng runtime chỉ đọc `DEFAULT_ADMIN_TRAINER_ID`; cấu hình thiếu/sai
   làm các nghiệp vụ coaching cần HLV fail dù `ADMIN_EMAIL` đã xác định đúng tài khoản admin.
4. Sitemap từng công bố 747 recipe legacy cùng lúc, trong khi broad SPA fallback trả homepage `200` cho URL giả. Google vì
   vậy vừa gặp tập URL lớn chất lượng chưa được tuyển chọn, vừa nhận tín hiệu soft-404 không đáng tin cậy.

Popup gợi ý chủ động của HT Assistant cũng tạo thao tác ngoài ý muốn. Product direction mới là chỉ mở
chat khi người dùng tự bấm launcher; các suggestion chip bên trong panel vẫn được giữ.

## Evidence và root cause đã xác nhận

| Hiện tượng | Bằng chứng trong code | Kết luận |
|---|---|---|
| Đổi conversation làm dừng AI | `client/src/hooks/useAiChat.js`: `switchConversation()` gọi `cancelRequest(false)`; hàm này abort `AbortController` hiện tại | Client chủ động đóng SSE khi chỉ định chuyển view |
| Backend dừng sinh câu trả lời | `server/src/controllers/ai.controller.js`: listener `res.on("close")` abort provider | Đây là bảo vệ tài nguyên đúng khi client thật sự disconnect; không cần gỡ để sửa thao tác đổi conversation trong cùng panel |
| Quota vẫn giảm | `server/src/routes/ai.routes.js`: limiter chạy trước `chatStream` | Request đã được nhận và tính quota trước khi client abort; hotfix phải ngăn mất kết quả, không tạo cơ chế hoàn quota thiếu an toàn |
| Popup tự xuất hiện | `DeferredChatPanel.jsx` dùng `useAiAssistantNudge`; hook đo thời gian đọc/scroll và render CTA | Có thể gỡ độc lập mà vẫn giữ launcher và suggestion trong panel |
| Lưu thực đơn trả `409` | Ảnh production cho thấy `POST /saved-meal-plans` trả `409` với “Gói tập chưa được phân công huấn luyện viên” | Request vượt qua auth/CSRF/validation nhưng bị chặn tại access resolver |
| Meal Plan phụ thuộc HLV | `savedMealPlanAccess.service.js` tái sử dụng `resolveJournalWriteAccess()`; resolver yêu cầu Order approved, còn buổi và trainer/default trainer | Contract của Daily Journal đã bị dùng quá rộng cho thao tác lưu thực đơn cá nhân |
| UI lộ thuật ngữ kỹ thuật | `client/src/i18n/locales/vi/mealplan.json` có “Lưu snapshot…” và “Phiên bản”; component hiển thị raw API message | Cần tách error code máy đọc được khỏi câu chữ dành cho khách |
| Admin mặc định không được nhận | `trainingScheduleCommand.service.js` chỉ đọc `DEFAULT_ADMIN_TRAINER_ID`; `productionReadiness.js` mới bắt buộc `ADMIN_EMAIL` | Thiếu fallback explicit từ email canonical và thiếu readiness gate cho cấu hình ID |
| Google báo soft 404 | `client/public/_redirects` có `/* /index.html 200`; URL giả nhận SPA shell/homepage thay vì 404 | Cần scoped SPA rewrites và final true 404 |
| Sitemap tăng đột biến | `client/public/sitemap.xml` chứa 747 recipe detail legacy sau đợt publish ngày 2026-07-23/25 | Cần tách sitemap, curate recipe và chỉ prerender URL thật sự được công bố |

## Product decisions đề xuất

1. **Đổi conversation chỉ đổi màn hình đang xem**. Nó không được abort stream của conversation khác.
2. Pending state, nội dung nháp, tool state và lỗi được quản lý theo `conversationId`; một conversation chỉ
   có tối đa một stream đang chạy, nhưng các conversation khác có thể được mở và gửi câu hỏi độc lập.
3. Background ở đây nghĩa là tiếp tục khi người dùng đổi conversation hoặc đóng panel nhưng trang vẫn
   đang mở. Đóng tab, mất mạng hoặc reload vẫn là disconnect thật; backend tiếp tục abort để tránh job mồ côi.
4. Quota vẫn tính đúng một lượt cho một request đã được chấp nhận. Tiêu chí sửa là người dùng nhận được
   và xem lại kết quả tương ứng, không phải hoàn quota sau thao tác chuyển view.
5. Gỡ toàn bộ proactive nudge. Giữ nút/pill `HT Assistant` và các suggestion chip chỉ xuất hiện sau khi
   người dùng chủ động mở panel.
6. User đã đăng nhập được create/revise/archive thực đơn của chính mình mà không bắt buộc có Order hoặc
   HLV. `trainerIdAtCreation` tiếp tục là field optional và có thể `null`; không cần schema change.
7. Không hạ auth, CSRF, ownership, rate limit, feature flag, canonical Food recalculation, idempotency,
   immutable revision hoặc retention hiện có.
8. UI tiếng Việt không hiển thị `snapshot`, `version`, `archive`, `requestId`, `meal plan` hay lỗi phân công
   HLV. Các khái niệm này có thể giữ nội bộ trong model/API.
9. Resolver HLV mặc định ưu tiên `DEFAULT_ADMIN_TRAINER_ID`; nếu biến này không được cấu hình thì mới fallback theo
   `ADMIN_EMAIL`, và tài khoản tìm được bắt buộc có role `admin`. ID đã cấu hình nhưng sai phải fail closed, không âm thầm
   chọn một admin khác.
10. Saved Meal Plan độc lập hoàn toàn với resolver HLV mặc định; sửa config admin không phải điều kiện để khách lưu thực đơn.
11. URL không tồn tại/đã xóa phải trả true `404/410`; SPA rewrite `200` chỉ áp dụng cho các app route thật cần client routing.
12. Sitemap được tách theo loại nội dung; recipe chỉ được công bố theo manifest tuyển chọn 20–50 slug, không theo toàn bộ
    `isPublished`. GSC chỉ được validate sau deploy khi HTTP evidence live đạt yêu cầu.
13. Sidebar hiển thị spinner riêng cho mọi conversation đang có stream. Conversation đang xem không được dùng làm nguồn
    suy luận loading cho conversation khác; spinner tắt khi đúng stream hoàn tất, lỗi hoặc bị dừng.
14. Catalog tính năng lưu lịch sử xử lý dạng date-only `YYYY-MM-DD` với trạng thái phân biệt `Đã code`, `Đã kiểm thử`
    và `Đã xác minh production`. Priority vẫn là mức cao nhất của hạng mục chưa được xác minh production; không tự đánh dấu
    hoàn tất từ Git hoặc test runner.

## Giải thích và hiệu chỉnh ba mục F0

### HT Assistant — giữ F0

- **Vấn đề thật cần xử lý ngay**: mất câu trả lời khi chuyển conversation trong khi quota đã giảm; popup
  chủ động khiến người dùng bấm nhầm.
- **Giá trị sau sửa**: phản hồi tiếp tục chạy đúng conversation, quay lại xem được nội dung, nút dừng chỉ
  dừng conversation đang xem và khách chủ động quyết định khi nào mở AI.
- **Cách đo**: tỷ lệ request có `done`, tỷ lệ abort do navigation, số request bị tính quota nhưng không có
  assistant message, và feedback hữu ích.

### Meal Plan — giữ F0

- **Vấn đề thật cần xử lý ngay**: entry public cho phép tạo thực đơn nhưng thao tác lưu lại phụ thuộc vào
  lifecycle coaching/HLV. Ảnh production đã chứng minh đường dẫn này fail với `409`.
- **Giá trị sau sửa**: user đã đăng nhập lưu, xem lại, cập nhật và bỏ lưu thực đơn cá nhân; quyền sở hữu và
  tính toán dinh dưỡng canonical vẫn do server bảo vệ.
- **Cách đo**: tỷ lệ save thành công, phân bố lỗi theo stable code, số lần retry và tỷ lệ quay lại dùng thực
  đơn đã lưu.

### Meal Scan — đề xuất hạ F1

- **Hiện trạng đã có**: UI cho chỉnh gram và tính lại local; API trả khoảng khẩu phần/confidence; backend có
  calibration tests và benchmark tooling. Spec hiện chủ đích không lưu ảnh/kết quả hay tự ghi Daily Journal.
- **Khoảng trống còn lại**: kết quả đã chỉnh chưa được lưu vào nhật ký và chưa có ground-truth thực tế để đo
  độ chính xác ngoài synthetic/proxy benchmark.
- **Lý do không giữ F0**: chưa có incident production tương đương hai mục trên. Việc lưu kết quả scan sẽ mở
  thêm quyết định schema, privacy, retention và cách biểu diễn độ bất định; không nên gộp vào hotfix.
- **Điều kiện nâng lại F0**: có bằng chứng tỷ lệ sai nghiêm trọng, nhu cầu nhật ký là blocker chính của khách,
  hoặc business quyết định Meal Scan là hành trình trọng tâm ngay trong release kế tiếp.

Sau khi duyệt, catalog nên phản ánh đúng quyết định: HT Assistant và Meal Plan là F0; Meal Scan là F1. Mô tả
`Cơ hội cải thiện ban đầu` phải nêu vấn đề có thể kiểm chứng ở trên thay vì roadmap chung chung.

## Scope

**In scope**:

- Vòng đời stream và state theo conversation trong `useAiChat`/ChatPanel.
- Regression test đổi conversation trong lúc SSE đang trả lời.
- Gỡ proactive nudge và dead code/config/test tương ứng.
- Nới write access Saved Meal Plan cho authenticated owner, giữ toàn bộ security/data integrity gate.
- Việt hóa customer-facing copy và map stable error code sang thông báo dễ hiểu.
- Cập nhật spec AI, service access policy và catalog priority sau khi behavior đã có test.
- Khôi phục resolver admin mặc định theo config explicit và bổ sung production readiness test.
- Tách sitemap core/content/recipe, giới hạn recipe theo manifest tuyển chọn, cập nhật prerender và true-404 routing.
- Thêm static/rendered verification cho URL tốt, URL giả và sitemap; live GSC chỉ ghi `SKIP/BLOCKED` khi thiếu quyền.

**Out of scope**:

- Background job sống qua reload/đóng tab hoặc tách generation khỏi HTTP lifecycle.
- Hoàn quota, đổi 5/15/30 AI Chat quota hoặc đổi Meal Plan generation quota.
- Persist Meal Scan, tạo history/ground-truth dataset hoặc sửa Daily Journal schema.
- Migration/backfill, thay đổi dữ liệu thật, deploy staging/production.
- Refactor toàn bộ `ChatPanel.jsx`, `validation.js` hoặc Today Dashboard ngoài phần consumer bị ảnh hưởng.
- Tự động chọn “admin đầu tiên”, backfill Order thiếu trainer hoặc chỉnh biến môi trường production.
- Yêu cầu lập chỉ mục thủ công hàng loạt, tự xác nhận GSC validation hoặc cam kết Google sẽ index toàn bộ URL.

## Implementation Steps

### Step 1: Khóa regression bằng test RED cho conversation switching

Mở rộng mock SSE để conversation A trả chậm, cho UI chuyển sang B trước event `done`, rồi xác minh request A
không bị abort, B hiển thị đúng state và khi quay lại A thì assistant message đã hoàn tất. Thêm case hai
conversation pending độc lập và nút “Dừng phản hồi” chỉ abort stream của conversation đang xem.

**Behavior**: navigation không làm mất response; event không ghi nhầm vào conversation đang mở.

**Blast radius**: `e2e/ai-chat.spec.js`, `e2e/mock-api.cjs`, helper/state-machine test mới nếu cần.

**Verify**: test mới phải fail trên code hiện tại vì `switchConversation()` abort request A.

### Step 2: Tách transient stream state theo conversation

Thay single `activeSessionRef` và các buffer/timer global bằng registry có key ổn định. Conversation mới dùng
temporary key và được re-key atomically khi nhận event `conversation`. `switchConversation()` chỉ đổi selected
view và load/cache dữ liệu; SSE handler luôn ghi vào state của session nguồn. `isLoading`, `activeTool`, `error`
và stop action được derive theo conversation đang xem. Khi `done`, reconcile từ API và refresh sidebar.

Giữ abort khi hook unmount thật sự; không sửa listener disconnect backend. Nếu state machine làm hook quá lớn,
tách helper pure dưới 300 dòng thay vì refactor presentation của `ChatPanel`.

**Behavior**: A tiếp tục trả lời khi xem B; có thể hỏi B mà không ghi đè A; quay lại A thấy streaming/complete.

**Blast radius**: `client/src/hooks/useAiChat.js`, helper/test mới, `ChatPanel.jsx`, sidebar indicator nếu cần.

**Verify**: focused state-machine test + AI Chat E2E + existing chat runtime tests.

### Step 2A: Hiển thị spinner cho conversation đang chạy nền

Derive danh sách `pendingConversationIds` từ session registry, refresh danh sách sidebar ngay khi SSE phát event
`conversation`, rồi truyền trạng thái tới `ChatPanelSidebar`. Mỗi row pending hiển thị `LoaderCircle` có nhãn
“Đang nhận phản hồi”, hỗ trợ reduced motion và không làm conversation đang xem bị loading nhầm.

**Behavior**: gửi ở A rồi chuyển sang B vẫn thấy spinner tại A; spinner biến mất khi A `done`, error hoặc abort. Conversation
mới xuất hiện trong sidebar ngay sau khi server cấp ID thay vì đợi response hoàn tất.

**Blast radius**: `aiChatSessionRegistry.js`, `useAiChat.js`, `ChatPanel.jsx`, `ChatPanelSidebar.jsx`, focused registry test và
AI Chat E2E.

**Verify**: registry test pending IDs + E2E assert accessible status trên đúng row trước/sau `done`.

### Step 3: Gỡ proactive AI nudge nhưng giữ manual discovery

Xóa consumer/render nudge trong `DeferredChatPanel`, bỏ `initialAction` không còn dùng, xóa hook và test khi
không còn consumer, đồng thời bỏ `proactive` fields/helper khỏi page context. Không xóa page suggestions,
launcher/pill, guest access hay context enrichment.

**Behavior**: không còn popup sau thời gian/scroll; chỉ bấm launcher mới mount/mở chat; suggestion chip vẫn có.

**Blast radius**: `DeferredChatPanel.jsx`, `ChatPanel.jsx`, `useAiAssistantNudge.js`, test hook,
`aiPageContext.js` và spec sitewide assistant.

**Verify**: `rg` không còn nudge/proactive consumer; page-context tests và AI Chat E2E pass.

### Step 4: Khóa regression Meal Plan bằng test RED

Thêm integration cases:

- user authenticated không có Order vẫn create/revise/archive plan của mình;
- user có Order approved còn buổi nhưng chưa có `trainerId` vẫn save thành công và snapshot trainer nullable;
- outsider vẫn không đọc/sửa được; guest vẫn 401; thiếu CSRF vẫn 403;
- feature flag, canonical Food, idempotency, conflict và immutable revision giữ nguyên;
- trường hợp đúng như ảnh production không còn trả `TRAINER_ASSIGNMENT_REQUIRED`.

**Behavior**: quyền lưu phụ thuộc authenticated ownership, không phụ thuộc trainer assignment.

**Blast radius**: `savedMealPlan.integration.test.js` và access resolver tests liên quan.

**Verify**: case không có trainer phải fail trên code hiện tại với `409` trước khi sửa.

### Step 5: Tách Saved Meal Plan khỏi Journal access resolver

Thay `resolveSavedMealPlanWriteAccess()` bằng resolver riêng cho personal save. Resolver có thể lấy trainer hiện
tại theo hướng optional để điền metadata khi có, nhưng tuyệt đối không fail khi không có Order/trainer. Create,
revise và archive tiếp tục chạy trong ownership/transaction hiện có. Không sửa model vì
`trainerIdAtCreation` đã nullable.

Retention hiện tại không đổi trong hotfix. Việc tách retention của thực đơn cá nhân khỏi lifecycle coaching là
một product/privacy decision riêng nếu sau này cần giữ vô thời hạn.

**Behavior**: save thành công cho user thường và user chưa được gán HLV; dữ liệu cũ tương thích ngược.

**Blast radius**: `savedMealPlanAccess.service.js`, `savedMealPlan.service.js`, focused tests và spec.

**Verify**: full Saved Meal Plan command/privacy suites; không có migration hoặc document write thật.

### Step 6: Việt hóa luồng lưu và chuẩn hóa lỗi cho khách hàng

Thay copy tiếng Việt theo ngôn ngữ sản phẩm, ví dụ:

- “Lưu thực đơn hiện tại để xem lại và dùng khi cần.”
- “Thay bằng thực đơn hiện tại” thay cho diễn giải version.
- “Bỏ lưu” thay cho action `archive` ở UI.
- “Không thể lưu thực đơn lúc này. Vui lòng thử lại.” cho lỗi tạm thời.

Ẩn số version khỏi presentation nhưng tiếp tục gửi `expectedVersion` nội bộ. Frontend map `code` allowlist sang
i18n copy và không render raw backend message cho customer-facing errors. Locale tiếng Anh vẫn dùng câu tiếng
Anh tự nhiên khi user chọn EN.

**Behavior**: không còn thuật ngữ kỹ thuật hoặc lỗi vận hành trong UI; retry và accessibility state giữ nguyên.

**Blast radius**: `SavedMealPlans.jsx`, locale `vi/en`, focused presentation tests, controller error contract.

**Verify**: text assertions không chứa `snapshot|version|archive|requestId|meal plan` trong locale/UI tiếng Việt;
manual responsive/keyboard check trên Meal Plan.

### Step 7: Cập nhật catalog F0 theo evidence

Sau khi behavior đã pass, cập nhật `communityFeatureCatalog.js` và service-access policy:

- HT Assistant F0: stream continuity, không mất kết quả quota, manual-open UX.
- Meal Plan F0: save reliability/access policy và copy dễ hiểu.
- Meal Scan F1: journal integration + real-world accuracy evidence là phase riêng.

Không biến catalog thành nguồn telemetry và không trộn priority roadmap vào quota registry.

**Behavior**: bảng Admin giải thích đúng việc cần làm và mức ưu tiên có căn cứ.

**Blast radius**: catalog backend, Admin API/presentation tests và `docs/specs/service-access-policy.md`.

**Verify**: service access policy integration + presentation tests; filter `Nhóm` giữ nguyên.

### Step 7A: Ghi lịch sử kết quả xử lý có ngày và trạng thái

Mở rộng catalog read-only bằng `deliveryUpdates` theo từng tính năng. Mỗi update có key ổn định, mô tả ngắn, status
canonical và `statusDate` dạng `YYYY-MM-DD`; UI format thành `dd/MM/yyyy` và fail closed khi status/date không hợp lệ.
Thêm đúng một cột `Kết quả xử lý`, không tạo database/migration và không biến endpoint Admin thành mutation.

HT Assistant và Meal Plan tiếp tục giữ F0 cho tới khi các hạng mục tương ứng được xác minh production. Khi triển khai local,
chỉ ghi trạng thái cao nhất có evidence thật; không gắn nhãn production dựa trên code local.

**Behavior**: Admin thấy từng hạng mục đã code/test/deploy vào ngày nào; row không có update hiển thị trạng thái trống rõ ràng.

**Blast radius**: catalog backend, presentation helper/table, API + client tests và service-access policy spec.

**Verify**: API contract trả status/date canonical; presentation test format date và fail closed; bảng giữ filter Nhóm.

### Step 8: Khôi phục admin làm HLV mặc định theo config explicit

Viết regression test cho resolver qua command/service seam: ID hợp lệ được ưu tiên; khi ID không được cấu hình thì
`ADMIN_EMAIL` resolve đúng user role `admin`; ID đã cấu hình nhưng invalid/missing user và email không trỏ admin đều fail
closed bằng stable code. Bổ sung production-readiness validation để ít nhất một cấu hình định danh admin mặc định rõ ràng,
nhưng không query ngẫu nhiên và không ghi Order thật.

**Behavior**: nghiệp vụ coaching có Order chưa gán trainer vẫn dùng đúng admin canonical; cấu hình sai bị chặn trước release.

**Blast radius**: `trainingScheduleCommand.service.js`, helper resolver mới nếu cần, `productionReadiness.js`, focused tests và
release checklist.

**Verify**: focused server service/config tests pass; Saved Meal Plan no-Order test vẫn pass độc lập.

### Step 9: Thu hẹp sitemap và trả true 404 theo 8 bước SEO

1. Tạo `404.html` noindex và final fallback HTTP 404 cho URL không tồn tại/đã xóa.
2. Thay broad SPA fallback bằng allowlist rewrite cho app route thật; giữ redirect legacy trước các rewrite.
3. Sinh sitemap index trỏ tới core, blog/story/trainer và recipe sitemap riêng.
4. Không đưa toàn bộ recipe `isPublished` vào sitemap.
5. Dùng manifest repo-native tuyển chọn 20–50 recipe slug; build strict fail nếu slug tuyển chọn không tồn tại.
6. Chỉ công bố recipe đã có nội dung cơ bản phục vụ người đọc; ghi phần macro/HLV review/source nâng cao là follow-up nếu
   dữ liệu hiện tại chưa có, không bịa dữ liệu SEO.
7. Tách internal prerender manifest khỏi sitemap: vẫn prerender mọi public URL hợp lệ để direct access không bị 404,
   nhưng chỉ submit tập URL tuyển chọn; test URL tốt, URL đã xóa và URL giả.
8. Chỉ chạy/validate GSC sau deploy khi live HTTP evidence đạt; lượt local ghi live mode là `SKIP`.

**Behavior**: crawler nhận đúng sitemap nhỏ có chủ đích; URL giả không còn homepage `200`; app route hợp lệ vẫn refresh được.

**Blast radius**: sitemap/prerender scripts và tests, `_redirects`, static 404 asset, robots và SEO operations note.

**Verify**: script unit tests + static sitemap/redirect checks + client production build; rendered check trên local dist nếu
browser/runtime sẵn sàng.

### Step 10: Re-trace, QA và release gate

Chạy impact re-trace cho AI SSE, quota metadata, Saved Meal Plan consumers/privacy và catalog Admin. Thực hiện
AI check, UI check, code review, cleanup, full unit/build/security gates; chỉ kết luận sẵn sàng staging khi mọi
gate bắt buộc pass. Deploy là thao tác riêng sau đó.

## Verification Commands

| Mục đích | Lệnh | Kỳ vọng |
|---|---|---|
| AI client focused | `npm run test:unit:client -- --run src/components/ChatWidget src/config/__tests__/aiPageContext.test.js` | exit 0 |
| AI E2E | `npx playwright test e2e/ai-chat.spec.js` | delayed SSE switching pass |
| Saved Meal Plan server | `npm run test:unit:server -- --run src/controllers/__tests__/savedMealPlan.integration.test.js src/controllers/__tests__/savedMealPlan.privacy.integration.test.js` | exit 0 |
| Admin policy focused | `npm run test:unit:client -- --run src/pages/admin/service-access-policies` và `npm run test:unit:server -- --run src/routes/__tests__/serviceAccessPolicy.routes.integration.test.js` | exit 0 |
| Default admin | `npm run test:unit:server -- --run src/services/__tests__/defaultAdminTrainer.service.test.js src/config/__tests__/productionReadiness.test.js` | ID precedence, email fallback và fail-closed pass |
| SEO scripts | `npm run test:unit:client -- --run scripts/__tests__/prerender-routes.test.js scripts/__tests__/seo-redirects.test.js scripts/__tests__/sitemap.test.js` | sitemap split/curation/404 contract pass |
| AI contracts | `node .agents/scripts/validate-tools.mjs` | all tools valid |
| Full unit | `npm run test:unit` | exit 0 |
| Client lint/build | `npm run lint --prefix client` và `npm run build --prefix client` | exit 0 |
| Security | `npm run security:secrets` và `npm run security:data-boundaries` | exit 0 |
| Agent docs | `npm run agents:validate` | exit 0 |
| Diff hygiene | `git diff --check` | không có whitespace error |

## Done Criteria

- [ ] Đổi conversation không abort stream cũ; quay lại thấy response hoàn chỉnh đúng conversation.
- [ ] Quota giảm đúng một lần cho request và không còn trường hợp navigation làm mất response.
- [ ] Stop/delete/new conversation có semantics rõ và không tác động nhầm stream khác.
- [ ] Sidebar hiển thị spinner cho đúng mọi conversation pending, kể cả conversation mới; spinner tắt đúng stream.
- [x] Không còn proactive nudge; launcher và suggestions thủ công hoạt động bình thường theo static review.
- [ ] User authenticated không có Order/trainer vẫn create/revise/archive Saved Meal Plan của chính mình.
- [ ] Auth, CSRF, IDOR, canonical nutrition, idempotency, version conflict và privacy tests vẫn pass.
- [x] UI tiếng Việt không lộ thuật ngữ kỹ thuật hoặc raw backend error.
- [x] Catalog F0/F1 phản ánh evidence đã duyệt và không làm thay đổi quota runtime.
- [x] Bảng Admin có cột `Kết quả xử lý`, ngày `dd/MM/yyyy` và không gọi local-only là đã xác minh production.
- [x] Admin canonical có ID precedence, email fallback, role check và config sai fail closed trong code/static checks.
- [x] Saved Meal Plan vẫn lưu được khi resolver HLV mặc định không khả dụng.
- [x] Sitemap được tách, recipe giới hạn tối đa 30 URL tuyển chọn và strict prerender đọc manifest riêng.
- [x] Static routing kết thúc bằng true 404 và chỉ rewrite app route đã biết; live GSC được ghi SKIP cho tới sau deploy/quyền truy cập.
- [x] Focused tests, full unit, lint/build, AI/security/agent gates có evidence thật.
- [x] Không deploy, migration, production write hoặc chỉnh secret trong implementation local.

## Execution evidence — 2026-08-10

- Release re-validation sau khi mở quyền local: build PASS, prerender 785/785, bundle budget PASS; client 328/328,
  server 606/606 và Chromium E2E 78/78 PASS.
- E2E RED đã phát hiện fixture SSE thiếu ranh giới event và Admin flex item thiếu `min-w-0`; hai root cause được sửa tối thiểu,
  focused E2E GREEN rồi full E2E GREEN.
- Security release gates PASS: secret scan, repository data boundary, client/server dependency audit, runtime logging,
  commercial contract, 18 ops tests và `git diff --check`; Codex security ở mức preflight-only theo policy.
- AI check PASS: 35 file bắt buộc tồn tại, 11 tools hợp lệ/không orphan; prompt/provider/tool/quota/ownership không đổi.

- Spinner/catalog bổ sung: scoped client ESLint PASS; Node contract checks PASS cho pending conversation IDs,
  format ngày delivery và catalog history; server/E2E syntax cùng `git diff --check` PASS.
- AI check bổ sung: 35 file bắt buộc tồn tại, prompt/moderation static contract giữ nguyên và validator PASS 11 tools,
  không orphan. Threat matrix: UI pending state không đổi prompt/provider/tool/output/quota/ownership; LLM02/LLM10
  giữ guard hiện có và không mở trust boundary mới.
- UI check phạm vi `ChatPanelSidebar` + `CommunityFeatureTable`: không thêm AI-slop pattern; spinner có accessible status,
  reduced motion và màu product; bảng semantic, dùng `Intl.DateTimeFormat` UTC và giữ horizontal overflow. Rendered check BLOCKED vì build không chạy được.
- Scoped ESLint: PASS cho AI hook, Meal Plan, Recipe và SEO scripts.
- AI tool validator: PASS, 11 tools, không orphan.
- Agent instruction validator: PASS, 28 skills, 0 warning.
- Static/node contracts: PASS cho session registry, admin selector/readiness, catalog priority, locale JSON, split sitemap,
  scoped Netlify rewrites, final 404 và `git diff --check`.
- Lần chạy sandbox ban đầu: client/server Vitest bị chặn trước test vì Vite config loader không spawn được (`EPERM`); runner fallback không
  tương thích CommonJS dependency (`require is not defined`).
- Lần chạy sandbox ban đầu: release build bị chặn bởi `@tailwindcss/oxide` native binding và Vite `spawn EPERM`; prebuild sitemap
  vẫn chạy thành công ở non-strict fallback.
- Lần chạy sandbox ban đầu: Playwright E2E bị chặn bởi browser/server `spawn EPERM`.
- Lần chạy sandbox ban đầu: official secret/data-boundary wrappers không spawn được `git`; manual added-line secret pattern scan PASS.
- Lần chạy lại official secret/data-boundary ngày 2026-08-10 vẫn BLOCKED bởi `spawnSync git EPERM`/không enumerate được tracked files;
  không có secret hoặc dữ liệu người dùng được thêm trong spinner/catalog diff theo code review.
- Rendered SEO/UI và live GSC: SKIP vì build/browser bị chặn, chưa deploy và chưa có GSC property access.

## STOP Conditions

- Cần hoàn quota hoặc đổi commercial quota ngoài registry canonical.
- Cần background generation sống qua reload/đóng tab.
- Cần thêm field/model để persist Meal Scan hoặc đổi Daily Journal schema.
- Cần migration/backfill/retention cleanup trên dữ liệu thật.
- AI/Saved Meal Plan/SEO files xuất hiện concurrent diff không thuộc task và không thể tích hợp an toàn.
- Cần thay đổi schema recipe hoặc bịa macro/HLV review để đủ điều kiện SEO; khi đó tách thành spec/schema plan riêng.
- Cùng verification fail ba vòng sau các sửa có căn cứ.
