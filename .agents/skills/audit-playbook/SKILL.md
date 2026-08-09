---
name: audit-playbook
description: Hướng dẫn audit codebase theo 7 danh mục. Dùng khi user gọi audit hoặc yêu cầu quét toàn project; mọi finding phải có evidence file:line.
---

# Audit Playbook — HTCoachingWeb

> Quét codebase tìm vấn đề ẩn. Mỗi finding phải có evidence cụ thể (`file:line`).
> "Probably has N+1 queries somewhere" **KHÔNG** phải finding; `orders/api.ts:142 issues one query per order item inside a loop` **là** finding.
>
> **Finding format & output:** Xem `references/templates.md`

---

## By-Design — KHÔNG Report Những Thứ Này

> Trước khi report finding, kiểm tra danh sách này. Nếu trùng → bỏ qua, ghi vào "Đã xem xét và bỏ qua".

| Pattern | Lý do by-design |
|---------|-----------------| 
| Mixed quote style (`""` và `''`) | Project convention |
| File lớn đã được ghi nhận | Biết rồi, chưa ưu tiên — xem `../known-issues/SKILL.md`; chỉ report nếu task tạo thêm rủi ro cụ thể |
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

Khi diff có URL fetch, filesystem path, object merge/query, dynamic regex, browser output, shell hoặc GitHub Actions,
đọc [JavaScript and workflow threat routing](references/javascript-threat-routing.md). Chỉ report khi trace được
attacker-controlled input tới sink/asset; defense-in-depth gap đứng riêng dưới hardening notes.

**Canonical patterns:** đọc `../known-issues/SKILL.md`, root `SECURITY.md` và code hiện tại; không hardcode
trạng thái “đã fix” trong playbook vì chúng có thể drift.

#### Security coverage ledger

Dùng template `references/security-coverage-ledger.md` và ghi đủ:

- target revision + diff/working-tree/path/codebase scope;
- entry point/untrusted input → validation → authorization → sink/asset;
- validation method, realistic reachability/impact và result;
- deferred areas, proof gaps và re-validation sau fix.

Candidate lifecycle bắt buộc: candidate → validate/reject → impact/path → accepted finding → bounded fix →
focused regression → re-validation. Không có attacker-controlled path hoặc repeatable evidence thì ghi
`proof gap`, không report confirmed vulnerability.

### 3. Performance ⚡

Tìm algorithmic + architectural wins, không micro-optimize:
- **N+1 patterns**: Mongoose query per item trong loops
- **Wrong complexity**: Nested `.find()` where Map/Set suffices
- **Caching gaps**: Identical DB queries repeated per request
- **Payload size**: Select all fields when only ID needed, missing pagination
- **Frontend**: Bundle size, missing code-splitting, unoptimized images
- **Backend**: Synchronous work thuộc queue

### 4. Test Coverage 🧪

Đọc skill `../tdd-guide/SKILL.md` để lấy cấu trúc test hiện tại trước khi đánh giá coverage.

Tìm kiếm:
- **Critical paths untested**: Auth flow, payment/wallet, CRUD operations
- **High churn + no tests**: Files thay đổi thường xuyên mà không có test
- **Output**: Liệt kê top 5 critical paths cần test nhất theo risk

### 5. Tech Debt & Architecture 🏚️

Khi mục tiêu là coupling, module boundary hoặc refactor leverage, đọc
[Architecture depth review](references/architecture-depth.md) và dùng đúng vocabulary/deletion test tại đó.

Tìm kiếm:
- **Duplication**: Same logic re-implemented ở nhiều nơi
- **Layering violations**: Component import trực tiếp từ model internals
- **Dead code**: Unexported unused modules, commented-out blocks
- **God objects**: Files lớn bất thường, functions nhiều parameters
- **Inconsistent patterns**: Nhiều cách làm cùng 1 việc
- **Shallow module**: Interface phơi gần hết complexity, không tạo locality hoặc test seam có giá trị
- **Low locality**: Hiểu/sửa một concept phải nhảy qua nhiều module không có ownership rõ

Không report file lớn hay nhiều module nhỏ như finding nếu chưa chứng minh friction, deletion test và before/after seam.

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
| **quick** (`$audit quick`) | Hotspots only | Security + Bugs + Tests | Top ~5, HIGH confidence |
| **standard** (`$audit`) | Key packages + routes + models + middlewares | All 7 | Full table |

Dù ở level nào, **ghi rõ** những gì KHÔNG được audit.

---

## Proactive triggers và boundary

- Tự bật focused security workflow khi diff chạm auth/payment/wallet, ownership, upload/private data,
  external callback/webhook hoặc trust boundary mới.
- Dùng playbook để tạo/vet findings; không dùng thay QA hoặc release decision.
- Paid Codex Security chỉ chạy theo `docs/operations/runbooks/codex-security-scan.md`; raw output không tự
  trở thành finding và preflight không phải PASS.

---
