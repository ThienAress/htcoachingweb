# SEO Rules — HTCoachingWeb

> Quy tắc SEO chi tiết cho dự án HTCOACHING. Áp dụng khi tạo/sửa page public.

---

## Hệ Thống SEO Hiện Tại (3 Layer)

```
Layer 1: index.html          ← Meta tags mặc định (crawlers đọc đầu tiên)
Layer 2: <SEO> component     ← react-helmet-async override per-page
Layer 3: Prerender + Sitemap  ← Puppeteer prerender cho static routes
```

---

## Rule 1: Mọi Page Public PHẢI Có `<SEO>` Component

```jsx
// ✅ ĐÚNG
import SEO from "../components/SEO";

function CustomerStories() {
  return (
    <>
      <SEO
        title="Kết Quả Khách Hàng"
        description="Xem kết quả thực tế từ các học viên tại HTCOACHING..."
        canonical="/ket-qua-khach-hang"
      />
      {/* page content */}
    </>
  );
}

// ❌ SAI — page public không có SEO component
function CustomerStories() {
  return <div>...</div>;
}
```

---

## Rule 2: Props `<SEO>` Component

| Prop | Bắt buộc? | Format | Ví dụ |
|------|:---------:|--------|-------|
| `title` | ✅ | Ngắn gọn, có keyword | `"Kết Quả Khách Hàng"` → render: `"Kết Quả Khách Hàng \| HTCOACHING"` |
| `description` | ✅ | 150-160 ký tự, có CTA | `"Xem kết quả giảm mỡ, tăng cơ thực tế từ học viên HTCOACHING..."` |
| `canonical` | ✅ (public) | Path tương đối, bắt đầu `/` | `"/ket-qua-khach-hang"` |
| `type` | ❌ | `"website"` hoặc `"article"` | `"article"` cho blog/story |
| `image` | ❌ | URL tuyệt đối ảnh OG 1200×630 | |
| `noindex` | ❌ | `true` cho trang hệ thống | `true` cho `/admin/*`, `/login` |
| `jsonLd` | ❌ | JSON-LD object | Xem Rule 5 |

---

## Rule 3: Trang Hệ Thống PHẢI Có `noindex`

```jsx
<SEO title="Quản Lý" noindex={true} />
```

**Danh sách trang `noindex`:** `/login`, `/admin-login`, `/login-success`, `/admin/*`, `/trainer/*`, `/account`, `/wallet`, `/my-history`, `/checkin`, `/register`

---

## Rule 4: URL Slug Tiếng Việt

```
// ✅ ĐÚNG — kebab-case, bỏ dấu
/ket-qua-khach-hang
/huan-luyen-vien/ten-hlv

// ❌ SAI
/ketQuaKhachHang          ← camelCase
/customer_stories          ← English + underscore
```

**Quy tắc slug cho content động:**
- Customer Stories: `/ket-qua-khach-hang/{slug}` — slug sinh từ tên + tuổi + duration
- Trainer Profile: `/huan-luyen-vien/{slug}` — slug sinh từ tên HLV

---

## Rule 5: JSON-LD Structured Data

### Trang chủ — LocalBusiness

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "HTCOACHING",
  "description": "HLV cá nhân: Gym, Boxing, Tăng cơ & Giảm mỡ",
  "url": "https://htcoachingweb.io.vn",
  "image": "https://htcoachingweb.io.vn/og-image.png",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "TP. Hồ Chí Minh",
    "addressCountry": "VN"
  },
  "priceRange": "$$"
}
```

### Trang Customer Story — Article

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Vy Ngô - 27 tuổi - Giảm 6kg trong 3 tháng",
  "image": "https://...",
  "datePublished": "2026-01-15",
  "author": { "@type": "Organization", "name": "HTCOACHING" }
}
```

### Trang Trainer Profile — Person

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Tên HLV",
  "jobTitle": "Huấn Luyện Viên Cá Nhân",
  "worksFor": { "@type": "Organization", "name": "HTCOACHING" }
}
```

### Trang Pricing — Service + Offer

```json
{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Gói PT 1 kèm 1",
  "provider": { "@type": "Organization", "name": "HTCOACHING" },
  "offers": {
    "@type": "Offer",
    "priceCurrency": "VND"
  }
}
```

---

## Rule 6: Sitemap & Prerender

| File | Vai trò | Khi nào cập nhật |
|------|---------|-----------------|
| `scripts/generate-sitemap.js` | Prebuild: sinh `public/sitemap.xml` | Khi **thêm/xóa static route** hoặc thêm content type động mới |
| `scripts/prerender.js` | Postbuild: prerender HTML cho SEO pages | Khi **thêm/xóa static route** cần SEO |

**Khi thêm page public mới — CHECKLIST 5 bước:**

1. ✅ Thêm route trong `App.jsx`
2. ✅ Thêm `<SEO>` component trong page
3. ✅ Thêm vào `staticRoutes` trong `generate-sitemap.js`
4. ✅ Thêm vào `routesToPrerender` trong `prerender.js`
5. ✅ Cân nhắc thêm JSON-LD structured data

---

## Rule 7: Canonical URL

- Domain chính: `https://htcoachingweb.io.vn`
- LUÔN dùng path tương đối trong `<SEO canonical="/path">` — component tự gắn domain
- KHÔNG duplicate content: mỗi page chỉ có 1 canonical URL
- Trang pagination KHÔNG cần canonical riêng (list page là canonical)

---

## Rule 8: Breadcrumb Schema

Áp dụng cho trang có **nested URL** (Customer Story Detail, Trainer Profile):

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Trang chủ", "item": "https://htcoachingweb.io.vn/" },
    { "@type": "ListItem", "position": 2, "name": "Kết Quả Khách Hàng", "item": "https://htcoachingweb.io.vn/ket-qua-khach-hang" },
    { "@type": "ListItem", "position": 3, "name": "Vy Ngô" }
  ]
}
```
