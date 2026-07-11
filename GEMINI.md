# GEMINI AI — HTCOACHINGWEB PROJECT RULES

> **Scope:** Áp dụng cho mọi tác vụ coding do Gemini (Antigravity) thực hiện trong dự án này.
> **Mục tiêu:** AI code chính xác, đơn giản, an toàn — như một dev partner hiểu rõ project.

---

## 1. Identity & Communication

- Bạn là **fullstack developer partner** — hỗ trợ code, debug, review cho dự án htcoachingweb.
- Luôn giao tiếp, giải thích và báo cáo bằng **Tiếng Việt**.
- Diễn giải **ngắn gọn, rõ ràng, có căn cứ** — không suy đoán mơ hồ.
- Khi không chắc chắn → **DỪNG LẠI và hỏi**, không tự ý quyết định.

---

## 2. Think Before Coding

> **"Đừng giả định. Đừng giấu sự nhầm lẫn. Bề mặt hóa các đánh đổi."**

Trước khi implement:

- **Nêu rõ giả định.** Nếu không chắc → hỏi.
- **Nhiều cách hiểu → trình bày tất cả**, để user chọn — không tự ý pick.
- **Có cách đơn giản hơn → nói ra.** Push back khi cần thiết.
- **Không hiểu → DỪNG.** Nói rõ cái gì chưa hiểu, rồi hỏi.

**Đặc biệt cho htcoachingweb:**

- Nếu thay đổi liên quan đến **Auth / CSRF / JWT / Payment / Wallet** → **LUÔN nêu rõ ảnh hưởng** trước khi code.
- Nếu thay đổi liên quan đến **SEO** (routes, meta tags, sitemap, prerender) → **LUÔN kiểm tra** có cần cập nhật `generate-sitemap.js` và `prerender.js` không.
- Nếu thay đổi **data model** (Mongoose schema) → nêu rõ ảnh hưởng đến các controllers/services/routes liên quan.

---

## 3. Simplicity First

> **"Code tối thiểu giải quyết vấn đề. Không gì suy đoán."**

- **Không thêm feature** ngoài yêu cầu.
- **Không tạo abstraction** cho code chỉ dùng 1 lần.
- **Không thêm "flexibility"** hay "configurability" chưa được yêu cầu.
- **Không handle error** cho scenario không thể xảy ra.
- Nếu viết 200 dòng mà 50 dòng đủ → **viết lại 50 dòng**.

**Đặc biệt cho htcoachingweb:**

- **File mới phải dưới 300 dòng.** Nếu dài hơn → tách component/module.
- **Không tạo custom hooks** trừ khi logic được dùng ở ≥2 nơi.
- **Không tạo utility functions** cho thao tác dùng 1 lần.
- **Câu test:** *"Một senior engineer có nói code này quá phức tạp không?"* Nếu có → đơn giản hóa.

---

## 4. Surgical Changes

> **"Chỉ chạm vào cái cần chạm. Chỉ dọn rác do mình tạo ra."**

Khi sửa code hiện tại:

- **Không "cải thiện"** code, comments, formatting bên cạnh.
- **Không refactor** thứ chưa hỏng.
- **Match style hiện tại** — kể cả bạn muốn khác.
- Thấy dead code → **mention nó, ĐỪNG xóa** (trừ khi user yêu cầu).

Khi thay đổi tạo orphans:

- **Xóa imports/variables/functions** mà THAY ĐỔI CỦA BẠN tạo ra unused.
- **Không xóa** pre-existing dead code trừ khi được yêu cầu.

**Đặc biệt cho htcoachingweb:**

- **Không sửa inline imports** trong `server.js` (dòng 152-178) trừ khi được yêu cầu — đó là pattern có chủ đích.
- **Không đổi quote style** (project dùng mixed `""` và `''`).
- **Không thêm type hints / JSDoc** trừ khi được yêu cầu.
- **Test:** Mọi dòng thay đổi phải trace trực tiếp về yêu cầu của user.

---

## 5. Goal-Driven Execution

> **"Định nghĩa tiêu chí thành công. Lặp cho đến khi verify."**

Biến task thành mục tiêu có thể verify:

| Thay vì nói... | Biến thành... |
|----------------|---------------|
| "Thêm feature X" | "Code feature X → verify: build thành công + UI hoạt động đúng" |
| "Fix bug Y" | "Xác định root cause → fix → verify: scenario lỗi không tái hiện" |
| "Refactor Z" | "Refactor → verify: tất cả routes liên quan vẫn hoạt động" |

Với task nhiều bước → **phải có plan:**
```
1. [Bước 1] → verify: [kiểm tra gì]
2. [Bước 2] → verify: [kiểm tra gì]  
3. [Bước 3] → verify: [kiểm tra gì]
```

**Đặc biệt cho htcoachingweb:**

- Sau khi code xong → **chạy `npm run build` (client)** để verify không có build errors.
- Với API changes → verify bằng cách **kiểm tra response format** nhất quán.
- Nếu AI mắc lỗi → **tự đọc error → phân tích → sửa → retry** (tối đa 3 lần). Sau 3 lần → dừng, báo cáo rõ ràng.

---

## 6. Git Safety

* **Tuyệt đối KHÔNG** dùng lệnh Git làm thay đổi trạng thái code:
  * ❌ `git pull`, `git checkout`, `git merge`, `git rebase`, `git reset`
* Vì code trên server có thể chưa cập nhật — pull về sẽ **ghi đè code local đang sửa**.
* Luôn **giữ nguyên trạng thái code local** hiện tại để làm việc.
* Nếu cần file hoặc nội dung mới → **yêu cầu user cung cấp** thay vì tự ý dùng git.
* **Được phép** dùng lệnh read-only: `git status`, `git diff`, `git log` — để kiểm tra trạng thái.

---

## 7. Project Architecture

### Monorepo Structure

```
htcoachingweb/
├── client/                          ← React 19 SPA (Vite 8)
│   ├── index.html                   ← SEO meta tags gốc + GA4
│   ├── public/                      ← Static assets, sitemap.xml, robots.txt
│   ├── scripts/
│   │   ├── generate-sitemap.js      ← Prebuild: sinh sitemap từ API
│   │   └── prerender.js             ← Postbuild: prerender SEO pages (Puppeteer)
│   └── src/
│       ├── App.jsx                  ← Router chính (lazy-loaded pages)
│       ├── main.jsx                 ← Entry point
│       ├── components/              ← Shared components (SEO, ErrorBoundary, F1/...)
│       ├── context/                 ← AuthContext (JWT + CSRF)
│       ├── hooks/                   ← Custom hooks (useMealGenerator, useGsap...)
│       ├── layouts/                 ← MainLayout, AdminLayout, TrainerLayout
│       ├── pages/                   ← Page components (lazy-loaded)
│       │   ├── admin/               ← 15+ admin pages
│       │   ├── trainer/             ← Trainer dashboard, coaching, schedule
│       │   ├── customer/            ← Online coaching
│       │   └── [public pages]       ← Home, Login, Register, Club, Exercises...
│       ├── routes/                  ← AdminRoute (role-based guard)
│       ├── sections/                ← Landing page sections (Hero, Pricing, About...)
│       ├── services/                ← API call functions (20 service files)
│       └── utils/                   ← api.js (axios instance), csrf, navigation
│
├── server/                          ← Express 5 API
│   ├── server.js                    ← Entry point (routes, middleware, cron jobs)
│   └── src/
│       ├── config/                  ← db.js, env.js, passport.js
│       ├── controllers/             ← Request handlers (17 controllers)
│       ├── middlewares/             ← Auth, CSRF, rate limit, uploads, validation
│       ├── models/                  ← Mongoose schemas (26 models)
│       ├── routes/                  ← Express routers (20 route files)
│       ├── services/                ← Business logic + cron jobs
│       └── utils/                   ← Shared utilities
│
└── GEMINI.md                        ← File này
```

### Data Flow

```
[Browser] → React SPA (Vite dev / Netlify prod)
    ↓ axios (withCredentials + CSRF token)
[Express API] → Controllers → Services → Mongoose → MongoDB
    ↓ Cloudinary (uploads), Nodemailer/Resend (email)
```

### 3 Roles

| Role | Frontend Routes | Backend Auth |
|------|----------------|-------------|
| **Public** | `/`, `/ket-qua-khach-hang/*`, `/huan-luyen-vien/*`, `/tdee-calculator`, `/mealplan`, `/exercises`, `/club` | Không cần auth |
| **User** | `/login`, `/register`, `/checkin`, `/my-history`, `/wallet`, `/online-coaching`, `/account` | JWT `role: "user"` |
| **Trainer** | `/trainer/*` (Dashboard, Checkin History, Coaching, Schedule) | JWT `role: "trainer"` hoặc `role: "user"` + active subscription |
| **Admin** | `/admin/*` (15+ management pages) | JWT `role: "admin"` |

---

## 8. Tech Stack & Mandatory Patterns

### Tech Stack

| Layer | Công nghệ | Lưu ý |
|-------|----------|-------|
| **Frontend** | React 19 + Vite 8 | ES Modules, JSX |
| **Styling** | Tailwind CSS v4 (plugin `@tailwindcss/vite`) | Không dùng `@apply` quá mức |
| **Routing** | React Router DOM v7 | Lazy loading TẤT CẢ pages |
| **State** | React Context (Auth) + TanStack Query v5 (server state) | Không dùng Redux |
| **Forms** | React Hook Form + Zod v4 | Validation ở cả client và server |
| **Animation** | GSAP 3.15 + SplitType | Qua custom hook `useGsap` |
| **SEO** | react-helmet-async + sitemap + prerender | Xem Section 11 |
| **UI Kit** | @aejkatappaja/phantom-ui + Lucide React | Icons chỉ dùng Lucide |
| **Backend** | Express 5 + Mongoose 9 (MongoDB) | MVC pattern |
| **Auth** | JWT (httpOnly cookies) + Google OAuth (Passport) + CSRF | Xem Section 10 |
| **Upload** | Multer → Cloudinary | Mỗi loại entity có middleware upload riêng |
| **Email** | Nodemailer + Resend | |
| **Deploy** | Netlify (FE) + Render (BE) | CORS configured |

### Mandatory Patterns — AI PHẢI Follow

#### FE Pattern 1: Lazy Loading Pages
```jsx
// ✅ ĐÚNG — TẤT CẢ pages phải lazy-loaded
const NewPage = lazy(() => import("./pages/NewPage"));

// ❌ SAI — KHÔNG import trực tiếp
import NewPage from "./pages/NewPage";
```

#### FE Pattern 2: Service Layer
```
// API calls PHẢI nằm trong services/, KHÔNG inline trong components
client/src/services/{module}.service.js  ← Đặt API calls ở đây
client/src/pages/{Module}.jsx            ← Component chỉ gọi service
```

#### FE Pattern 3: Route Guard
```
// Trang cần auth → wrap trong <AdminRoute>
// AdminRoute check: user role + subscription status
```

#### BE Pattern 1: MVC + Service Layer
```
routes/{module}.routes.js    → Định nghĩa endpoints + middleware
controllers/{module}.controller.js → Handle request/response
services/{module}.service.js → Business logic
models/{Model}.js            → Mongoose schema
```

#### BE Pattern 2: Upload Middleware
```
// Mỗi loại upload có middleware RIÊNG:
middlewares/avatarUpload.js
middlewares/trainerUpload.js
middlewares/coachingUpload.js
middlewares/customerStoryUpload.js
middlewares/f1MediaUpload.js
middlewares/siteSettingUpload.js
// → Khi tạo upload mới, tạo middleware mới. KHÔNG gộp chung.
```

#### BE Pattern 3: Validation
```
// TẤT CẢ validation nằm trong: middlewares/validation.js
// Dùng express-validator, apply trong routes
```

---

## 9. Code Style & Conventions

### Naming

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| **React Component** | PascalCase | `TrainerCoaching.jsx`, `MyWallet.jsx` |
| **Page file** | PascalCase.jsx | `FoodManagement.jsx` |
| **Service file** | camelCase.service.js | `food.service.js` |
| **Controller file** | camelCase.controller.js | `food.controller.js` |
| **Route file** | camelCase.routes.js | `food.routes.js` |
| **Model file** | PascalCase.js | `Food.js` |
| **Middleware file** | camelCase.js | `auth.middleware.js` |
| **Hook file** | useCamelCase.js | `useMealGenerator.js` |
| **URL routes (FE)** | kebab-case tiếng Việt | `/ket-qua-khach-hang`, `/huan-luyen-vien` |
| **API endpoints** | kebab-case | `/api/customer-stories`, `/api/f1-customers` |
| **Mongoose fields** | camelCase | `startWeight`, `publishedAt` |

### Import Order (Frontend)

```jsx
// 1. React / React libraries
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// 2. Third-party libraries
import { toast } from "react-toastify";

// 3. Local context / hooks
import { useAuth } from "../context/AuthContext";
import useDebounce from "../hooks/useDebounce";

// 4. Services
import { getOrders } from "../services/order.service";

// 5. Components
import SEO from "../components/SEO";

// 6. CSS / Assets (nếu có)
```

### File Structure cho Page Mới

```
// Page đơn giản → 1 file
pages/NewPage.jsx

// Page phức tạp → folder
pages/NewPage/
├── NewPage.jsx          ← Component chính
├── components/          ← Sub-components (nếu cần)
└── hooks/               ← Page-specific hooks (nếu cần)
```

---

## 10. Security Rules

### Auth Flow — KHÔNG ĐƯỢC PHÁ

```
[Login] → Google OAuth / Admin login
    ↓
[Server] → Set httpOnly cookies: accessToken + refreshToken
    ↓
[Client] → api.js interceptor tự gắn CSRF token (từ cookie)
    ↓
[Request] → Cookie (JWT) + Header (X-CSRF-Token)
    ↓
[Server] → auth.middleware.js verify JWT + CSRF
    ↓
[401] → api.js interceptor tự call /auth/refresh → retry request
    ↓
[Refresh fail] → redirect /login
```

### Rules Bắt Buộc

| Rule | Chi tiết |
|------|---------|
| **CSRF** | Mọi request mutating (POST/PUT/DELETE) PHẢI có `X-CSRF-Token` header. Đã handle trong `utils/api.js` — KHÔNG SỬA file này trừ khi có lý do rõ ràng |
| **CSRF timing-safe** | `csrf.js` dùng `crypto.timingSafeEqual()` để so sánh token. KHÔNG revert về `===` hay `!==` |
| **JWT cookies** | `accessToken` và `refreshToken` là **httpOnly** — frontend KHÔNG đọc/xóa được. Chỉ server quản lý |
| **Environment** | `.env` files KHÔNG được commit. KHÔNG in nội dung `.env` ra chat. KHÔNG hardcode credentials |
| **Rate Limiting** | Production có rate limit (`rateLimit.js`). KHÔNG xóa hoặc tăng limit quá mức |
| **Role check** | Backend PHẢI check role bằng middleware trước khi xử lý. KHÔNG trust role từ frontend |
| **IDOR Protection** | Endpoint user-accessible dùng `findById(req.params.id)` PHẢI có ownership check. Pattern: `findOne({ _id, userId })` hoặc check `clientId`/`trainerId` match `req.user.id`, hoặc `assertCustomerAccess()`. Admin-only endpoints (đã có `requireRoles("admin")`) được miễn |
| **Validation** | Input PHẢI validate ở cả client (Zod) VÀ server (express-validator). KHÔNG bỏ 1 trong 2 |
| **Upload** | PHẢI validate file type, size trong upload middleware. KHÔNG cho upload file tùy ý |
| **CSP Headers** | Helmet CSP đã config trong `server.js` (production-only). Khi thêm domain mới → cập nhật CSP whitelist. Xem bảng domains chi tiết trong `skills/reference/known_issues.md` → section "CSP Domains Đã Whitelist" |
| **Safe Logging** | Security-critical controllers (auth, payment, contract) PHẢI dùng `safeLog` từ `utils/safeLogger.js`. KHÔNG `console.error(err)` log raw errors chứa PII |
| **Security.txt** | File `client/public/.well-known/security.txt` tồn tại theo RFC 9116. KHÔNG xóa |

### Lệnh CẤM

| ❌ Tuyệt đối KHÔNG | Lý do |
|-------------------|-------|
| `DROP TABLE`, `db.dropDatabase()` | Phá hủy dữ liệu |
| `rm -rf`, xóa thư mục quan trọng | Phá hủy project |
| In API keys, JWT secrets ra chat | Lộ credentials |
| Disable CSRF protection | Mở lỗ hổng bảo mật |
| Revert CSRF `timingSafeEqual` về `!==` | Mở lỗ hổng timing attack |
| Xóa IDOR ownership checks trong controllers | Mở lỗ hổng IDOR |
| Disable rate limiting trong production | Mở cho DDoS |
| Hardcode production URLs trong code | Dùng env variables |
| Xóa CSP config trong Helmet | Mở lỗ hổng XSS/injection |
| `console.error` log PII (password, phone, token) | Lộ dữ liệu nhạy cảm |

---

## 11. SEO Rules (Chi Tiết)

### Hệ Thống SEO Hiện Tại (3 Layer)

```
Layer 1: index.html          ← Meta tags mặc định (crawlers đọc đầu tiên)
Layer 2: <SEO> component     ← react-helmet-async override per-page
Layer 3: Prerender + Sitemap  ← Puppeteer prerender cho static routes
```

### Rule 1: Mọi Page Public PHẢI Có `<SEO>` Component

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

### Rule 2: Props `<SEO>` Component

| Prop | Bắt buộc? | Format | Ví dụ |
|------|:---------:|--------|-------|
| `title` | ✅ | Ngắn gọn, có keyword | `"Kết Quả Khách Hàng"` → render: `"Kết Quả Khách Hàng \| HTCOACHING"` |
| `description` | ✅ | 150-160 ký tự, có CTA | `"Xem kết quả giảm mỡ, tăng cơ thực tế từ học viên HTCOACHING..."` |
| `canonical` | ✅ (public) | Path tương đối, bắt đầu bằng `/` | `"/ket-qua-khach-hang"` |
| `type` | ❌ | `"website"` hoặc `"article"` | `"article"` cho blog/story |
| `image` | ❌ | URL tuyệt đối ảnh OG 1200×630 | |
| `noindex` | ❌ | `true` cho trang hệ thống | `true` cho `/admin/*`, `/login` |
| `jsonLd` | ❌ | JSON-LD object | Xem bên dưới |

### Rule 3: Trang Hệ Thống PHẢI Có `noindex`

```jsx
// Tất cả trang admin, login, account → noindex
<SEO title="Quản Lý" noindex={true} />
```

Danh sách trang `noindex`: `/login`, `/admin-login`, `/login-success`, `/admin/*`, `/trainer/*`, `/account`, `/wallet`, `/my-history`, `/checkin`, `/register`

### Rule 4: URL Slug Tiếng Việt

```
// ✅ ĐÚNG — kebab-case, bỏ dấu hoặc giữ nguyên ký tự Việt trong slug
/ket-qua-khach-hang
/huan-luyen-vien/ten-hlv

// ❌ SAI
/ketQuaKhachHang          ← camelCase
/customer_stories          ← English + underscore
```

**Quy tắc slug cho content động:**
- Customer Stories: `/ket-qua-khach-hang/{slug}` — slug sinh từ tên + tuổi + duration
- Trainer Profile: `/huan-luyen-vien/{slug}` — slug sinh từ tên HLV

### Rule 5: JSON-LD Structured Data

**Trang chủ — Organization + FAQPage (`@graph`):**
```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "name": "HTCOACHING",
      "url": "https://htcoachingweb.io.vn"
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Câu hỏi?",
          "acceptedAnswer": { "@type": "Answer", "text": "Trả lời." }
        }
      ]
    }
  ]
}
```

**Trang Customer Story — Article (có `datePublished`, `dateModified`):**
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Vy Ngô - 27 tuổi - Giảm 6kg trong 3 tháng",
  "image": "https://...",
  "datePublished": "2026-01-15",
  "dateModified": "2026-06-22",
  "author": { "@type": "Organization", "name": "HTCOACHING" }
}
```

**Trang Trainer Profile — Person:**
```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Tên HLV",
  "jobTitle": "Huấn Luyện Viên Cá Nhân",
  "worksFor": { "@type": "Organization", "name": "HTCOACHING" }
}
```

**Trang Pricing — Service + Offer:**
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

### Rule 6: Sitemap & Prerender

| File | Vai trò | Khi nào cập nhật |
|------|---------|-----------------|
| `scripts/generate-sitemap.js` | Prebuild: sinh `public/sitemap.xml` | Khi **thêm/xóa static route** hoặc thêm content type động mới |
| `scripts/prerender.js` | Postbuild: prerender HTML cho SEO pages | Khi **thêm/xóa static route** cần SEO |

**Khi thêm page public mới:**
1. Thêm route trong `App.jsx`
2. Thêm `<SEO>` component trong page
3. Thêm vào `staticRoutes` trong `generate-sitemap.js`
4. Thêm vào `routesToPrerender` trong `prerender.js`
5. Cân nhắc thêm JSON-LD structured data (dùng `@graph` nếu cần FAQPage)
6. Thêm **internal links** đến ≥2 trang public khác (xem Rule 10)
7. Cập nhật `llms.txt` nếu page quan trọng (xem Rule 9)

### Rule 7: Canonical URL

- Domain chính: `https://htcoachingweb.io.vn`
- LUÔN dùng path tương đối trong `<SEO canonical="/path">` — component tự gắn domain
- KHÔNG duplicate content: mỗi page chỉ có 1 canonical URL
- Trang pagination KHÔNG cần canonical riêng (list page là canonical)

### Rule 8: Breadcrumb Schema (Khi áp dụng)

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

Áp dụng cho: Customer Story Detail, Trainer Profile — các trang có nested URL.

### Rule 9: AI SEO (llms.txt & robots.txt cho AI bots)

Project đã có:
- **`client/public/llms.txt`** — Mô tả HTCOACHING cho AI search engines (GPT, Claude, Perplexity)
- **`client/public/robots.txt`** — Allow 6 AI bots: GPTBot, ClaudeBot, PerplexityBot, GoogleOther, Applebot-Extended, Bytespider. Block CCBot.

**Rules:**
- Khi thêm page public **quan trọng** → cập nhật `llms.txt` phần "Available Pages"
- KHÔNG xóa hoặc sửa AI bot rules trong `robots.txt` trừ khi user yêu cầu
- KHÔNG chặn GPTBot, ClaudeBot, PerplexityBot — đây là lưu lượng tốt cho SEO

### Rule 10: Internal Linking

Mỗi trang public PHẢI có **internal links đến ≥2 trang public khác**:

| Pattern | Áp dụng |
|---------|--------|
| Section "Khám phá thêm" | CustomerStoryDetail → TDEE, Exercises, Kết quả KH |
| Section "Công cụ hỗ trợ" | ExercisesPage → TDEE, Meal Plan, Kết quả KH |
| CTA tự nhiên trong content | TDEE → Meal Plan (đã có sẵn) |

**Mục đích:** Tạo mạng lưới Hub-and-Spoke cho Google crawl. Không để orphan page.

---

## 12. Anti-Patterns (FORBIDDEN)

| ❌ Anti-Pattern | ✅ Thay thế đúng |
|----------------|------------------|
| Import page component trực tiếp (`import X from...`) | `lazy(() => import("./pages/X"))` + `<Suspense>` |
| Gọi API trực tiếp trong component | Tạo function trong `services/*.service.js` |
| Inline styles (`style={{ color: "red" }}`) | Tailwind CSS classes |
| `document.getElementById()` / DOM manipulation trực tiếp | React refs hoặc state |
| `console.log()` để lại trong code delivery | Xóa trước khi deliver |
| Hardcode API URL | Dùng `import.meta.env.VITE_API_URL` (FE) hoặc `process.env` (BE) |
| `setTimeout` / `setInterval` cho data fetching | TanStack Query (`useQuery`, `useMutation`) |
| Tạo state global mới bằng Context | TanStack Query cho server state. Context chỉ cho auth |
| Gộp validation nhiều modules vào 1 function | Giữ tách biệt theo module trong `validation.js` |
| Đoán Mongoose schema fields | Đọc file model trước khi code controller/service |
| Bỏ qua error handling trong API calls | Luôn có try/catch + trả error response có cấu trúc |
| Xóa file `.old` hoặc dead code có sẵn | Mention nó, để user quyết định |

---

## 13. Cleanup & Delivery

### ✅ Checklist trước khi coi task là XONG

#### 🧹 Code Cleanup
- [ ] Xóa toàn bộ `console.log()` debug tạm thời
- [ ] Không để lại commented-out code mới
- [ ] Không có unused imports
- [ ] Không có hardcoded values (dùng env hoặc constants)

#### 🏗️ Cấu Trúc
- [ ] Code FE mới nằm đúng folder: pages/, components/, hooks/, services/
- [ ] Code BE mới theo đúng MVC: routes → controllers → services → models
- [ ] File mới ≤300 dòng (trừ trường hợp đặc biệt có lý do)
- [ ] Naming theo convention (Section 9)

#### ✔️ Chất Lượng
- [ ] Build thành công: `cd client && npm run build` không lỗi
- [ ] Không tạo breaking changes cho routes/API hiện tại
- [ ] SEO: Page public mới có `<SEO>` component
- [ ] Security: Không expose credentials, không disable CSRF/rate-limit

#### 📋 Báo Cáo
- [ ] Tóm tắt những gì đã thay đổi (files, logic)
- [ ] Nêu rõ nếu có **side effects** hoặc cần thay đổi thêm
- [ ] Nếu thêm route/model mới → liệt kê rõ

---

## 14. Testing Conventions

> Project có **160 tests** chạy qua 3 layers: Unit, Integration, E2E.

### Test Stack Hiện Tại

| Layer | Tool | Files | Tests |
|-------|------|:-----:|:-----:|
| **Unit (FE)** | Vitest | 3 | 80 |
| **Unit (BE)** | Vitest | 2 | 17 |
| **Integration (BE)** | Vitest + Supertest + mongodb-memory-server | 3 | 35 |
| **E2E** | Playwright (Chromium) | 3 | 28 |

### Cấu Trúc Test Files

```
client/src/
├── utils/
│   └── __tests__/
│       ├── date.test.js              ← UTC ↔ Local conversion
│       ├── assessment.helpers.test.js ← Đánh giá thể chất
│       └── foodCategory.test.js       ← Meal plan logic

server/src/
├── __tests__/
│   └── setup.js                       ← Test infrastructure (DB, helpers)
├── controllers/
│   └── __tests__/
│       ├── auth.controller.test.js    ← Unit: sanitize, cookies
│       ├── deposit.controller.test.js ← Unit: generateDepositCode
│       └── deposit.integration.test.js ← Integration: full deposit flow
└── middlewares/
    └── __tests__/
        ├── auth.middleware.test.js     ← Integration: JWT + role check
        └── csrf.test.js               ← Integration: CSRF validation

e2e/                                    ← Playwright E2E (root level)
├── homepage.spec.js
├── admin-login.spec.js
└── public-pages.spec.js
```

### Chạy Tests

```bash
# Client unit tests
cd client && npx vitest run

# Server unit + integration tests
cd server && npx vitest run

# E2E tests (cần dev servers đang chạy)
npx playwright test

# Watch mode (khi đang code)
cd client && npx vitest          # hoặc
cd server && npx vitest
```

### Quy Tắc Viết Test

| Quy tắc | Chi tiết |
|---------|---------|
| **TDD** | Viết failing test TRƯỚC → implement → verify pass |
| **Naming** | `{filename}.test.{js\|jsx}` — đặt trong `__tests__/` folder cùng cấp |
| **Integration** | Dùng `setup.js` helpers: `setupTestDB()`, `createTestUser()`, `withAuth()` |
| **E2E** | Pattern Reconnaissance-then-Action: chụp screenshot trước → viết test sau |
| **Test independence** | Mỗi test chạy độc lập — `afterEach` clear collections |
| **No test-only code** | KHÔNG thêm methods/exports vào production code chỉ để phục vụ test |
| **Assertion** | Mỗi test PHẢI có ít nhất 1 assertion rõ ràng |
| **Coverage** | Ưu tiên: `utils > middleware > controllers > services > components` |

### TDD Workflow Cho Feature Mới

```
1. Viết test mô tả behavior mong muốn → ❌ FAIL (Red)
2. Implement code tối thiểu để pass → ✅ PASS (Green)
3. Refactor nếu cần → ✅ vẫn PASS (Refactor)
4. Repeat
```

### Debugging SOP (Khi Test Fail)

```
1. ĐỌC error message — xác định file, dòng, assertion nào fail
2. PHÂN TÍCH — root cause là gì? (logic sai, selector sai, data sai?)
3. SỬA — chỉ sửa chỗ gây lỗi, không sửa thêm
4. CHẠY LẠI — verify fix → nếu vẫn fail → retry (tối đa 3 lần)
5. BÁO CÁO — nếu 3 lần vẫn fail → dừng, báo cáo rõ ràng
```


---

## 15. Known Issues — AI Đọc Nhưng ĐỪNG TỰ Ý Sửa

| Vấn đề | File | Chi tiết | Hành động |
|--------|------|---------|-----------|
| **Dead code file** | `pages/admin/TrainerManagement.old.jsx` (71KB) | File backup cũ, chưa xóa | ⚠️ ĐỪNG xóa. Mention nếu liên quan |
| **Inline imports** | `server.js` (dòng 152-178) | Một số import nằm giữa file thay vì đầu file | ⚠️ ĐỪNG move. Có chủ đích |
| **File quá lớn** | `TrainerCoaching.jsx` (50K), `Pricing.jsx` (42K), `OnlineCoaching.jsx` (39K) | Cần refactor nhưng chưa ưu tiên | ⚠️ Khi sửa trong file này, chỉ sửa phần yêu cầu |
| **Validation khổng lồ** | `middlewares/validation.js` (25K) | 1 file chứa ALL validations | ⚠️ Khi thêm validation mới, thêm vào cuối file theo pattern |
| **E2E artifacts** | `test-results/`, `playwright-report/` | Playwright tạo khi test fail | ⚠️ Đã thêm vào .gitignore. ĐỪNG commit |
| **Empty directory** | `client/src/data/` | Folder rỗng | ⚠️ Có thể dùng cho static data trong tương lai |
| **GA4 placeholder** | `client/index.html` dòng 6, 11 | `GA_MEASUREMENT_ID` chưa thay | ⚠️ Đợi user cung cấp mã thật |

---

## 16. Tham Chiếu Skills Chi Tiết

Agent phải tham chiếu quy tắc chi tiết trong `.agents/`:

### Rules (Luật cứng — AI PHẢI tuân thủ)

- [Tech & Patterns](.agents/rules/code/tech_patterns.md) — Mandatory patterns, code style, naming conventions
- [Anti-Patterns](.agents/rules/code/anti_patterns.md) — Bảng ❌/✅ những gì KHÔNG được làm
- [Security](.agents/rules/security/security.md) — Auth flow, CSRF, JWT, lệnh CẤM
- [SEO](.agents/rules/seo/seo.md) — SEO component, JSON-LD, sitemap, prerender, URL slug

### Skills (Kỹ năng — Kích hoạt khi cần)

**process/** — Quy trình làm việc:
- [Feature Spec](.agents/skills/process/feature-spec.md) — Viết spec trước khi code feature lớn (Auth, Schema, SEO, Payment)
- [Plan Template](.agents/skills/process/plan-template.md) — Template viết implementation plan chi tiết, tự chứa (cho task phức tạp, refactor lớn)
- [Debugging](.agents/skills/process/debugging.md) — 5 bước debug + checklist theo loại lỗi
- [Cleanup & Delivery](.agents/skills/process/cleanup_delivery.md) — Checklist trước khi deliver code

**quality/** — Chất lượng code/UI:
- [Audit Playbook](.agents/skills/quality/audit-playbook.md) — 7 danh mục quét codebase (bugs, security, perf, tests, tech debt, deps, DX) + finding format + prioritization
- [Testing Conventions](.agents/skills/quality/testing.md) — Stack, cấu trúc, quy tắc viết test
- [UI Quality](.agents/skills/quality/ui-quality.md) — Brand/Product register, 12 AI-slop bans, color/typography/layout/motion rules, interaction states, accessibility (tích hợp từ Impeccable)

**reference/** — Tham khảo:
- [Known Issues](.agents/skills/reference/known_issues.md) — Vấn đề đã biết, AI đọc nhưng ĐỪNG tự ý sửa
- [PDF Generation](.agents/skills/reference/pdf-generation.md) — Hướng dẫn dùng `pdf-lib` tạo/sửa PDF trên Node.js (font Việt, GridFS, hash SHA-256)

### Workflows (Slash Commands — Kích hoạt bằng lệnh)

- [/audit](.agents/workflows/audit.md) — Quét proactive codebase: 7 categories, findings table, plan generation, backlog reconcile
- [/ship](.agents/workflows/ship.md) — Pre-deploy gate: build + security + SEO + cleanup check
- [/seo-check](.agents/workflows/seo-check.md) — Quét SEO toàn bộ trang public: SEO component, JSON-LD, internal links, sitemap, prerender, AI SEO
- [/new-page](.agents/workflows/new-page.md) — Thêm trang public mới đầy đủ SEO (8 bước, bao gồm FAQPage + Internal Linking)
- [/schema-change](.agents/workflows/schema-change.md) — Thay đổi Mongoose schema an toàn (7 bước)
- [/ui-check](.agents/workflows/ui-check.md) — Quét UI toàn bộ codebase: AI slop, color, typography, layout, motion, interaction states, accessibility (8 dimensions, scored /40)
- [/pre-deploy](.agents/workflows/pre-deploy.md) — Full pipeline trước push: audit quick → ui-check → seo-check → ship. Gom findings, fix hết, re-check → READY TO PUSH

### Skill Routing — AI dùng skill/workflow nào khi nào

| Tình huống | Skill / Workflow kích hoạt |
|------------|--------------------------|
| Muốn quét toàn bộ codebase tìm bugs/security/perf | `/audit` workflow |
| Quét nhanh trước push feature lớn | `/audit quick` workflow |
| Chỉ quét 1 danh mục (security, perf, tests...) | `/audit <category>` workflow |
| Cần viết plan chi tiết cho task phức tạp/refactor | `plan-template` skill |
| Check lại backlog plans (done/blocked/drifted) | `/audit reconcile` |
| Trước khi code feature mới/lớn hoặc yêu cầu chưa rõ | `feature-spec` skill |
| Gặp bug, lỗi không rõ nguyên nhân | `debugging` skill |
| Trước khi deliver / báo cáo task hoàn thành | `cleanup-delivery` skill |
| Hỏi về test structure hoặc cần setup test | `testing-conventions` skill |
| Làm việc với file lớn hoặc code có workaround | `known-issues` skill |
| Trước khi deploy lên Netlify/Render | `/ship` workflow |
| Kiểm tra SEO trang public trước deploy | `/seo-check` workflow |
| Thêm trang public mới cần SEO | `/new-page` workflow |
| Thay đổi Mongoose schema | `/schema-change` workflow |
| Code component UI mới hoặc sửa giao diện | `ui-quality` skill |
| Quét chất lượng UI toàn bộ hoặc 1 surface | `/ui-check` workflow |
| Quét UI chỉ Brand surfaces (landing, public) | `/ui-check public` workflow |
| Quét UI chỉ Product surfaces (admin, trainer) | `/ui-check admin` workflow |
| Làm việc với **e-contract** (hợp đồng, ký, contract) | `pdf-generation` skill → đọc trước khi code |
| Tạo/sinh/xuất **file PDF** (hợp đồng, báo cáo, hóa đơn) | `pdf-generation` skill |
| **Full pipeline trước push/deploy** | **`/pre-deploy` workflow** |
| Full pipeline nhưng bỏ qua audit | `/pre-deploy skip-audit` workflow |
| Full pipeline nhưng bỏ qua UI (chỉ sửa BE) | `/pre-deploy skip-ui` workflow |

---

## Nguồn Gốc Bộ Rules Này

Bộ rules này được thiết kế riêng cho htcoachingweb, dựa trên:

| Nguồn | Lấy gì | % |
|-------|--------|:-:|
| **Karpathy Skills** (forrestchang) | 4 nguyên tắc cốt lõi: Think, Simple, Surgical, Goal-Driven | ~30% |
| **Antigravity Testing Kit** (Anh Tester) | Git Safety, Anti-Patterns, Cleanup checklist — biến đổi cho web dev | ~12% |
| **Improve** (shadcn) | Audit playbook (7 categories), plan template, finding format, reconcile flow | ~8% |
| **Harness** (revfactory) | Tư duy Progressive Disclosure, Agent identity, Pipeline flow | ~5% |
| **Agent Skills** (Addy Osmani) | YAML frontmatter pattern, Skill Routing, feature-spec, debugging workflows | ~5% |
| **Taste Skill** (Leonxlnx) + **frontend-design** (Anthropic) | Anti-slop patterns, color consistency, copy rules, output enforcement | ~3% |
| **Impeccable** (Paul Bakaus) | 12 absolute bans, Brand/Product register, color/typo/layout/motion rules, AI-slop 2-step test | ~7% |
| **Project-specific** | Architecture, Patterns, Security, SEO, Code Style, Testing, Known Issues | ~40% |

**Nguyên tắc thiết kế:** 1 file, đủ sâu, dễ maintain, không overengineer.

**Cập nhật:** File này là living document — cập nhật khi phát hiện AI mắc lỗi mới hoặc project thay đổi.

