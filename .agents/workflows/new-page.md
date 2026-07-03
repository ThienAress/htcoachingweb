---
name: new-page
trigger: /new-page
description: Workflow thêm trang public mới cho htcoachingweb. Đảm bảo đầy đủ: route, lazy import, SEO component, sitemap, prerender. Use khi tạo bất kỳ page nào cần Google index.
---

# /new-page — Thêm Trang Public Mới

> **Tại sao cần workflow này?** Thêm trang public ở htcoachingweb cần cập nhật **6 nơi**. Bỏ sót bất kỳ bước nào → Google không index, SEO bị broken, hoặc trang không load được.

---

## Input cần thiết

Trước khi bắt đầu, xác nhận:
- **Tên trang:** (VD: `ClubGuide`)
- **URL route:** (VD: `/huong-dan-tap-gym`) — kebab-case tiếng Việt
- **Page title:** (VD: `Hướng Dẫn Tập Gym`)
- **Meta description:** (150-160 ký tự)
- **Có cần JSON-LD không?** (LocalBusiness / Article / Person / Service)

---

## Bước 1: Tạo Page Component 📄

```
client/src/pages/TenPage.jsx
```

Template tối thiểu:
```jsx
import SEO from "../components/SEO";

function TenPage() {
  return (
    <>
      <SEO
        title="Page Title"
        description="Meta description 150-160 ký tự..."
        canonical="/url-route"
      />
      {/* Nội dung trang */}
    </>
  );
}

export default TenPage;
```

**Verify:** File tồn tại, có `<SEO>` component với đủ 3 props bắt buộc.

---

## Bước 2: Thêm Lazy Route vào App.jsx 🔀

```jsx
// Thêm vào phần lazy imports (đầu file, cùng nhóm với các pages khác)
const TenPage = lazy(() => import("./pages/TenPage"));

// Thêm vào phần <Routes> (đúng vị trí trong hierarchy)
<Route path="/url-route" element={<TenPage />} />
```

**Verify:** Import là `lazy()`, không phải direct import. Route được thêm đúng chỗ.

---

## Bước 3: Cập nhật generate-sitemap.js 🗺️

```js
// client/scripts/generate-sitemap.js
// Tìm mảng staticRoutes và thêm vào:
const staticRoutes = [
  // ... routes hiện có ...
  {
    url: "/url-route",
    changefreq: "monthly",  // hoặc "weekly" nếu content thay đổi thường
    priority: 0.7,          // 1.0 = trang chủ, 0.8 = trang quan trọng, 0.6-0.7 = trang thường
  },
];
```

**Verify:** Route mới có trong `staticRoutes` array với `url`, `changefreq`, `priority`.

---

## Bước 4: Cập nhật prerender.js 🖨️

```js
// client/scripts/prerender.js
// Tìm mảng routesToPrerender và thêm vào:
const routesToPrerender = [
  // ... routes hiện có ...
  "/url-route",
];
```

**Verify:** Route mới có trong `routesToPrerender` array.

---

## Bước 5: SEO Props Đầy Đủ ✅

Kiểm tra lại `<SEO>` component trong page:

| Prop | Bắt buộc | Đã có? |
|------|:--------:|:------:|
| `title` | ✅ | |
| `description` | ✅ | |
| `canonical` | ✅ | |
| `type` | ❌ optional | |
| `jsonLd` | ❌ nếu cần | |

**Verify:** `description` đủ 150-160 ký tự, `canonical` bắt đầu bằng `/`.

---

## Bước 6: JSON-LD (Nếu cần) 📊

Áp dụng cho:
- **Trang chủ:** `LocalBusiness` + `FAQPage` schema (`@graph`)
- **Customer Story:** `Article` schema (có `datePublished`, `dateModified`)
- **Trainer Profile:** `Person` schema
- **Trang dịch vụ/pricing:** `Service` schema
- **Công cụ (TDEE, Exercises):** `WebApplication` + `FAQPage` schema (`@graph`)

```jsx
<SEO
  title="..."
  description="..."
  canonical="/url-route"
  jsonLd={{
    "@context": "https://schema.org",
    "@type": "Article",  // thay đổi theo loại trang
    "headline": "...",
    // ...
  }}
/>
```

---

## Bước 7: FAQPage Schema (Nếu trang có nội dung Q&A) ❓

Nếu trang có câu hỏi thường gặp → thêm `FAQPage` schema bằng `@graph`:

```jsx
const pageSchema = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebApplication", /* schema chính */ },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Câu hỏi?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Câu trả lời."
          }
        }
      ]
    }
  ]
};
```

**Verify:** Google Rich Results Test validate OK.

---

## Bước 8: Internal Linking 🔗

Mỗi trang public MỚI phải có ít nhất **2-3 internal links** đến các trang khác:

| Trang mới | Nên link đến |
|-----------|-------------|
| Bất kỳ | TDEE Calculator, Exercises, Kết quả KH |
| Có liên quan dinh dưỡng | Meal Plan |
| Có liên quan PT | Kết quả KH, Pricing (#pricing) |

Thêm section "Khám phá thêm" hoặc "Công cụ hỗ trợ" cuối trang với 3 Link cards.

**Verify:** Không có orphan page (trang không có internal link nào trỏ tới).

---

## Output Format

```
📄 NEW PAGE CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Page: [TenPage] → /url-route

[1/8] Page Component    ✅ Created với <SEO> component
[2/8] Lazy Route        ✅ Added to App.jsx
[3/8] Sitemap           ✅ Added to generate-sitemap.js
[4/8] Prerender         ✅ Added to prerender.js
[5/8] SEO Props         ✅ title, description, canonical đầy đủ
[6/8] JSON-LD           ⏭️ SKIP (không cần cho trang này)
[7/8] FAQPage Schema    ⏭️ SKIP (trang không có FAQ)
[8/8] Internal Linking  ✅ 3 links đến TDEE, Exercises, KQ KH

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULT: ✅ DONE — Trang sẵn sàng, Google + AI engines có thể index
```
