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
- **Trang chủ:** `LocalBusiness` schema
- **Customer Story:** `Article` schema  
- **Trainer Profile:** `Person` schema
- **Trang dịch vụ/pricing:** `Service` schema

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

## Output Format

```
📄 NEW PAGE CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Page: [TenPage] → /url-route

[1/6] Page Component    ✅ Created với <SEO> component
[2/6] Lazy Route        ✅ Added to App.jsx
[3/6] Sitemap           ✅ Added to generate-sitemap.js
[4/6] Prerender         ✅ Added to prerender.js
[5/6] SEO Props         ✅ title, description, canonical đầy đủ
[6/6] JSON-LD           ⏭️ SKIP (không cần cho trang này)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULT: ✅ DONE — Trang sẵn sàng, Google có thể index
```
