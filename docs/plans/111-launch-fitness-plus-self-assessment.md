# Plan 111: Launch Đánh giá bản thân cho HT Fitness+

> **Hướng dẫn thực thi**: Làm tuần tự từng step. Chạy mọi verification command và xác nhận kết quả mong đợi trước khi
> sang step kế tiếp. Gặp STOP condition thì dừng và báo cáo, không improvise.
>
> **Drift check (chạy đầu tiên)**: `git diff --stat` và `git log -5 --oneline` cho các file in-scope; so các excerpt ở
> "Current State" với code thật. Không khớp thì STOP.

Spec canonical: [`docs/specs/fitness-plus-self-assessment.md`](../specs/fitness-plus-self-assessment.md) (đã chốt 5 câu hỏi mở).

## Status

- **Priority**: P1
- **Complexity**: COMPLEX
- **Effort**: L
- **Risk**: MED (schema mới + dữ liệu sức khỏe + chạm sidebar/policy; không chạm Auth/Payment/Wallet)
- **Depends on**: plan HT Fitness+ đã live (052, 054)
- **Category**: feature
- **Planned at**: 2026-10-21
- **Lifecycle**: IN PROGRESS
- **Verification**: FOCUSED
- **Rollout**: NOT STARTED
- **Owner**: root
- **Updated at**: 2026-10-21

## Tiến độ thực thi (2026-10-21)

Step 1-8 đã làm trên working tree, chưa commit và chưa rollout. Bằng chứng kiểm chứng ở mục "Kết quả kiểm chứng" cuối file.

## Why This Matters

HT Fitness+ bán cho người đã biết tập nhưng không có HLV, nên không có F1 (trainer-only) để biết mình đang ở mức nào. Mục
"Đánh giá bản thân" cho họ tự khảo sát an toàn, tự kiểm tra thể lực và nhận mức thể lực cùng gợi ý bắt đầu, là quyền lợi nổi
bật nhất của gói. Sai lầm đắt giá nhất là cho người có cờ y tế làm bài test nặng, nên cổng an toàn phía server là phần cốt lõi.

## Current State

- Phân quyền: `server/src/services/customerDashboardAccess.service.js:10-33` trả `accessMode` = `coaching | self_managed | blocked`
  (trainer/admin → `blocked`; coaching thắng Fitness+). `FITNESS_PLUS_TIERS` ở `server/src/constants/serviceAccessPolicies.js:11-13`.
- `server/src/services/todayDashboard.service.js:24-34` `getTodayProgressPromptEligibility` trả `{eligible, accessMode, hasActiveCustomerPlan, hasCoaching}`; client đọc qua `getTodayProgressPromptEligibility()`
  (`client/src/services/todayDashboard.service.js:6`) với queryKey `["today-dashboard","prompt-eligibility",user._id]`
  (dùng ở `CustomerDashboardLayout.jsx:115-122`, `Pricing.jsx`, `Header.jsx`).
- Sidebar: `client/src/layouts/CustomerDashboardLayout.jsx` — `NAV_ITEMS` (dòng 31-37), `getNavItems(accessMode)` (48-51 chỉ ẩn
  "training"), `CustomerNav` (53-105) dùng 3 lần (desktop, mobile `compact`, thanh nổi). Test đọc source-string
  `client/src/pages/today-dashboard/__tests__/selfManagedDashboard.test.js:18` kiểm `accessMode === "coaching" || item.key !== "training"`.
- Route: `client/src/App.jsx:192-241` nhóm `/dashboard` (`AuthenticatedRoute > TodayPlatformRoute > CustomerDashboardLayout`);
  `client/src/utils/customerDashboardNavigation.js` có `dashboardPathFor`, `dashboardSectionFromPath`.
- Registry policy: `server/src/constants/serviceAccessPolicies.js` — mỗi dịch vụ có `serviceKey`, `label`, `category`, `description` và `policies` theo 8 tier
  (`guest`, `user`, `coaching_customer`, `trainer`, `admin`, `fitness_plus_essential`, `fitness_plus_smart`, `fitness_plus_max`)
  (mẫu `tdee` ~dòng 259: `unlimited()`; `practice_email` dùng `unavailable()`). Test: `server/src/services/__tests__/serviceAccessPolicy.test.js`.
  Trang Admin "Quyền & hạn mức" render từ `GET /api/admin/service-access-policies`.
- F1 (chỉ để tham chiếu, KHÔNG sửa): `server/src/controllers/f1Customer/intake.helpers.js:84` `buildSystemFlags` (pain ≥7 severe, ≥5 moderate,
  ≥1 mild; `holdReasons` → `hold_test`; pain ≥5 / bệnh nền / phẫu thuật / lâu không tập → `modified_test`);
  `assessment.helpers.js` `computeOverallPhysicalLevel` (trung bình rank theo level từng nhóm). Trong F1 level do HLV chọn tay.
- Thư viện bài tập: route `/exercises` (`App.jsx:176`); `ExercisesPage` **không** lọc qua query URL.
- Chuẩn mô hình/route: `.claude/rules/backend.md`, `.claude/rules/security.md`, `.claude/rules/api-design.md`
  (cổng `server/src/routes/__tests__/apiNaming.contract.test.js`), `.claude/rules/frontend.md`.

## Quyết định chốt trong plan (2 điểm nhỏ còn mở ở spec)

1. **Link thư viện bài tập**: trỏ `/exercises` thuần (không query, vì trang không lọc theo URL). Gợi ý bài là danh sách **cố định theo
   nhóm cần cải thiện**, tên bài giữ tiếng Anh, nằm trong constants phía server; không thêm bộ lọc URL vào thư viện (ngoài phạm vi).
2. **Cờ lịch sử**: thêm `hasSelfAssessmentHistory` (boolean) vào kết quả `getTodayProgressPromptEligibility`; client dùng lại đúng queryKey
   `["today-dashboard","prompt-eligibility",userId]`, không tạo query mới.

## Commands You Will Need

| Mục đích | Lệnh (PowerShell, tại root repo) | Mong đợi |
|---|---|---|
| Server test một file | `fnm exec --using=22.23.1 cmd /c "npx vitest run <path> --root server"` | pass |
| Server unit/integration | `fnm exec --using=22.23.1 cmd /c "npm run test:unit:server"` | pass |
| Client unit | `fnm exec --using=22.23.1 cmd /c "npm run test:unit:client"` | pass |
| Lint client | `fnm exec --using=22.23.1 cmd /c "npm run lint --prefix client"` | 0 error |
| UI gate | `fnm exec --using=22.23.1 cmd /c "npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high"` | không finding mới mức cao |
| E2E (cần dev servers) | `fnm exec --using=22.23.1 cmd /c "npm run test:e2e"` | pass |
| Inventory | `npm run agents:inventory` rồi `npm run agents:inventory:check` | đồng bộ |
| Secret/boundary | `npm run security:secrets`, `npm run security:data-boundaries` | pass |

(Cách chạy một file test server: kiểm `server/package.json` trước, dùng đúng script đang có.)

## Scope

**In scope**
- Backend mới: `server/src/models/FitnessSelfAssessment.js`, `server/src/services/fitnessSelfAssessment/` (screening, norms, scoring,
  service), `server/src/controllers/fitnessSelfAssessment.controller.js`, `server/src/routes/fitnessSelfAssessment.routes.js`,
  validation thêm cuối `server/src/middlewares/validation.js`, mount ở `server/server.js`, migration index guarded
  `server/src/migrations/<ngày>-fitness-self-assessment-indexes.js`.
- Backend sửa: `server/src/constants/serviceAccessPolicies.js` (service `self_assessment`), `server/src/services/todayDashboard.service.js`
  (cờ lịch sử), controller/route Admin service-access nếu cần để hiển thị hàng mới.
- Client mới: `client/src/pages/self-assessment/*`, `client/src/services/fitnessSelfAssessment.service.js`,
  `client/src/queries/fitnessSelfAssessment.queries.js`.
- Client sửa: `CustomerDashboardLayout.jsx`, `utils/customerDashboardNavigation.js`, `App.jsx`, `selfManagedDashboard.test.js`,
  `e2e/mock-api.cjs`, trang Admin Quyền & hạn mức nếu cần.
- Docs: `docs/plans/README.md`, `plan-state.json`, `traceability/111.json`, cập nhật status spec.

**Out of scope** (không chạm)
- `F1*` model/route/controller/UI; `client/src/utils/api.js`; Auth/CSRF/JWT; Wallet/Payment.
- Mục tiêu bước chân/nước/ngủ tự đặt + cảnh báo hợp lý: **Plan riêng (112)**, không làm ở đây.
- Upload ảnh/video, AI report/forecast/prediction, thêm bộ lọc URL vào thư viện bài tập, retention/xóa dữ liệu.
- Chạy migration/seed/ghi dữ liệu thật.

## Steps

### Step 1: Thêm policy `self_assessment` và hàng hiển thị ở Admin

Thêm entry vào `SERVICE_ACCESS_POLICY_REGISTRY`: `serviceKey: "self_assessment"`, label "Đánh giá bản thân", category "Công cụ",
`unlimited()` cho ba tier `fitness_plus_*`, `unavailable()` cho `guest, user, coaching_customer, trainer, admin`. Hằng số khuyến nghị làm
lại `SELF_ASSESSMENT_RETEST_DAYS = 28` export từ cùng file (không để client hardcode).

**Behavior**: Admin thấy hàng "Đánh giá bản thân" với ba cột Fitness+ không giới hạn, các cột khác không khả dụng.
**Blast radius**: `serviceAccessPolicies.js`, test `serviceAccessPolicy.test.js`, mọi test/snapshot đếm registry (grep `SERVICE_ACCESS_POLICY_REGISTRY`).
**Depends on**: none.
**Verify**: `npm run test:unit:server` (file `serviceAccessPolicy.test.js` + admin service-access test) pass; trang Admin render hàng mới (client test hiện có pass).

### Step 2: Engine sàng lọc và chấm điểm thuần (không DB, không HTTP)

Tạo `server/src/services/fitnessSelfAssessment/`:
- `screening.js`: `buildSelfScreening({healthScreening, trainingProfileGoal})` → `{painFlag, medicalReviewFlag, testPermission, recommendedStartPhase, holdReasons, cautionReasons}`.
  Dùng **cùng ngưỡng** với `buildSystemFlags` (không import từ controller F1, không sửa F1). Thêm test hợp đồng đối chiếu: cùng bộ fixture chạy qua cả hai hàm, `testPermission/painFlag/medicalReviewFlag` phải trùng.
- `norms.js`: bảng chuẩn từng bài test (số lần/giây/nhịp tim → level theo giới tính và nhóm tuổi), kèm chú thích nguồn trong comment, và danh sách bài mỗi nhóm (tối đa 3, tên bài tiếng Anh) cùng biến thể nhẹ cho `modified_test`.
- `scoring.js`: `scoreMetric`, `computeOverallLevel` (trung bình rank cùng cách `assessment.helpers.js`), `buildFocusAreas`, `buildRecommendation` (giai đoạn bắt đầu + danh sách bài gợi ý cố định theo nhóm cần cải thiện + `libraryPath: "/exercises"`).

**Gate quyết định**: bảng `norms.js` là số liệu thể lực. Trước khi sang Step 3, trình bảng chuẩn cho user duyệt (user hoặc HLV chuyên môn). Chưa duyệt thì dừng ở dạng draft, không ship.

**Behavior**: gọi hàm thuần với input mẫu cho đúng `full/modified/hold` và mức thể lực; mọi bảng quyết định có test.
**Blast radius**: chỉ thư mục mới + test. **Depends on**: none (song song được với Step 1).
**Verify**: `npx vitest run server/src/services/fitnessSelfAssessment` pass; test đối chiếu F1 pass; expected value lấy từ literal ghi tay, không tính lại bằng công thức của code.

### Step 3: API đọc/ghi nháp/submit với quyền đúng và migration index guarded

- Model `FitnessSelfAssessment` theo spec (`userId`, `status`, `draftStep`, `screening`, `profile`, `metrics`, `training`, `systemFlags`, `tests`, `result`,
  `consent`, `completedAt`, `nextEligibleAt`); không có `reviewDecision`, `allowAiAnalysis`, `postureMediaSummary`.
  Index: `{userId,status,createdAt:-1}` và partial unique `{userId}` với `status:"draft"`.
- Routes (chốt tên theo `api-design.md` + chạy `apiNaming.contract.test.js`): `GET /api/fitness-self-assessments/me/latest`,
  `GET /api/fitness-self-assessments/me` (phân trang, `limit` tối đa), `PUT /api/fitness-self-assessments/me/draft`,
  `POST /api/fitness-self-assessments/me/submit`. Tất cả `protect` + CSRF; thêm rate limiter riêng cho ghi.
- Quyền: ghi chỉ `self_managed` (tái dùng `resolveCustomerDashboardAccess`); đọc cho chủ bản ghi kể cả `blocked` đã hết hạn (chỉ lọc `userId = req.user._id`).
  Trainer/admin không có đường đọc. Lỗi theo `sendApiError`, `code` ổn định, message tiếng Việt.
- Draft: allowlist field, không nhận `systemFlags/result/userId/status` từ client; server tính lại `systemFlags` từ screening mỗi lần lưu.
  Khi `hold_test`: từ chối ghi `tests`. Submit: kiểm đủ bước, tính `result`, đặt `completedAt`, `nextEligibleAt = completedAt + SELF_ASSESSMENT_RETEST_DAYS`.
  Tạo mới khi còn trong hạn khuyến nghị: server trả `isEarly: true` trong `latest`, vẫn cho tạo (không chặn).
- Log chỉ bằng `safeLog` với metadata allowlist (id, status, bước), không log payload.
- Migration: file guarded theo mẫu `20260817-fitness-plus-subscription-indexes.js` (preflight + apply cần xác nhận target). **Không chạy.**

**Behavior**: bằng API (Supertest) một Fitness+ Member lưu nháp qua 4 bước, submit và đọc lại kết quả; người hết hạn đọc được nhưng ghi bị 403; user khác không đọc được.
**Blast radius**: backend mới + `server.js` + `validation.js` (thêm cuối file). **Depends on**: Step 1, Step 2 (đã duyệt bảng chuẩn).
**Verify**: `fitnessSelfAssessment.integration.test.js` pass với các case: self_managed ghi OK; coaching/blocked/trainer/admin ghi 403; hết hạn đọc OK ghi 403; IDOR; hold_test chặn tests; submit thiếu bước 400 (mã ổn định); client không đổi được `systemFlags`; không route upload; `apiNaming.contract.test.js` pass.

### Step 4: Mục sidebar, route và cờ lịch sử (vỏ trang chạy được)

- `todayDashboard.service.js`: `getTodayProgressPromptEligibility` thêm `hasSelfAssessmentHistory` (có ít nhất một bản của user; query có `.limit(1)`/`exists`).
- `customerDashboardNavigation.js`: thêm section `selfAssessment` → `/dashboard/self-assessment`; `App.jsx`: route lazy `SelfAssessmentPage` trong nhóm `/dashboard`.
- `CustomerDashboardLayout.jsx`: thêm `NAV_ITEMS` key `selfAssessment` "Đánh giá bản thân"; `getNavItems(accessMode, {hasHistory})` hiện mục khi
  `accessMode === "self_managed"` hoặc (`blocked` và `hasHistory`); cập nhật test source-string `selfManagedDashboard.test.js` cho đúng cú pháp mới. Mobile 5 mục.
- Trang vỏ `SelfAssessmentPage`: loading/empty/error; `self_managed` chưa có bản → thẻ "Bắt đầu đánh giá"; `blocked` có lịch sử → danh sách chỉ đọc kèm thẻ gia hạn
  (CTA `/?plan=fitness-plus#pricing`); `blocked` không lịch sử mở URL trực tiếp → thẻ mời mua gói.

**Behavior**: Fitness+ Member thấy mục và trang vỏ; coaching không thấy; người hết hạn có lịch sử thấy mục ở chế độ chỉ đọc.
**Blast radius**: `CustomerDashboardLayout.jsx`, `customerDashboardNavigation.js`, `App.jsx`, `todayDashboard.service.js` + test.
**Depends on**: Step 3.
**Verify**: `npm run test:unit:client` và `todayDashboard.integration.test.js` pass; thêm test hiển thị mục theo 3 trạng thái; `npm run lint --prefix client`.

### Step 5: Wizard bước 1–2 (sàng lọc + hồ sơ/số đo) với lưu nháp

- Form React Hook Form + Zod theo từng bước; ô chọn dùng `client/src/components/F1/assessment/RoundedSelect.jsx` (bọc `Controller`), không `<select>` gốc.
- Chấp thuận `allowDataStorage` ở bước 1; lỗi inline và focus đúng field; lưu nháp khi bấm "Tiếp tục"; tải lại khôi phục đúng bước (`draftStep`).
- Mutation theo `frontend.md`: khóa nút khi pending, toast sau khi server xác nhận, lỗi qua `getUserErrorMessage`.
- Màn cảnh báo khi kết quả sàng lọc là `hold_test` hoặc `modified_test`: lời khuyên tiếng Việt, không lộ enum thô.

**Behavior**: người dùng nhập bước 1–2, thoát rồi quay lại vẫn ở đúng bước; ca `hold_test` thấy khuyến nghị và không có bước test.
**Blast radius**: `client/src/pages/self-assessment/*`, service + queries mới. **Depends on**: Step 4.
**Verify**: client test từng bước (render, validate, khôi phục nháp, hold_test); `grep -rn "<select" client/src/pages/self-assessment` rỗng; lint pass.

### Step 6: Bước 3–4 (tự kiểm tra thể lực) và trang kết quả

- Bước 3 chỉ hiện khi `testPermission` ≠ `hold_test`; `modified_test` hiện bài biến thể nhẹ và cảnh báo. Mỗi nhóm tối đa 3 bài, nhập số, hướng dẫn bằng chữ; tên bài tiếng Anh.
- Bước 4/kết quả: mức thể lực tổng và từng nhóm, điểm mạnh/cần cải thiện, giai đoạn bắt đầu ("Giai đoạn 1: Anatomical Adaptation"), lưu ý an toàn,
  danh sách bài gợi ý cố định + nút "Mở thư viện bài tập" tới `/exercises`, liên kết Dinh dưỡng/Tiến trình. Gọi là "phân tích tự động", không AI/forecast.
- Không có nút/field upload ở bất kỳ bước nào.

**Behavior**: hoàn tất cả 4 bước tạo bản `completed` và hiện kết quả đúng mức.
**Blast radius**: `client/src/pages/self-assessment/*`. **Depends on**: Step 5.
**Verify**: client test render kết quả theo fixture; `npm run ui:audit -- --baseline ... --fail-on-new-high` không finding mới mức cao.

### Step 7: Làm lại với xác nhận mềm và chế độ chỉ đọc khi hết hạn

- Mở lại mục khi đã `completed`: hiện kết quả gần nhất + "Nên làm lại sau 28 ngày" (lấy số ngày từ server). Bấm "Làm lại" khi `isEarly` mở hộp xác nhận bằng
  `useConfirmDialog` (không `window.confirm`) nêu ngày khuyến nghị; đồng ý thì tạo bản mới; hết hạn khuyến nghị thì không hỏi.
- `blocked` có lịch sử: ẩn mọi nút ghi (làm lại, tiếp tục nháp, xóa), hiện thẻ gia hạn; server đã chặn ghi ở Step 3.

**Behavior**: làm lại sớm có hộp xác nhận và vẫn tạo được; người hết hạn chỉ xem.
**Blast radius**: `client/src/pages/self-assessment/*`. **Depends on**: Step 6.
**Verify**: client test cho `isEarly` đồng ý/hủy, và chế độ chỉ đọc (không có nút ghi trong DOM).

### Step 8: E2E, gate cuối và đóng plan

- `e2e/mock-api.cjs` thêm trạng thái `self_managed`; thêm spec flow nháp → submit → kết quả; ẩn mục với `coaching`; chỉ đọc khi hết hạn.
- Chạy toàn bộ gate trong "Done Criteria"; `npm run agents:inventory` (+ `:check`) vì thêm test; cập nhật `docs/plans/README.md`, `plan-state.json`,
  trạng thái spec; ghi rõ lệnh `NOT RUN`/`BLOCKED`.
- Rollout (ngoài phạm vi code): migration index guarded chỉ chạy khi user xác nhận target; không tự apply.

**Behavior**: toàn bộ luồng chạy trên mock e2e; gate xanh.
**Blast radius**: `e2e/*`, docs. **Depends on**: Step 7.
**Verify**: `npm run test:e2e` (spec mới) pass; các lệnh còn lại ở "Done Criteria".

## Test Plan

- Server unit: `screening.test.js` (bảng quyết định hold/modified/full, biên đau 4/5/6/7, đối chiếu F1), `scoring.test.js` (ví dụ tính tay), `norms.test.js` (mỗi bài có ngưỡng, tên bài tiếng Anh).
- Server integration `fitnessSelfAssessment.integration.test.js` (mẫu: `todayDashboard.integration.test.js`, helper `setupTestDB/createTestUser/withAuth`): các case ở Step 3.
- Policy: `serviceAccessPolicy.test.js` thêm case `self_assessment` cho 8 tier.
- Client: test từng bước, nav 3 trạng thái, `isEarly`, chỉ đọc; e2e flow (Step 8).
- Expected value từ literal/worked example, không tính lại bằng chính công thức.

## Done Criteria

- [ ] `npm run test:unit:server` và `npm run test:unit:client` pass (số test mới nêu trong báo cáo)
- [ ] `npm run lint --prefix client` 0 error; `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high` không finding mới mức cao
- [ ] `npm run test:e2e` spec self-assessment pass (hoặc ghi `BLOCKED` kèm lý do)
- [ ] `npm run security:secrets`, `npm run security:data-boundaries`, `npm run agents:inventory:check` pass
- [ ] Fitness+ Member hoàn tất đánh giá; coaching/trainer/admin không thấy mục và bị 403 khi ghi; hết hạn chỉ đọc; không có đường upload
- [ ] Admin thấy hàng "Đánh giá bản thân" lấy từ registry
- [ ] Không file ngoài in-scope bị sửa (`git status`); không `console.log` tạm; không `<select>` gốc ở file mới
- [ ] `docs/plans/README.md`, `plan-state.json`, `traceability/111.json` cập nhật; migration chưa được chạy

## STOP Conditions

- Code ở "Current State" không khớp (ví dụ `buildSystemFlags` đã đổi ngưỡng, `getNavItems` đã tách) → dừng, báo.
- Bảng chuẩn `norms.js` chưa được user duyệt → không sang Step 3.
- Test đối chiếu với `buildSystemFlags` lệch → dừng, hỏi trước khi sửa F1 hoặc đổi ngưỡng.
- Một endpoint ghi cho phép trainer/admin/coaching, hoặc cho đọc dữ liệu của user khác → dừng, vá trước.
- Cần sửa `client/src/utils/api.js`, Auth/CSRF, hoặc thêm dependency mới → dừng, hỏi.
- Một verification fail 2 lần sau khi đã sửa.

## Maintenance Notes

- Nếu F1 đổi ngưỡng sàng lọc, test đối chiếu sẽ đỏ: quyết định có đồng bộ self-screening hay giữ khác biệt có chủ đích.
- Reviewer soi: quyền ghi/đọc ở từng route, allowlist field, không log payload sức khỏe, thông báo lỗi tiếng Việt, không enum thô, `RoundedSelect`.
- Deferred có chủ đích: mục tiêu bước chân/nước/ngủ tự đặt (Plan 112), upload ảnh, AI report/forecast (chỉ khách có HLV), bộ lọc URL cho thư viện bài tập, retention/xóa dữ liệu.
- Index production cần migration guarded; collection mới nên không cần backfill.

## Bảng chuẩn đã chốt (Step 2, user giao quyết định)

Chỉ dùng số liệu đã công bố; không có bảng phù hợp thì lưu làm mốc, không xếp mức (xem comment đầu `server/src/services/fitnessSelfAssessment/norms.js`).

| Nhóm | Bài | Nguồn bảng chuẩn | Ghi chú |
|---|---|---|---|
| Thân trên | Push-Up | Payne và cs. (2000), CSEP; nam hít đất chuẩn, nữ hít đất quỳ | 5 mức, tuổi 18-69; biến thể khác chỉ lưu mốc |
| Thân dưới | 30-Second Chair Stand | CDC STEADI (ngưỡng dưới trung bình) | Chỉ 60-94 tuổi; dưới 60 lưu mốc |
| Thân giữa | Plank | Mốc thực dụng điều chỉnh từ nghiên cứu plank 2014 (vận động viên 18-25) | Là mốc tham khảo, không phải chuẩn quần thể; ghi rõ ở giao diện |
| Tim phổi | Rockport 1-Mile Walk | Kline 1987 quy ra VO2max; xếp mức theo bảng The Cooper Institute | Kiểm chứng ở tuổi 30-69; ngoài khoảng đó có ghi chú ước lượng |

Hệ thống gợi ý (`recommendation.js`): giai đoạn bắt đầu (tối đa giai đoạn 3, khớp trần của F1), lịch tập theo kinh nghiệm, volume/RIR theo giai đoạn (ACSM 2009, Schoenfeld 2017), tim phổi theo WHO/ACSM và vùng nhịp tim Tanaka kèm dự trữ nhịp tim, protein theo mục tiêu (Morton 2018), BMI châu Á, vòng eo và eo/hông (WHO), giấc ngủ, bước chân (Paluch 2022), bài gợi ý theo nhóm yếu và lưu ý theo vùng đau. Danh sách nguồn trả kèm kết quả để hiển thị cho người dùng.

## Lệch so với kế hoạch ban đầu

- Mỗi nhóm kiểm tra có **một bài chính** (kèm biến thể giảm tải), không phải tối đa 3 bài; đủ cho bản đầu và tránh bảng chuẩn thiếu nguồn.
- Route: `GET /api/fitness-self-assessments/me` (trạng thái gồm nháp, kết quả gần nhất, nhắc làm lại), `GET /api/fitness-self-assessments` (lịch sử), `PUT /api/fitness-self-assessments/me/draft`, `POST /api/fitness-self-assessments/:id/submit` (đúng cổng đặt tên).
- Người hết hạn chỉ thấy bản đã hoàn tất; bản nháp dở dang không hiển thị (thẻ khóa kèm liên kết gia hạn).
- Không có bài kéo trong bộ kiểm tra; gợi ý luôn kèm bài kéo để cân bằng.
- Đã thêm `/api/fitness-self-assessments` vào `TODAY_PLATFORM_API_PREFIXES` (cùng cổng với dashboard).
- Cờ `hasSelfAssessmentHistory` trong `prompt-eligibility`; luật hiển thị sidebar nằm ở `isDashboardSectionVisible` (`customerDashboardNavigation.js`).

## Kết quả kiểm chứng

- Server: 3 file engine (43 test), `fitnessSelfAssessment.integration.test.js` (14 test), migration index (4 test), cổng đặt tên và prefix pass.
- Client: 219 file / 1140 test pass; lint không lỗi mới; `ui:audit` 0 finding chặn mới.
- E2E `e2e/self-assessment.spec.js` pass (2 test, chromium).
- Chưa chạy: toàn bộ e2e, staging, migration index trên môi trường thật (cần xác nhận target).
