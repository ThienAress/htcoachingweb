# Plan 108: Build the self-sculpting looping preview by approval phases

> **Hướng dẫn thực thi**: Follow plan step by step. Chạy verification command và
> xác nhận kết quả trước khi chuyển step. Gặp STOP condition thì dừng, không mở rộng scope.
>
> **Drift check**: `git status --short`, đọc `client/src/App.jsx`, transition modules
> và mobile tools trong `client/src/sections/Header/Header.jsx`; dừng nếu route contract đổi.

## Status

- **Priority**: P1
- **Complexity**: MODERATE
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: 2026-09-14
- **Lifecycle**: IN PROGRESS
- **Verification**: LOCAL FULL — LOOPING PREVIEW READY FOR APPROVAL
- **Rollout**: NOT STARTED
- **Owner**: root
- **Updated at**: 2026-09-15

## Why This Matters

Animation 5 giây và visual đã được user duyệt qua ba phase. Route integration từng
được thử ở Phase 4, sau đó user yêu cầu giữ preview lặp vô hạn và không chuyển
trang. Runtime hiện tại vì vậy không còn preload, navigate hoặc cooldown; dialog
chỉ dừng khi user đóng.

## Current State

- `client/src/App.jsx` lazy-load hai page mục tiêu và mount global transition boundary
  bên trong `BrowserRouter`.
- `client/src/components/transitions/SculptNavigationBoundary.jsx` intercept semantic
  link toàn app nhưng chỉ mở preview cho đúng hai exact route.
- `client/src/components/transitions/SculptTransitionOverlay.jsx` chịu trách nhiệm
  dialog, focus, scroll-lock và GSAP looping preview.
- `client/src/components/transitions/SculptFigure.jsx` render approved WebP; scene
  tách 16 logical layers/targets cho animation.
- `client/src/sections/Header/Header.jsx` mobile tools dùng `Link` và đóng menu bằng
  `onClick`, giúp capture boundary chạy mà vẫn giữ state menu đúng.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused unit | `cd client; npx vitest run src/components/transitions/__tests__` | exit 0 |
| Client unit | `npm run test:unit:client` | exit 0 |
| Lint | `npm run lint --prefix client` | exit 0 |
| UI gate | `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high` | exit 0, 0 new high |
| Compile | `cd client; npx vite build` | exit 0 |
| Bundle budget | `npm run check:bundle --prefix client` | exit 0 |

## Scope

**In scope**:

- `client/src/App.jsx`
- `client/src/sections/Header/Header.jsx`
- `client/src/components/transitions/*`
- `e2e/sculpted-route-transition.spec.js` — regression loop, URL ổn định, cleanup và static fallback
- Spec, plan, plan index/state và traceability của Plan 108

**Out of scope**:

- Programmatic redirect, browser back/forward và transition cho route ngoài scope
- Three.js/R3F/WebGL, package dependency changes và asset có license chưa xác minh
- Route/API/schema/SEO/sitemap/prerender changes
- Transition cho exercise detail, back/forward hoặc programmatic redirects
- Refactor Header hoặc App ngoài vùng tích hợp cần thiết

## Steps

### Step 1: Lock the preview-only click contract

Đổi policy từ `animate + cooldown` sang `openPreview + motion`. Test RED rồi GREEN
cho exact routes, bỏ cooldown, static fallback và native modified-click semantics.

**Behavior**: click hợp lệ mở preview; không có đường gọi preload/navigate.

**Blast radius**: policy, boundary và focused tests trong transitions.

**Depends on**: none.

**Verify**: focused Vitest command → exit 0.

### Step 2: Render the five-second self-sculpting loop

Thay key visual bằng SVG có thân dưới thô lớn, thân trên cơ bắp, tay cầm búa/đục;
orchestrate impact/reveal/reset bằng timing contract 5 giây và `repeat: -1`. Thêm nút
đóng, Escape, focus restoration và shared modal scroll lock.

**Behavior**: scene lặp cho tới khi đóng; reduced-motion/Save-Data giữ keyframe tĩnh.

**Blast radius**: figure, motion contract, overlay, boundary và App wrapper.

**Depends on**: Step 1.

**Verify**: focused Vitest, lint, compile và rendered desktop/mobile check.

### Step 3: Re-trace, review and close QA

Rerun route/link trace, kiểm working-tree diff theo Standards/Spec/Security-Operations,
dọn dead coordinator/preload code và cập nhật artifacts/evidence Plan 108.

**Behavior**: không consumer ngoài scope đổi semantics; docs phản ánh đúng preview tạm thời.

**Blast radius**: transition modules và Plan 108 artifacts.

**Depends on**: Step 2.

**Verify**: client unit, lint, UI gate, compile, bundle budget và `git diff --check`.

### Step 4: Revise the continuous-body visual without changing preview mode

Trong `SculptFigure.jsx`, giảm chiều ngang đá dưới, dựng một torso–chân liên tục,
thêm outer shell ôm bụng/eo/đùi che muscle core lúc đầu; tay trái giữ đục chạm
shell, tay phải giơ búa với pivot ở vai. Dùng graphite pseudo-3D và surface texture
nhẹ; thay HUD rings bằng spotlight và shockwave chỉ hiện lúc impact. Trong
`SculptTransitionOverlay.jsx`, đồng bộ shell/cracks/reveal/debris/shockwave với
timeline 5 giây hiện có, giữ modal/close/reduced-motion. Title giảm tracking.

**Behavior**: keyframe trước va chạm đọc như một người đang tự đục vỏ đá; nhát
đục reveal cơ phía dưới, rồi vòng lặp reset, URL không đổi.

**Blast radius**: figure, overlay, focused visual contract test, spec/plan.

**Depends on**: Steps 1–3 đã hoàn thành trong phiên trước.

**Verify**: focused Vitest và rendered desktop/mobile trước–sau impact, sau đó
client unit, lint, UI gate, compile, bundle budget → exit 0.

### Step 5: Phase 1 approved static composition and layer architecture

Thay SVG mascot bằng ảnh được user duyệt trực tiếp, lưu thành WebP 1672×941;
render full-bleed trong một
static scene có 16 logical layers/anchors đúng brief. Background procedural giữ
base, spotlight, vignette, haze và halo; overlay bỏ render-time GSAP và ghi rõ
Phase 1. Không thay click policy, route, cooldown/navigation hoặc đi tiếp Phase 2.

**Behavior**: click hai route vẫn mở dialog nhưng scene đứng yên; desktop/mobile
giữ nhân vật, búa, đục và rubble trong focal crop; URL không đổi.

**Blast radius**: figure/static scene/layer manifest/overlay, visual-contract tests,
spec và Plan 108 artifacts.

**Depends on**: user override cho phép dùng trực tiếp approved PNG.

**Verify**: focused Vitest, rendered desktop/mobile, client unit, lint, UI gate,
compile, bundle budget và `git diff --check`.

### Step 6: Prepare the nine animation states without running a timeline

Thêm state contract đúng thứ tự brief và active-layer mapping. Nâng 16 layer
anchors thành approved-raster masks cùng procedural/vector targets cho hammer arc,
impact, cracks, debris, dust và transition cover. Overlay có inspector Trước/Sau
để duyệt snapshot từng state; không autoplay, không GSAP timeline và không route
switch.

**Behavior**: user duyệt vòng chín trạng thái bằng click hoặc phím mũi tên; URL
không đổi, close/Escape/focus/scroll lock giữ nguyên.

**Blast radius**: state contract, scene/figure/overlay/inspector, focused tests,
spec và Plan 108 artifacts.

**Depends on**: user đã duyệt Phase 1 và yêu cầu sang Phase 2.

**Verify**: state/scene RED → GREEN, focused transition suite, rendered desktop và
mobile, lint, UI gate, compile, bundle budget và `git diff --check`.

### Step 7: Animate the approved state architecture

Orchestrate chín state bằng GSAP trong chu kỳ đúng 5 giây: anticipation `0.75s`,
hammer swing `1.45s`, impact `2s`, shell crack/breakup và muscle reveal, debris
expansion, transition cover `3.55s`, reset phía sau cover từ `4.35s`. Thay state
inspector Trước/Sau bằng status cùng Tạm dừng/Tiếp tục và Phát lại. Reduced-motion
hoặc Save-Data giữ ảnh tĩnh, không tạo timeline.

**Behavior**: preview tự chạy và lặp tới khi đóng; URL không đổi, không cooldown,
không preload hoặc navigate. Cleanup timeline khi unmount.

**Blast radius**: motion contract, scene/overlay/playback control, focused tests,
spec và Plan 108 artifacts.

**Depends on**: user đã duyệt Phase 2 và yêu cầu sang Phase 3.

**Verify**: motion/scene RED → GREEN, focused transition suite, rendered desktop và
mobile, pause/replay/reduced-motion, client QA gates và `git diff --check`.

### Step 8: Revert route integration to a looping preview

Theo yêu cầu mới nhất của user, đổi click contract Phase 4 trở lại preview-only.
Boundary không preload hoặc gọi `useNavigate`; overlay không có transition variant,
callback route switch/complete hay nút bỏ qua. Timeline luôn dùng `repeat: -1`, đi
qua cover rồi reset về `idle` trong cùng dialog. Reduced-motion/Save-Data vẫn mở
preview tĩnh và URL tiếp tục đứng yên.

**Behavior**: click `/exercises` hoặc `/tdee-calculator` mở animation loop; dialog
không tự đóng và không chuyển trang. Nút đóng/Escape chỉ đóng preview; có thể mở lại
ngay vì không có cooldown.

**Blast radius**: policy, navigation boundary, timeline/overlay, focused tests, E2E,
spec và Plan 108 artifacts. Xóa module cooldown/preload không còn consumer.

**Depends on**: user đã yêu cầu rõ “loop đi, đừng chuyển trang”.

**Verify**: policy/motion/overlay focused tests; E2E URL ổn định qua trọn chu kỳ,
desktop/mobile cleanup; client QA gates, bundle budget và `git diff --check`.

## Test Plan

- `sculptTransitionPolicy.test.js`: exact route/trailing slash/query/hash;
  detail/external, modifier/target/download bypass; same-location vẫn mở preview;
  không cooldown và reduced-motion/Save-Data mở preview tĩnh.
- `sculptTransitionMotion.test.js`: preview `cycleSeconds: 5`, `repeat: -1`;
  impact `2s`, cover `3.55s` và reset trước chu kỳ kế tiếp.
- Visual/manual: desktop 1280×800 và mobile 390×844; URL giữ nguyên qua cover/reset,
  dialog tiếp tục loop; close/Escape/mobile menu cleanup.
- `e2e/sculpted-route-transition.spec.js`: regression giữ dialog/URL sau hơn thời
  lượng danh nghĩa 5 giây, mở lại ngay, mobile Exercises, close/Escape và static fallback.
- `sculptFigure.test.jsx`: render static markup, kiểm body core/shell/tool contact,
  no HUD rings và các target cần cho timeline.
- `sculptTransitionFocus.test.js` và `useModalScrollLock.test.js`: link còn hiển
  thị nhận lại focus; link trong drawer `inert` trả focus về nút menu; scroll lock
  chỉ được thả khi cả menu và preview cùng đóng, không phụ thuộc thứ tự cleanup.
- `sculptAnimationStates.test.js`: đúng chín state theo thứ tự brief và inspector
  wrap từ đầu/cuối mà không cần timeline.

## Done Criteria

- [x] Hai exact route mở preview, không navigate và không cooldown.
- [x] Timeline khai báo chu kỳ 5 giây và lặp vô hạn cho tới khi đóng.
- [x] Key visual SVG đọc được một silhouette, fat shell bao bụng/eo/đùi, búa/đục
  đúng điểm va chạm và vùng cơ reveal sau cú đánh.
- [x] Reduced-motion/Save-Data, modifier/new-tab/detail route đúng contract.
- [x] GSAP timeline, document listener và scroll lock cleanup khi đóng.
- [x] Không dependency mới; focused/full client, lint, UI gate, compile/budget có evidence.
- [x] Phase 1 render static approved raster và đủ 16 layer/anchor, không mount timeline.
- [x] User duyệt static composition để cho phép bắt đầu Phase 2.
- [x] Phase 2 chuẩn bị đủ chín state, active layers và visual targets; timeline off.
- [x] User duyệt state architecture để cho phép bắt đầu Phase 3.
- [x] Phase 3 có timeline 5 giây, impact `2s`, cover `3.55s` và loop vô hạn.
- [x] Pause/resume/replay hoạt động; reduced-motion/Save-Data giữ scene tĩnh.
- [x] User duyệt chuyển động Phase 3 trước khi bắt đầu Phase 4.
- [x] Route switch/preload/cooldown Phase 4 đã được gỡ theo yêu cầu mới nhất.
- [x] Dialog tiếp tục loop sau `transition-cover`; close/Escape không điều hướng.

## STOP Conditions

- Cần intercept programmatic navigation hoặc đổi router contract.
- Build chỉ pass nếu nâng bundle budget hoặc thêm dependency ngoài scope.
- Phải dùng ảnh tham khảo có watermark hoặc asset license chưa xác minh.
- Cùng một verification fail ba vòng sau các sửa có căn cứ.

## Maintenance Notes

- Route mới không tự nhận preview; phải được user chốt rồi thêm policy/tests.
- Route integration Phase 4 là evidence lịch sử, không còn là product contract.
- Approved raster composite được dùng trực tiếp theo yêu cầu user; các duplicate
  masks/procedural targets không phải bitmap alpha đã segment độc lập.

## Verification Evidence

- Phase 1 visual-contract RED: static-scene module/layer manifest chưa tồn tại và
  figure còn render inline SVG; GREEN: focused transition suite 5 files/26 tests.
- User cho phép dùng trực tiếp approved reference. Project asset được chuyển từ
  PNG 1,720,821 bytes sang visually verified WebP 126,902 bytes; PNG gốc trên
  Desktop không bị sửa hoặc xóa.
- Rendered desktop 1440×900 và mobile 390×844 từ WebP cuối: 16 layer DOM đúng thứ
  tự, 0 animation-state node, URL giữ `/`, búa/chisel/rubble nằm trong crop và nút
  đóng không che focal point.
- Phase 1 client QA: full unit 170 files/788 tests pass khi chạy tuần tự; compile
  `npx vite build` pass; lint exit 0 với warning cũ ngoài scope tại
  `TrainerTransferPanel.jsx:91`; UI regression gate 0 new/34 resolved; bundle
  budget pass, entry 537.8 KiB raw/169.0 KiB gzip; agent validator và
  `git diff --check` exit 0. Canonical E2E/release prerender không chạy vì đây là
  static approval gate, chưa phải release.
- Một lần full client chạy song song với compile/lint bị timeout tại test trainer
  không liên quan. Test đó pass 9/9 khi chạy riêng và full suite pass 788/788 khi
  chạy tuần tự; không sửa module trainer.

- Policy RED: 18/18 fail đúng vì runtime cũ còn trả `animate`, cooldown và bypass
  reduced-motion/Save-Data.
- Policy GREEN: 18/18 pass sau khi chuyển sang preview-only contract.
- Motion RED: suite fail đúng vì timing contract chưa tồn tại.
- Focused: 2 files, 19 tests pass. Full client: 167 files, 779 tests pass.
- Lint exit 0; một warning cũ tại `TrainerTransferPanel.jsx:91`, ngoài scope.
- UI regression gate: 0 finding mới; secret scan và agents validation pass.
- `npx vite build` compile pass; `npm run check:bundle --prefix client` pass,
  entry 546.5 KiB raw / 171.8 KiB gzip dưới budget 600/200 KiB.
- Manual Playwright diagnostic desktop 1280×800: URL trước/trong/sau là `/`,
  dialog/nút đóng hiện, focus vào nút rồi trả về CTA. Mobile 390×844 với
  reduced-motion: preview tĩnh, URL không đổi và Escape đóng được. In-app browser
  mobile normal motion: hai CTA mở được, quan sát impact và Escape/nút đóng pass.
- Release `npm run build --prefix client` chưa chạy lại: môi trường local vẫn thiếu
  `VITE_API_URL`, đã khiến prerender 0/58 ở phiên trước; compile-only không phải
  release evidence. Canonical E2E chưa chạy vì không có backend/test environment.
- Step 4 visual-contract RED: 2 test fail vì body/shell/contact/crack/shockwave
  targets chưa có; GREEN: focused 3 files, 21 tests pass.
- Rendered desktop 1280×800 trước va chạm, thời điểm 2 giây và sau reveal; mobile
  390×844 sau reveal và reduced-motion. Búa chạm chuôi đục, glow/nứt ở mũi đục,
  shell tách để lộ ngực/cơ bụng. Vòng lặp >5 giây giữ dialog/scroll lock/URL;
  Escape đóng, trả focus về link khả dụng, click lại mở tức thì. Diagnostic local,
  không thay thế canonical E2E.
- Current tree after mobile fix: client unit 169 files/786 tests pass; lint exit 0
  (1 warning cũ `TrainerTransferPanel.jsx:91`); UI regression 0 new, 34
  resolved; `npx vite build` exit 0; bundle budget pass, entry 548.9 KiB
  raw/172.5 KiB gzip; `git diff --check` và `npm run agents:validate` exit 0.
  Release build/prerender và canonical E2E chưa chạy lại.
- Manual mobile follow-up: click thật ở menu `/exercises` và `/tdee-calculator`
  mở preview, `aria-hidden` menu chuyển true, URL `/` giữ nguyên. Phát hiện
  link trong drawer `inert` không thể nhận lại focus và scroll lock cũ bị chồng;
  sửa focus fallback về nút menu và chuyển Header sang shared reference-counted
  scroll lock. Test RED → GREEN cho hai nhánh này, rồi chạy lại gate client.
- Browser diagnostic mobile sau sửa: mở từ menu `/exercises`, chờ >5 giây vẫn
  dialog và URL `/`; Escape đóng, focus `Mở menu`, body scroll khôi phục; mở
  `/tdee-calculator` từ menu một lần nữa vẫn vào preview và đóng menu.
- TDEE card follow-up: chuyển toàn bộ featured card thành một semantic `Link`
  duy nhất thay vì chỉ cho CTA nhận click. Browser diagnostic trên dev server hiện
  có xác nhận click vào thân card mở Phase 1 dialog, URL nguồn không đổi; focused
  transition 5 files/26 tests, lint scope, UI regression gate, compile và
  `git diff --check` đều exit 0.
- Phase 2 state-preparation RED: state module chưa tồn tại; scene không có phase,
  state, timeline-off marker hoặc effect targets. GREEN: đúng chín state theo brief,
  16 layer giữ thứ tự, state inspector wrap đầu/cuối và 13 visual targets/masks.
- Manual rendered check trên dev server: mobile hiện đầy đủ figure + inspector;
  các state idle, anticipation, hammer swing, impact, shell crack, shell breakup,
  muscle reveal, debris expansion và transition cover duyệt được bằng nút. Desktop
  1280×800 giữ controls/title không che focal point; URL `/` không đổi.
- Phase 2 QA client: focused transition 6 files/29 tests pass; full client 171
  files/791 tests pass; `npx vite build` pass; full lint exit 0 với một warning cũ
  ngoài scope tại `TrainerTransferPanel.jsx:91`; UI regression gate 0 new/35
  resolved; bundle budget pass, entry 549.5 KiB raw/172.1 KiB gzip; agent validator,
  traceability JSON và `git diff --check` pass. Server/E2E/release prerender không
  chạy vì Phase 2 chỉ là frontend approval gate và chưa tích hợp animation/route.
- Phase 3 RED: motion suite thiếu sequence chín mốc; scene/overlay còn marker Phase 2
  và không có timeline/reduced-motion copy. GREEN: focused transition 6 files/31
  tests pass sau khi thêm GSAP controller, playback controls và timeline markers.
- Manual desktop 1280×800: click TDEE mở preview, URL giữ `/`; loop quan sát đủ
  state theo thứ tự với impact gần `2s`, cover sau `3.55s`, idle trở lại ở khoảng
  `5s`. Pause giữ nguyên transition-cover qua 700ms; replay trả về idle. Mobile
  390×844: `/exercises` tới muscle reveal, controls/title không che điểm va chạm;
  reduced-motion mở TDEE với state idle, timeline off và copy fallback đúng.
- Phase 3 client QA: full unit 171 files/793 tests pass; compile `npx vite build`
  pass; full lint exit 0 với một warning cũ ngoài scope tại
  `TrainerTransferPanel.jsx:91`; UI regression gate không có high-confidence finding
  mới (một advisory static-scan cho motion file, runtime fallback đã có test/browser
  evidence); bundle budget pass, entry 554.0 KiB raw/173.4 KiB gzip; agent validator,
  traceability JSON và `git diff --check` pass. Server/E2E/release prerender không
  chạy vì Phase 3 vẫn là frontend approval gate, không đổi API/route/SEO.
- Phase 4 policy/cooldown/motion/static RED → GREEN; focused transition suite
  hiện có 7 files/42 tests pass. Browser desktop 1280×800 xác nhận URL nguồn giữ
  nguyên tới `transition-cover`, route đổi khi scene transparent/body opacity 0 và
  backdrop opacity 1; overlay biến mất, page Exercises/TDEE render bên dưới.
- Browser QA phát hiện và sửa hai regression trước bàn giao: dialog có nền kín làm
  page mới bật ra ở cuối, và callback `useNavigate` đổi identity sau route switch
  làm timeline restart. `navigateRef` giữ callback timeline ổn định; scene được
  dọn đúng lúc cover kín. Preload chunk là best-effort và rejection không chặn route.
- Review policy phát hiện `/exercises` và `/exercises/` từng bị coi là hai location;
  canonical same-location hiện bỏ qua transition cho khác biệt dấu `/` cuối nhưng
  vẫn giữ query/hash trong target. Regression test RED → GREEN được bổ sung.
- Phase 4 E2E trên mock/local context: `e2e/sculpted-route-transition.spec.js`
  6/6 pass, gồm covered route switch + single cleanup, cooldown 60 giây, skip,
  Escape, mobile Exercises, reduced-motion và Save-Data. Test chờ state/URL thay
  vì wall-clock để không flake khi Chromium headless hạ nhịp GSAP.
- Final client gate: 172 files/804 unit tests pass; lint exit 0 với một warning cũ
  ngoài scope tại `TrainerTransferPanel.jsx:91`; UI regression gate không có finding
  high-confidence mới (một advisory static-scan cho motion module, fallback được
  cover bởi policy/E2E); `npx vite build` pass; bundle budget pass, entry 555.9 KiB
  raw/174.0 KiB gzip; secret scan, agents validation, traceability JSON và
  `git diff --check` pass. Full cross-repository E2E và release prerender không chạy.
- User override sau Phase 4: runtime được trả về preview-only. Policy RED có 20
  failure đúng contract cũ; GREEN: focused transition 6 files/34 tests pass sau khi
  bỏ route switch, preload, cooldown và transition variant.
- Browser local 127.0.0.1:5174: click TDEE giữ URL `/`; sau 6.2 giây dialog vẫn mở
  và state đã sang `anticipation` của chu kỳ kế tiếp. Đóng rồi mở lại ngay thành công.
- Looping-preview E2E trên mock/local origin: 6/6 pass, gồm giữ dialog/URL sau hơn
  5 giây, close/Escape cleanup, mở lại không cooldown, mobile Exercises,
  reduced-motion và Save-Data static preview.
- Current client gate: 171 files/796 unit tests pass; lint exit 0 với một warning cũ
  ngoài scope tại `TrainerTransferPanel.jsx:91`; UI regression gate 0 blocking mới
  (một advisory reduced-motion đã được cover bởi policy/overlay/unit/E2E); Vite
  compile pass; bundle budget pass, entry 554.1 KiB raw/173.4 KiB gzip; agent
  validator và `git diff --check` pass.

## Port log

- 2026-10-10 port: số cũ 090/091 trùng plan đã có trên staging nên đổi thành 108/109; đã port
từ working tree root (backup ngoài repo tại D:/htcoachingweb-backup-20261010) sang branch
`codex/plans-108-109-port-20261010` từ `origin/staging` (883681e). Chưa commit/push/deploy.
- Code transition đã có sẵn trên staging; phần còn thiếu thực tế là mount `SculptNavigationBoundary` trong
  `App.jsx`, opt-out `data-sculpt-transition="off"` ở ExerciseDetailPage và e2e spec cho preview lặp.
- Verify: client unit 192 files/982 tests PASS; lint 0 error/1 warning; UI gate 0 new;
  `e2e/sculpted-route-transition.spec.js` 6/6 PASS (lượt đầu timeout do cold start Vite, lượt hai PASS).
- Chưa chạy: rendered review desktop/mobile, deploy. Rollout vẫn NOT STARTED.
