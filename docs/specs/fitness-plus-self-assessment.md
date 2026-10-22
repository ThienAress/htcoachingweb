# Spec: Đánh giá bản thân cho HT Fitness+

Trạng thái: **đã chốt, đã triển khai trên working tree theo [Plan 111](../plans/111-launch-fitness-plus-self-assessment.md)** (chưa rollout). Bổ sung cho [HT Fitness+](./ht-fitness-plus.md) và
[Customer notifications và self-managed dashboard](./customer-notifications-and-fitness-dashboard.md).

## Assumptions

1. Người dùng đích là HT Fitness+ Member (`accessMode = self_managed`): đã biết tập, không có HLV.
2. Đánh giá do chính họ nhập và thực hiện; hệ thống chỉ chấm điểm bằng bộ luật tất định, **không gọi AI** ở bản đầu.
3. Không tái dùng `F1Customer`/`F1Intake`/`F1Assessment` (CRM gắn `assignedTrainerId`, toàn bộ route là `requireTrainerAccess`).
   Dùng model riêng; chỉ tái dùng luật sàng lọc thuần của F1 (`buildSystemFlags` ở `server/src/controllers/f1Customer/intake.helpers.js:84`).
4. Dữ liệu là dữ liệu sức khỏe nhạy cảm: chỉ chủ tài khoản đọc được; HLV/admin không đọc (khớp spec self-managed dòng 158).
5. Coaching Customer vẫn dùng F1 do HLV thực hiện; mục này không xuất hiện cho họ. Người vừa có Coaching vừa có Fitness+ được
   `customerDashboardAccess` xếp `coaching` nên không thấy mục này.

## Objective

Cho HT Fitness+ Member một mục **"Đánh giá bản thân"** trong sidebar dashboard để tự khảo sát sức khỏe, nhập số đo, tự kiểm tra thể
lực an toàn và nhận mức thể lực cùng gợi ý giai đoạn bắt đầu. Đây là quyền lợi giá trị nhất của gói không có HLV, và là nguồn
dữ liệu nền cho Tiến trình.

Thành công khi một Fitness+ Member hoàn tất đánh giá trong một phiên (~10–15 phút), thấy kết quả dễ hiểu bằng tiếng Việt, không bị
đẩy vào bài test không an toàn, và có thể làm lại sau 4 tuần để so sánh.

## Product contract

### Vị trí và quyền truy cập
- Mục sidebar "Đánh giá bản thân" (key `selfAssessment`), route `/dashboard/self-assessment`; chỉ hiện khi `accessMode === "self_managed"`.
- `coaching` và `blocked`: API trả 403 mã ổn định; người `blocked` mở thẳng URL thấy thẻ mời mua gói (cùng CTA `/?plan=fitness-plus#pricing`).
- Ba mục Dinh dưỡng, Nhật ký, Tiến trình đã mở theo `accessMode`; spec này không đổi gating của chúng.

### Luồng 4 bước (lưu nháp từng bước, tiếp tục được)
1. **Sàng lọc sức khỏe**: đau hiện tại (vị trí, mức 0–10), chấn thương, bệnh nền, phẫu thuật, thuốc, khuyến cáo của bác sĩ,
   dấu hiệu cảnh báo (đau ngực, chóng mặt, khó thở khi gắng sức...). Cần chấp thuận lưu dữ liệu (`allowDataStorage`).
2. **Hồ sơ và số đo**: tuổi, giới tính, chiều cao, cân nặng, vòng eo/hông, nhịp tim nghỉ, kinh nghiệm, số buổi/tuần, mục tiêu
   (`fat_loss | weight_gain | muscle_gain | maintenance`), mức vận động công việc, giấc ngủ, nước, stress.
3. **Tự kiểm tra thể lực** (chỉ khi được phép, xem "Cổng an toàn"): mỗi nhóm tối đa 3 bài, có hướng dẫn, khách nhập kết
   quả bằng số. Nhóm: sức mạnh thân trên/thân dưới/core, sức bền cơ bắp, tim phổi. **Không có upload ảnh/video/file** và không có
   nhóm đánh giá tư thế bằng ảnh. Tên bài tập luôn tiếng Anh (Wall Push-Up, Goblet Squat...).
4. **Kết quả**: mức thể lực tổng và từng nhóm, điểm mạnh/cần cải thiện, giai đoạn bắt đầu gợi ý ("Giai đoạn 1: Anatomical
   Adaptation") **kèm liên kết tới thư viện bài tập** (`/exercises`, xác nhận route khi lập plan), lưu ý an toàn và liên kết tới
   Dinh dưỡng/Tiến trình. **Không có dự đoán kết quả (forecast/prediction)**: tính năng đó chỉ dành cho khách có gói HLV.

### Cổng an toàn (khác F1: không có HLV duyệt)
Server tính bằng `buildSystemFlags` (ngưỡng đau: 1–4 nhẹ, 5–6 vừa, ≥7 nặng; hold khi có dấu hiệu cảnh báo hoặc khuyến cáo bác sĩ):
| Kết quả sàng lọc | Hành vi |
|---|---|
| `full_test` | Làm đủ các bài |
| `modified_test` (đau ≥5, bệnh nền, phẫu thuật, lâu không tập) | Chỉ bài biến thể nhẹ, có cảnh báo; không có bài cường độ cao |
| `hold_test` | Không cho làm bài test; hiện khuyến nghị gặp bác sĩ/HLV trước khi tập. Khách **không tự mở khóa**; làm lại sàng lọc mới đổi được |
- Khách không có quyền "duyệt" `reviewDecision`; không có trường reviewDecision trong model mới.
- Giá trị nhập vô lý (nhịp tim, số lần quá cao) bị validate ở server theo khoảng hợp lý và từ chối; số liệu đáng ngờ nhưng hợp lệ
  được đánh dấu để hỏi lại, không chặn.

### Tần suất làm lại (khuyến nghị mềm, không chặn cứng)
- Mỗi người một đánh giá `draft` đang mở. Sau `completed`, vào lại mục này khách thấy kết quả gần nhất cùng lời nhắc:
  "Nên làm lại sau 28 ngày để so sánh tiến bộ."
- Nếu bấm "Làm lại" trước `nextEligibleAt`, hiện hộp xác nhận (dùng `useConfirmDialog`, không `window.confirm`) nêu ngày khuyến nghị; khách
  đồng ý thì vẫn được tạo bản mới. Sau/đúng hạn thì không cần xác nhận.
- Số ngày khuyến nghị (28) là hằng số ở registry policy, không hardcode ở client; server trả `nextEligibleAt` và `isEarly`.
  Server vẫn chống spam bằng rate limit riêng và đúng một `draft` mở, nhưng không từ chối làm lại sớm.
- Các bản `completed` cũ giữ lại để so sánh ở Tiến trình. Không chiếm credit AI.

### Gói hết hạn: chỉ đọc
- Khi không còn Fitness+ active, khách vẫn xem lại các bản `completed` và nháp đã có, **không tạo/sửa/xóa/làm lại** (UI ẩn mọi nút ghi,
  server trả 403 mã ổn định cho mọi method ghi). Nháp dở dang chỉ xem, không tiếp tục được; gia hạn gói thì mở lại.
- Vì `accessMode` của người hết hạn là `blocked`, đường đọc chỉ kiểm `ownership` (`userId = req.user._id`), không kiểm entitlement.
  Mục sidebar hiện cho người hết hạn **có ít nhất một bản đánh giá**: server trả thêm cờ (ví dụ `hasSelfAssessmentHistory`) trong
  `prompt-eligibility`; người chưa từng làm và `blocked` không thấy mục này. Chi tiết chốt ở plan.
- Không xóa tự động dữ liệu khi hết hạn (retention/xóa cần spec riêng theo `security.md`).

### Mục tiêu bước chân/nước/ngủ (thay phần HLV đặt)
- Self-managed tự đặt mục tiêu; hệ thống gợi ý mặc định từ cân nặng, mức vận động và mục tiêu trong đánh giá (nếu chưa có thì dùng mặc định chung).
- Lưu tách khỏi target của HLV (`createdByRole: "user"`), nhãn "Đã lưu", không có "Đã gửi HLV".
- Thay "kiểm tra chéo" bằng cảnh báo hợp lý trong Tiến trình: giá trị bất thường (ví dụ bước chân quá lớn) và thiếu dữ liệu nhiều ngày liên tiếp.
- Chi tiết triển khai ở PR riêng sau khi spec này được duyệt; spec `wellness-targets.md` sẽ được cập nhật khi đó.

## Tech Stack liên quan
Express 5 + Mongoose 9 (route → controller → service → model), React 19 + TanStack Query + React Hook Form + Zod,
`RoundedSelect` cho mọi ô chọn, `getUserErrorMessage`/`sendApiError` cho lỗi.

## Commands
- `npm run test:unit:server`, `npm run test:unit:client`, `npm run lint --prefix client`
- `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high`
- `npm run test:e2e` (cần dev servers), `npm run agents:inventory` khi thêm/xóa test, `npm run security:secrets`

## Cấu trúc file bị ảnh hưởng (dự kiến)
**Backend (tạo mới)**: `models/FitnessSelfAssessment.js`, `services/fitnessSelfAssessment.service.js` (+ scoring tách file),
`controllers/fitnessSelfAssessment.controller.js`, `routes/fitnessSelfAssessment.routes.js`, validation thêm cuối
`middlewares/validation.js`, mount ở `server.js`.
**Backend (sửa)**: `constants/serviceAccessPolicies.js` (service key `self_assessment`, số ngày khuyến nghị làm lại; mọi tier Fitness+ dùng
chung quyền lợi ở bản đầu), `services/todayDashboard.service.js` (cờ lịch sử cho `prompt-eligibility`), controller Admin
`service-access-policies` và trang Admin "Quyền & hạn mức" (thêm hàng "Đánh giá bản thân" cho ba tier Fitness+; client không hardcode).
`customerDashboardAccess.service.js` chỉ để tái dùng, không đổi.
**Client (tạo mới)**: `pages/self-assessment/*`, `services/fitnessSelfAssessment.service.js`, `queries/fitnessSelfAssessment.queries.js`.
**Client (sửa)**: `layouts/CustomerDashboardLayout.jsx` (`NAV_ITEMS`, `getNavItems`), `utils/customerDashboardNavigation.js`,
`App.jsx` (route lazy), `pages/today-dashboard/__tests__/selfManagedDashboard.test.js` (test đọc source-string).
**Tài liệu**: `docs/README.md`, `docs/specs/wellness-targets.md` (PR mục tiêu).

### Schema `FitnessSelfAssessment` (collection mới, không migration dữ liệu cũ)
- `userId` (ref User, index), `status` (`draft|completed`), `draftStep` (1–4), `completedAt`, `nextEligibleAt`.
- `screening`, `profile`, `metrics`, `training`: cấu trúc theo `F1Intake` nhưng không có `customerInfo` phone/email và không có `reviewedBy`.
- `systemFlags` (`painFlag`, `medicalReviewFlag`, `testPermission`, `recommendedStartPhase`) do server tính, client không gửi.
- `tests.<metric>[]` tối đa 3 bài mỗi nhóm; `result` (`overallLevel`, `metricLevels`, `strengths`, `focusAreas`).
- `consent.allowDataStorage` + thời điểm; không có `allowAiAnalysis` vì không dùng AI, không có `postureMediaSummary` vì không upload media.
- Index dự kiến: `{ userId, status, createdAt: -1 }`; **partial unique** `{ userId }` với `status: "draft"` để đúng một nháp mở.
  Production tắt `autoIndex`: cần migration guarded như `20260817-fitness-plus-subscription-indexes.js`, không tự chạy khi deploy.

### Endpoint (kiểm theo `.claude/rules/api-design.md` và `apiNaming.contract.test.js`)
`GET /api/fitness-self-assessments/me/latest`, `PUT /api/fitness-self-assessments/me/draft`,
`POST /api/fitness-self-assessments/me/submit`, `GET /api/fitness-self-assessments/me` (lịch sử, phân trang có giới hạn).
Tên cụ thể chốt khi lập plan. Mọi endpoint: `protect` + CSRF; ownership theo `req.user._id`, không nhận `userId` từ client.
Endpoint ghi (`PUT`, `POST`) chỉ cho `self_managed`; endpoint đọc cho chủ bản ghi kể cả khi gói đã hết hạn (xem "Gói hết hạn: chỉ đọc").
Không có endpoint upload.

## Code Style
Giữ pattern hiện có; validation express-validator, allowlist field (không spread `req.body`), response `{ success, data | message }`,
log bằng `safeLog` allowlist metadata (không log payload sức khỏe). File mới < 300 dòng, tách scoring khỏi service.
UI: tiếng Việt, thuật ngữ "Tiếng Việt (English)", một cặp ngoặc, không lặp thông tin giữa tiêu đề/phụ đề/thân.

## Testing Strategy
- Server integration: ghi chỉ `self_managed`; `coaching`, `blocked`, trainer, admin bị 403 khi ghi; người hết hạn đọc được bản của mình nhưng mọi
  method ghi trả 403; IDOR (user A không đọc/ghi bản của B); hold_test chặn nhập bài test; submit khi thiếu bước bị từ chối;
  làm lại sớm trả `isEarly` nhưng vẫn tạo được; không nhận field `systemFlags` từ client; không có route/field upload.
- Server unit: bảng quyết định cổng an toàn và chấm điểm với ví dụ tính tay (expected value từ literal, không tính lại bằng công thức của code).
- Client: render từng bước, trạng thái loading/empty/error/disabled, focus lỗi validate, không có `<select>` gốc, không lộ enum thô.
- E2E: mock-api thêm `self_managed`; flow nháp → submit → kết quả; ẩn mục với `coaching`/`blocked`.
- Ghi rõ `NOT RUN`/`BLOCKED` cho lệnh chưa chạy.

## Boundaries
- Always: kiểm quyền và ownership ở backend; validate mọi input; giữ CSRF/rate limit; thêm rate limit riêng cho submit/draft;
  đọc model thật trước khi dùng field; chạy `impact-check`, `schema-change`, `service-access-policy` trước khi code.
- Ask first: schema mới và migration index production; thêm dependency; thêm bài test mới ngoài danh sách; cho HLV/admin đọc dữ liệu.
- Never: để HLV/admin đọc đánh giá self-managed; dùng AI/gửi dữ liệu sức khỏe ra dịch vụ ngoài; cho khách tự đổi cờ an toàn; hiển thị
  enum thô; log raw payload; tự chạy migration/seed/ghi dữ liệu thật.

## Success Criteria
1. Fitness+ Member thấy mục "Đánh giá bản thân"; Coaching/trainer/admin không thấy; API ghi trả 403 với thông báo tiếng Việt thân thiện cho người không đủ quyền.
2. Hoàn tất 4 bước ghi một bản `completed`; nháp khôi phục đúng bước sau khi tải lại trang.
3. Sàng lọc `hold_test` không bao giờ cho lưu kết quả bài test; kết quả hiển thị khuyến nghị an toàn.
4. Không có endpoint nào trả dữ liệu của người khác (test IDOR pass); không có đường upload file.
5. Làm lại trước ngày khuyến nghị hiện hộp xác nhận nêu ngày; đồng ý thì tạo được bản mới.
6. Gói hết hạn: xem lại được bản cũ, mọi thao tác ghi bị chặn cả ở UI và server.
7. Kết quả có liên kết tới thư viện bài tập; không có dự đoán kết quả.
8. Trang Admin "Quyền & hạn mức" có hàng "Đánh giá bản thân" lấy từ registry.
9. UI regression gate không phát sinh finding mới mức cao; test server/client liên quan pass.

## Requirements và Acceptance Criteria (máy đọc qua traceability của Plan 111)

### REQ-001 — Truy cập và luồng đánh giá
- AC-001: Fitness+ Member thấy mục "Đánh giá bản thân"; Coaching/trainer/admin không thấy và API ghi trả 403 với thông báo tiếng Việt thân thiện.
- AC-002: Hoàn tất 4 bước ghi một bản `completed`; nháp khôi phục đúng bước sau khi tải lại trang.

### REQ-002 — Cổng an toàn
- AC-003: Sàng lọc `hold_test` không bao giờ cho lưu kết quả bài test và client không tự đổi được cờ an toàn; kết quả hiển thị khuyến nghị an toàn.

### REQ-003 — Dữ liệu, làm lại và hết hạn
- AC-004: Không endpoint nào trả dữ liệu của người khác (IDOR), trainer/admin không có đường đọc, và không có đường upload file.
- AC-005: Làm lại trước ngày khuyến nghị hiện hộp xác nhận nêu ngày; đồng ý thì tạo được bản mới.
- AC-006: Gói hết hạn: xem lại được bản cũ, mọi thao tác ghi bị chặn cả ở giao diện lẫn server.

### REQ-004 — Kết quả, policy và chất lượng
- AC-007: Kết quả có mức thể lực, giai đoạn bắt đầu và liên kết `/exercises`; không có dự đoán kết quả.
- AC-008: Trang Admin "Quyền & hạn mức" có hàng "Đánh giá bản thân" lấy từ registry.
- AC-009: UI regression gate không phát sinh finding mới mức cao; test server/client liên quan và inventory pass.

## Quyết định đã chốt (user, 2026-10-21)
1. Làm lại: khuyến khích sau 28 ngày, nếu khách vẫn đồng ý thì cho làm lại (khuyến nghị mềm, không chặn cứng).
2. Không upload file/ảnh; dự đoán kết quả chỉ dành cho khách có gói HLV.
3. Gợi ý giai đoạn bắt đầu có liên kết tới thư viện bài tập.
4. Có policy dịch vụ riêng hiển thị ở Admin "Quyền & hạn mức".
5. Gói hết hạn: chỉ đọc, không thêm/sửa/xóa.

## Chốt thêm khi lập plan ([Plan 111](../plans/111-launch-fitness-plus-self-assessment.md))
- Link thư viện bài tập là `/exercises` thuần (trang không lọc theo URL); gợi ý bài là danh sách cố định theo nhóm cần cải thiện, tên bài tiếng Anh.
- Cờ lịch sử là `hasSelfAssessmentHistory` trong `prompt-eligibility`, dùng lại queryKey hiện có, không tạo query mới.

## Open Questions còn lại
- Bảng chuẩn thể lực đã được chốt theo nguồn đã công bố (xem Plan 111); plank là mốc thực dụng chưa phải chuẩn quần thể và nên được chuyên gia thể chất xem lại trước khi mở rộng.
