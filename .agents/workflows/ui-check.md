---
name: ui-check
trigger: /ui-check
description: Quét UI toàn bộ codebase kiểm tra chất lượng design (AI slop, color, typography, layout, motion, interaction states, accessibility, responsive). Dựa trên ui-quality skill + Impeccable rules. Chạy sau khi thêm/sửa UI hoặc trước deploy.
---

# /ui-check — Kiểm Tra Chất Lượng UI Toàn Bộ Codebase

> **Tại sao cần?** AI code UI dễ rơi vào "AI Slop" — gradient text, identical cards, bounce easing, gray-on-color... Workflow này quét TẤT CẢ pages/components và chấm điểm theo rules đã setup trong `ui-quality.md`.

---

## Cách Chạy

| Lệnh | Mô tả |
|-------|--------|
| `/ui-check` | Full scan — tất cả pages + sections + components |
| `/ui-check public` | Chỉ quét Brand surfaces (Hero, Landing, Customer Stories...) |
| `/ui-check admin` | Chỉ quét Product surfaces (Admin, Trainer, Dashboard...) |
| `/ui-check <file>` | Quét 1 file/component cụ thể |

---

## Bước 1: Recon — Xác Định Surfaces 📋

// turbo

**Scan codebase để phân loại surfaces:**

1. Đọc `client/src/App.jsx` — lấy tất cả routes
2. Đọc `.agents/skills/quality/ui-quality.md` — nắm rules cần check
3. Phân loại mỗi route/page vào register:

| Register | Surfaces cần quét | Files |
|----------|-------------------|-------|
| **Brand** | Homepage sections, Customer Stories, Trainer Profiles, Club, TDEE landing, Mealplan landing, Exercises landing | `sections/`, `pages/` (public) |
| **Product** | Admin pages, Trainer pages, Online Coaching, Checkin, Wallet, Workout Plan | `pages/admin/`, `pages/trainer/`, `pages/customer/` |
| **Shared** | Header, Footer, Layouts, SEO, ErrorBoundary | `components/`, `layouts/` |

**Output:**
```
📋 UI RECON
━━━━━━━━━━━━━━━━━━━━━━
Brand surfaces: X files
Product surfaces: X files
Shared components: X files
Total files to scan: XX
━━━━━━━━━━━━━━━━━━━━━━
```

---

## Bước 2: AI Slop Scan 🔴

> *"Nếu ai đó nhìn vào và nói 'AI làm cái này' → đã fail."*

Quét TẤT CẢ files UI (JSX + CSS) tìm 12 absolute bans:

### Check List

| # | Rule | Grep Pattern | Severity |
|---|------|-------------|:--------:|
| 1 | Side-stripe borders | `border-l-`, `border-r-` (≥ 2px, có màu accent) | 🔴 HIGH |
| 2 | Gradient text | `bg-clip-text`, `text-transparent` + gradient | 🔴 HIGH |
| 3 | Glassmorphism default | `backdrop-blur` dùng cho cards (không phải overlay) | 🟡 MED |
| 4 | Hero-metric template | Big number + label + stats pattern | 🟡 MED |
| 5 | Identical card grids | 3+ cards cùng structure bằng nhau | 🟡 MED |
| 6 | Eyebrow mọi section | Uppercase tracked text trên MỌI heading | 🟡 MED |
| 7 | 01/02/03 numbering | Section markers không phải real sequence | 🟢 LOW |
| 8 | Purple-to-blue gradient | `from-purple`, `to-blue`, `from-violet` | 🔴 HIGH |
| 9 | Bounce/elastic easing | `bounce`, `elastic`, `back` trong GSAP/CSS | 🔴 HIGH |
| 10 | Icon tile trên heading | Rounded icon box directly above heading | 🟡 MED |
| 11 | Text overflow | Text có thể tràn container trên mobile | 🟡 MED |
| 12 | Dark glow/neon shadow | Colored box-shadow sáng trên nền tối | 🟡 MED |

**Cách quét:**

```bash
# Gradient text
grep -rn "bg-clip-text\|text-transparent" client/src/ --include="*.jsx"

# Bounce/elastic easing
grep -rn "bounce\|elastic\|back\.out\|back\.in" client/src/ --include="*.jsx" --include="*.js"

# Purple-blue gradient
grep -rn "from-purple\|to-blue\|from-violet\|to-indigo" client/src/ --include="*.jsx" --include="*.css"

# Side-stripe borders (accent, ≥ 2px)
grep -rn "border-l-[2-9]\|border-l-\[\|border-r-[2-9]\|border-r-\[" client/src/ --include="*.jsx"

# Glassmorphism on non-overlay elements
grep -rn "backdrop-blur" client/src/ --include="*.jsx"
```

---

## Bước 3: Color Audit 🎨

### 3.1 Gray-on-Color Check

Tìm pattern: text có màu gray (`text-gray-*`, `text-zinc-*`, `text-slate-*` ở lightness 300-500) nằm trong container có colored background (`bg-{color}-*`):

```bash
# Tìm file có cả colored bg và gray text
grep -rn "text-gray-[3-5]00\|text-zinc-[3-5]00\|text-slate-[3-5]00" client/src/ --include="*.jsx"
```

**Với mỗi match:** Mở file, kiểm tra context — text gray đó có nằm trên nền có màu không?

### 3.2 Accent Color Consistency

Với mỗi page, kiểm tra:
- Accent color đầu page = accent color cuối page?
- CTA buttons có cùng color scheme không?
- Không có section đột ngột đổi accent?

### 3.3 Pure Black/White Large Surfaces

```bash
# Tìm bg-black, bg-white trên large containers (not small elements)
grep -rn "bg-black\|bg-white" client/src/ --include="*.jsx"
```

**Mỗi match:** Kiểm tra element có phải large surface (body, section, card) → nên dùng near-black/near-white.

---

## Bước 4: Typography Check 📝

### 4.1 Line Length

Tìm body text containers thiếu `max-w-*` constraint:

```bash
# Prose/paragraph sections không có max-width
grep -rn "<p " client/src/sections/ --include="*.jsx" | head -20
```

**Mỗi page section có body text:** Có `max-w-prose`, `max-w-2xl`, `max-w-3xl`, hoặc tương đương không?

### 4.2 Heading Hierarchy

Với mỗi page, kiểm tra:
```bash
# Tìm tất cả heading tags
grep -rn "<h[1-6]" client/src/pages/ client/src/sections/ --include="*.jsx"
```

**Check:** h1 → h2 → h3 liên tục, không skip level? Mỗi page chỉ có 1 `<h1>`?

### 4.3 Hero Heading Size (Brand surfaces only)

```bash
# Tìm clamp() trong hero/landing sections
grep -rn "clamp\|text-[7-9]xl\|text-\[" client/src/sections/Hero* --include="*.jsx" --include="*.css"
```

**Check:** Max ≤ 6rem (~96px)?

---

## Bước 5: Motion Audit 🎬

### 5.1 Easing Check

```bash
# Tìm GSAP easing patterns
grep -rn "ease:" client/src/ --include="*.jsx" --include="*.js"
```

**Check mỗi match:**
- ✅ `power3.out`, `power4.out`, `expo.out` → OK
- ❌ `bounce`, `elastic`, `back` → FAIL

### 5.2 Reduced Motion

```bash
# Tìm files dùng GSAP nhưng KHÔNG check reduced-motion
grep -rlZ "gsap\.\|ScrollTrigger\|SplitType" client/src/ --include="*.jsx" --include="*.js"
```

**Với mỗi file dùng GSAP:** Có `prefers-reduced-motion` check không?

### 5.3 Reveal Safety

```bash
# Tìm elements bắt đầu với opacity-0 hoặc invisible
grep -rn "opacity-0\|invisible\|opacity: 0" client/src/ --include="*.jsx" --include="*.css"
```

**Mỗi match:** Content có visible by default nếu JS fail không? Hay bị ẩn vĩnh viễn?

---

## Bước 6: Layout & Components Check 📐

### 6.1 Nested Cards

```bash
# Tìm potential nested cards (card-like classes lồng nhau)
grep -rn "rounded.*shadow\|border.*rounded\|bg-.*rounded" client/src/ --include="*.jsx" | head -30
```

**Visual review:** Mở các files chính, check có cards lồng trong cards không?

### 6.2 Z-index Audit

```bash
# Tìm tất cả z-index values
grep -rn "z-\[" client/src/ --include="*.jsx" --include="*.css"
grep -rn "z-index" client/src/ --include="*.css"
```

**Check:** Có dùng arbitrary values (z-[999], z-[9999]) không? Có semantic scale không?

### 6.3 Identical Card Grids

Visual review các trang public: có section nào 3+ cards hoàn toàn giống nhau (icon + heading + text) không?

---

## Bước 7: Interaction States Check ⚡

### 7.1 Button States

```bash
# Tìm buttons THIẾU hover/focus/disabled states
grep -rn "<button\|<Button" client/src/ --include="*.jsx" | head -20
```

**Với mỗi custom button/CTA:** Có đủ `hover:`, `focus:`, `disabled:` states không?

### 7.2 Touch Targets

```bash
# Tìm interactive elements nhỏ
grep -rn "p-1 \|p-0\.5\|text-xs.*click\|text-xs.*button" client/src/ --include="*.jsx"
```

**Check:** Interactive elements có ≥ 44×44px trên mobile không?

---

## Bước 8: Accessibility Quick Check ♿

| Check | Cách kiểm tra | Severity |
|-------|--------------|:--------:|
| Images thiếu alt | `grep -rn "<img" \| grep -v "alt="` | 🔴 HIGH |
| Icon-only buttons thiếu aria-label | `grep -rn "onClick" \| grep -v "aria-label\|title\|<span"` | 🔴 HIGH |
| Form inputs thiếu label | `grep -rn "<input" \| grep -v "aria-label\|id=.*label"` | 🟡 MED |
| Color-only information | Visual review: red = error mà không có icon/text? | 🟡 MED |

---

## Bước 9: Tổng Hợp & Report 📊

### Output Format

```
🎨 UI QUALITY CHECK REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 TỔNG QUAN
Brand surfaces: X files scanned
Product surfaces: X files scanned
Shared components: X files scanned

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 SCORECARD (0-5 mỗi dimension)

| # | Dimension          | Score | Key Finding                    |
|---|--------------------|:-----:|--------------------------------|
| 1 | AI Slop            | ?/5   | [finding hoặc "Clean ✓"]      |
| 2 | Color & Contrast   | ?/5   | [finding hoặc "Clean ✓"]      |
| 3 | Typography         | ?/5   | [finding hoặc "Clean ✓"]      |
| 4 | Layout & Spacing   | ?/5   | [finding hoặc "Clean ✓"]      |
| 5 | Motion & Animation | ?/5   | [finding hoặc "Clean ✓"]      |
| 6 | Interaction States | ?/5   | [finding hoặc "Clean ✓"]      |
| 7 | Accessibility      | ?/5   | [finding hoặc "Clean ✓"]      |
| 8 | Responsive         | ?/5   | [finding hoặc "Clean ✓"]      |
| **Total** |             | **??/40** | **[Rating band]**         |

Rating: 36-40 Excellent | 28-35 Good | 20-27 Needs Work | <20 Critical

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ FINDINGS (sorted by severity)

| # | Finding | File | Severity | Category | Fix |
|---|---------|------|:--------:|----------|-----|
| 1 | ...     | ...  | 🔴 HIGH  | Slop     | ... |
| 2 | ...     | ...  | 🟡 MED   | Color    | ... |
| 3 | ...     | ...  | 🟢 LOW   | Typo     | ... |

✅ POSITIVES (things done well)
- [specific praise with file reference]
- [specific praise with file reference]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULT: ✅ PASS / ❌ FAIL — X findings cần fix
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Scoring Guide

| Score | Criteria |
|:-----:|----------|
| 5 | Zero findings trong category, exemplary |
| 4 | 1-2 minor findings (🟢 LOW), overall strong |
| 3 | 1-2 medium findings (🟡 MED), acceptable |
| 2 | Multiple medium hoặc 1 high finding |
| 1 | Multiple high findings |
| 0 | Category basically broken |

---

## Bước 10: Fix & Re-check 🔧

**Sau khi trình bày report:**

| User nói | AI làm |
|----------|--------|
| "fix #1" | Fix finding cụ thể |
| "fix all 🔴" | Fix tất cả HIGH severity |
| "fix all" | Fix tất cả findings |
| "chỉ report thôi" | Dừng lại, không fix |

**Sau khi fix:**
- Chạy `npm run build` để verify không break
- Chạy lại `/ui-check` để confirm score cải thiện

---

## Khi Nào Chạy /ui-check

| Tình huống | Nên chạy? |
|------------|:---------:|
| Sau khi thêm page/section UI mới | ✅ Bắt buộc |
| Sau khi refactor UI lớn | ✅ Bắt buộc |
| Trước deploy (cùng /ship) | ✅ Nên |
| Review UI định kỳ (monthly) | ✅ Nên |
| Chỉ sửa code backend | ❌ Không cần |
| Chỉ sửa API/data logic | ❌ Không cần |

---

## Kết Hợp Với Workflows Khác

```
/ui-check → fix UI issues → /seo-check → fix SEO → /ship → deploy
```

| `/ui-check` | `/seo-check` | `/audit` |
|-------------|-------------|----------|
| **Design quality** | **SEO compliance** | **Code quality** |
| AI slop, color, typo, motion | Meta tags, JSON-LD, sitemap | Bugs, security, perf |
| Frontend UI only | Frontend SEO only | Full stack |
