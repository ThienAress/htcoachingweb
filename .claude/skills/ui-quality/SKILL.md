---
name: ui-quality
description: Chuẩn chất lượng UI/UX của HTCOACHING (Tailwind 4, React 19, GSAP) — tránh AI slop, giữ brand emerald/cyan, đủ interaction states và accessibility — kèm quy trình quét UI toàn codebase bằng ui:audit. Dùng khi làm component/layout mới, sửa hoặc review giao diện, hoặc kiểm UI trước release.
---

# UI quality — HTCOACHING

Mục tiêu: giao diện có bản sắc HTCOACHING, không giống template AI-generated.

## Trước khi bắt đầu

- Chi tiết màu, contrast, typography, GSAP: [ui-guidelines](references/ui-guidelines.md).
- Kiến trúc/performance React 19 + Vite SPA: [react-spa-quality](references/react-spa-quality.md).
- Overflow/scrollbar và copy tiếng Việt: theo `.claude/rules/frontend.md`.
- Xác định surface **Brand** (trang chủ, public) hay **Product** (dashboard, admin, HLV, checkin).

Surface mới hoặc redesign: chốt brief tối thiểu trước khi code — audience và một việc duy nhất page giúp họ làm;
mode của page (**Persuade**, **Operate**, **Read**, **Experience**); constraint/brand phải giữ và một signature element
có lý do; phác hai layout ngắn, chọn một, tự critique chỗ còn generic. Chỉnh sửa hẹp thì giữ identity, behavior và
copy thực tế hiện có.

## Mode 1 — Làm UI mới

1. Palette theo tone `emerald/cyan` hiện có; không tự đặt HEX cứng ngoài token.
2. Trang Brand ưu tiên layout bất đối xứng, tránh grid 3 card giống hệt nhau.
3. Component chạy được ngay, không placeholder `//...`, đủ hover, focus-visible, disabled, loading, empty, error.
4. Sau build, xem desktop + mobile một lượt, sửa defect quan sát được, xác nhận lại tối đa một lượt.

## Mode 2 — Review/sửa UI có sẵn

Kiểm contrast WCAG AA (đặc biệt chữ xám trên nền màu), class không theo spacing scale, anti-pattern bên dưới.
Báo cáo theo thứ tự: một câu kết luận → danh sách 🟢/🟡/🔴 → lý do → file sẽ sửa.

Gặp các dấu hiệu sau thì báo và sửa luôn trong phạm vi đang làm:

| Dấu hiệu | Sửa |
|---|---|
| `bg-clip-text text-transparent` (gradient text) | Màu solid |
| `<button>` thiếu `hover:`/`focus-visible:` | Bổ sung state |
| `text-gray-*` trên `bg-emerald-*` | `text-emerald-100` hoặc `text-white/70` |
| Card có border/shadow lồng trong card khác | Bỏ một lớp |
| GSAP `bounce`/`elastic`/`back` | `power4.out` hoặc `expo.out` |

## Mode 3 — Quét UI toàn codebase (`/ui-quality check [public|admin|<file>]`)

1. Chạy scanner deterministic trước; đọc `ruleId`, `confidence`, `file:line` và context rồi mới kết luận:

   ```bash
   npm run ui:audit
   npm run ui:audit -- --format json
   npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high
   ```

   `--format prompt` cho remediation, `--category accessibility` để lọc. Baseline là debt snapshot, không phải waiver;
   gate chỉ chặn finding mới `status=fail` + `confidence=high`. `advisory` cần evidence rendered/manual.
   Không chạy `ui:audit:baseline:update` chỉ để CI xanh. Scanner fail thì dừng và chẩn đoán scanner trước.
2. Phân loại surface: Brand (`sections/`, page public), Product (`pages/admin/`, `pages/trainer/`, `pages/customer/`),
   Shared (`components/`, `layouts/`). Kiểm thêm theo [web interface checks](references/web-interface-checks.md).
3. Lệnh cấm (ưu tiên evidence từ `ui:audit`, `rg` để bổ sung, luôn đọc context):

   | Cấm | Severity |
   |---|---|
   | Gradient text, gradient purple→blue, bounce/elastic easing, side-stripe border accent ≥ 2px | HIGH |
   | Ảnh thiếu `alt`, icon-only button thiếu `aria-label` | HIGH |
   | Glassmorphism cho card, nested cards, grid 3 card giống hệt, eyebrow trên mọi section, glow/neon trên nền tối | MED |
   | Chữ xám trên nền màu, text tràn container mobile, heading nhảy cấp hoặc nhiều `h1` | MED |
   | GSAP bỏ qua `prefers-reduced-motion`, nội dung `opacity-0` vĩnh viễn nếu JS lỗi, z-index tùy tiện, touch target < 44px | MED |

4. Báo cáo: scorecard 0–5 cho 8 chiều (AI slop, color/contrast, typography, layout, motion, interaction states,
   accessibility, responsive — tổng /40), bảng `# | finding | file:line | severity | fix`, và điểm làm tốt.
   Chỉ sửa khi user yêu cầu (`fix #1`, `fix all HIGH`), sau đó chạy lại gate.

## Kiểm UI bằng trình duyệt

- Dùng Playwright với viewport cố định: desktop 1440×900 và mobile 390×844; chụp cả hai trước khi báo xong. Không kéo hoặc resize khung trình duyệt
  của app: khung hẹp làm trang hiện bố cục mobile và ảnh chụp sai so với desktop thật.
- Đo bằng DOM, không chỉ nhìn ảnh: `scrollWidth - clientWidth` (tràn ngang), cột/lề thẳng hàng, chữ đè nhau, vùng bấm tối thiểu 36px.
- Trang cần đăng nhập mà phiên hết hạn: dừng và nhờ user đăng nhập lại; không tự nhập thông tin đăng nhập.
