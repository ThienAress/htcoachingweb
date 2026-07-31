---
name: qa
description: Workflow QA duy nhất sở hữu việc chạy compile/release build, unit, integration và E2E; tạo evidence có thể tái sử dụng bởi pre-deploy và ship.
---

# $qa — Quality Assurance

`$qa` là nguồn sự thật duy nhất cho build và test. `$pre-deploy` và `$ship` phải tái sử dụng QA evidence hợp lệ thay vì chạy lại cùng lệnh.

---

## Cách Chạy

| Lệnh | Mô tả |
|-------|--------|
| `$qa` | Release build + client tests + server tests + E2E khi đủ điều kiện; tạo release evidence |
| `$qa quick` | Compile-only + client tests + server tests; không phải release evidence |
| `$qa client` | Compile-only + client tests |
| `$qa server` | Server tests |
| `$qa e2e` | E2E; bổ sung vào evidence hiện có |

---

## Step 1: Build Check 🏗️

`$qa quick` và `$qa client` dùng compile-only, không chạy lifecycle `prebuild`/`postbuild`:

```bash
cd client && npx vite build
```

`$qa` dùng release build. Lệnh này chạy sitemap, Vite build, prerender và bundle budget theo npm lifecycle:

```bash
npm run build --prefix client
```

Nếu compile-only pass nhưng release build fail thì QA vẫn **FAIL**. Không nâng kết quả quick thành release evidence.

---

## Step 2: Client Tests 🧪 (Vitest)

Chạy unit tests frontend.

```bash
npm run test:unit:client
```

→ Verify: Ghi nhận số tests passed/failed/skipped

**Nếu FAIL:** Ghi nhận findings, tiếp tục step tiếp theo (không dừng).

### Khi viết test mới (FE)

- File location: `client/src/{module}/__tests__/{file}.test.js`
- Import pattern: `import { describe, test, expect } from 'vitest'`
- Mỗi test phải độc lập (`afterEach` cleanup nếu cần)
- Naming: `{filename}.test.{js|jsx}`

---

## Step 3: Server Tests 🔧 (Vitest + Supertest)

Chạy unit + integration tests backend.

```bash
npm run test:unit:server
```

→ Verify: Ghi nhận số tests passed/failed/skipped

**Nếu FAIL:** Ghi nhận findings, tiếp tục step tiếp theo (không dừng).

### Test Infrastructure có sẵn

| Helper | File | Vai trò |
|--------|------|---------|
| `setupTestDB()` | `server/src/__tests__/setup.js` | Tạo MongoDB in-memory |
| `teardownTestDB()` | `server/src/__tests__/setup.js` | Drop DB + disconnect |
| `clearCollections()` | `server/src/__tests__/setup.js` | Xóa data giữa tests |
| `createTestUser(overrides)` | `server/src/__tests__/setup.js` | Tạo user + JWT tokens |
| `createTestApp()` | `server/src/__tests__/setup.js` | Express app minimal |
| `withAuth(request, token)` | `server/src/__tests__/setup.js` | Gắn cookies + CSRF |

### Khi viết test mới (BE)

```javascript
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupTestDB, teardownTestDB, clearCollections, createTestUser, createTestApp } from '../__tests__/setup.js';

describe('Module Name', () => {
  beforeAll(async () => await setupTestDB());
  afterAll(async () => await teardownTestDB());
  afterEach(async () => await clearCollections());

  test('should do something', async () => {
    // Arrange
    const { user, accessToken } = await createTestUser();
    // Act
    // Assert
  });
});
```

---

## Step 4: E2E Tests 🌐 (Playwright)

> Chỉ chạy khi dev servers và dữ liệu thử nghiệm cần thiết đã sẵn sàng.
> Nếu thiếu điều kiện, ghi `SKIP` kèm lý do; không được báo `PASS`.

```bash
npm run test:e2e
```

→ Verify: Ghi nhận kết quả. Screenshots lưu tự động khi fail. Với auth, payment, wallet, contract hoặc workflow chính, E2E là bắt buộc nếu tiêu chí nghiệm thu yêu cầu.

### Trước khi viết E2E test mới

1. **Chụp screenshot / đọc DOM** trước → biết selectors thật
2. File location: `e2e/{feature}.spec.js`
3. Luôn chờ page loaded trước khi assert

---

## QA evidence contract

Trước khi chạy, ghi `git status --short`, `git diff --stat` và Git `HEAD`. Evidence chỉ hợp lệ khi có đủ:

- Thời điểm chạy và mode (`full`, `quick`, `client`, `server`, `e2e`).
- `HEAD` và trạng thái working tree; nếu dirty, kèm danh sách file thay đổi và diff stat làm fingerprint.
- Chính xác lệnh đã chạy, exit code, PASS/FAIL/SKIP và số test.
- Release build `PASS` nếu dùng cho deploy.
- Client/server tests `PASS` cho các layer nằm trong phạm vi.
- E2E `PASS` hoặc `SKIP` có lý do và đánh giá rủi ro.
- Không có thay đổi code/config/test liên quan sau thời điểm evidence được tạo.

Evidence hết hạn ngay khi working tree liên quan thay đổi. Sau khi sửa, chỉ chạy lại các lệnh bị ảnh hưởng và cập nhật evidence; không tái sử dụng kết quả cũ bằng suy đoán. Mọi exit code khác `0` là `FAIL`; lỗi môi trường phải ghi `BLOCKED`, không đổi thành `PASS`.

## Output Format

```text
QA EVIDENCE — HTCoachingWeb
Mode: full | quick | client | server | e2e
Timestamp: <ISO-8601>
HEAD: <commit>
Working tree: clean | dirty (<changed files + diff stat>)

Release build: PASS | FAIL | NOT RUN
Client tests: PASS (X) | FAIL (Y) | NOT RUN
Server tests: PASS (X) | FAIL (Y) | NOT RUN
E2E: PASS (X) | FAIL (Y) | SKIP (<reason>) | NOT RUN

Result: PASS | FAIL | BLOCKED
Release evidence: VALID | NOT VALID
```

`PASS` nghĩa là mọi lệnh bắt buộc của mode đã pass. Chỉ `$qa` full đáp ứng đủ điều kiện để ghi `Release evidence: VALID`.

---

## Critical Paths Cần Test (Ưu tiên)

Khi viết tests mới, ưu tiên theo risk:

| Priority | Path | Lý do |
|:--------:|------|-------|
| 🔴 P0 | Auth flow (login → JWT → refresh → logout) | Lỗi = mất access toàn bộ |
| 🔴 P0 | Wallet transactions (deposit → purchase → refund) | Lỗi = mất tiền |
| 🔴 P0 | CSRF validation | Lỗi = security hole |
| 🟡 P1 | AI chat (message → tool call → response) | Lỗi = feature chính hỏng |
| 🟡 P1 | Coaching CRUD (tạo → sửa → xóa giáo án) | Lỗi = trainer workflow hỏng |
| 🟢 P2 | SEO rendering (meta tags, JSON-LD) | Lỗi = mất traffic |
| 🟢 P2 | Form validation (Zod schemas) | Lỗi = bad data vào DB |

---

## Khi Nào Chạy

| Tình huống | Lệnh |
|------------|-------|
| Trước deploy (trong `$pre-deploy`) | `$qa` full đúng một lần |
| Sau khi thêm feature mới | `$qa` |
| Chỉ sửa frontend | `$qa client` |
| Chỉ sửa backend | `$qa server` |
| Quick check trước commit | `$qa quick` |
