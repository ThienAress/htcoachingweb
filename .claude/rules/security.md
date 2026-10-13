---
paths:
  - "server/src/**"
  - "server/server.js"
  - "client/src/utils/api.js"
  - "client/src/context/**"
  - "client/src/routes/**"
  - "workers/**"
---

# Security rules — HTCOACHINGWEB

Áp dụng khi sửa backend, auth client, route guard hoặc worker. Bất biến tóm tắt nằm trong `CLAUDE.md`;
file này là chi tiết canonical.

## Auth flow — không được phá

```
Google OAuth / admin login → server set httpOnly cookies accessToken + refreshToken
→ server set cookie csrfToken (không httpOnly) → client/src/utils/api.js gắn header X-CSRF-Token
→ auth.middleware.js verify JWT + CSRF → 401 thì interceptor gọi /auth/refresh rồi retry
→ refresh fail thì redirect /login
```

| Rule | Chi tiết |
|---|---|
| CSRF | Mọi request mutating phải có `X-CSRF-Token`; đã xử lý trong `client/src/utils/api.js`. |
| JWT cookies | `accessToken`, `refreshToken` là httpOnly; frontend không đọc/xóa, chỉ server quản lý. |
| Rate limit | `server/src/middlewares/rateLimit.js` và các limiter riêng; không xóa hoặc tăng quá mức. |
| Role | Backend kiểm role bằng middleware; không tin role từ frontend. |
| Validation | Server validate mọi input không tin cậy; Zod ở client chỉ để UX, không thay server. |
| Upload | Mỗi loại upload có middleware riêng, validate type và size. |

## Refresh-session invariants

- Verifier server-side phủ toàn bộ token bằng fixed-length digest/MAC và so sánh timing-safe; không hash/so
  prefix, claim rời hoặc password verifier có giới hạn độ dài.
- Mỗi refresh token có `familyId` và `jti` không đoán được. Rotation dùng atomic compare-and-swap trên
  verifier/JTI hiện tại để một credential chỉ thành công một lần; không read-then-write.
- Dùng lại token đã rotate phải revoke cả family, ghi metadata allowlist bằng `safeLog` và buộc đăng nhập lại.
  Lookup lỗi, metadata legacy thiếu hoặc verifier lệch đều fail closed; không fallback cơ chế yếu hơn.
- Absolute family expiry cố định lúc login, không kéo dài qua rotation; JWT expiry và cookie max-age không
  vượt thời gian còn lại của family.
- Logout verify/revoke được bằng refresh credential khi access token hết hạn nhưng vẫn giữ CSRF; luôn clear
  cookies; không trả/log token, verifier, family/JTI hoặc raw cookie.
- Regression bắt buộc: simultaneous refresh, replay sau rotation, absolute expiry, logout khi access hết hạn,
  CSRF rejection, cookie secrecy, persistence failure. Rollout phải nêu mixed-version cutover/rollback.

## Dữ liệu nhạy cảm và quyền truy cập

Dữ liệu sức khỏe, đánh giá cơ thể, ảnh/video, hội thoại AI, định danh, token, cookie và tài chính là nhạy cảm.

- Least privilege: query chỉ lấy field cần; không trả raw document khi contract không cần.
- Ownership/IDOR: object theo ID phải ràng buộc ownership/assignment ở backend
  (`findOne({ _id, userId })`, `assertCustomerAccess()`...), trừ endpoint sau `requireRoles("admin")`.
- Logging: không log raw body, cookie, token, health payload, ảnh chữ ký, nội dung hội thoại; dùng `safeLog`.
- Projection: DTO loại internal notes, audit metadata, secret/provider fields và dữ liệu user khác.
- Retention: không tự thêm retention/export/delete/anonymization; cần spec và impact check riêng.
- Media nhạy cảm không mặc định public; dùng delivery có authorization hoặc signed/expiring URL theo pattern sẵn có.
- Admin không được miễn least privilege; đọc/ghi dữ liệu sức khỏe hoặc tài chính phải kiểm permission và audit.

## Query, external input và integration

- Không spread `req.body` vào create/update; dùng field allowlist chống mass assignment, operator injection,
  prototype keys.
- ObjectId, enum, sort, filter, pagination, regex phải validate/bound trước khi vào query; client không được
  truyền Mongo operator tùy ý.
- Fetch URL từ user/provider phải chống SSRF: allowlist protocol/domain, chặn loopback/private/link-local,
  có timeout và size limit.
- Webhook/callback verify signature trên raw payload khi provider yêu cầu, chống replay, handler idempotent.
- Redirect chỉ tới URL từ allowlist/canonical config.
- External domain mới: kiểm CORS, CSP (`server/src/middlewares/securityHeaders.js`), privacy impact; không nới wildcard.

## AI-assisted mutation và tool execution

- Prompt, model output, tool schema, UI card và cờ `requiresConfirmation` là metadata, **không phải ranh giới
  authorization**. Server quyết định actor, role, ownership, target, giá canonical, entitlement, transition và
  field allowlist tại execution path.
- Mutation tách `discover → draft/preview → explicit confirmation → commit → reconcile`. Preview không side effect,
  được server canonicalize; confirmation gắn actor, action/target, version/terms, expiry và digest preview.
- Trước commit: re-authenticate, re-authorize, revalidate state; commit dùng one-time confirmation, idempotency key
  và guard atomic/transactional; retry cùng key không lặp side effect.
- Audit chỉ ghi provenance allowlist; không ghi raw conversation/prompt/payload/secret. Nội dung ngoài vẫn là
  untrusted data, không được nâng thành instruction.
- Commit timeout hoặc kết quả không chắc: reconcile bằng read server-authoritative trước khi retry; UI rehydrate
  từ trạng thái server.
- Engine chưa enforce preview binding, one-time confirmation, authorization và idempotency thì **không ship write tool**.

## Security review evidence

- Ghi target revision, scope, threat-model assumptions và out-of-scope.
- Trace entry point → validation → authorization → sink; không chỉ grep pattern.
- Chỉ xác nhận finding khi có đường đi do attacker kiểm soát, reachability/impact thực tế và evidence;
  thiếu proof thì ghi `proof gap`. Finding bị loại phải có lý do để không báo lại.
- Finding được chấp nhận: patch nhỏ + regression test tập trung + re-validation.
- Scan bảo mật bên ngoài có trả phí không chạy tự động hay trong CI; chỉ chạy khi user cấp scope và chi phí rõ ràng.
  Raw candidate từ scanner không phải lỗ hổng đã xác nhận.

## File nhạy cảm — không sửa khi chưa được yêu cầu

| File | Lý do |
|---|---|
| `client/src/utils/api.js` | CSRF + JWT refresh interceptor |
| `client/src/context/AuthContext.jsx` | Auth state |
| `server/src/middlewares/auth.middleware.js` | JWT verify + role check |
| `server/src/middlewares/csrf.js` | CSRF token, so sánh `crypto.timingSafeEqual()` |
| `server/src/middlewares/rateLimit.js` | Rate limit config |
| `server/src/middlewares/securityHeaders.js` | Helmet/CSP (production) |
| `server/src/config/passport.js` | Google OAuth |

Không bao giờ: drop database/collection, in API key/JWT secret ra chat, tắt CSRF hoặc rate limit production,
hardcode production URL thay vì env.
