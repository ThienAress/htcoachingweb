---
name: ui-quality
description: Checklist chất lượng UI/UX khi tạo hoặc sửa giao diện. Use khi code component mới, tạo trang mới, hoặc refactor UI. Đảm bảo design không bị generic/AI-slop và copy rõ ràng, nhất quán.
---

# UI Quality — HTCoachingWeb

> **Nguồn gốc:** Cherry-pick từ frontend-design (Anthropic) + taste-skill (Leonxlnx) + **Impeccable** (Paul Bakaus — 44 detection rules, Brand/Product register). Đã adapt cho stack htcoachingweb (Tailwind v4, GSAP, Lucide React).

---

## 1. Surface Register — Brand vs Product

> *htcoachingweb là mixed-register. Mỗi surface có bar riêng.*

Trước khi code UI, xác định surface thuộc register nào:

| Register | Surfaces | Bar chất lượng | Ví dụ |
|----------|---------|---------------|-------|
| **Brand** | Homepage (Hero, Pricing, About), Customer Stories, Trainer Profiles, Club, TDEE landing | **Distinctiveness** — người xem phải hỏi "cái này đẹp thế, làm sao?" | Hero sections, testimonials |
| **Product** | Admin Dashboard, Trainer Dashboard, Online Coaching, Checkin, Wallet, Mealplan, Exercises, Workout Plan | **Earned Familiarity** — user quen dùng Linear/Notion phải tin tưởng ngay | Forms, tables, modals |

### Khác biệt khi code

| Khía cạnh | Brand surfaces | Product surfaces |
|-----------|---------------|-----------------|
| **Typography** | Có thể dùng display/heading font lớn, fluid `clamp()` | Fixed rem scale, tighter ratio |
| **Motion** | Orchestrated entrance, GSAP page-load reveals OK | 150-250ms chỉ cho state changes, không choreography |
| **Color** | Cho phép bold, committed palette | Restrained — accent chỉ cho primary actions |
| **Layout** | Asymmetric, art direction per section OK | Structural responsive, consistent |
| **Cards** | Hạn chế dùng, ưu tiên layout sáng tạo hơn | OK cho data display, nhưng không nested |

---

## 2. Respect Existing Design Language

htcoachingweb đã có design cố định. AI **KHÔNG** tự ý sáng tạo aesthetic mới.

**Trước khi code UI:**
- Xem các trang hiện có để hiểu tone, palette, spacing đang dùng
- Match font sizes, colors, spacing với các pages cùng loại
- Nếu cần thay đổi design direction → **hỏi user trước**

**Quy tắc:**
- Trang public mới phải trông như **cùng một website** với trang chủ
- Trang admin/trainer mới phải match với layout admin/trainer hiện có
- Không tự ý thêm gradient, animation, hay decorative elements mà các trang khác không có

---

## 3. Copy & Writing Rules

> *"Words are design material, not decoration."*

### Button Labels
```
✅ ĐÚNG — Active voice, nói rõ action:
"Lưu thay đổi", "Đăng ký", "Gửi yêu cầu", "Xóa gói tập"

❌ SAI — Mơ hồ, passive:
"Submit", "Gửi", "Xác nhận", "OK"
```

### Naming Consistency
```
✅ ĐÚNG — Cùng hành động, cùng tên xuyên suốt flow:
Button: "Đăng ký" → Toast: "Đăng ký thành công" → Email subject: "Xác nhận đăng ký"

❌ SAI — Mỗi nơi gọi khác:
Button: "Đăng ký" → Toast: "Tạo tài khoản thành công" → Email: "Welcome"
```

### Error Messages
```
✅ ĐÚNG — Nói rõ lỗi gì, làm gì tiếp:
"Email đã được sử dụng. Vui lòng dùng email khác hoặc đăng nhập."
"Ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn."

❌ SAI — Mơ hồ, xin lỗi:
"Oops! Đã có lỗi xảy ra."
"Something went wrong. Please try again."
"Có lỗi rồi!"
```

### Empty States
```
✅ ĐÚNG — Hướng dẫn hành động tiếp theo:
"Chưa có lịch sử check-in. Bắt đầu check-in đầu tiên của bạn."
"Chưa có gói tập nào. Tạo gói tập mới để bắt đầu."

❌ SAI — Chỉ nói trống:
"Không có dữ liệu"
"No data found"
```

### Ngôn ngữ
- Giao diện public → **tiếng Việt**, giọng thân thiện nhưng chuyên nghiệp
- Giao diện admin/trainer → tiếng Việt, giọng ngắn gọn, functional
- Không dùng tiếng Anh trộn lẫn trừ thuật ngữ kỹ thuật (TDEE, BMI, PT)
- Không dùng: "Seamless", "Next-Gen", "Elevate", "Game-changer", "Empower", "Robust", "Delve", "Pivotal" — AI-slop copy

---

## 4. Color Rules

### 4.1 Contrast — Bắt buộc (WCAG AA)

| Loại text | Minimum ratio | Check |
|-----------|:------------:|-------|
| Body text (< 18px) | **4.5:1** | Bao gồm placeholder text |
| Large text (≥ 18px hoặc bold ≥ 14px) | **3:1** | Headlines, CTA buttons |
| UI components (borders, icons) | **3:1** | Form borders, icon-only buttons |

**Lỗi phổ biến nhất:** muted gray body text trên tinted near-white background → khó đọc. Nếu contrast gần ngưỡng → bump text color đậm hơn. "Light gray for elegance" là lý do #1 AI designs khó đọc.

### 4.2 Gray on Color = Cấm

```
❌ SAI — Text xám trên nền có màu:
<div class="bg-emerald-600">
  <p class="text-gray-400">Mô tả gói tập</p>  <!-- washed out -->
</div>

✅ ĐÚNG — Dùng shade đậm hơn cùng hue, hoặc opacity:
<div class="bg-emerald-600">
  <p class="text-emerald-100">Mô tả gói tập</p>
  <!-- hoặc -->
  <p class="text-white/70">Mô tả gói tập</p>
</div>
```

### 4.3 Color Consistency Lock

- Accent color phải nhất quán **xuyên suốt page** — không đổi giữa sections
- Button primary color nhất quán: hero dùng emerald → footer CTA cũng emerald
- Khi tạo component mới → check accent color của trang chứa nó trước
- **Kiểm tra:** Cuộn từ trên xuống dưới page — accent color có nhất quán không?

### 4.4 Không dùng Pure Black/White

```
❌ SAI:
text-black (#000000), bg-white (#ffffff), text-white (#ffffff)

✅ ĐÚNG — Dùng near-black / near-white có chút warmth:
text-zinc-900, bg-zinc-50, text-zinc-100
```

> **Ngoại lệ:** Tailwind `text-white` trên dark backgrounds là OK vì Tailwind white = #fff và trên nền tối contrast đủ. Rule này chủ yếu áp dụng cho large surface areas (body bg, card bg).

---

## 5. Typography Rules

### 5.1 Line Length — Body Text

```
✅ ĐÚNG:
<p class="max-w-prose">...</p>       <!-- ~65ch -->
<p class="max-w-2xl">...</p>         <!-- ~42rem ≈ 70ch -->

❌ SAI — Text chạy full width:
<p class="w-full">Đoạn text dài chạy hết màn hình...</p>
```

**Giới hạn:** 65-75 ký tự cho body text. Data tables có thể rộng hơn (120ch+).

### 5.2 Heading Hierarchy — Không Skip Level

```
✅ ĐÚNG:  h1 → h2 → h3 → h4
❌ SAI:   h1 → h3 (skip h2)
❌ SAI:   h2 → h2 → h2 (flat, no hierarchy)
```

### 5.3 Font Pairing

```
❌ SAI — 2 font cùng loại (2 geometric sans, 2 humanist sans):
font-sans + DM Sans  ← quá giống nhau, không tạo contrast

✅ ĐÚNG — Pair trên contrast axis, hoặc 1 family nhiều weights:
- 1 family + weight variation (project hiện tại dùng cách này ✓)
- Serif + Sans (nếu redesign)
```

### 5.4 Hero Heading Size

- Ceiling: `clamp()` max ≤ 6rem (~96px). Lớn hơn → đang la hét, không phải đang thiết kế
- Áp dụng cho Brand surfaces (Hero, Landing). Product surfaces dùng fixed rem

### 5.5 Text Wrap

```css
/* Headings — even line lengths */
h1, h2, h3 { text-wrap: balance; }

/* Long prose — reduce orphans */
.prose p { text-wrap: pretty; }
```

---

## 6. Layout Rules

### 6.1 Cards — Dùng Có Chủ Đích

```
❌ SAI — Cards là đáp án mặc định cho mọi thứ:
- Nhét mọi thứ vào card
- Cards lồng trong cards (nested cards)
- 3 cards bằng nhau hàng ngang (identical card grids)

✅ ĐÚNG — Cards chỉ khi thật sự cần:
- Data items cần visual boundary → OK
- Feature comparison → ưu tiên highlight card chính, asymmetric
- Nested cards → KHÔNG BAO GIỜ hợp lệ
```

### 6.2 Spacing — Vary for Rhythm

Không dùng cùng một spacing cho mọi gap. Tạo nhịp điệu:
- Section gap: lớn (`py-16` / `py-24`)
- Group gap: vừa (`gap-8` / `gap-12`)
- Item gap: nhỏ (`gap-4` / `gap-6`)

### 6.3 Flex vs Grid

```
Flexbox cho 1D (row HOẶC column)
Grid cho 2D (rows VÀ columns)

❌ SAI — Grid cho simple row:
<div class="grid grid-cols-3">  <!-- chỉ cần 1 hàng -->

✅ ĐÚNG — Flex cho 1D:
<div class="flex gap-4">

✅ ĐÚNG — Grid cho responsive breakpoint-free:
<div class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
```

### 6.4 Z-index Scale

```
Semantic scale, KHÔNG arbitrary values:

dropdown:       z-10
sticky-header:  z-20
modal-backdrop: z-40
modal:          z-50
toast:          z-[60]
tooltip:        z-[70]

❌ SAI: z-[999], z-[9999], z-[99999]
```

---

## 7. AI Slop — Absolute Bans

> *"Nếu ai đó nhìn vào UI và nói 'AI làm cái này' mà không cần suy nghĩ → đã fail."*

### 🔴 MATCH-AND-REFUSE — Nếu sắp viết, dừng lại và viết lại

| # | Ban | Phát hiện | Thay thế |
|---|-----|----------|----------|
| 1 | **Side-stripe borders** | `border-l-4 border-blue-500` trên cards/alerts | Full borders, background tints, hoặc leading icons |
| 2 | **Gradient text** | `bg-clip-text bg-gradient-to-r text-transparent` | Solid color. Nhấn mạnh bằng weight hoặc size |
| 3 | **Glassmorphism mặc định** | `backdrop-blur bg-white/10` dùng decorative | Chỉ dùng cho overlays có lý do. Không dùng cho cards |
| 4 | **Hero-metric template** | Big number + small label + stats row | Chỉ dùng khi data thật sự ấn tượng + có context |
| 5 | **3 identical card grids** | 3 cards bằng nhau, icon + heading + text | Asymmetric, highlight 1-2 cards chính |
| 6 | **Eyebrow mọi section** | Tiny uppercase tracked text "VỀ CHÚNG TÔI", "DỊCH VỤ", "LIÊN HỆ" trên MỌI heading | 1 eyebrow có chủ đích = voice. Mọi section đều có = AI scaffolding |
| 7 | **01/02/03 numbering** | Section markers "01 · Giới thiệu / 02 · Dịch vụ / 03 · Liên hệ" | Chỉ dùng khi content thật sự là sequence |
| 8 | **Purple-to-blue gradient** | `from-purple-500 to-blue-500` hoặc tương tự | Dùng palette hiện tại của htcoachingweb |
| 9 | **Bounce/elastic animation** | `ease-bounce`, spring animation | `ease-out` exponential (quart/quint/expo) |
| 10 | **Icon tile trên heading** | Rounded-square icon tile phía trên mỗi heading | Inline icon hoặc không icon |
| 11 | **Text overflow container** | Heading dài tràn ra ngoài trên mobile | Test heading ở mọi breakpoint. Giảm clamp max hoặc rewrite copy |
| 12 | **Dark glow/neon shadow** | Colored box-shadow sáng trên nền tối | Subtle shadow hoặc border |

### 🟡 AI Slop Test (2 bước)

**Bước 1 — First-order check:**
> *"Ai đó có thể đoán theme + palette chỉ từ category (fitness website) không?"*
> Nếu có → đang dùng training-data defaults. Rework.

**Bước 2 — Second-order check:**
> *"Ai đó biết bạn muốn tránh SaaS-cream, có đoán được bạn sẽ chọn editorial-typographic không?"*
> Nếu có → tránh được reflex đầu nhưng rơi vào reflex thứ hai. Rework.

---

## 8. Motion Rules (GSAP)

### 8.1 Easing — Chỉ Exponential

```javascript
// ✅ ĐÚNG — Smooth exponential deceleration:
gsap.to(el, { opacity: 1, y: 0, ease: "power3.out" });     // quart
gsap.to(el, { opacity: 1, y: 0, ease: "power4.out" });     // quint
gsap.to(el, { opacity: 1, y: 0, ease: "expo.out" });       // expo

// ❌ SAI — Bounce/elastic feels dated:
gsap.to(el, { y: 0, ease: "bounce.out" });
gsap.to(el, { y: 0, ease: "elastic.out" });
gsap.to(el, { y: 0, ease: "back.out" });
```

### 8.2 Reduced Motion — Không Tùy Chọn

```jsx
// ✅ BẮT BUỘC — Mọi GSAP animation phải check:
useEffect(() => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return; // skip animation hoặc crossfade thay thế

  const ctx = gsap.context(() => {
    // animation code...
  }, containerRef);

  return () => ctx.revert();
}, []);
```

### 8.3 Reveal Safety

```
❌ SAI — Content bị ẩn cho đến khi animation chạy:
<div class="opacity-0">Content</div>  <!-- nếu JS fail → content biến mất -->

✅ ĐÚNG — Content visible by default, animation enhance:
<div class="opacity-100">Content</div>  <!-- JS thêm animation nếu có -->
```

Lý do: Animation pause trên hidden tabs và headless renderers → content không bao giờ hiện.

### 8.4 Duration by Register

| Register | Duration | Lý do |
|----------|---------|-------|
| Brand (Hero, Landing) | 400-800ms cho entrance, staggered reveals OK | Tạo ấn tượng |
| Product (Dashboard, Forms) | 150-250ms cho state changes | Users đang làm việc, không muốn đợi |

### 8.5 No Reflex Animation

```
❌ SAI — Mọi section đều fade-in-from-bottom giống nhau:
Đây là "uniform reflex" — AI mặc định gắn cùng 1 animation cho mọi thứ.

✅ ĐÚNG — Mỗi reveal phù hợp với content:
- Stats: count-up animation
- Image gallery: stagger từng item
- Text block: simple fade, hoặc không animation
- Không animation cũng là một lựa chọn hợp lệ
```

---

## 9. Interaction States — Đủ Bộ

Mỗi interactive element **PHẢI** có tất cả states liên quan:

| State | Tailwind Example | Bắt buộc? |
|-------|-----------------|:---------:|
| **Default** | `bg-emerald-600 text-white` | ✅ |
| **Hover** | `hover:bg-emerald-700` | ✅ |
| **Focus** | `focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2` | ✅ |
| **Active** | `active:bg-emerald-800` | Nên có |
| **Disabled** | `disabled:opacity-50 disabled:cursor-not-allowed` | ✅ |
| **Loading** | Spinner hoặc skeleton | ✅ cho async actions |
| **Error** | `border-red-500 text-red-600` | ✅ cho forms |

**Không ship component mà thiếu hover + focus + disabled states.** Missing states = confused users.

---

## 10. Accessibility Basics

### 10.1 Keyboard Navigation
- Mọi interactive element phải có visible focus state (`focus:ring-*`)
- Tab order phải hợp lý (trên → dưới, trái → phải)
- Modal mở → focus trap bên trong modal
- Escape → đóng modal/dropdown

### 10.2 Semantic HTML
```
❌ SAI:
<div onClick={handleClick}>Click me</div>

✅ ĐÚNG:
<button onClick={handleClick}>Click me</button>
```

### 10.3 Touch Targets

```
Minimum: 44×44px cho mobile

❌ SAI:
<button class="p-1 text-xs">×</button>  <!-- quá nhỏ -->

✅ ĐÚNG:
<button class="p-2 min-w-[44px] min-h-[44px]">×</button>
```

### 10.4 Color-Only Information

```
❌ SAI — Chỉ dùng màu để truyền thông tin:
<span class="text-red-500">●</span>  <!-- red = error? inactive? -->

✅ ĐÚNG — Màu + text/icon:
<span class="text-red-500 flex items-center gap-1">
  <AlertCircle size={14} /> Lỗi
</span>
```

### 10.5 Dark Mode
- htcoachingweb hiện **chưa có dark mode** — không bắt buộc implement
- Nếu thêm dark mode trong tương lai → dùng Tailwind `dark:` variant, set 1 lần ở root

---

## 11. Hero & Viewport Rules

> *Hero là first impression. Nếu user phải scroll để thấy CTA → hero đã fail.*

**Áp dụng cho Brand surfaces (Landing, Marketing) — KHÔNG áp dụng cho Product surfaces.**

- Headline: tối đa **2 dòng** trên desktop
- Subtext: tối đa **20 từ** hoặc **3-4 dòng**
- CTA button: **phải visible** không cần scroll
- Dùng `min-h-dvh` thay vì `h-screen` (tránh iOS Safari viewport jump)

---

## 12. Responsive Design

### 12.1 No Fixed Widths
```
❌ SAI:
<div class="w-[800px]">  <!-- breaks on mobile -->

✅ ĐÚNG:
<div class="w-full max-w-4xl">
```

### 12.2 No Horizontal Scroll
- Test mọi page ở 375px width (iPhone SE)
- Text, images, tables không được tràn viewport

### 12.3 Text Scaling
- Không dùng font-size < 14px trên mobile
- Layout không được vỡ khi user zoom 200%

---

## 13. Output Enforcement

> *AI không được cắt code, bỏ dở, hoặc dùng placeholder.*

### Cấm hoàn toàn trong code output

```
❌ // ...
❌ // rest of code
❌ // implement here
❌ // TODO
❌ /* ... */
❌ // similar to above
❌ // continue pattern
❌ // add more as needed
```

### Cấm trong giao tiếp

```
❌ "Let me know if you want me to continue"
❌ "for brevity, I'll skip..."
❌ "the rest follows the same pattern"
❌ "and so on"
❌ "I'll leave that as an exercise"
```

### Khi output dài

Nếu response quá dài → dừng ở **clean breakpoint** (cuối function, cuối file):
```
[PAUSED — 3/5 files hoàn thành. Gõ "continue" để tiếp tục từ: file tiếp theo]
```

Tiếp tục từ đúng chỗ dừng. Không recap, không lặp lại.

---

## Quick Check — Trước Khi Ship UI

Chạy nhanh trước khi coi task UI là xong:

**Design Quality:**
- [ ] Xác định register (Brand/Product) → áp dụng rules phù hợp?
- [ ] UI mới match design language hiện tại?
- [ ] Không có anti-slop patterns (gradient text, side-stripe, identical cards, eyebrow spam)?
- [ ] Accent color nhất quán xuyên suốt page?

**Typography & Color:**
- [ ] Body text contrast ≥ 4.5:1?
- [ ] Không có gray text trên colored background?
- [ ] Body text line-length ≤ 75ch?
- [ ] Heading hierarchy không skip level?

**Interaction & Motion:**
- [ ] Tất cả interactive elements có hover + focus + disabled states?
- [ ] GSAP animation có reduced-motion fallback?
- [ ] Easing dùng exponential (power3-4.out, expo.out), không bounce/elastic?
- [ ] Touch targets ≥ 44×44px?

**Content & Copy:**
- [ ] Copy rõ ràng, active voice, không AI-slop words?
- [ ] Error messages nói rõ lỗi gì + cách fix?
- [ ] Empty states có hướng dẫn hành động?

**Code:**
- [ ] Code output đầy đủ, không có `// ...` placeholder?
- [ ] Hero (nếu có) fit viewport, CTA visible?
- [ ] Không có nested cards?
- [ ] Z-index dùng semantic scale?
