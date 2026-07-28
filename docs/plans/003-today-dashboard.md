# Plan 003: Xây dựng Today Dashboard thành trung tâm đồng hành hằng ngày

> **Hướng dẫn thực thi**: Đây là master implementation plan cho một thay đổi nhiều
> phase. Feature spec canonical nằm tại
> [`docs/specs/today-dashboard.md`](../specs/today-dashboard.md). Không triển khai
> nhiều phase cùng lúc. Mỗi phase phải được user duyệt riêng, hoàn thành test/gate
> và cập nhật trạng thái trước khi bắt đầu phase tiếp theo.
>
> **Drift check đầu tiên**: Trước khi code, chạy lại các lệnh inventory trong phần
> Commands. Nếu vai trò của `TrainingSchedule`, `CoachingDay`, `WorkoutPlan`, `Order`
> hoặc các route hiện tại không còn khớp phần Current State thì STOP và cập nhật plan.

## Status

- **Priority**: P1
- **Effort**: XL (nhiều phase, nhiều ngày; không triển khai như một PR duy nhất)
- **Risk**: HIGH — dữ liệu sức khỏe, IDOR, lịch sử thay đổi và nhiều nguồn dữ liệu
- **Depends on**: Plan 001 và Plan 002 đã được triển khai
- **Category**: feature | architecture | data | privacy | UX | tests
- **Planned at**: 2026-07-28
- **Status**: SPEC / PLAN — CHƯA IMPLEMENT

## Assumptions đã chốt

1. Today Dashboard đầy đủ dành cho khách có gói PT/coaching đã duyệt và còn buổi.
2. Khách chỉ xem/sửa dữ liệu của chính mình.
3. HLV chỉ xem khách đang thuộc phạm vi quản lý; admin có quyền hỗ trợ theo role.
4. Múi giờ nghiệp vụ là `Asia/Ho_Chi_Minh`; khóa ngày dùng `YYYY-MM-DD`.
5. Dashboard tái sử dụng nguồn hiện tại, không tạo bản sao lịch/giáo án/coaching.
6. Dữ liệu mới phải có lịch sử ai tạo, ai sửa, thời điểm và lý do sửa.
7. UI mobile-first trên React web/PWA; chưa làm native app hoặc wearable.
8. HLV có thể phản hồi vào nhật ký ngày/tuần nhưng không sửa dữ liệu khách đã nhập.
9. Khách được ghi bữa ăn nhanh; không bắt nhập calories/gram cho mọi trường hợp.
10. F1 chỉ được dùng làm baseline khi có liên kết danh tính rõ ràng; không join ngầm
    bằng email.

## Why This Matters

Project đã có TDEE, Meal Plan, công thức, lịch hẹn, coaching theo ngày, workout plan,
check-in và video feedback nhưng chúng nằm ở nhiều màn hình. Khách biết “nên làm gì”
nhưng chưa có một nơi cho biết “hôm nay làm gì, đã làm tới đâu, cơ thể phản ứng ra sao
và HLV đã phản hồi gì”.

Today Dashboard phải tạo vòng lặp:

```text
HLV giao kế hoạch
      ↓
Dashboard tổng hợp công việc của ngày
      ↓
Khách thực hiện và ghi nhận
      ↓
Hệ thống tạo lịch sử + báo cáo tuần
      ↓
HLV phản hồi và điều chỉnh kế hoạch gốc
```

Mục tiêu không phải tạo thêm nguồn dữ liệu tập luyện. Mục tiêu là compose các nguồn
hiện có, bổ sung đúng những dữ liệu chưa tồn tại và giữ được lịch sử để hai bên có
bằng chứng khi cần đối chiếu.

---

# Feature Spec

## 1. Objective

Xây trang protected `/today` cho khách PT/coaching, hiển thị dữ liệu theo từng ngày:

- Lịch hẹn tập.
- Coaching day và tiến độ bài tập.
- Workout plan liên quan.
- Meal plan/bữa ăn thực tế.
- Nước, ngủ, bước chân, năng lượng, đói, stress, đau nhức.
- Thói quen.
- Ghi chú khách, phản hồi HLV và activity timeline.
- Tổng hợp tiến độ ngày và tuần.

Dashboard phải cho phép chuyển ngày:

```text
← Hôm qua          Hôm nay          Ngày mai →
```

Ngày tương lai chỉ hiển thị kế hoạch/lịch được giao. Ngày hiện tại và quá khứ gần
cho phép ghi nhận theo policy. Mọi correction sau khi đã submit phải có reason và
tạo revision; không ghi đè lịch sử âm thầm.

## 2. Personas và quyền

### Khách hàng

- Xem dashboard của chính mình.
- Xem lịch/giáo án/coaching đã được giao.
- Ghi nhật ký, meal completion, wellness và thói quen.
- Submit ngày/tuần.
- Xem comment của HLV và lịch sử của chính mình.
- Tiếp tục đọc lịch sử sau khi gói hết hạn.

### Huấn luyện viên

- Chỉ xem khách có `Order` thỏa:
  `status=approved`, `sessions>0`, `trainerId=req.user.id`.
- Không được sửa dữ liệu wellness/nutrition do khách nhập.
- Được comment, review weekly check-in và điều chỉnh kế hoạch qua màn hình gốc.
- Khi quan hệ quản lý hết hiệu lực, mất quyền xem dữ liệu sức khỏe của khách.

### Admin

- Có quyền hỗ trợ nhưng mọi read/write nhạy cảm phải ghi AuditLog.
- Không dùng quyền admin ở frontend làm enforcement; backend luôn kiểm tra role.

### User chưa có gói

- Có thể mở `/today` và thấy empty/onboarding state cùng CTA đăng ký.
- Không nhận full coaching data hoặc endpoint trainer-scoped.

## 3. Current State và reuse matrix

| Nhu cầu | Nguồn canonical hiện tại | Cách dùng trong Today Dashboard | Không được làm |
|---|---|---|---|
| Lịch hẹn hôm nay | `TrainingSchedule` | Query theo `clientId + occurrenceDateKey`; link `/book-training` | Không tạo `TodaySchedule` |
| HLV được gán | `Order` + `resolveClientTrainer()` | Dùng active approved order còn buổi | Không suy luận bằng email |
| Coaching theo ngày | `CoachingDay` | Query `userId + dateString`; hiển thị completion/video status; link `/online-coaching` | Không copy exercises |
| Workout plan | `WorkoutPlan` | Query client và `planDate`; hiển thị summary; link `/workout-plans/:id` | Không tạo lại plan builder |
| Check-in buổi PT | `Checkin` | Hiển thị attendance/session history khi có record cùng ngày | Không dùng nó làm body check-in |
| Meal generation | `useMealGenerator` | Reuse output shape; phase sau thêm API lưu snapshot | Không viết generator thứ hai ở server |
| Food database | `Food` | Reference khi còn tồn tại, đồng thời snapshot tên/macros | Không phụ thuộc hoàn toàn vào document mutable |
| Công thức | `Recipe` | Cho phép chọn recipe làm meal source | Không copy công thức vào journal ngoài snapshot tối thiểu |
| F1 baseline | `F1Intake` | Chỉ đọc khi có explicit `F1Customer.userId` link | Không match tự động bằng email |
| Lịch sử tài chính/gói | `Order`, `TrainerSubscription` | Chỉ dùng eligibility/CTA | Không đưa wallet/payment vào dashboard domain |
| Lịch sử hành động | `AuditLog` | Mở rộng action/target enum cho hành động quan trọng | Không log raw ảnh/video hoặc toàn bộ PII |
| Nhắc lịch | `ReminderDelivery` | Giữ cho training schedule; notification mới dùng domain riêng | Không đổi semantics reminder hiện tại |

### Evidence hiện tại

- `server/src/models/TrainingSchedule.js` — occurrence, status và reminder của lịch.
- `server/src/services/trainingScheduleCommand.service.js:186` — resolve HLV từ Order.
- `server/src/models/CoachingDay.js` — bài theo ngày, completion và video feedback.
- `server/src/models/WorkoutPlan.js` — giáo án, sections, sets/reps/tempo/maxWeight.
- `server/src/models/Checkin.js` — attendance, muscle, note và số buổi còn lại.
- `client/src/hooks/useMealGenerator.js` — generator đang chạy client-side.
- `client/src/pages/MealPlan/MealPlan.jsx:30` — lựa chọn hiện chỉ ở localStorage.
- `server/src/models/F1Intake.js` — health/body baseline nhưng chưa link User trực tiếp.
- `client/src/App.jsx:138-165` — các route hiện tại chưa có `/today`.

## 4. Canonical ownership

Today Dashboard là **read composition + entry point**, không phải nguồn sự thật cho
mọi module.

| Dữ liệu | Owner |
|---|---|
| Ngày/giờ lịch tập | `TrainingSchedule` |
| Nội dung coaching theo ngày và exercise completion | `CoachingDay` |
| Cấu trúc giáo án | `WorkoutPlan` |
| Số buổi PT | `Order` + `Checkin` |
| Meal plan đã lưu | `SavedMealPlan` mới |
| Nhật ký thực tế của khách | `DailyJournal` mới |
| Lịch sử sửa nhật ký | `DailyJournalRevision` mới |
| Habit do HLV giao | `CoachingHabit` mới |
| Weekly submission/review | `WeeklyCheckin` mới |
| Trao đổi gắn ngữ cảnh | `CoachingComment` mới |

Aggregator không được ghi vào các model cũ. Mutation lịch/coaching/workout tiếp tục
dùng controller/service hiện có.

## 5. Information architecture

### 5.1 Header ngày

- Greeting, avatar và tên khách.
- Ngày hiện tại theo Việt Nam.
- Previous/Today/Next navigation và date picker giới hạn.
- Completion ring của ngày.
- Badge `Ngày tập`, `Ngày nghỉ`, `Chờ HLV`, `Đã submit`.

### 5.2 Priority strip

Chỉ xuất hiện khi có việc cần chú ý:

- Buổi tập sắp bắt đầu.
- Weekly check-in đến hạn.
- HLV vừa phản hồi.
- Có pain score cao.
- Có lịch bị thay đổi/hủy.

Không dùng màu đỏ cho reminder bình thường; đỏ chỉ cho pain/safety hoặc lỗi.

### 5.3 Schedule card — reuse

- Start/end time, trainer, gym/exercise type, status.
- CTA `Xem/đổi lịch` mở `/book-training`.
- Không nhúng form booking vào dashboard phase đầu.

### 5.4 Today workout card — reuse

- CoachingDay: tiêu đề, số bài hoàn thành/tổng, video còn thiếu, clientStatus.
- WorkoutPlan: title, sections và trạng thái.
- CTA mở màn hình gốc.
- Nếu cả hai tồn tại, hiển thị hai sub-section, không merge exercises theo tên.
- Nếu không có plan: empty state “Ngày nghỉ hoặc HLV chưa giao bài”.

### 5.5 Nutrition card — mới + reuse

- Target calories/macros snapshot.
- Meal plan đã gán/lưu.
- Mỗi bữa có trạng thái: planned, eaten, changed, skipped.
- Quick log:
  - Theo đúng meal plan.
  - Chọn recipe.
  - Nhập mô tả nhanh.
  - Ảnh bữa ăn chỉ triển khai sau private-media gate.
- Tổng macro chỉ hiển thị “estimated” nếu dữ liệu không định lượng.

### 5.6 Wellness quick log — mới

- Sleep hours.
- Water ml.
- Steps.
- Energy, hunger, stress, soreness: thang 1–5.
- Pain: 0–10 + vị trí + note.
- Weight optional; vòng eo/body fat ưu tiên weekly check-in.
- Autosave có trạng thái `Đang lưu / Đã lưu / Lỗi — thử lại`.

Pain không được tạo chẩn đoán y khoa. Khi pain >= configured threshold, UI khuyên
khách dừng tập nếu cần và liên hệ HLV/chuyên môn; HLV nhận attention flag.

### 5.7 Habit card — mới

- Habit do HLV giao hoặc khách tự tạo nếu policy cho phép.
- Frequency theo ngày trong tuần.
- Completion checkbox.
- Streak chỉ là động lực, không dùng shame copy khi mất streak.

### 5.8 Notes, comments và timeline — mới

- Client note của ngày.
- Coach comments gắn `daily_journal`, `weekly_checkin`, `coaching_day` hoặc
  `workout_plan`.
- Timeline hiển thị các event quan trọng:
  plan assigned, schedule changed, meal logged, day submitted, correction,
  coach reviewed.
- Không expose IP/user agent cho khách hoặc HLV.

### 5.9 Mobile interaction

- Một cột; schedule và workout ở trên nutrition/wellness.
- Sticky quick-action bar: `Ghi bữa ăn`, `Cập nhật sức khỏe`, `Gửi check-in`.
- Tap target tối thiểu 44px.
- Form dùng bottom sheet/dialog; focus trap và keyboard đầy đủ.

## 6. State matrix

| State | UI |
|---|---|
| Loading | Skeleton theo card, không spinner toàn trang |
| API partial failure | Card lỗi riêng + retry; card khác vẫn dùng được |
| Không có active order | Onboarding + CTA; không gọi health mutations |
| Order có nhưng chưa gán HLV | `Đang chờ phân công` |
| Rest day | Wellness/nutrition/habit vẫn hoạt động |
| Future day | Read-only plan/schedule; không submit journal |
| Past day chưa submit | Cho phép backfill trong edit window |
| Submitted day | Read-only; correction cần reason |
| Offline/network error | Giữ draft UI, không báo success giả |
| 403 relationship ended | Ẩn trainer view ngay, không dùng cached data |

## 7. Proposed API contracts

### Read-only aggregator

```http
GET /api/today-dashboard/day/:dateKey
```

```json
{
  "success": true,
  "data": {
    "dateKey": "2026-07-28",
    "timeZone": "Asia/Ho_Chi_Minh",
    "eligibility": {
      "status": "active",
      "orderId": "id",
      "trainer": { "_id": "id", "name": "..." }
    },
    "capabilities": {
      "canEditJournal": true,
      "canSubmitDay": true,
      "canComment": false
    },
    "summary": {
      "dayStatus": "in_progress",
      "completionPercent": 60,
      "attentionFlags": []
    },
    "schedule": { "items": [], "source": "training_schedule" },
    "coaching": { "day": null, "source": "coaching_day" },
    "workoutPlans": [],
    "attendance": [],
    "journal": null,
    "nutrition": { "plan": null, "totals": null },
    "habits": [],
    "comments": [],
    "links": {
      "booking": "/book-training",
      "coaching": "/online-coaching",
      "workoutPlans": "/workout-plans"
    }
  }
}
```

Response chỉ trả summary cần thiết. Chi tiết video/plan lớn tiếp tục lấy từ API gốc.

### Daily journal

```http
GET  /api/daily-journals/:dateKey
PUT  /api/daily-journals/:dateKey
POST /api/daily-journals/:dateKey/submit
POST /api/daily-journals/:dateKey/corrections
GET  /api/daily-journals/:dateKey/history
```

Mọi mutation:

- `protect` + `csrfProtection`.
- Server lấy `clientId` từ `req.user`, không nhận clientId tùy ý.
- Có `requestId` hoặc expected revision để chống double submit/lost update.
- Correction yêu cầu `reason`.

### Trainer read

```http
GET /api/trainer/clients/:clientId/today/:dateKey
GET /api/trainer/clients/:clientId/progress?from=&to=
```

Backend bắt buộc ownership check bằng active Order, không dựa vào route guard FE.

### Meal plans

```http
POST /api/saved-meal-plans
GET  /api/saved-meal-plans
GET  /api/saved-meal-plans/:id
POST /api/saved-meal-plans/:id/assignments
```

Generator vẫn ở client trong phase đầu. Server validate shape và tự tính lại tổng từ
snapshot items trước khi lưu; không tin total do client gửi.

### Weekly check-in

```http
GET  /api/weekly-checkins/current
POST /api/weekly-checkins
GET  /api/weekly-checkins/:id
POST /api/weekly-checkins/:id/review
```

Một client chỉ có một submission cho một `weekStartDateKey`; correction tạo revision.

## 8. Proposed schemas

### `DailyJournal`

- `clientId` required ref User.
- `dateKey` required `YYYY-MM-DD`.
- `timeZone` enum `Asia/Ho_Chi_Minh`.
- `assignmentSnapshot`: orderId, trainerId.
- `status`: draft | submitted | corrected.
- `wellness`: sleepHours, waterMl, steps, energy, hunger, stress, soreness,
  painLevel, painLocations, note.
- `bodyMetrics`: weightKg optional.
- `mealEntries`: bounded array tối đa 10.
- `habitCompletions`: bounded array.
- `clientNote` max length.
- `revision` optimistic concurrency integer.
- `submittedAt`, `lastCorrectedAt`.
- Unique index `{ clientId: 1, dateKey: 1 }`.

Không embed full schedule, CoachingDay hoặc WorkoutPlan.

### `DailyJournalRevision`

- `journalId`, `clientId`, `dateKey`.
- `revision`, `actorId`, `actorRole`.
- `changeType`: autosave | submit | correction | system.
- `changes`: bounded list `{ path, before, after }`.
- `reason`, `requestId`.
- Append-only; unique `{ journalId, revision }`.

Revision không lưu raw binary/media, IP hoặc token.

### `SavedMealPlan`

- `ownerId`, `createdBy`.
- `title`, `source`: generator | trainer | manual.
- `targetSnapshot`: calories/protein/carb/fat.
- `meals`: bounded snapshot của name, amount, macros, optional Food/Recipe ref.
- `status`: active | archived.
- Không sửa snapshot đã được dùng cho submitted history; tạo version mới.

### `CoachingHabit`

- `clientId`, `trainerId`, title, category.
- schedule day-of-week, start/end, target/unit.
- status active | paused | archived.
- Daily completion nằm trong `DailyJournal` với title snapshot.

### `WeeklyCheckin`

- `clientId`, `trainerIdSnapshot`, `weekStartDateKey`.
- body metrics, progress summary, subjective review, client note.
- `status`: draft | submitted | reviewed | corrected.
- trainer review, reviewedBy/At.
- revision.
- Unique `{ clientId, weekStartDateKey }`.

### `CoachingComment`

- `clientId`, `actorId`, `actorRole`.
- `targetType`, `targetId`.
- `body`, `status`: visible | removed.
- Không hard delete; removal tạo tombstone/audit event.

## 9. Privacy, retention và security invariants

- Không sửa `client/src/utils/api.js`, JWT cookies hoặc CSRF flow.
- Mọi mutating endpoint có CSRF và server validation.
- Trainer endpoints phải kiểm tra IDOR trên backend.
- Không join F1Customer với User chỉ bằng email.
- Health/nutrition data không xuất hiện trong public route, sitemap hoặc prerender.
- `/today` dùng `<SEO noindex />`.
- Ảnh meal/progress phải dùng private-media pattern; chưa đạt gate thì không ship upload.
- `safeLog` chỉ log event code và opaque ids; không log notes, pain details hoặc meal text.
- Customer own-history vẫn đọc được sau khi order hết hạn; trainer mất quyền ngay.
- Retention cần cấu hình và dry-run trước enforcement. Không dùng TTL để xóa health data
  nhiều collection vì cần orchestration/audit tương tự F1 privacy lifecycle.
- User deletion flow phải inventory các collection mới và có deletion/pseudonymization job.
- AuditLog chỉ giữ metadata tối thiểu; DailyJournalRevision giữ thay đổi nghiệp vụ.

### Migration recommendation

- Các model mới không cần backfill; tạo index bằng migration có verify/dry-run.
- F1 integration cần thêm optional `userId`/`linkedUserId` với partial unique index.
- **Không auto-backfill F1 bằng email ở migration chính.**
- Nếu muốn link dữ liệu cũ, tạo report dry-run các match một-một để admin xác nhận riêng.

## 10. Tech stack và conventions

- React 19 + React Router lazy route.
- TanStack Query cho server state.
- React Hook Form + Zod cho form mới.
- Tailwind 4 + Lucide.
- Frontend gọi API qua `client/src/services/`.
- Backend theo route → controller → service → model.
- Validation server theo pattern `server/src/middlewares/validation.js`.
- Mongoose 9 indexes, optimistic concurrency hoặc explicit revision.
- Test bằng Vitest/Supertest/mongodb-memory-server và Playwright.

## 11. Scope

### In scope

- Protected customer Today Dashboard.
- Trainer read/review view.
- Aggregation từ module hiện tại.
- Daily journal + revision.
- Saved meal plan + meal completion.
- Habits.
- Progress/weekly check-in.
- Comments và activity timeline.
- Privacy/deletion/retention support cho model mới.
- Mobile/accessibility/error/empty states.

### Out of scope

- Viết lại Booking, OnlineCoaching hoặc WorkoutPlan.
- Native mobile app.
- Apple Health/Garmin/Fitbit.
- Barcode/AI meal photo recognition.
- Community feed/challenge.
- Auto thay calories/workout không có HLV duyệt.
- Chẩn đoán y khoa.
- Thay đổi payment/wallet/pricing.
- Public SEO page cho dashboard.

## 12. Success criteria

- Khách active mở `/today` và thấy đúng lịch, coaching, workout plan của ngày.
- Dashboard không tạo bản sao các source records hiện tại.
- Rest day vẫn ghi nutrition/wellness/habit được.
- Autosave có revision; concurrent stale update bị 409, không mất dữ liệu.
- Submitted day không bị ghi đè; correction có reason và history.
- Trainer khác không đọc được data; active trainer đọc/review được.
- Trainer mất assignment không còn đọc được.
- Meal plan được lưu qua tài khoản và dùng trên thiết bị khác.
- Weekly summary lấy dữ liệu server, không phụ thuộc localStorage.
- Partial API error không làm sập toàn trang.
- Protected route noindex và không vào sitemap/prerender.
- Deletion/retention flow inventory đủ model mới.
- Unit/integration/E2E, lint, build và security gates pass.

## 13. Product decisions phải duyệt trước implementation tương ứng

Plan dùng recommendation mặc định sau; nếu product owner đổi thì cập nhật spec trước:

1. Client edit window: hôm nay và 7 ngày trước.
2. Sau submit, correction phải có reason.
3. Trainer không sửa client journal, chỉ comment/review.
4. Trainer mất quyền đọc khi active assignment kết thúc.
5. Progress photo/meal photo chưa vào MVP nếu private media chưa hoàn thiện.
6. Retention mặc định đề xuất 365 ngày sau archive nhưng phải khớp privacy policy trước
   khi bật enforcement.
7. Notification MVP chỉ dùng in-app; email là phase sau và phải opt-in.
8. User chưa có coaching chỉ thấy onboarding/CTA tại `/today`.

---

# Implementation Plan

## Commands You Will Need

| Purpose | Command | Expected |
|---|---|---|
| Drift/status | `git status --short --branch` | Không có thay đổi ngoài task |
| Source inventory | `rg -n "TrainingSchedule|CoachingDay|WorkoutPlan|DailyJournal" client/src server/src` | Mọi producer/consumer được phân loại |
| Client tests | `npm run test:unit:client` | exit 0 |
| Server tests | `npm run test:unit:server` | exit 0 |
| E2E | `npm run test:e2e` | exit 0 |
| Lint | `npm run lint --prefix client` | exit 0 |
| Client build | `$env:SKIP_DYNAMIC_ROUTES='true'; npm run build --prefix client` | exit 0 |
| Secrets | `npm run security:secrets` | exit 0 |
| Boundaries | `npm run security:data-boundaries` | exit 0 |

## Phase 0 — Contract, baseline và feature flag

**Goal**: Khóa nguồn dữ liệu, DTO, công thức ngày/completion và đường rollback trước
khi tạo UI hoặc schema mới.

### Task 0.1 — Xác nhận canonical field map

- Trace field cụ thể cho target/actual sets, reps, kg, tempo và completion.
- Lập bảng field → model → service → API → UI consumer.
- Xác nhận phần giao nhau giữa `CoachingDay` và `WorkoutPlan`, đồng thời chỉ định
  domain sở hữu từng mutation.
- Chốt các trạng thái `TrainingSchedule` mà khách được xem.
- Chốt eligibility thực tế ngoài `Order.status=approved` và `sessions>0`.

**Acceptance**: mỗi card Today có đúng một canonical source; không còn field “tạm
đoán” và không đề xuất model mới cho dữ liệu đã tồn tại.

**Verify**: review field map bằng evidence `file:line` và contract fixtures.

### Task 0.2 — Khóa response và error contract

- Chốt DTO cho eligibility, summary, section, capability, deep link và partial error.
- Chốt fallback cho enum/status mới để frontend không crash khi contract drift.
- Chốt hành vi `400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`.
- Có fixtures cho success, partial success, no-coaching và unauthorized.
- Không trả raw Mongoose document.

**Acceptance**: frontend render từng section độc lập và contract có thể kiểm thử.

**Verify**: server/client contract tests chạy trên cùng fixtures.

### Task 0.3 — Khóa date, completion và missing-data rules

- Canonical `dateKey` và week key dùng `Asia/Ho_Chi_Minh`.
- Chốt giới hạn ngày quá khứ/tương lai.
- Completion do server tính, có `formulaVersion`.
- Missing data khác zero; rest day không bị tính thiếu workout.
- Reuse helper trong `trainingOccurrence.service.js`.

**Acceptance**: công thức không bị frontend/backend tính khác nhau.

**Verify**: unit tests tại 23:30/00:30 giờ Việt Nam, rest day và partial data.

### Task 0.4 — Feature flag và rollout switch

- Chọn feature flag server/client theo convention thực tế của repository.
- Khi flag off, ẩn entry point hoặc trả trạng thái có kiểm soát.
- Flag không được bỏ qua authentication, CSRF, ownership hoặc rate limit.
- Ghi rõ cách tắt Today mà không ảnh hưởng booking, coaching, workout và Meal Plan.

**Acceptance**: có thể rollback UI/write path mà không xóa dữ liệu hoặc làm hỏng
module hiện tại.

**Verify**: integration/E2E với flag on và off.

### Phase 0 release gate

- Các quyết định sản phẩm trong mục 13 được duyệt.
- Canonical-source map và contract fixtures được review.
- Test plan và rollout switch đã chốt.
- Chưa tạo schema hoặc collection mới.

## Phase 1 — Read-only Today Dashboard foundation

**Goal**: Ship dashboard tổng hợp dữ liệu có sẵn, chưa thêm schema mới.

### Task 1.1 — Tạo access policy dùng chung

- Tạo `server/src/services/coachingClientAccess.service.js`.
- Client self-read dùng `req.user.id`.
- Trainer read dùng active approved Order còn buổi và matching trainerId.
- Admin path rõ ràng, ghi request context cho sensitive support reads.
- Reuse logic/date helpers từ `trainingScheduleCommand.service.js` và
  `trainingOccurrence.service.js`; không copy constant timezone.

**Acceptance**:

- User A không đọc User B.
- Trainer A không đọc khách Trainer B.
- Client không active vẫn nhận eligibility state nhưng không nhận trainer-private data.

**Verify**: integration test happy/401/403/no-active-order/admin.

### Task 1.2 — Tạo aggregation service read-only

- Tạo `server/src/services/todayDashboard.service.js`.
- Query song song:
  - `TrainingSchedule` theo client/date.
  - `CoachingDay` theo user/dateString.
  - `WorkoutPlan` theo clientId/clientEmail và planDate.
  - `Checkin` qua Order của client theo ngày.
- Chỉ select summary fields; không tải video payload hoặc toàn history.
- Không `save`, `update` hoặc tạo snapshot.
- Tính completion bằng pure helper mới, không ghi DB.

**Acceptance**: cùng source IDs/status với API gốc; 0 writes.

**Verify**: service tests cover workout-only, coaching-only, cả hai, rest day,
cancelled schedule và partial missing source.

### Task 1.3 — Thêm protected GET endpoint

- Tạo `server/src/controllers/todayDashboard.controller.js`.
- Tạo `server/src/routes/todayDashboard.routes.js`.
- Mount `/api/today-dashboard` trong `server/server.js` theo inline-import convention.
- Validate dateKey bằng helper server hiện có.
- Response contract đúng phần Proposed API.

**Acceptance**: `GET /day/2026-07-28` trả envelope ổn định; invalid date trả 400.

**Verify**: Supertest integration + IDOR cases.

### Task 1.4 — Tạo frontend service và adapter

- Tạo `client/src/services/todayDashboard.service.js`.
- Tạo `client/src/pages/today-dashboard/todayDashboard.adapter.js`.
- Adapter normalize null/empty nhưng fail closed với unknown contract version.
- Query key gồm user id + dateKey; không dùng local state làm server truth.

**Acceptance**: adapter có output ổn định cho loading/empty/partial/error.

**Verify**: Vitest pure adapter/service tests.

### Task 1.5 — Tạo page mobile-first

- Tạo lazy page `client/src/pages/today-dashboard/TodayDashboard.jsx`.
- Component nhỏ dưới `components/`: Header, AttentionStrip, ScheduleCard,
  CoachingCard, WorkoutPlanCard, EmptyState.
- Card dùng summary và link màn hình gốc; không nhúng form/video upload.
- Thêm `/today` trong `App.jsx` bằng lazy import và protected behavior hiện có.
- Thêm navigation có điều kiện trong Header.
- `<SEO noindex />`; không sửa sitemap/prerender.

**Acceptance**: active client thấy đúng card; no-order thấy onboarding; route anonymous
redirect login; keyboard/mobile usable.

**Verify**: client tests, accessibility E2E, 360/768/1280 viewport manual screenshots.

### Phase 1 release gate

- Backend and frontend deploy staging.
- Read-only verification bằng test account đã xác nhận.
- So sánh source IDs với `/book-training`, `/online-coaching`, `/workout-plans`.
- Không có model/index/migration mới.

## Phase 2 — Daily Journal, revision và quick wellness logging

**Depends on**: Phase 1 verified.

### Task 2.1 — Thêm schemas và index migration

- Tạo `DailyJournal.js`, `DailyJournalRevision.js`.
- Unique/index đúng phần schema.
- Bounded arrays, max lengths, numeric ranges và explicit defaults.
- Tạo migration createIndexes + verify; không backfill documents.
- Dùng migration safety hiện có; không chạy staging/prod chưa xác nhận.

**Acceptance**: document cũ không bị tác động; duplicate client/date fail.

**Verify**: model tests + migration verify trên memory/local DB.

### Task 2.2 — Tạo journal domain service

- Tạo `dailyJournal.service.js`.
- Upsert draft bằng expected revision.
- Ghi current state và revision trong Mongo transaction.
- Submit idempotent.
- Correction cần reason, actor và revision mới.
- Server tự tính completion summary.

**Acceptance**: stale update trả 409; double request không tạo revision trùng.

**Verify**: integration tests cho concurrency, submit, correction và transaction rollback.

### Task 2.3 — Routes/controller/validation

- Tạo routes/controller journal theo contract.
- Mutations dùng protect + CSRF.
- ClientId luôn từ auth.
- Trainer chỉ read; admin action có audit.
- Giới hạn edit window trên server, không chỉ UI.

**Acceptance**: past/future boundary đúng Asia/Ho_Chi_Minh.

**Verify**: boundary tests ở midnight UTC/Vietnam và CSRF/ownership tests.

### Task 2.4 — Wellness quick log UI

- Thêm WellnessCard và editor bằng RHF + Zod.
- Autosave debounce nhưng flush khi submit/unmount.
- Hiển thị saved/error/retry.
- Pain safety copy không chẩn đoán.
- Optimistic UI chỉ commit khi response revision khớp.

**Acceptance**: reload/đổi thiết bị vẫn thấy dữ liệu; network fail không báo saved.

**Verify**: adapter tests + Playwright save/reload/stale conflict.

### Task 2.5 — Activity timeline cơ bản

- Merge revision events với schedule/coaching status events trong read model.
- Không tạo duplicate source events.
- Hiển thị actor label và timestamp; ẩn metadata nội bộ.

**Acceptance**: user đối chiếu được submit/correction và schedule change.

**Verify**: deterministic ordering test.

## Phase 3 — Persisted Meal Plan và Habit execution

**Depends on**: Phase 2 verified.

### Task 3.1 — Lưu meal generator output

- Tạo `SavedMealPlan` model/service/routes/controller.
- Reuse output của `useMealGenerator`; không rewrite generator.
- Frontend thêm nút `Lưu vào tài khoản`.
- Server validate từng item và tự tính calories/macros.
- Snapshot name/amount/macros để lịch sử không đổi khi Food được sửa.

**Acceptance**: save ở laptop, đọc được trên PC; tampered total bị reject/recalculate.

**Verify**: contract/integration tests và cross-device E2E bằng fresh context.

### Task 3.2 — Gắn meal plan vào ngày

- Cho khách chọn SavedMealPlan cho một hoặc nhiều dateKeys trong giới hạn.
- DailyJournal lưu plan reference + version/snapshot id, không copy toàn plan tùy tiện.
- Mỗi meal có planned/eaten/changed/skipped.
- Recipe có thể làm source nhưng giữ snapshot name.

**Acceptance**: archive/edit template không đổi submitted history.

**Verify**: versioning and historical immutability tests.

### Task 3.3 — Quick meal logging

- Ba mode: follow plan, recipe, manual description.
- Manual không hiển thị macro chính xác nếu không có quantities.
- Giới hạn 10 entries/ngày và text lengths.
- Photo mode deferred cho tới private-media gate.

**Acceptance**: khách ghi một bữa trong tối đa vài thao tác; estimated label rõ ràng.

**Verify**: Zod/server validation parity và accessibility.

### Task 3.4 — Habit assignment/completion

- Tạo `CoachingHabit`.
- Trainer tạo/pause/archive habit chỉ cho managed client.
- Completion lưu trong DailyJournal với snapshot title.
- Streak là derived read model, không lưu counter mutable.

**Acceptance**: thay title habit không đổi lịch sử; missed day không phá dữ liệu.

**Verify**: assignment IDOR, schedule day, streak derivation tests.

## Phase 4 — Progress Hub và Weekly Check-in

**Depends on**: Phase 2; Phase 3 recommended.

### Task 4.1 — WeeklyCheckin domain

- Tạo model/service/routes/controller.
- Week start theo timezone canonical.
- Body metrics, subjective review và note.
- Submit/review/correction có revision/idempotency.
- Trainer review không sửa client fields.

**Acceptance**: một check-in/tuần/client; correction truy vết được.

**Verify**: week boundary, ownership, concurrent submit tests.

### Task 4.2 — Progress aggregation

- Tạo `progressReadModel.service.js`.
- Query date range có giới hạn.
- Derived metrics:
  workout/coaching completion, schedule attendance, meal/habit compliance,
  weight trend, wellness averages.
- Không tạo medical conclusions.
- Empty/missing data không được tính thành zero compliance.

**Acceptance**: denominator chỉ gồm task thực sự được giao/có dữ liệu.

**Verify**: pure calculation tests cho missing/rest/partial weeks.

### Task 4.3 — Progress UI

- Tạo `/progress` protected lazy page hoặc tab trong `/today`.
- 7/30/90-day filters.
- Charts có table/text alternative.
- Side-by-side progress photo chỉ sau private-media gate.
- Link từ Today Dashboard.

**Acceptance**: khách hiểu trend mà không cần đọc raw log; HLV có same canonical numbers.

**Verify**: visual/accessibility/responsive tests.

### Task 4.4 — F1 baseline linking

- Đề xuất thêm optional `linkedUserId` vào F1Customer + partial unique index.
- Admin-only explicit linking workflow.
- Dry-run report cho legacy candidates; không auto-write bằng email.
- Progress service đọc latest approved F1 baseline khi linked.

**STOP**: Không triển khai task này cho tới khi user duyệt migration/linking policy.

## Phase 5 — Coach collaboration, notifications và history hardening

**Depends on**: Phase 4 verified.

### Task 5.1 — Contextual comments

- Tạo `CoachingComment`.
- Comment target daily/weekly/coaching/workout.
- Trainer ownership check; client own check.
- Edit/delete dùng revision/tombstone; không hard delete.
- Phase đầu text-only; voice/video deferred.

**Acceptance**: conversation không bị lẫn giữa các ngày/plan.

**Verify**: IDOR, tombstone, pagination và max-length tests.

### Task 5.2 — Trainer client overview

- Thêm read-only Today/Progress tab vào trainer client workflow.
- Reuse same aggregator/progress services với actor-specific capabilities.
- Attention queue: missed weekly, pain flag, pending feedback.
- Không xây dashboard số liệu riêng có công thức khác.

**Acceptance**: số liệu client và trainer khớp; trainer không managed nhận 403.

**Verify**: cross-role contract tests.

### Task 5.3 — Notifications

- Inventory schedule reminder hiện có trước.
- Chỉ tạo notification domain mới cho journal/comment/weekly events.
- In-app first; email opt-in và chống spam/dedupe.
- Mọi delivery idempotent; không gửi nội dung sức khỏe nhạy cảm trong subject.

**Acceptance**: một event không gửi trùng; opt-out được tôn trọng.

**Verify**: retry/dedupe/preferences tests.

### Task 5.4 — Audit và export

- Mở rộng AuditLog enum cho sensitive admin/trainer actions.
- Activity timeline cho client không expose internal audit metadata.
- Cung cấp export JSON/CSV có xác thực; PDF chỉ làm bằng workflow PDF riêng nếu user
  duyệt sau.
- Export có timestamp/timezone/source IDs để đối chiếu.

**Acceptance**: support có thể trace ai làm gì mà không đọc raw server logs.

**Verify**: audit creation, export ownership và escaping tests.

## Phase 6 — Privacy lifecycle, performance và staged rollout

### Task 6.1 — Deletion/retention integration

- Inventory DailyJournal, revisions, SavedMealPlan, Habit, WeeklyCheckin, Comment/media.
- Tạo coaching data deletion job hoặc mở rộng user privacy orchestration có transaction.
- Pseudonymize/delete theo policy; audit tối thiểu được giữ theo policy.
- Dry-run default, enforcement cần explicit env và actor như F1 pattern.

**STOP**: retention days/privacy policy chưa được product owner xác nhận.

### Task 6.2 — Query/index/performance

- Explain critical day and range queries.
- Prevent N+1/populate toàn history.
- Aggregator có bounded selects và date ranges.
- TanStack cache không giữ trainer data sau 403/logout/assignment change.

**Verify**: explain/index verifier + load smoke; payload budget được ghi rõ.

### Task 6.3 — Full QA and staging rollout

- Targeted unit/integration trước.
- Full tests, lint, build, secrets, boundaries.
- Staging seed chỉ dùng synthetic client.
- Verify role matrix, timezone, partial failures, PC/laptop persistence.
- Rollout read-only Phase 1 trước; write phases sau feature flag nếu cần.
- Production chỉ sau pre-deploy ALL PASS.
- Theo dõi P50/P95 aggregator latency, partial error rate, `409` conflict rate,
  save/submit success và unauthorized attempts.
- Rollout theo thứ tự: deploy flag off → verify indexes → internal accounts →
  cohort nhỏ → theo dõi → mở rộng.
- Threshold rollback phải được ghi trước khi bật cohort production.

## Test Plan tổng

### Server

- Date/timezone boundaries.
- Eligibility and IDOR role matrix.
- Aggregator source mapping.
- Model indexes/validation/bounds.
- Journal optimistic concurrency, idempotency và transaction rollback.
- Submitted immutability/correction.
- Meal macro server recalculation.
- Habit/weekly derived metrics.
- Retention/deletion dry-run and enforcement guards.

### Client

- Service paths và response adapters.
- Completion calculation pure helpers.
- Loading/partial error/empty/locked/submitted/correction states.
- Form Zod ranges.
- Query invalidation và stale conflict.
- noindex metadata.

### E2E

- Anonymous → login.
- User no order → onboarding.
- Active user → đúng source cards.
- Save wellness → reload → persisted.
- Save meal plan → fresh browser context → persisted.
- Submit/correct → history visible.
- Trainer managed/unmanaged access.
- Assignment expires → trainer loses access.
- Mobile keyboard/accessibility.

## Test matrix tối thiểu

| Nhóm | Trường hợp bắt buộc |
|---|---|
| Authentication | Guest, expired session, valid client, trainer, admin |
| Authorization | Own data, other client, wrong trainer, ended relationship |
| Date/time | Today, past, future, leap date, midnight Việt Nam |
| Source state | No schedule, rest day, no plan, cancelled schedule, partial failure |
| Journal | Create, update, submit, reopen, conflict, duplicate request, expired edit window |
| Nutrition | Save snapshot, forged totals, archived food, assigned plan, skipped/substituted |
| Habit | Scheduled, not scheduled, archive, streak boundary |
| Weekly | Draft, submit, review, reopen, missing data |
| Privacy | Export, delete, retention, audit, redaction |
| UI | 360px, tablet, desktop, keyboard, screen reader basics, reduced motion |
| Reliability | Slow API, offline, retry, double click, refresh |

## Migration và rollback strategy

1. Deploy code đọc được trạng thái chưa có collection/dữ liệu mới.
2. Tạo index bằng migration có dry-run và verify; không backfill suy đoán.
3. Backfill bắt buộc phải resumable, idempotent và có report.
4. Bật write path cho internal cohort trước.
5. Verify documents, indexes, cardinality và privacy inventory.
6. Rollback bằng feature flag và ngừng write; không drop collection/index vội.
7. Cleanup chỉ thực hiện sau thời gian quan sát và xác nhận riêng.
8. F1 mapping có rollback unlink riêng; không xóa F1 data khi mapping lỗi.

## Rủi ro và biện pháp

| Rủi ro | Tác động | Biện pháp |
|---|---|---|
| Nhân bản lịch/bài tập | Drift và tranh chấp dữ liệu | Read adapters + deep links; cấm duplicated write |
| Quyền HLV dựa trên client ID | IDOR | Server resolver + integration tests |
| Meal generator thay đổi | Lịch sử meal plan biến đổi | Immutable snapshot + `generatorVersion` |
| Save đồng thời | Mất dữ liệu | Revision + conditional update + `409` |
| Ngày lệch UTC | Log sai ngày | Helper chuẩn `Asia/Ho_Chi_Minh` |
| F1 ghép sai người | Lộ dữ liệu sức khỏe | Explicit mapping; không auto-link email |
| Revision phình lớn | Tăng storage/latency | Field diff allowlist, retention, pagination |
| Aggregator chậm | UX kém | Parallel adapters, projection, metrics, partial response |
| Notification quá nhiều | Notification fatigue | Dedupe, preference, attention thresholds |
| Private route bị index | Privacy/SEO | `noindex`, route guard, loại khỏi sitemap/prerender |

## Phân rã release

### Release A — Hôm nay của tôi

- Phase 0 + Phase 1.
- Chỉ đọc dữ liệu hiện có; chưa tạo collection mới.

### Release B — Nhật ký hằng ngày

- Phase 2.
- Quick log, submit, revision và privacy lifecycle.

### Release C — Ăn uống và thói quen

- Phase 3.
- Persisted meal plan, daily execution và habits.

### Release D — Tiến trình và review tuần

- Phase 4.
- Progress, weekly check-in và optional explicit F1 baseline.

### Release E — Đồng hành cùng HLV

- Phase 5 + Phase 6.
- Contextual comments, trainer workspace, notifications, hardening và rollout.

Mỗi release phải đạt gate và có thể deploy độc lập; không chờ toàn bộ feature mới
tạo giá trị.

## Definition of Done cho từng task

Một task chỉ được đóng khi:

- Contract và canonical source đã rõ.
- Code đúng layering/convention.
- Loading, empty, error và disabled states đầy đủ.
- Ownership/security có test tương xứng.
- Unit/integration/E2E liên quan đã chạy.
- Lint/build liên quan pass.
- Không có debug log, secret hoặc unused import mới.
- Docs/API/schema/operations được cập nhật.
- Diff được review về side effect.

## Done Criteria

- [ ] Phase 1 read-only compose dữ liệu hiện có, không duplicate source model.
- [ ] Mỗi mutation domain mới có auth, CSRF, server validation và ownership.
- [ ] Daily history có revision và correction reason.
- [ ] Meal plan không còn phụ thuộc duy nhất vào localStorage.
- [ ] Progress/weekly metrics dùng một backend read model chung.
- [ ] Trainer không sửa client-entered health/nutrition fields.
- [ ] F1 không join ngầm bằng email.
- [ ] Private media gate đạt trước mọi health/meal photo upload.
- [ ] Deletion/retention inventory đủ model mới.
- [ ] Protected routes noindex và không vào sitemap/prerender.
- [ ] Tất cả test/build/security gates pass ở từng phase.
- [ ] Staging verification có evidence trước production.

## STOP Conditions

- Một source hiện tại đã đổi semantics so với Current State.
- Cần merge `CoachingDay` và `WorkoutPlan` bằng exercise name.
- Cần trust client-supplied calories/completion/role/clientId.
- Cần disable CSRF/rate limit hoặc sửa JWT cookie flow.
- Trainer access chỉ có thể kiểm tra bằng frontend.
- F1 baseline chỉ có thể link bằng email không xác nhận.
- Cần upload ảnh/video trước khi private storage/deletion flow sẵn sàng.
- Migration yêu cầu backfill production nhưng chưa có dry-run và user approval.
- Retention policy chưa được xác nhận.
- Verification cùng loại fail ba vòng.

## Maintenance Notes

- Dashboard là composition layer; khi module gốc đổi response/status, cập nhật adapter và
  contract tests, không copy logic mới vào page.
- Derived metrics phải nằm trong pure backend service dùng chung cho client/trainer.
- Không biến `DailyJournal` thành document chứa mọi dữ liệu; giữ arrays bounded và tách
  resource khi domain tăng.
- AI adaptive adjustment, wearable, barcode và community là follow-up riêng sau khi có
  dữ liệu thực tế đủ tốt.
- Mỗi phase hoàn tất phải cập nhật status của plan này và `docs/plans/README.md`.
