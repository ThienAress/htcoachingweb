# Plan 062: Tinh gọn báo cáo coaching, tiến trình và thông báo đúng ngữ cảnh

> **Hướng dẫn thực thi**: Thực hiện từng behavior slice, chạy verification tương ứng và dừng nếu
> cần migration/data write hoặc phải nới ownership. Drift check đầu tiên: `git status --short --branch`
> và đối chiếu các symbol nêu dưới đây với branch `staging`.

## Status

- **Priority**: P1
- **Effort**: XL
- **Risk**: HIGH — health schema, correction lifecycle, trainer deep-link và shared Progress UI
- **Depends on**: 003F, 011, 016, 047, 060
- **Category**: feature / ux / data-contract
- **Planned at**: 2026-08-23
- **Status**: IMPLEMENTED / LOCAL VERIFIED — MANUAL AUTH BLOCKED
- **Implemented at**: 2026-08-23

## Why This Matters

Báo cáo tuần hiện thu thập nội dung không còn cần thiết và cho sửa sau gửi không giới hạn. Tiến trình
render ba nhóm dài cùng lúc, còn thông báo mất ngữ cảnh khách/ngày. Release này làm rõ từng quyết định
của người dùng mà vẫn giữ dữ liệu cũ, quyền truy cập và read model hiện có.

## Current State

- `server/src/models/WeeklyCheckin.js`: body legacy và chưa có `correctionCount`.
- `server/src/services/weeklyCheckin*.service.js`: patch/DTO/correction lifecycle và notification event.
- `client/src/pages/progress/WeeklyCheckin*.jsx`: form cũ, diễn giải adherence và correction mở sẵn.
- `client/src/pages/today-dashboard/WellnessFields.jsx`: select 1/10–10/10.
- `client/src/pages/progress/ProgressSummary.jsx`: render nối tiếp cả ba section; được dùng lại trong
  `client/src/pages/trainer/TrainerClientOverview.jsx`.
- `server/src/services/inAppNotification.service.js`: title/deep-link tĩnh, còn copy tiếng Anh.
- `client/src/utils/notificationDestination.js`: fallback chung không giữ client/date.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused client | `npm run test:unit:client -- --run <test-files>` | exit 0 |
| Focused server | `npm run test:unit:server -- <test-files>` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Client build | `npm run build --prefix client` | compile exit 0; report prerender env separately |
| UI regression | `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high` | no new high |
| Boundaries | `npm run security:data-boundaries` | exit 0 |

## Scope

**In scope**: WeeklyCheckin model/services/tests/UI; wellness presentation; shared Progress navigation;
notification model/service/callers/destination/tests; trainer journal/weekly anchors; Vietnamese-first
rule and directly affected copy; spec/plan indexes.

**Out of scope**: production/staging data writes, migration/backfill, provider/InBody integration,
read-model formula changes, global copy rewrite outside user-visible surfaces found by scoped audit.

## Steps

### Step 1: Thu thập bốn số đo tuần và enforce một correction

Thêm optional body-composition fields và `correctionCount`, mở rộng patch/DTO, giữ legacy fields trong
schema compatibility window. UI chỉ hiện bốn số đo, khóa sau submit, mở bằng `Cập nhật` và server từ chối
correction thứ hai. Progress source/read model đưa hai số đo mới vào cùng current/delta/history hiện có.

**Behavior**: report mới submit/reload read-only; correction đầu thành công và correction thứ hai trả conflict.

**Verify**: focused WeeklyCheckin model/service/controller tests và client form/component tests pass.

### Step 2: Thay thang số bằng ba lựa chọn có nghĩa

Tạo semantic option catalog dùng chung cho render/mapping; dữ liệu legacy gom theo bucket và lựa chọn mới
gửi representative values. Căn giữa icon header mục tiêu.

**Behavior**: khách không cần hiểu `1/10`, còn API vẫn nhận đúng integer hiện có.

**Verify**: focused wellness mapping/render tests pass và accessibility labels rõ.

### Step 3: Điều hướng Tiến trình theo một chức năng

Thêm navigator card + active section/back action trong shared Progress component. Customer và trainer
overview dùng cùng contract; chỉ section đã chọn được mount.

**Behavior**: landing có ba entry, chọn một chỉ thấy nội dung tương ứng, quay lại không refetch sai dữ liệu.

**Verify**: Progress presentation/component tests pass trên customer và trainer consumer.

### Step 4: Đưa thông báo tới đúng khách, ngày và nội dung

Sinh title có tên khách và deep-link canonical từ event context; expose metadata tối thiểu cần thiết.
Thêm anchor/panel phù hợp trong trainer workspace và Việt hóa notification catalog.

**Behavior**: click journal/weekly notification mở đúng client/date/section; unsafe link vẫn bị reject.

**Verify**: notification service/integration và destination tests pass, ownership tests không regress.

### Step 5: Chuẩn hóa policy copy và chạy release gates

Thêm canonical Vietnamese-first rule, pointer trong `ui-quality`, rồi rà scoped user-visible copy. Chạy
client/server QA phù hợp, lint/build, UI regression, secrets/data-boundaries và review diff độc lập.

**Behavior**: copy mới nhất quán tiếng Việt, không đổi identifier/English locale ngoài scope.

**Verify**: gates đã nêu exit 0 hoặc blocker môi trường được ghi evidence chính xác.

### Step 6: Xác nhận gửi thiếu và thông báo đúng trường còn trống

Thêm helper completeness có allowlist riêng cho nhật ký sức khỏe và bốn số đo tuần. Frontend dùng
cùng catalog nhãn để mở xác nhận trước submit/correction; backend tính lại từ document đã lưu và gắn
key thiếu vào notification. `missingFields` chỉ chứa key, không chứa giá trị sức khỏe.

**Behavior**: người dùng có thể gửi form partial/empty sau khi xác nhận; HLV thấy đúng tên trường thiếu.

**Verify**: client helper/confirmation tests, notification model/service và journal/weekly event tests pass.

### Step 7: Chỉnh hierarchy Nhật ký và gộp landing Tiến trình

Bỏ ba câu copy theo yêu cầu, chuẩn hóa bốn heading card lớn và giữ heading mục tiêu ở cấp con explicit.
Gộp header page + navigator thành một card `Tiến trình cơ thể và huấn luyện` chứa ba lựa chọn con;
giữ focus restore và active-section behavior hiện có.

**Behavior**: hierarchy đọc rõ trên desktop/mobile, landing không còn hai card nối tiếp.

**Verify**: component/source tests, client lint/build và UI regression gate pass.

## Test Plan

- Server: schema bounds/default, legacy document, first/second correction, idempotent replay, title/deep-link context.
- Client: weekly payload mới, locked/edit-once state, wellness bucket/representative mapping, one-section navigation,
  safe/fallback destination.
- Integration: trainer journal and weekly events contain correct client/date link; client review link đúng module.
- Manual/rendered: desktop/mobile, keyboard focus, disabled/loading/empty/error, long Vietnamese title.

## Verification Evidence

- Follow-up focused client sau chỉnh heading cuối: PASS — 5 files / 8 tests.
- `npm run test:unit:client`: PASS — 112 files / 516 tests trên working tree cuối.
- Follow-up focused server notification/journal/weekly/progress: PASS — 4 files / 28 tests.
- `npm run test:unit:server -- --pool=threads --maxWorkers=1 --reporter=verbose --bail=1`:
  PASS — 182 files / 950 tests trước follow-up xác nhận gửi thiếu; không dùng làm evidence cho source
  follow-up mới.
- Focused server notification/weekly lifecycle sau reviewer fixes: PASS — 2 files / 11 tests.
- `npm run lint --prefix client`: PASS.
- `npx vite build` trong `client/`: PASS — 2.891 modules trên working tree cuối.
- `npm run build --prefix client`: exit 0; Vite build và bundle budget PASS. Prerender tạo
  `0/38` pages do môi trường thiếu `VITE_API_URL` và network không tải được Google Fonts, nên không
  được xem là rendered evidence hợp lệ.
- `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high`: PASS —
  0 regression mới, 0 high-confidence blocking, 10 findings resolved.
- `npm run security:secrets`, `npm run security:data-boundaries`, `npm run agents:validate` và
  `git diff --check`: PASS.
- Manual desktop/mobile: SKIP — browser local bị chuyển tới `/login`, không có browser session khác
  đã đăng nhập. Không có E2E mutation hoặc data write được thực hiện.
- Independent review: sáu finding về privacy, correction notification, trainer metrics, empty report,
  focus management và focused-test command đã được sửa và regression-test lại.

## Done Criteria

- [x] Tất cả requirement trong spec có test hoặc verification evidence.
- [x] Không migration/data write và không thay production.
- [x] Dữ liệu legacy tương thích; correction limit do backend enforce.
- [x] Client lint/build, UI regression và boundary scans được báo chính xác.
- [x] Không còn debug log/unused import do thay đổi tạo ra.
- [x] `docs/plans/README.md` chuyển status sang kết quả thực tế.

## STOP Conditions

- Cần rename/xóa field legacy hoặc backfill database.
- Deep-link đúng ngữ cảnh yêu cầu nới trainer ownership hoặc lộ private note.
- Thay đổi cần chạm auth/CSRF/JWT hoặc production configuration.
- Verification cùng nguyên nhân fail quá ba vòng.

## Maintenance Notes

- `correctionCount` và body-composition field là server-authoritative; client label không được dùng làm policy.
- Nếu sau này lấy số đo từ InBody/provider, phải ghi source/time và quyết định precedence bằng spec mới.
- Audit Việt hóa toàn site là follow-up riêng; release này chỉ sửa catalog/surface trực tiếp liên quan.
