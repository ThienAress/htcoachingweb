---
name: anti-patterns
description: Danh sách anti-patterns bắt buộc tránh khi code. Áp dụng mọi lúc — cả frontend (React, Tailwind) lẫn backend (Express, Mongoose).
---

# Anti-Patterns — HTCoachingWeb

> Bảng những gì KHÔNG ĐƯỢC LÀM. AI phải tránh tất cả anti-patterns dưới đây.

---

## Frontend Anti-Patterns

| ❌ Anti-Pattern | ✅ Thay thế đúng |
|----------------|------------------|
| Import page component trực tiếp (`import X from...`) | `lazy(() => import("./pages/X"))` + `<Suspense>` |
| Gọi API trực tiếp trong component | Tạo function trong `services/*.service.js` |
| Inline styles (`style={{ color: "red" }}`) | Tailwind CSS classes |
| `document.getElementById()` / DOM manipulation trực tiếp | React refs hoặc state |
| `console.log()` để lại trong code delivery | Xóa trước khi deliver |
| Hardcode API URL | Dùng `import.meta.env.VITE_API_URL` (FE) |
| `setTimeout` / `setInterval` cho data fetching | TanStack Query (`useQuery`, `useMutation`) |
| Tạo state global mới bằng Context | TanStack Query cho server state. Context chỉ cho auth |
| `useState` + `useEffect` cho API data | TanStack Query |
| Tạo custom hook cho logic dùng 1 lần | Inline trong component |
| Import icon từ library khác | Chỉ dùng `lucide-react` |

## Backend Anti-Patterns

| ❌ Anti-Pattern | ✅ Thay thế đúng |
|----------------|------------------|
| Gộp validation nhiều modules vào 1 function | Giữ tách biệt theo module trong `validation.js` |
| Đoán Mongoose schema fields | Đọc file model trước khi code controller/service |
| Bỏ qua error handling trong API calls | Luôn có try/catch + trả error response có cấu trúc |
| Response format không nhất quán | `{ success: true/false, data/message }` |
| Gộp upload middleware cho nhiều entity | Tạo middleware upload riêng cho mỗi entity |
| Trust role từ frontend | Backend PHẢI check role bằng middleware |
| Hardcode production URLs | Dùng `process.env` |

## General Anti-Patterns

| ❌ Anti-Pattern | ✅ Thay thế đúng |
|----------------|------------------|
| Xóa file `.old` hoặc dead code có sẵn | Mention nó, để user quyết định |
| Refactor code không liên quan đến task | Chỉ sửa cái user yêu cầu |
| Thêm docstring/JSDoc khi chưa được yêu cầu | Giữ nguyên style hiện tại |
| Đổi quote style `""` ↔ `''` | Match style hiện tại của file |
| Move inline imports trong `server.js` | Giữ nguyên — pattern có chủ đích |
| Tạo abstraction "để sau dùng" | YAGNI — chỉ code cho requirement hiện tại |
| File mới > 300 dòng | Tách thành components/modules nhỏ hơn |
