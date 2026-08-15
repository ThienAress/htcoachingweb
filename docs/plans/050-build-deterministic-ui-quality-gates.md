# Plan 050: Xây UI quality gates deterministic và pilot icon morph có kiểm soát

> **Hướng dẫn thực thi**: Thực hiện theo thứ tự Phase 1 → 4. Chỉ chuyển phase khi
> verification của phase hiện tại exit `0`. Nếu một gate fail sau tối đa ba vòng sửa
> có căn cứ, dừng và báo cáo; không bỏ qua gate hoặc tự hạ mức lỗi.
>
> **Drift check**: Trước mỗi phase, chạy `git status --short` và đọc diff của mọi
> file in-scope đã tồn tại. Không ghi đè thay đổi ngoài task; nếu file hotspot thay đổi
> chồng lấn thì dừng phase đó.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 017, 030, 046
- **Category**: dx, tests, perf
- **Planned at**: 2026-08-14
- **Execution**: COMPLETE / LOCAL VERIFIED — READY FOR STAGING

## Why This Matters

`$ui-check` hiện bao phủ brand/taste nhưng phụ thuộc review của model, còn Axe/Playwright
chỉ thấy những route đã render. Plan này bổ sung scanner source deterministic có rule ID,
confidence, evidence và baseline regression; thêm rendered overflow gate; sau đó mới pilot
Morphicons tại một state control hẹp. Mục tiêu là bắt regression mới có bằng chứng, không
chạy theo điểm 100 và không biến HTCOACHINGWEB thành shadcn app.

## Current State

- `AGENTS.md` liệt kê build, tests, security và agent validation nhưng chưa có UI source audit command.
- `.agents/skills/ui-check/SKILL.md` dùng `rg` + model review; chưa có JSON/ruleset/baseline contract.
- `e2e/accessibility.spec.js` chạy Axe trên public, admin, trainer, F1 và dashboard surfaces.
- `client/src/pages/F1CustomersPage/F1Customers.jsx:250` swap `Menu` và `X` trực tiếp.
- `client/package.json` dùng React 19, Vite 8, Tailwind 4 và `lucide-react`; chưa có Morphicons.
- Working tree có thay đổi ngoài task; Phase 2 tạo spec mới và Phase 3 chỉ sửa F1 file đang sạch.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Scanner tests | `node --test scripts/ui-audit/*.test.mjs` | exit 0 |
| Scanner | `npm.cmd run ui:audit` | exit 0, deterministic report |
| Overflow E2E | `npx.cmd playwright test e2e/ui-overflow.spec.js --project=chromium` | exit 0 |
| Client QA | `npm.cmd run test:unit:client` + `npm.cmd run build --prefix client` | exit 0 |
| Agent contract | `npm.cmd run agents:validate` | exit 0 |

## Scope

**In scope**:

- `scripts/ui-audit/**`, root `package.json`, root `package-lock.json`
- `e2e/ui-overflow.spec.js`
- `client/src/components/motion/**`, `client/src/pages/F1CustomersPage/F1Customers.jsx`
- `client/package.json`, `client/package-lock.json`
- `AGENTS.md`, `.agents/skills/ui-check/**`, `.agents/reference/agent-workflow-map.md`
- `.github/workflows/ci.yml`
- Plan 050 và `docs/plans/README.md`

**Out of scope**:

- Không sửa các UI file đang dirty ngoài F1 pilot.
- Không thay toàn bộ `lucide-react`, không thêm shadcn và không dùng Shadscan hosted/API.
- Không tự sửa findings cũ do scanner phát hiện.
- Không chạy deploy, production write, migration, commit hoặc push.

## Steps

### Phase 1: Thêm deterministic source audit và agent contract

Tạo CLI không phụ thuộc dịch vụ ngoài, scan `client/src`, phát findings có rule ID,
category, severity, confidence, status, file:line, stable key và remediation. Hỗ trợ
`human`, `json`, `prompt`, category filter và baseline regression. Bộ v1 tập trung vào
accessible names, image alt, form button type, autocomplete, focus visibility, nested
interactive controls, transition-all, reduced motion, gradient text, bounce easing và
extreme z-index. Default là informational; chỉ option regression mới có quyền exit non-zero.

**Verify**: scanner unit tests, hai lần JSON output giống nhau sau khi loại field thời gian,
`npm.cmd run ui:audit`, `npm.cmd run agents:validate` đều exit `0`.

### Phase 2: Thêm rendered horizontal-overflow gate

Tạo Playwright spec mới ở viewport `320×820` và `1440×1000`, kiểm tra các public và
authenticated shell đã có mock API. Khi fail, report route, viewport, document width và
bounded culprit selectors. Không sửa các E2E spec đang dirty.

**Verify**: targeted Chromium spec exit `0`. Nếu web server/browser không khởi động được,
Phase 2 là BLOCKED và không chuyển Phase 3.

### Phase 3: Pilot Morphicons qua wrapper nội bộ

Cài version Morphicons chính xác, tạo `MorphStateIcon` cho Product surface với
`reducedMotion="user"`, spring không bounce, accessible decorative/label behavior và raw
stroke geometry nội bộ để không thêm icon pack thứ hai. Chỉ thay swap `Menu ↔ X` của F1;
giữ state, focus, aria-expanded và drawer behavior hiện tại.

**Verify**: focused component contract test, client unit tests, lint/build và F1 mobile E2E
đều exit `0`; manifest/bundle budget không vượt gate hiện có.

### Phase 4: Bật regression workflow có baseline và handoff

Ghi baseline snapshot cho findings hiện hữu mà không gọi chúng là accepted waiver; CI chạy
scanner và chỉ fail khi xuất hiện HIGH-confidence regression mới hoặc ruleset/baseline drift.
Agent instructions phải yêu cầu chạy deterministic audit trước phần manual `$ui-check`, đọc
evidence rồi mới sửa và không ép advisory thành pass.

**Verify**: baseline test chứng minh finding cũ không fail/finding mới fail; CI syntax được
review; `agents:validate`, scanner tests, full client QA và focused E2E pass.

## Test Plan

- Node tests cho CLI args, deterministic ordering, multiline JSX, confidence/status,
  category filter, prompt output, baseline ruleset mismatch và new-high regression.
- Playwright test cho overflow ở hai viewport với diagnostics bounded.
- Client test cho MorphStateIcon luôn truyền reduced-motion policy và giữ decorative semantics.
- F1 E2E xác minh aria-expanded, toggle liên tiếp và reduced-motion không phá drawer.

## Verification Log

- **2026-08-14 — Phase 1 PASS**: `npm.cmd run test:ui-audit` (6/6), deterministic JSON comparison, `npm.cmd run ui:audit` và `npm.cmd run agents:validate` đều exit `0`. Burn-in trên 453 source files tạo informational debt report; không sửa findings hiện hữu.
- **2026-08-14 — Phase 2 PASS**: targeted Chromium overflow gate pass 12/12 ở `320×820` và `1440×1000` cho public, auth, admin, trainer, customer và F1 shells. Playwright-managed server teardown bị kẹt trên Windows; verification cuối reuse hai process ẩn do command sở hữu rồi cleanup đúng PID, exit `0`.
- **2026-08-14 — Phase 3 PASS**: pin `morphicons@1.7.0`; wrapper contract 2/2, client unit 451/451, lint, UI audit, F1 mobile morph E2E và release build/bundle budget đều exit `0`. Prerender dùng fallback và render 0/38 do local env thiếu `VITE_API_URL` cùng network font bị chặn; không dùng lần build này làm SEO/prerender evidence.
- **2026-08-14 — Phase 4 PASS**: scanner 9/9 tests; ruleset `2026.08.2`; baseline gate `0 new / 0 blocking`; probe xác minh regression mới trả exit `1`; agents validator 28/28; focused E2E 13/13; client unit 451/451, lint, `npm ci --dry-run`, release build, prerender CI-mode 9/9 và bundle budget đều pass. CI workflow chạy scanner tests + baseline regression gate.

## Residual Environment Note

- Dependency audit client/server đã PASS sau khi staging branch cập nhật lockfile remediation.
- Local release build compile/bundle pass nhưng prerender cần `VITE_API_URL` và API network; E2E
  targeted vẫn pass 41/41 với mock API. Không coi 0/68 local prerender là SEO evidence.

## Done Criteria

- [x] Bốn phase đạt gate theo đúng thứ tự.
- [x] `npm.cmd run ui:audit` là command canonical và được AGENTS/skill tham chiếu.
- [x] CI chỉ fail regression mới, không fail vì advisory hoặc debt baseline.
- [x] Morphicons chỉ được dùng qua wrapper và chỉ pilot một control.
- [x] Build/bundle budget, client tests, focused E2E và agent validator pass.
- [x] Không sửa findings/UI ngoài scope và không ghi đè working-tree changes của user.
- [x] Plan/index phản ánh verification thực tế.

## STOP Conditions

- File F1, package manifests, agent skill hoặc CI xuất hiện thay đổi chồng lấn sau drift check.
- Scanner cần execute source/project scripts để phân tích.
- Overflow E2E không thể pass do môi trường sau ba vòng chẩn đoán có căn cứ.
- Morphicons yêu cầu dependency/icon pack thứ hai hoặc làm bundle budget fail.
- CI không thể phân biệt debt baseline với regression mới một cách deterministic.

## Maintenance Notes

- Rule mới phải tăng `rulesetVersion`, có tests và cập nhật baseline có review.
- Baseline là snapshot debt, không phải waiver; waiver thật cần reason, owner và review date.
- Component render graph và auto-apply agent được defer cho tới khi có evidence về false negative.
- Morphicons không được dùng cho navigation decoration hoặc thay thế toàn bộ Lucide.
