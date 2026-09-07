---
name: security-rules
description: Quy tắc bảo mật bắt buộc — Auth flow, CSRF, JWT, rate limiting, file nhạy cảm. KHÔNG ĐƯỢC vi phạm dưới bất kỳ hình thức nào.
---

# Security Rules — HTCoachingWeb

> Quy tắc bảo mật bắt buộc. KHÔNG ĐƯỢC vi phạm dưới bất kỳ hình thức nào.

---

## Auth Flow — KHÔNG ĐƯỢC PHÁ

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

### Luồng chi tiết

1. **Login**: User login bằng Google OAuth → server gọi Passport → verify → tạo JWT
2. **Token storage**: `accessToken` + `refreshToken` = **httpOnly cookies** — frontend KHÔNG đọc được
3. **CSRF**: Server tạo `csrfToken` cookie (NOT httpOnly) → client đọc qua `js-cookie` → gắn vào header `X-CSRF-Token`
4. **Request**: Mỗi request mutating (POST/PUT/DELETE) gửi: cookies (JWT) + header (CSRF)
5. **Interceptor**: `utils/api.js` tự handle: gắn CSRF, auto-refresh khi 401, redirect khi refresh fail

---

## Rules Bắt Buộc

| Rule | Chi tiết |
|------|---------|
| **CSRF** | Mọi request mutating PHẢI có `X-CSRF-Token` header. Đã handle trong `utils/api.js` — **KHÔNG SỬA** file này trừ khi có lý do rõ ràng |
| **JWT cookies** | `accessToken` và `refreshToken` là **httpOnly** — frontend KHÔNG đọc/xóa được. Chỉ server quản lý |
| **Environment** | `.env` files KHÔNG được commit. KHÔNG in nội dung `.env` ra chat. KHÔNG hardcode credentials |
| **Rate Limiting** | Production có rate limit (`rateLimit.js`). KHÔNG xóa hoặc tăng limit quá mức |
| **Role check** | Backend PHẢI check role bằng middleware trước khi xử lý. KHÔNG trust role từ frontend |
| **Validation** | Server PHẢI validate mọi input không tin cậy. Form user-facing validate thêm ở client bằng Zod để có UX tốt, nhưng client validation không thay thế server validation |
| **Upload** | PHẢI validate file type, size trong upload middleware. KHÔNG cho upload file tùy ý |

---

## Refresh-session invariants

- Verifier lưu server-side phải bao phủ **toàn bộ token chính xác** bằng fixed-length digest/MAC
  và timing-safe comparison; không hash/compare một prefix, claim rời hoặc dùng password verifier
  có giới hạn độ dài làm hai JWT khác nhau có thể cùng được chấp nhận.
- Mỗi refresh token phải có `familyId` và `jti` không đoán được. Rotation dùng atomic
  compare-and-swap trên current verifier/JTI để một credential chỉ thành công một lần; không làm
  theo chuỗi read-then-write có thể double-success khi concurrent.
- Dùng lại token đã rotate phải revoke successor/current family, ghi metadata allowlist bằng `safeLog`
  và buộc đăng nhập lại. Lookup lỗi, metadata legacy thiếu hoặc verifier không khớp đều fail closed;
  không fallback về cơ chế yếu hơn.
- Absolute family expiry được cố định lúc login và không kéo dài qua rotation. JWT expiry và cookie
  max-age không được vượt quá thời gian còn lại của family.
- Logout phải có thể verify/revoke bằng refresh credential khi access token đã hết hạn, nhưng mutating
  request vẫn giữ CSRF. Luôn clear cookies; không trả/log token, verifier, family/JTI hoặc raw cookie.
- Regression bắt buộc gồm simultaneous refresh, replay sau rotation, absolute expiry, logout khi access
  hết hạn, CSRF rejection, cookie secrecy và persistence failure. Kế hoạch rollout phải nêu mixed-version
  cutover/rollback; không rollback sang binary có thể hồi sinh legacy verifier hoặc hạ invariant.

---

## Dữ Liệu Nhạy Cảm & Quyền Truy Cập

Xem dữ liệu sức khỏe, đánh giá cơ thể, ảnh/video, hội thoại AI, thông tin định danh,
token, cookie và dữ liệu tài chính là dữ liệu nhạy cảm.

| Rule | Chi tiết |
|------|---------|
| **Least privilege** | Query chỉ lấy field cần dùng; không trả raw document nếu response contract không cần toàn bộ fields |
| **Ownership/IDOR** | Endpoint user-accessible lấy object theo ID phải ràng buộc ownership/assignment ở backend. Không dựa vào việc frontend đã ẩn link |
| **Logging** | Không log raw request body, cookie, token, health payload, ảnh chữ ký hoặc nội dung hội thoại. Dùng `safeLog` với metadata allowlist |
| **Projection** | DTO/response phải loại internal notes, audit metadata, secret/provider fields và dữ liệu của user khác |
| **Retention** | Không tự thêm retention, export, delete hoặc anonymization semantics. Thay đổi privacy lifecycle cần spec và impact check riêng |
| **Media** | Media nhạy cảm không mặc định public; dùng delivery đã được authorization hoặc signed/expiring URL theo pattern hiện có |

Admin role không tự động loại bỏ yêu cầu audit/least privilege. Với read/write dữ liệu
sức khỏe hoặc tài chính, kiểm tra permission, mục đích endpoint và audit requirements
trong domain hiện tại.

---

## Query, External Input & Integration Safety

- Không spread trực tiếp `req.body` vào Mongoose create/update. Dùng allowlist fields và
  validation contract để ngăn mass assignment, operator injection và prototype keys.
- Object ID, enum, sort, filter, pagination và regex input phải được validate/bound trước
  khi đưa vào query. Không cho client truyền tùy ý Mongo operators.
- Code fetch URL do user/provider cung cấp phải chống SSRF: allowlist protocol/domain,
  chặn loopback/private/link-local targets và đặt timeout/size limit.
- Webhook/callback phải verify signature theo raw payload khi provider yêu cầu, chống
  replay và giữ handler idempotent trước khi mutation.
- Redirect URL phải lấy từ allowlist/canonical config; không redirect thẳng tới URL từ
  query/body chưa kiểm tra.
- Khi thêm external domain, kiểm tra đồng thời CORS, Helmet CSP, privacy impact và cách
  credential được truyền; không nới wildcard chỉ để request chạy được.

## AI-assisted mutation & tool execution

- Prompt, model output, tool schema, UI card và cờ `requiresConfirmation` là input/routing metadata,
  **không phải authorization boundary**. Server quyết định actor, role, ownership, target, canonical
  price, entitlement, transition hợp lệ và field allowlist tại execution path.
- Mutation phải tách `read/discover → draft/preview → explicit confirmation → commit → reconcile`.
  Draft/preview không gây side effect và được server canonicalize; confirmation phải gắn với đúng actor,
  action/target, version/terms, expiry và một preview identifier/digest không thể tráo.
- Trước commit, server re-authenticate/re-authorize và revalidate current state cùng mọi business
  invariant. Commit dùng one-time confirmation, idempotency key và atomic/transactional guard phù hợp;
  retry cùng key không được lặp side effect.
- Audit chỉ ghi provenance allowlist như actor/tool/action/resource/confirmation/idempotency/result;
  không ghi raw conversation, prompt, health/financial payload hoặc secret. External content vẫn là
  untrusted data và không được tự nâng thành instruction/action.
- Nếu commit timeout hoặc kết quả không chắc chắn, reconcile bằng status/read server-authoritative trước
  khi retry. UI phải invalidate/rehydrate từ final server state; không tự giả định thành công từ card/chat.
- Nếu tool engine chưa enforce preview binding, one-time confirmation, authorization và idempotency,
  **không ship write tool**; viết spec/plan cho boundary còn thiếu thay vì dựa vào prompt để bù.

## Security Review Evidence Contract

- Security-sensitive review phải ghi target revision, diff/path/scope, threat-model assumptions và out-of-scope.
- Trace entry point/untrusted input → validation → authorization → sink/asset; không chỉ grep pattern.
- Chỉ xác nhận finding khi có attacker-controlled path, realistic reachability/impact và validation evidence.
- Candidate chưa đủ proof phải ghi proof gap; rejected finding phải có lý do để tránh re-report.
- Mỗi accepted finding được fix bằng bounded patch, focused regression test và re-validation.
- Coverage ledger phải ghi reviewed/deferred surfaces theo template của `audit-playbook`.

## Codex Security Scope & Cost Policy

- Routine changes dùng secret scan, dependency audit, tests và local ownership/security review.
- Auth/payment/wallet, release lớn hoặc trust boundary mới bắt đầu bằng diff/working-tree/path scan nhỏ.
- Full/deep scan chỉ chạy khi có explicit scope, user cost authority và `--ack-full-scan`.
- Luôn dùng wrapper tại `scripts/codex-security-scan.mjs`; default dry-run, max-cost thấp, policy ceiling `$5`.
- `--max-cost` là estimate guard, không phải hard billing cap; không tự chạy paid scan trong CI.
- Preflight không phải completed scan; raw candidate không phải confirmed vulnerability.

---

## Files Nhạy Cảm — KHÔNG SỬA Trừ Khi Được Yêu Cầu

| File | Lý do |
|------|-------|
| `client/src/utils/api.js` | Chứa toàn bộ logic CSRF + JWT refresh interceptor |
| `client/src/context/AuthContext.jsx` | Auth state management |
| `server/src/middlewares/auth.middleware.js` | JWT verify + role check |
| `server/src/middlewares/csrf.js` | CSRF token generation + validation |
| `server/src/middlewares/rateLimit.js` | Rate limiting config |
| `server/src/config/passport.js` | Google OAuth config |

---

## Lệnh CẤM

| ❌ Tuyệt đối KHÔNG | Lý do |
|-------------------|-------|
| `DROP TABLE`, `db.dropDatabase()` | Phá hủy dữ liệu |
| `rm -rf`, xóa thư mục quan trọng | Phá hủy project |
| In API keys, JWT secrets ra chat | Lộ credentials |
| Disable CSRF protection | Mở lỗ hổng bảo mật |
| Disable rate limiting trong production | Mở cho DDoS |
| Hardcode production URLs trong code | Dùng env variables |
| Sửa `utils/api.js` interceptor logic | Phá auth flow |
