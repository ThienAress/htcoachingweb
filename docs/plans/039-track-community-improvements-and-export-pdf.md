# Plan 039: Theo dõi vòng đời cải tiến và xuất báo cáo PDF

> **Hướng dẫn thực thi**: triển khai theo vertical behavior slice và test RED trước. Không thêm database,
> migration, Admin mutation, production write hoặc tự suy trạng thái từ Git/test/deploy.
>
> **Drift check**: Plan 038 đang có working-tree diff chưa commit tại catalog, bảng Admin và tests. Giữ nguyên
> toàn bộ thay đổi đó, chuyển contract theo expand-contract và không chạm `.vscode/` hay các file SEO/Meal Plan ngoài scope.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — đổi Admin API contract, thêm report endpoint và PDF tiếng Việt
- **Depends on**: 033, 038
- **Category**: feature | reporting | ux
- **Planned at**: 2026-08-10
- **Execution**: RELEASE CANDIDATE VERIFIED — STAGING PENDING

## Why This Matters

Bảng hiện tại lưu cơ hội và kết quả mới nhất nhưng không đủ dữ liệu để thay cơ hội cũ mà vẫn tái tạo đúng lịch sử.
Feature này tách roadmap hiện tại khỏi change log bất biến, giúp Admin biết ngày nào cải thiện tính năng nào và tải
báo cáo PDF chính xác từ cùng nguồn canonical backend.

## Current State

- `server/src/constants/communityFeatureCatalog.js` dùng `initialImprovement` và `deliveryUpdates`; history chưa có snapshot sáu trường.
- `server/src/services/serviceAccessPolicy.service.js` trả catalog trực tiếp trong Admin matrix.
- `server/src/routes/serviceAccessPolicy.routes.js` chỉ có `GET /` admin-only.
- `client/src/pages/admin/service-access-policies/CommunityFeatureTable.jsx` render kết quả nhưng chưa có report controls.
- `server/src/templates/BeVietnamPro-Regular.ttf` và `BeVietnamPro-Bold.ttf` đã tồn tại; server đã có `pdf-lib` + fontkit.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Server focused | `npm run test:unit:server -- src/services/__tests__/communityFeatureReport.service.test.js src/services/__tests__/communityFeatureReportPdf.service.test.js src/routes/__tests__/serviceAccessPolicy.routes.integration.test.js` | exit 0 |
| Client focused | `npm run test:unit:client -- src/pages/admin/service-access-policies/__tests__/serviceAccessPolicyPresentation.test.js` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Release build | `npm run build --prefix client` | exit 0 |
| Hygiene | `git diff --check` | no whitespace error |

## Scope

**In scope**:

- Catalog + compatibility serializer: `communityFeatureCatalog.js`, `serviceAccessPolicy.service.js`.
- Report/PDF API: route, controller, two focused services và tests.
- Admin UI: service/query/query key, page, table, presentation helper/test và report toolbar mới.
- Canonical docs: service-access policy spec, Plan 039 và plan index.

**Out of scope**:

- Mongoose model, migration, GridFS, audit mutation hoặc editor cho Admin.
- Thay AI quota, provider, prompt, SSE hoặc quyền truy cập dịch vụ.
- Deploy, production verification hoặc tự nâng milestone lên `production_verified`.
- Refactor các file UI lớn/backup hoặc thay route registration trong `server/server.js`.

## Steps

### Step 1: Trả report read model từ lịch sử canonical

Đổi catalog sang `currentImprovement` + `improvementHistory`, mỗi history record có immutable snapshot và milestone.
Serializer chính phát contract mới cùng alias cũ được derive. Thêm report service parse/filter date, group, status và
tính summary từ cùng catalog.

**Behavior**: cơ hội hiện tại có thể đổi mà history cũ vẫn giữ đúng sáu trường; JSON report theo khoảng ngày chính xác.

**Verify**: unit report tests + Admin route integration, gồm invalid date/group/status và non-admin `403`.

### Step 2: Xuất PDF từ đúng report read model

Sinh PDF A4 ngang bằng `pdf-lib`, embed hai font Be Vietnam Pro, wrap text, lặp table header khi sang trang và dùng sáu cột
đã duyệt. Endpoint `.pdf` dùng cùng filters/report builder, trả attachment và `private, no-store`.

**Behavior**: cùng filter cho JSON/PDF có cùng summary/event count; tiếng Việt không lỗi dấu.

**Verify**: PDF service test load được bytes, có page và endpoint trả đúng headers; không ghi file/GridFS.

### Step 3: Hiển thị thống kê và tải PDF trên Admin

Đổi column thành `Cơ hội cải thiện hiện tại`/`Kết quả gần nhất`. Thêm toolbar Product UI dùng group hiện tại,
date range và status; query summary server-authoritative, có loading/error/retry và mutation download blob.

**Behavior**: Admin chọn kỳ/trạng thái, thấy thống kê tương ứng và tải đúng PDF; empty/filter states rõ ràng.

**Verify**: presentation tests, scoped ESLint và rendered check desktop/mobile nếu runtime cho phép.

### Step 4: Re-trace và release gate

Trace catalog → serializer → JSON/PDF endpoints → client query/download; chạy QA, UI check, code review,
security/agent gates và cleanup. Không đánh dấu release-ready nếu build/tests bị environment chặn.

## Test Plan

- Report service: defaults, inclusive date range, group/status filters, invalid query, sorting và summary.
- PDF service: valid `%PDF`, load bằng `PDFDocument`, multipage khi nhiều rows và no-history message.
- Route: admin JSON/PDF, non-admin `403`, invalid filter `400`, attachment/cache headers.
- Client presentation: latest milestone, date range defaults và fail-closed unknown history shape.

## Done Criteria

- [x] Catalog chỉ có một nguồn `currentImprovement` + `improvementHistory`; alias cũ được derive.
- [x] JSON/PDF dùng chung filter và report read model admin-only.
- [x] PDF sáu cột, font Việt, wrap/page-break đúng và không lưu server.
- [x] UI có summary, date/status filters, retry/download states và tên cột mới.
- [x] Không schema/migration, quota change, production write hoặc secret.
- [x] Focused tests/build/QA có evidence thật; report/PDF contract và Admin download E2E đều pass.
- [x] Plan index và spec canonical đã cập nhật.

## Execution Evidence

### Passed

- Release re-validation: build PASS, prerender 785/785, bundle budget PASS; client 328/328, server 606/606 và
  Chromium E2E 78/78 PASS.
- Report/PDF E2E PASS sau khi locator được scope vào report region; Admin layout giữ nút tải trong viewport bằng
  `min-w-0` tại flex boundary.
- Secret/data-boundary/dependency/runtime logging/commercial/ops security gates PASS; Codex security preflight-only.
- Scoped client ESLint cho page, table, report toolbar, presentation helper/test, query và service: exit `0`.
- `node --check` cho report service, PDF service, controller, route và hai server test files: exit `0`.
- Direct Node contract checks: report filter/timeline/compatibility aliases, PDF `%PDF-` một trang và 60 dòng nhiều trang,
  controller JSON/PDF mock contract đều đạt kỳ vọng.
- `npm run agents:validate`: `ALL PASS` với 28 skills, không warning.
- `git diff --check`: không có whitespace error.
- Review cuối đã tách version snapshot lịch sử khỏi catalog version hiện tại và giữ đúng label nhóm từ snapshot lịch sử.

### Initial sandbox blockers — superseded by release re-validation

- Focused client/server Vitest dừng khi load config với `[plugin externalize-deps] Error: spawn EPERM`; chưa chạy assertion.
- `npm run build --prefix client` dừng khi Vite load config với native Tailwind dependency không load được và
  `spawn EPERM`; chưa chạy bundle. Dynamic route prebuild chỉ báo nguồn local `ECONNREFUSED` và giữ route hiện có.
- `npm run security:secrets` và `npm run security:data-boundaries` không enumerate được Git vì child process
  `spawnSync git EPERM` trong sandbox.
- Browser local chuyển về login vì không có Admin session; chưa thể xác minh trực quan timeline/download trong runtime.

Các blocker trên chỉ thuộc lần chạy sandbox ban đầu và đã được supersede bằng release evidence thật. Chưa có production
verification hoặc production write trong Plan 039.

## STOP Conditions

- Cần cho Admin chỉnh history trực tiếp hoặc cần lưu báo cáo vào database/GridFS.
- Không thể embed font tiếng Việt từ asset repo hiện có.
- Report JSON và PDF phải dùng hai nguồn/filter semantics khác nhau.
- Cần thay auth/CSRF/quota hoặc route public ngoài scope.
- Cùng verification fail ba vòng sau các sửa có căn cứ.

## Maintenance Notes

- Không sửa snapshot lịch sử cũ; khi metadata feature thay đổi, tạo snapshot mới cho record mới.
- Chỉ append milestone theo tiến trình và chỉ gắn `production_verified` sau live verification.
- Khi bỏ compatibility alias, phải trace toàn bộ client/consumer trước trong plan riêng.
