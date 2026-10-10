# Spec: Bản xem thử tự điêu khắc

## Current phase gate — looping preview

User đã duyệt asset, kiến trúc chín state và animation 5 giây qua Phase 1–3. Sau
khi thử route integration ở Phase 4, user yêu cầu ngày 2026-09-15 giữ hiệu ứng ở
chế độ xem thử lặp vô hạn và tuyệt đối không chuyển trang. Contract hiện tại thay
thế route switch, preload và cooldown đã triển khai thử trước đó.

Asset nguồn là một raster composite đã flatten. Các duplicate mask đồng bộ với
`main-body` chỉ xác định vùng body/shell/tool; vector/procedural targets phụ trách
arc, impact, cracks, debris, dust và cover. Không tuyên bố raster composite đã được
segment thành các bitmap alpha độc lập.

## Objective

Khi người dùng click link exact `/exercises` hoặc `/tdee-calculator`, mở một dialog
toàn màn hình trình diễn nhịp búa, vỏ đá vỡ và phần cơ bắp lộ ra trong chu kỳ 5
giây. Dialog tiếp tục lặp tới khi người dùng đóng; URL và trang nền luôn giữ nguyên.

## Product contract

- Chỉ áp dụng cho exact route `/exercises` và `/tdee-calculator`, chấp nhận dấu
  `/` cuối, query hoặc hash. Không áp dụng cho `/exercises/:id/:slug?`, route khác,
  back/forward hoặc redirect bằng code.
- Click chuột trái không modifier trên link nội bộ mục tiêu bị intercept để mở
  preview. Không gọi `navigate`, không preload page đích, không đổi URL và không
  ghi/đọc cooldown.
- Timeline có chu kỳ đúng `5s`, `repeat: -1`: impact tại `2s`, cover bắt đầu tại
  `3.55s`, reset từ `4.35s` và trở lại `idle` trước khi chu kỳ kế tiếp bắt đầu.
  Dialog không tự đóng ở `transition-cover` hoặc cuối chu kỳ.
- Preview luôn có title, state inspector, Tạm dừng/Tiếp tục, Phát lại và nút
  `Đóng xem thử`. Escape chỉ đóng preview, không thực hiện navigation.
- Chỉ một preview được mở. Background nhận `inert`, document scroll được khóa bằng
  hook reference-counted và focus được trả về trigger khả dụng sau khi đóng.
- Với `prefers-reduced-motion: reduce` hoặc Save-Data, vẫn mở cùng preview nhưng ở
  keyframe tĩnh, không mount GSAP timeline và không điều hướng.
- Ctrl/Meta/Shift/Alt-click, click không phải nút trái, `target` khác `_self`, link
  download và external link giữ nguyên semantics trình duyệt.
- Key visual phải đọc được như một người tự đục lớp vỏ đá/mỡ ôm bụng, eo và đùi;
  tay trái giữ đục, tay phải đưa búa cao, vùng cơ phía trong chỉ lộ sau impact.

## Requirements

### REQ-001 — Preview đúng hai route

- `AC-001`: Normal click vào một trong hai exact route mở đúng một preview; không
  gọi preload/navigate và có thể mở lại ngay sau khi đóng.
- `AC-002`: Route ngoài phạm vi và modifier/new-tab/download không bị intercept;
  reduced-motion/Save-Data dùng preview tĩnh thay vì điều hướng.

### REQ-002 — Câu chuyện hình ảnh rõ trong chu kỳ 5 giây

- `AC-003`: Timeline dùng contract `cycleSeconds: 5`, `repeat: -1`; búa, đục, điểm
  va chạm, mảnh đá và phần thân trên cơ bắp là các target animation riêng.
- `AC-004`: Overlay có nút đóng, Escape, focus restoration và scroll-lock cleanup;
  desktop/mobile không cắt mất nhân vật hoặc CTA.
- `AC-005`: Sau impact vỏ tách, vùng cơ dưới được reveal, nứt/debris/shockwave xuất
  hiện rồi toàn bộ scene reset trong cùng chu kỳ.

### REQ-003 — Phase 1 static composition

- `AC-006`: Scene render asset raster đã được user duyệt theo layout full-bleed,
  desktop/mobile giữ đủ focal point, hammer/chisel interaction và silhouette.
- `AC-007`: DOM có đúng 16 logical layer theo brief; static fallback không mount
  GSAP timeline và vẫn đóng bằng nút/Escape.

### REQ-004 — Phase 2 animation-state preparation

- `AC-008`: Contract có đúng chín state: idle, anticipation, hammer swing, impact,
  shell crack, shell breakup, muscle reveal, debris expansion, transition cover.
- `AC-009`: Scene giữ đúng 16 layer cùng target/mask cho body, shell, hammer/chisel,
  arc, impact, cracks, debris, dust, rubble và cover.

### REQ-005 — Phase 3 animated preview

- `AC-010`: GSAP orchestration chạy đủ chín state trong đúng 5 giây, impact tại
  `2s`, transition cover tại `3.55s`, reset từ `4.35s` và `repeat: -1`.
- `AC-011`: Preview có Tạm dừng/Tiếp tục và Phát lại; cleanup timeline khi đóng.
  Reduced-motion/Save-Data không mount timeline.
- `AC-012`: URL hiện tại luôn được giữ, không cooldown, không preload và không
  navigate.

### REQ-006 — Current preview-only integration

- `AC-013`: Click link mục tiêu mở dialog; đi qua `transition-cover`, trở lại
  `idle` và tiếp tục loop mà URL không đổi, dialog không unmount.
- `AC-014`: Nút đóng và Escape chỉ đóng preview, dọn listener/timeline/scroll lock,
  phục hồi focus và cho phép mở lại ngay.
- `AC-015`: Reduced-motion/Save-Data vẫn mở preview tĩnh; exact route, modifier,
  external và detail-route semantics giữ đúng contract.

## UX brief

- Audience: khách đang khám phá thư viện bài tập hoặc công cụ TDEE.
- Surface mode: `Experience`; đây là preview do user chủ động mở, không phải bước
  chuyển trang hoặc loading state.
- Palette: graphite/slate cho đá, cyan/emerald làm rim light và orange tại điểm va
  chạm. Không gradient text, bounce/elastic, glass card hoặc `transition-all`.
- Signature: silhouette liền một người tự đục lớp vỏ ôm bụng/eo/đùi; nứt đá và
  vùng cơ xuất hiện ở đúng điểm đục.
- Ảnh tham khảo có watermark chỉ dùng để hiểu phép ẩn dụ. Không đưa ảnh đó hoặc
  asset Canva chưa được cấp quyền vào sản phẩm.

## Tech stack và cấu trúc ảnh hưởng

- React 19, React Router 7, Lucide React, Tailwind CSS 4 và GSAP hiện có; không thêm
  Three.js, R3F, WebGL hoặc dependency mới.
- `client/src/App.jsx`: mount boundary bên trong `BrowserRouter`.
- `client/src/components/transitions/`: click policy, preview boundary, dialog,
  timeline, state/layer manifest và renderer của approved raster composite.
- `client/src/sections/Header/Header.jsx`: mobile tool items dùng semantic `Link`;
  handler hiện có vẫn đóng menu khi preview được mở.
- Không đổi public route, lazy loading, SEO, sitemap, prerender, API hoặc schema.

## Testing strategy

- Unit policy: exact route, route chi tiết/external, same-location, modifier,
  target/download, reduced-motion và Save-Data.
- Unit timing/state: chu kỳ 5 giây, `repeat: -1`, đủ chín state và đúng mốc impact/cover.
- Unit overlay: luôn có inspector/nút đóng, không có hành động chuyển trang; static
  fallback không bật timeline.
- E2E: URL đứng yên và dialog tiếp tục tồn tại sau hơn thời lượng danh nghĩa 5 giây;
  close/Escape cleanup, mở lại không cooldown, mobile Exercises và static fallback.
- Gate: focused Vitest, full client unit, lint, UI regression gate, Vite compile,
  bundle budget, browser desktop/mobile và `git diff --check`.

## Boundaries

- Always: cleanup GSAP/listener, semantic dialog, focus rõ, scroll-lock có restore,
  z-index không vượt `z-[60]`, giữ native modified-click.
- Ask first: phục hồi navigation production, thêm route trigger, gọi API tạo ảnh
  hoặc thêm thư viện 3D.
- Never: navigate/preload/cooldown trong preview, chạy recurring motion khi reduced
  motion, dùng ảnh watermark hoặc sao chép tác phẩm tham khảo.

## Success criteria

- [x] Hai exact route mở preview nhưng URL/trang hiện tại không đổi.
- [x] Timeline chạy đủ chín state trong 5 giây và lặp vô hạn tới khi đóng.
- [x] Preview có pause/resume/replay, nút đóng, Escape và focus restoration.
- [x] Reduced-motion/Save-Data hiển thị scene tĩnh; native link modifiers giữ nguyên.
- [x] Scene dùng approved raster, đủ 16 layer/anchor và visual targets.
- [x] Không còn runtime consumer cho route switch, preload hoặc cooldown Phase 4.

## Open questions

Đang chờ user duyệt trực tiếp loop preview. Mọi yêu cầu đưa hiệu ứng trở lại luồng
navigation thật phải được chốt như một contract mới.
