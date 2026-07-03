---
name: seo-check
trigger: /seo-check
description: Quét toàn bộ trang public tìm vấn đề SEO (thiếu SEO component, JSON-LD, internal links, sitemap, prerender). Chạy trước deploy hoặc sau khi thêm page mới. Tương tự /ship nhưng chuyên cho SEO.
---

# /seo-check — Kiểm Tra SEO Toàn Bộ Trang Public

> **Tại sao cần workflow này?** Project có nhiều trang public. Mỗi trang cần đủ SEO component, JSON-LD, internal linking, sitemap entry, prerender. Bỏ sót 1 trang = Google không index đúng. Workflow này quét TẤT CẢ và phát hiện thiếu sót.

---

## Bước 1: Thu thập danh sách trang public 📋

Scan `App.jsx` để lấy TẤT CẢ routes public (không cần auth):

```
Trang public đã biết:
- / (Home)
- /ket-qua-khach-hang (CustomerStories)
- /ket-qua-khach-hang/:slug (CustomerStoryDetail)
- /huan-luyen-vien/:slug (TrainerProfile)
- /tdee-calculator (TdeeCalculator)
- /mealplan (MealPlan)
- /exercises (ExercisesPage)
- /club (Club)
```

**Action:** Grep `App.jsx` tìm tất cả `<Route path=` → lọc routes không nằm trong `AdminRoute` hoặc `TrainerLayout`.

---

## Bước 2: Kiểm tra SEO Component ✅

Với MỖI trang public, kiểm tra:

| Check | Cách kiểm tra | Pass/Fail |
|-------|--------------|:---------:|
| Có `<SEO>` component | Grep `<SEO` trong file | |
| Có `title` prop | Grep `title=` trong `<SEO>` | |
| Có `description` prop | Grep `description=` | |
| Có `canonical` prop | Grep `canonical=` | |
| `description` đủ 150-160 ký tự | Đếm ký tự | |
| Trang auth có `noindex` | Grep `noindex` | |

**Command mẫu:**
```bash
# Tìm trang public THIẾU SEO component
grep -rL "SEO" client/src/pages/*.jsx --include="*.jsx"
```

---

## Bước 3: Kiểm tra JSON-LD Structured Data 📊

| Trang | Schema bắt buộc | Check |
|-------|-----------------|:-----:|
| Home | Organization + FAQPage (`@graph`) | |
| CustomerStoryDetail | Article (có `datePublished`, `dateModified`) | |
| TrainerProfile | Person + FAQPage (`@graph`) | |
| TdeeCalculator | WebApplication + FAQPage (`@graph`) | |
| Pricing (section) | Service + Offer | |

**Command mẫu:**
```bash
# Tìm trang có jsonLd prop
grep -rn "jsonLd" client/src/pages/ --include="*.jsx"
```

---

## Bước 4: Kiểm tra Internal Linking 🔗

Mỗi trang public PHẢI có ≥2 internal links đến trang public khác.

**Cách kiểm tra:**
```bash
# Tìm trang THIẾU internal Link (không có Link to= trỏ đến trang khác)
grep -rn "Link.*to=\"/" client/src/pages/ --include="*.jsx"
```

**Checklist:**
| Trang | Links đến | Đủ ≥2? |
|-------|----------|:------:|
| CustomerStories | TDEE, Exercises, HLV | |
| CustomerStoryDetail | TDEE, Exercises, KQ KH | |
| TrainerProfile | TDEE, Exercises, KQ KH | |
| ExercisesPage | TDEE, Meal Plan, KQ KH | |
| TdeeCalculator | Meal Plan (CTA sẵn có) | |
| Club | ??? | |
| MealPlan | ??? | |

---

## Bước 5: Kiểm tra Sitemap & Prerender 🗺️

| Check | File | Command |
|-------|------|---------|
| Trang public có trong sitemap? | `scripts/generate-sitemap.js` | Đọc `staticRoutes` array |
| Trang public có trong prerender? | `scripts/prerender.js` | Đọc `routesToPrerender` array |

**So sánh:** Số routes trong App.jsx (public) = số routes trong sitemap = số routes trong prerender.

Nếu khác nhau → **FAIL** — có trang bị bỏ sót.

---

## Bước 6: Kiểm tra AI SEO 🤖

| Check | File | Pass/Fail |
|-------|------|:---------:|
| `llms.txt` tồn tại | `client/public/llms.txt` | |
| `llms.txt` liệt kê đủ pages | Đếm URLs trong file | |
| `robots.txt` cho phép AI bots | Grep `GPTBot`, `ClaudeBot` | |
| `robots.txt` có link sitemap | Grep `Sitemap:` | |

---

## Bước 7: Tổng hợp kết quả & Fix

### Output Format

```
🔍 SEO CHECK REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 TRANG PUBLIC: X trang
✅ SEO Component: X/X pass
✅ JSON-LD: X/X pass  
✅ Internal Links: X/X pass
✅ Sitemap: X/X pass
✅ Prerender: X/X pass
✅ AI SEO: X/X pass

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ VẤN ĐỀ CẦN FIX:

| # | Trang | Vấn đề | Mức độ |
|---|-------|--------|--------|
| 1 | Club | Thiếu internal links | 🟡 Medium |
| 2 | MealPlan | Thiếu JSON-LD | 🟡 Medium |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULT: ✅ PASS / ❌ FAIL — X vấn đề cần fix
```

### Sau khi fix

- Fix từng vấn đề theo thứ tự priority (🔴 High → 🟡 Medium → 🟢 Low)
- Chạy `npm run build` để verify
- Chạy lại `/seo-check` để confirm tất cả pass

---

## Khi nào chạy /seo-check

| Tình huống | Nên chạy? |
|------------|:---------:|
| Trước deploy lên Netlify | ✅ Bắt buộc |
| Sau khi thêm page public mới | ✅ Bắt buộc |
| Sau khi refactor routes | ✅ Nên |
| Khi chỉ sửa code backend | ❌ Không cần |
| Khi sửa trang admin/trainer | ❌ Không cần |
