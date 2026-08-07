# Plan 028D Tasks: Pilot OpenSEO read-only MCP

Status: TASKS APPROVED — OPERATIONAL APPROVALS REQUIRED
Parent: `028-build-seo-conversion-analytics.md`
Depends on: 028B release gate; Docker/DataForSEO are separate operational approvals

## Boundary

- OpenSEO chạy ngoài core HTCOACHINGWEB, database/secret riêng và localhost-only trong pilot.
- Không đưa customer/health/lead data, Google credential hoặc HT mutation vào OpenSEO/MCP.
- Chỉ cached-read tools được phép tự chạy; live/paid/crawl operations cần xác nhận từng lần.
- Không cài Docker, mua credit, clone/chạy external service hoặc expose port khi chưa có approval riêng.

## Tasks

- [ ] Task D1: Viết operational preflight và threat boundary
  - Acceptance: Ghi rõ pinned image/commit, localhost ports, secret locations, backup/cleanup, cost ceiling, data classification và shutdown procedure; không có secret value.
  - Verify: `npm run security:secrets` và markdown link check pass; reviewer có thể xác định mọi network/data boundary từ runbook.
  - Files: `docs/operations/runbooks/openseo-pilot.md`.

- [ ] Task D2: Chốt pilot dataset và success metrics
  - Acceptance: 30–50 keyword tiếng Việt/mobile, 3–5 competitors, cadence 30 ngày; metrics gồm rank coverage, useful findings, false positives, API spend và operator time; không chứa PII.
  - Verify: Checklist đủ keyword owner, locale/device, budget và stop threshold trước paid call đầu tiên.
  - Files: `docs/operations/openseo-pilot-dataset.md`, runbook D1.

- [ ] Task D3: Audit native MCP tool inventory
  - Acceptance: Mỗi tool phân loại cached-read/live-read/paid/mutation/credential; ghi input/output, side effect, auth và cost; tool chưa chứng minh được coi là denied.
  - Verify: Inventory không có unclassified callable tool và map đủ sang allow/ask/deny policy.
  - Files: `docs/audits/openseo-mcp-tool-inventory.md`, runbook D1.

- [ ] Task D4: Quyết định read-only connection strategy
  - Acceptance: Native MCP chỉ được chọn nếu enforce allowlist ngoài prompt; nếu không, giữ disabled hoặc đặc tả bounded proxy chỉ đọc cache; owner/Codex là audience duy nhất.
  - Verify: Threat review thử credential exfiltration, paid-call bypass, mutation, arbitrary URL/path và cross-database access; mọi case phải bị deny/ask đúng policy.
  - Files: `docs/architecture/openseo-readonly-mcp.md`, inventory D3, runbook D1.

- [ ] Task D5: Chạy local pilot sau approval hạ tầng
  - Acceptance: Pinned version chạy localhost-only; không customer data; budget/paid-call confirmations hoạt động; output không ảnh hưởng core app; shutdown/cleanup được kiểm chứng.
  - Verify: Runbook evidence gồm version digest, bound interface, denied tool tests, spend snapshot và no-secret scan; không ghi credential value.
  - Files: Chỉ cập nhật evidence/status trong D1–D4; external OpenSEO repo không được sửa nếu chưa có scope riêng.

- [ ] Task D6: Đánh giá 30 ngày và quyết định giữ/bỏ
  - Acceptance: So actual metrics/cost với threshold; giữ, điều chỉnh hoặc tắt pilot bằng quyết định có bằng chứng; không mặc định deploy Internet-facing.
  - Verify: Báo cáo có outcome, cost, incidents, false positives và next decision; Plan 028D chỉ DONE khi boundary tests vẫn pass.
  - Files: `docs/reports/openseo-pilot-review.md`, file này, `docs/plans/README.md`.

## STOP Conditions

- Docker/runtime không có hoặc yêu cầu expose `local_noauth` ra Internet.
- Native MCP không enforce được tool/cost/data boundaries ngoài prompt và không chấp nhận disabled/proxy fallback.
- Bất kỳ bước nào cần customer/health/lead data hoặc Google production credential.
- Paid API/crawl/live write được yêu cầu nhưng chưa có approval và budget cụ thể.
