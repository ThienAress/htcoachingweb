---
name: service-access-policy
description: Quản trị policy quyền truy cập, dùng thử, quota và entitlement dịch vụ HTCOACHINGWEB. Dùng khi thêm hoặc sửa dịch vụ có giới hạn theo Guest/User/gói/HLV, thay số lượt hoặc cửa sổ quota, thêm paywall/free preview, sửa quyền lợi gói HLV, tier resolver, response quota metadata hoặc bảng Admin Quyền & hạn mức.
---

# Service Access Policy

Giữ registry backend là nguồn canonical duy nhất cho policy dịch vụ. Không để middleware, UI, tài liệu hoặc test
tự định nghĩa một bản quota thứ hai.

## Nguồn phải đọc

1. Đọc `AGENTS.md` và `.agents/rules/security/security.md` nếu thay đổi chạm auth, rate limit hoặc entitlement.
2. Đọc `docs/specs/service-access-policy.md` để biết product contract đã duyệt.
3. Đọc `server/src/constants/serviceAccessPolicies.js` để lấy policy runtime hiện tại.
4. Dùng `$impact-check` để trace route, middleware, controller, service, frontend consumer, tests và docs liên quan.
5. Nếu thay đổi AI Chat, đọc `$ai-chat-system` và chạy `$ai-check` sau implementation.

## Workflow bắt buộc

### 1. Phân loại thay đổi

- Xác định service key, tier bị ảnh hưởng, mode `quota`/`unlimited`, unit, period, scope và enforcement owner.
- Phân biệt product policy với operational configuration. Không tự đổi số lượt khi user chưa duyệt policy.
- Giữ backend tier riêng khi entitlement khác nhau; chỉ gộp cột trình bày nếu policy giống nhau.

### 2. Cập nhật registry trước

- Thêm hoặc sửa đúng một entry trong `server/src/constants/serviceAccessPolicies.js`.
- Không hardcode lại limit trong limiter, controller, frontend hoặc Admin page.
- Bảo đảm serializer Admin trả entry mới. Trang Admin phải render từ API để hàng mới xuất hiện tự động mà không
  thêm JSX riêng cho từng dịch vụ.
- Với quyền lợi gói HLV, cập nhật `TRAINER_PLAN_BENEFIT_DEFINITIONS` cạnh catalog trong
  `server/src/constants/trainerPlans.js`. Pricing và bảng “Quyền lợi gói HLV” phải cùng đọc catalog response;
  không tạo mảng feature riêng trong component.
- Quyền lợi thương mại phải tham gia catalog fingerprint. Giữ bốn plan code canonical và cập nhật test catalog,
  Pricing helper cùng Admin matrix trong một thay đổi.

### 3. Enforce server-authoritative

- Dùng resolver backend trong `server/src/services/serviceAccessPolicy.service.js`; không nhận tier từ client.
- Với authenticated object access, giữ ownership/IDOR check riêng; tier không thay thế authorization.
- Với rate limit, lấy limit động từ registry và giữ key scope đúng policy. Không log raw IP, token, health data hoặc
  conversation payload.
- Với counter lifetime hoặc entitlement, giữ mutation atomic và fail closed.
- Không disable CSRF/rate limit và không sửa `client/src/utils/api.js` để né contract.

### 4. Phát quota metadata

- Trả `serviceKey`, `tier`, `limit`, `remaining`, `resetAt` từ state server-authoritative khi runtime có quota.
- Giữ error code/response envelope tương thích. Lỗi 429 phải mang cùng quota metadata để UI giải thích được.
- Với SSE, gửi event metadata riêng; không nhúng policy vào text của model.

### 5. Đồng bộ Admin và tài liệu

- Giữ `GET /api/admin/service-access-policies` read-only và admin-only trừ khi có spec mới cho mutation.
- Bảo đảm frontend dùng service + TanStack Query, có loading/error/retry/empty/responsive/accessibility states.
- Cập nhật spec dịch vụ liên quan và `docs/specs/service-access-policy.md` trong cùng thay đổi.
- Không tạo schema/migration chỉ để hiển thị policy tĩnh.

### 6. Test và bàn giao

- Viết test RED cho registry/tier/enforcement trước khi sửa runtime.
- Cover tier bị đổi, boundary cuối cùng được phép, request đầu tiên bị chặn và metadata `remaining/resetAt`.
- Khi thêm service, test Admin matrix chứa service từ registry; không snapshot số hàng hardcode.
- Khi đổi quyền lợi HLV, test cả plan availability, catalog fingerprint và bốn cột Admin; không suy quyền lợi từ
  tên hoặc thứ tự gói ở frontend.
- Chạy focused client/server tests, build phù hợp, security gates và `git diff --check`.
- Dùng `$code-review` và `$cleanup-delivery` trước khi báo hoàn thành.

## Guardrails

- Không dùng frontend visibility làm authorization.
- Không coi role HLV và khách có gói là cùng domain tier nếu entitlement thực tế khác nhau.
- Không để env override âm thầm làm Admin matrix khác runtime; nếu cần override, registry serializer phải phản ánh
  effective policy và spec phải mô tả precedence.
- Không thêm billing, wallet debit, migration hoặc production mutation nếu task chỉ yêu cầu access/quota.
