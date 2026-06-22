---
name: audit-playbook
description: Hướng dẫn quét proactive codebase theo 7 danh mục. Use khi user gõ /audit hoặc yêu cầu quét/kiểm tra toàn bộ project. Mỗi finding phải có evidence (file:line), không vibes-only.
---

# Audit Playbook — HTCoachingWeb

> Quét codebase tìm vấn đề ẩn. Mỗi finding phải có evidence cụ thể (`file:line`).
> "Probably has N+1 queries somewhere" **KHÔNG** phải finding; `orders/api.ts:142 issues one query per order item inside a loop` **là** finding.

---

## By-Design — KHÔNG Report Những Thứ Này

> Trước khi report finding, kiểm tra danh sách này. Nếu trùng → bỏ qua, ghi vào "Đã xem xét và bỏ qua".

| Pattern | Lý do by-design |
|---------|-----------------|
| Inline imports `server.js:152-178` | Có chủ đích — xem `known_issues.md` |
| Mixed quote style (`""` và `''`) | Project convention |
| File >300 dòng (`TrainerCoaching.jsx` 50K, `Pricing.jsx` 42K, `OnlineCoaching.jsx` 39K) | Đã biết, chưa ưu tiên refactor |
| `TrainerManagement.old.jsx` (71K dead code) | File backup, chưa xóa có chủ đích |
| `validation.js` (25K, 1 file all validations) | Pattern có chủ đích |
| `GA_MEASUREMENT_ID` placeholder | Đợi user cung cấp mã thật |
| `"test": "echo Error..."` trong server package.json | Chưa setup test — đã biết |

---

## 7 Danh Mục Audit

### 1. Correctness / Bugs 🐛

Ưu tiên cao nhất — real bugs tìm được bằng đọc code, không suy đoán.

Tìm kiếm:
- **Error handling**: Empty catch blocks, `catch (e) { console.log(e) }` trên critical paths (auth, payment, wallet)
- **Async hazards**: Unawaited promises, race conditions trên shared state, missing cleanup trong React effects
- **Null/undefined**: Non-null assumptions trên Mongoose `.findById()` returns, unchecked `req.user`
- **Boundary conditions**: Empty array handling, pagination off-by-one, timezone issues với dates
- **State machines**: Unhandled order/subscription status transitions, `default:` silently no-ops
- **Resource leaks**: Unclosed connections, listeners never removed, missing `finally`
- **Type escape hatches**: Implicit type coercion JavaScript, missing schema validation

**Đặc biệt cho htcoachingweb:**
- Check auth flow: `accessToken` refresh race conditions trong `api.js` interceptor
- Check Mongoose queries: `.findById()` và `.findOne()` có handle `null` return không
- Check CSRF: có endpoint nào bypass CSRF protection không (như đã xảy ra với `POST /record`)

### 2. Security 🔒

> **Rule cứng:** KHÔNG BAO GIỜ copy secret values vào finding. Chỉ ghi `file:line` + credential type.

Tìm kiếm:
- **Credential hygiene**: Hardcoded keys/tokens, credentials trong committed files, credentials logged
- **Injection**: Request data đi vào Mongoose queries không qua validation, HTML from user content (XSS)
- **Access control**: Routes thiếu `protect` middleware, authorization chỉ check ở FE, IDOR (object access by ID without ownership check)
- **Input contracts**: API endpoints nhận request body không qua `express-validator`, file uploads không validate type/size
- **Dependency posture**: `npm audit` — chỉ report critical/high reachable advisories
- **Production config**: CORS config, cookies missing `HttpOnly`/`Secure`/`SameSite`, debug mode trong production
- **Data minimization**: PII trong logs, stack traces trả về client, internal errors exposed

**Đặc biệt cho htcoachingweb:**
- Check tất cả routes trong `server.js` có `protect` middleware cho routes cần auth
- Check `CORS` config — `credentials: true` chỉ cho đúng domains
- Check rate limiting — có route nào bypass `rateLimit.js` không
- Check upload middlewares — file type + size validation đầy đủ

### 3. Performance ⚡

Tìm algorithmic + architectural wins, không micro-optimize.

Tìm kiếm:
- **N+1 patterns**: Mongoose query per item trong loops, missing `.populate()` hoặc aggregation
- **Wrong complexity**: Nested `.find()` trong loops where Map/Set suffices
- **Caching gaps**: Identical DB queries repeated per request, missing memoization
- **Payload size**: Select all fields when only ID needed, missing pagination on unbounded lists
- **Frontend**: Bundle composition (GSAP + SplitType weight), missing code-splitting trên lazy routes, unoptimized images
- **Backend**: Synchronous work thuộc queue, connection-per-request patterns

**Đặc biệt cho htcoachingweb:**
- Check Mongoose `.find()` — có select fields cần thiết thay vì `find({})` lấy tất cả?
- Check pagination — `getAll` endpoints có limit không?
- Check image handling — Cloudinary transforms có optimize cho web?

### 4. Test Coverage 🧪

> Project **chưa có tests** — đây luôn là finding #1.

Tìm kiếm:
- **Critical paths untested**: Auth flow, payment/wallet transactions, mealplan access control, CRUD operations
- **High churn + no tests**: Files thay đổi thường xuyên (git log) mà không có test = refactor risk
- **Verification infrastructure**: Có 1-command way để biết codebase works không? (`npm run build` cho FE, nhưng BE?)

**Output cho category này:**
- Liệt kê top 5 critical paths cần test nhất (theo risk)
- Khuyến nghị setup Vitest (đã có convention trong `skills/quality/testing.md`)

### 5. Tech Debt & Architecture 🏚️

Tìm kiếm:
- **Duplication**: Same logic re-implemented ở nhiều nơi (VD: shadow config pattern trong `search.ts` và `view.ts`)
- **Layering violations**: Component import trực tiếp từ model/service internals, circular deps
- **Dead code**: Unexported unused modules, feature flags không dùng, commented-out blocks
- **God objects**: Files lớn bất thường (>10x median), functions nhiều parameters
- **Inconsistent patterns**: Nhiều cách làm cùng 1 việc (data fetching, error handling)
- **Abstraction mismatches**: Premature abstractions cho 1 use case, hoặc missing abstractions khi N files phải sửa đồng bộ

**Đặc biệt cho htcoachingweb:**
- Đã biết: 3 file >39K, validation.js 25K → KHÔNG report lại, chỉ report nếu tìm thấy THÊM vấn đề mới
- Check service layer: có service nào duplicate logic với controller không?
- Check hooks: có hook nào chỉ dùng 1 nơi nhưng vẫn tách riêng?

### 6. Dependencies & Migrations 📦

Tìm kiếm:
- **Major-version lag**: Core framework/runtime đã EOL hoặc hết security fixes
- **Deprecated APIs**: APIs đã announced removal timelines
- **Abandoned dependencies**: Packages không release >2 năm, archived repos
- **Duplicate dependencies**: 2 packages giải quyết cùng vấn đề
- **Lockfile drift**: Version pinning inconsistencies

**Cách chạy:**
```bash
cd client && npm audit --audit-level=high
cd server && npm audit --audit-level=high
```

### 7. DX & Tooling 🛠️

Tìm kiếm:
- **Missing/broken**: Typecheck script, formatter, pre-commit hooks
- **Slow feedback**: Dev-server startup time, build time
- **Onboarding friction**: Undocumented required env vars, `.env.example` missing hoặc outdated
- **Error messages**: Unstructured logs, missing request IDs, debugging requires code changes

---

## Finding Format

Mỗi finding PHẢI theo format này:

```markdown
### [CATEGORY-NN] Short imperative title

- **Evidence**: `path/file.js:123` — mô tả 1 dòng. (2–5 locations mạnh nhất, ghi "và ~N chỗ tương tự" nếu phổ biến)
- **Impact**: Hậu quả cụ thể. "Every order-list render issues 1+N queries", KHÔNG "suboptimal".
- **Effort**: S (giờ) / M (~1 ngày) / L (nhiều ngày) — cho *fix*, bao gồm tests.
- **Risk**: Fix có thể phá gì; LOW/MED/HIGH + 1 dòng lý do.
- **Confidence**: HIGH (đọc code, chắc chắn) / MED (signal mạnh, cần verify) / LOW (smell, cần investigate).
- **Fix sketch**: 1–3 câu. Đủ để đánh giá effort, KHÔNG phải plan đầy đủ.
```

---

## Prioritization

Xếp findings theo **leverage = impact ÷ effort, discount bởi confidence và fix-risk**.

Tiebreakers:
1. Findings unblock các findings khác (verification baseline, characterization tests) → đẩy lên trên
2. Security findings HIGH confidence → trên equivalent-leverage non-security findings
3. Prefer findings có clean verification story
4. "Không đáng làm" = valid verdict — ghi lý do 1 dòng để không re-audit

---

## Output Table

Sau khi vet (loại false positives, sửa mis-attributions, bỏ duplicates), trình bày:

```markdown
| # | Finding | Category | Impact | Effort | Risk | Evidence |
|---|---------|----------|--------|--------|------|----------|
| 1 | ...     | security | HIGH   | S      | LOW  | file:line |
| 2 | ...     | perf     | MED    | M      | MED  | file:line |
```

Sau table, hỏi user chọn findings nào muốn tạo plan (default: top 3-5 theo leverage).
Ghi rõ dependency ordering nếu có (VD: "plan 02 phải xong trước plan 05").

---

## Audit Depth

| Level | Coverage | Categories | Findings |
|-------|----------|------------|----------|
| **quick** (`/audit quick`) | Hotspots only (files churn cao, critical paths) | Security + Bugs + Tests | Top ~5, HIGH confidence only |
| **standard** (`/audit`) | Key packages + routes + models + middlewares | All 7 | Full table |

Dù ở level nào, **ghi rõ** những gì KHÔNG được audit (VD: "Chưa quét `client/src/sections/` do focus vào pages + services").
