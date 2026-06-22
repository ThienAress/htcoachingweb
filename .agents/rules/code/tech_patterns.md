# Tech Patterns & Code Style — HTCoachingWeb

> Luật cứng về coding patterns và conventions. AI PHẢI tuân thủ khi viết code cho dự án này.

---

## Mandatory Frontend Patterns

### Pattern 1: Lazy Loading Pages

TẤT CẢ page components phải lazy-loaded trong `App.jsx`:

```jsx
// ✅ ĐÚNG
const NewPage = lazy(() => import("./pages/NewPage"));

// Trong Routes:
<Suspense fallback={<GlobalLoading />}>
  <Route path="/new-page" element={<NewPage />} />
</Suspense>

// ❌ SAI — KHÔNG import trực tiếp
import NewPage from "./pages/NewPage";
```

### Pattern 2: Service Layer

API calls PHẢI nằm trong `services/`, KHÔNG inline trong components:

```
client/src/services/{module}.service.js  ← API calls ở đây
client/src/pages/{Module}.jsx            ← Component chỉ gọi service
```

```jsx
// ✅ ĐÚNG — services/order.service.js
import api from "../utils/api";
export const getOrders = () => api.get("/orders");
export const createOrder = (data) => api.post("/orders", data);

// ✅ ĐÚNG — pages/admin/Orders.jsx
import { getOrders } from "../../services/order.service";

// ❌ SAI — gọi API trực tiếp trong component
const res = await api.get("/orders"); // KHÔNG làm vậy
```

### Pattern 3: Route Guard

Trang cần auth → wrap trong `<AdminRoute>`:

```jsx
// AdminRoute check: user role + subscription status
<Route path="/trainer" element={<AdminRoute><TrainerLayout /></AdminRoute>}>
```

### Pattern 4: TanStack Query cho Server State

```jsx
// ✅ ĐÚNG — dùng useQuery cho data fetching
const { data, isLoading } = useQuery({
  queryKey: ["orders"],
  queryFn: getOrders,
});

// ❌ SAI — useState + useEffect cho API calls
const [data, setData] = useState([]);
useEffect(() => { fetchData().then(setData); }, []);
```

### Pattern 5: Form Validation (Client)

```jsx
// ✅ ĐÚNG — React Hook Form + Zod
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Email không hợp lệ"),
});

// ❌ SAI — validate bằng tay
if (!email.includes("@")) { ... }
```

---

## Mandatory Backend Patterns

### Pattern 1: MVC + Service Layer

```
routes/{module}.routes.js          → Endpoints + middleware chain
controllers/{module}.controller.js → Handle req/res, call service
services/{module}.service.js       → Business logic (nếu cần)
models/{Model}.js                  → Mongoose schema
```

Khi thêm module mới, tạo ĐẦY ĐỦ 3-4 files theo pattern này.

### Pattern 2: Upload Middleware — Mỗi Loại Riêng

```
middlewares/avatarUpload.js          ← Upload avatar user
middlewares/trainerUpload.js         ← Upload ảnh trainer
middlewares/coachingUpload.js        ← Upload media coaching
middlewares/customerStoryUpload.js   ← Upload ảnh before/after
middlewares/f1MediaUpload.js         ← Upload media F1 customer
middlewares/siteSettingUpload.js     ← Upload ảnh site settings
```

Khi tạo upload mới → **tạo middleware mới, KHÔNG gộp chung**.

### Pattern 3: Validation — Tất Cả Trong 1 File

```
// TẤT CẢ validation nằm trong: middlewares/validation.js
// Dùng express-validator, apply trong routes
// Khi thêm mới → thêm vào CUỐI file, theo pattern đã có
```

### Pattern 4: Error Response Chuẩn

```js
// ✅ ĐÚNG — response format nhất quán
res.status(400).json({ success: false, message: "Lỗi gì đó" });
res.status(200).json({ success: true, data: result });

// ❌ SAI — format lung tung
res.json({ error: "..." });
res.send("OK");
```

---

## Code Style & Conventions

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
| **URL routes (FE)** | kebab-case tiếng Việt | `/ket-qua-khach-hang` |
| **API endpoints** | kebab-case | `/api/customer-stories` |
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
