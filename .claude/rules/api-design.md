---
paths:
  - "server/src/routes/**"
  - "server/server.js"
  - "client/src/services/**"
---

# Đặt tên API — HTCOACHINGWEB

Nguồn: 5 nguyên tắc RESTful trong video chủ dự án chia sẻ (mục A) và phần dự án bổ sung (mục B). Đây là best practice, không phải luật bắt buộc của REST;
quyết định và lý do nằm ở `docs/architecture/adr/0002-api-naming-and-versioning.md`. Cổng tự động: `server/src/routes/__tests__/apiNaming.contract.test.js`.

## A. Năm nguyên tắc (từ video)

1. **Danh từ, không động từ**: `/users`, không `/getUsers`. HTTP method mang hành động.
2. **Danh từ số nhiều**: `/products`, `/orders`; không `/product`.
3. **ID để truy cập bản ghi**: `GET /products/123`.
4. **Chữ thường, dấu gạch ngang**: `/account-settings`, không `/accountSettings`.
5. **URL lồng nhau thể hiện quan hệ**: `/posts/123/comments`.

| Method | Endpoint | Chức năng |
|---|---|---|
| GET | `/products` | Danh sách |
| POST | `/products` | Tạo |
| GET | `/products/123` | Chi tiết |
| PUT | `/products/123` | Thay thế |
| PATCH | `/products/123` | Cập nhật một phần |
| DELETE | `/products/123` | Xóa |

## B. Phần dự án bổ sung

- **Hành động không thuộc CRUD** (duyệt, hủy, ký...): `POST /<tài nguyên>/:id/<hành động>` với hành động trong danh sách `ALLOWED_ACTIONS` của
  `apiNamingScan.js` (`approve`, `reject`, `cancel`, `confirm`, `submit`, `archive`, `restore`, `duplicate`, `sign`...). Không dùng PUT cho hành động.
  Tạo bản ghi thì `POST /<tài nguyên>`, không `/<tài nguyên>/create`, `/book`, `/purchase`, `/send`, `/analyze`, `/record`.
- **Lồng tối đa 3 đoạn tên** (không tính `admin`): `/f1-customers/:id/assessments`. Sâu hơn thì tách tài nguyên và nhận id cha qua query hoặc body.
- **Tài nguyên của chính người dùng**: một kiểu duy nhất là `/<tài nguyên>/me` (ví dụ `GET /orders/me`); không thêm kiểu `/my`, `/my-<x>`.
- **Khu quản trị và HLV**: tiền tố `/admin/...` cho thao tác quản trị; không thêm hậu tố `/admin` vào cuối (`/blog/admin`).
- **Tham số**: `:id` cho bản ghi chính, `:<tên>Id` cho bản ghi cha; một khái niệm một tên (`clientId`, không lẫn `userId`).
- **Query danh sách**: `page`, `limit` (có giới hạn trên), `search`, `sort`; không tự đặt `pageSize`, `offset`, `q`.
- **Mã trạng thái**: 201 khi tạo, 200 khi đọc/sửa, 204 khi xóa không có nội dung, 400 dữ liệu sai, 401 chưa đăng nhập, 403 không có quyền,
  404 không thấy, 409 xung đột, 422 sai nghiệp vụ, 429 quá nhanh. Response và lỗi theo `backend.md` (`{ success, data }` / `{ success: false, code, message }`).
- Phiên bản: giữ `/api`, không thêm `/v1` (ADR 0002). Cần phá vỡ tương thích thì thêm route mới, giữ route cũ làm bí danh có thời hạn.

## Quy trình

1. Endpoint mới phải đúng quy tắc; cổng đặt tên đỏ nếu thêm vi phạm mới. **Không thêm dòng vào `apiNamingDebt.json` để qua cổng.**
2. Sửa endpoint cũ (đổi tên): thêm đường mới cùng handler, giữ đường cũ làm bí danh, chuyển `client/src/services/*.service.js`, `e2e/mock-api.cjs`
   và test sang đường mới, đếm lượt gọi đường cũ bằng `safeLog`/metric, rồi gỡ đường cũ ở PR riêng khi không còn lượt gọi. Xóa dòng tương ứng khỏi danh sách nợ.
3. **Không đổi**: webhook (`/api/webhooks/sepay`), OAuth (`/api/auth/google`, `/callback`), `/api/ops/*` (watchdog, smoke test, Render), đường dẫn mà script production
   gọi (`/api/blog`, `/api/recipes`, `/api/exercises`), và các tiền tố có rate limiter hoặc cổng tính năng (`server.js`, `server/src/config/todayPlatform.js`) khi chưa kiểm hết người dùng.
4. Route chạm auth, ví, hợp đồng, thanh toán: chạy skill `impact-check` trước khi đổi.
5. Đổi tên một tiền tố (`/api/<tên>`): sửa đồng thời bảng mount trong `server.js`, rate limiter và cổng auth gắn theo tiền tố, `TODAY_PLATFORM_API_PREFIXES`, URL do server tự dựng (ví dụ `/api/f1-customers/...`),
   client services và `e2e/mock-api.cjs`. Cổng `server/src/routes/__tests__/prefixCoverage.contract.test.js` đỏ nếu quên một chỗ bám vào tiền tố cũ; không sửa test để qua cổng.
