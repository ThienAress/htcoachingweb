---
name: audit-playbook
description: Hướng dẫn quét proactive codebase theo 7 danh mục. Use khi user gõ /audit hoặc yêu cầu quét/kiểm tra toàn bộ project. Mỗi finding phải có evidence (file:line), không vibes-only.
---

# Audit Playbook — HTCoachingWeb

> Quét codebase tìm vấn đề ẩn. Mỗi finding phải có evidence cụ thể (`file:line`).
> "Probably has N+1 queries somewhere" **KHÔNG** phải finding; `orders/api.ts:142 issues one query per order item inside a loop` **là** finding.
>
> **Finding format & output:** Xem `reference/audit-templates.md`

---

## By-Design — KHÔNG Report Những Thứ Này

> Trước khi report finding, kiểm tra danh sách này. Nếu trùng → bỏ qua, ghi vào "Đã xem xét và bỏ qua".

| Pattern | Lý do by-design |
|---------|-----------------| 
| Mixed quote style (`""` và `''`) | Project convention |
| File >300 dòng (3 files >39K) | Biết rồi, chưa ưu tiên — xem `known_issues.md` |
| `validation.js` 25K 1-file-all | Pattern có chủ đích |
| `htcoachingweb.onrender.com` hardcode trong Login + LoginModal | Google OAuth callback URL — intentional |
| CSP `'unsafe-inline'` cho scriptSrc/styleSrc | Cần cho GA4 + Tailwind CSS |
| `crossOriginResourcePolicy: false` | Cho phép Cloudinary images cross-origin |
| `frameSrc` chứa `www.youtube.com` | YouTube embeds trong Coaching. KHÔNG revert về `['none']` |
| `console.error()` trong non-critical controllers | Dần migrate sang `safeLog` khi sửa file |

---

## 7 Danh Mục Audit

### 1. Correctness / Bugs 🐛

Ưu tiên cao nhất — real bugs tìm được bằng đọc code, không suy đoán.

Tìm kiếm:
- **Error handling**: Empty catch blocks, `catch (e) { console.log(e) }` trên critical paths (auth, payment, wallet)
- **Async hazards**: Unawaited promises, race conditions, missing cleanup trong React effects
- **Null/undefined**: Non-null assumptions trên Mongoose `.findById()`, unchecked `req.user`
- **Boundary conditions**: Empty array handling, pagination off-by-one, timezone issues
- **State machines**: Unhandled order/subscription status transitions
- **Resource leaks**: Unclosed connections, listeners never removed

**Đặc biệt cho htcoachingweb:**
- Check auth flow: `accessToken` refresh race conditions trong `api.js` interceptor
- Check Mongoose: `.findById()` và `.findOne()` handle `null` return
- Check CSRF: endpoint nào bypass CSRF protection

### 2. Security 🔒

> **Rule cứng:** KHÔNG BAO GIỜ copy secret values vào finding. Chỉ ghi `file:line` + credential type.

Tìm kiếm:
- **Credential hygiene**: Hardcoded keys/tokens, credentials logged
- **Injection**: Request data vào Mongoose queries không qua validation, XSS
- **Access control**: Routes thiếu `protect` middleware, IDOR
- **IDOR cụ thể**: `findById(req.params.id)` không kèm ownership check. Exceptions: admin-only endpoints có `requireRoles("admin")`
- **Input contracts**: API endpoints không qua `express-validator`, uploads không validate type/size
- **Dependency posture**: `npm audit --audit-level=high` — chỉ report critical/high
- **Timing attacks**: So sánh secrets phải dùng `crypto.timingSafeEqual()`
- **Safe logging**: `console.error(err)` trong production có thể leak PII

**Patterns đã fix (KHÔNG re-report):**
- CSRF timing-safe: `csrf.js` dùng `timingSafeEqual()` ✅
- Contract/F1/Deposit IDOR: đã có ownership checks ✅
- Safe logger: auth + errorHandler đã dùng `safeLog` ✅
- Security.txt: tồn tại ✅

### 3. Performance ⚡

Tìm algorithmic + architectural wins, không micro-optimize:
- **N+1 patterns**: Mongoose query per item trong loops
- **Wrong complexity**: Nested `.find()` where Map/Set suffices
- **Caching gaps**: Identical DB queries repeated per request
- **Payload size**: Select all fields when only ID needed, missing pagination
- **Frontend**: Bundle size, missing code-splitting, unoptimized images
- **Backend**: Synchronous work thuộc queue

### 4. Test Coverage 🧪

Project có **10 test files** (3 client, 5 server, 2 E2E) — xem `skills/process/tdd.md`.

Tìm kiếm:
- **Critical paths untested**: Auth flow, payment/wallet, CRUD operations
- **High churn + no tests**: Files thay đổi thường xuyên mà không có test
- **Output**: Liệt kê top 5 critical paths cần test nhất theo risk

### 5. Tech Debt & Architecture 🏚️

Tìm kiếm:
- **Duplication**: Same logic re-implemented ở nhiều nơi
- **Layering violations**: Component import trực tiếp từ model internals
- **Dead code**: Unexported unused modules, commented-out blocks
- **God objects**: Files lớn bất thường, functions nhiều parameters
- **Inconsistent patterns**: Nhiều cách làm cùng 1 việc

### 6. Dependencies & Migrations 📦

```bash
cd client && npm run security:audit
cd server && npm run security:audit
```

Tìm: Major-version lag, deprecated APIs, abandoned deps, duplicate packages.

### 7. DX & Tooling 🛠️

Tìm: Missing typecheck/formatter, slow feedback, undocumented env vars, unstructured logs.

---

## Audit Depth

| Level | Coverage | Categories | Findings |
|-------|----------|------------|----------|
| **quick** (`/audit quick`) | Hotspots only | Security + Bugs + Tests | Top ~5, HIGH confidence |
| **standard** (`/audit`) | Key packages + routes + models + middlewares | All 7 | Full table |

Dù ở level nào, **ghi rõ** những gì KHÔNG được audit.
