---
name: qa
trigger: /qa
description: Quality Assurance workflow — chạy tests (unit + integration + E2E), kiểm tra test coverage, verify build. Chạy trước deploy hoặc sau khi thêm feature mới.
---

# /qa — Quality Assurance Check

> Chạy pipeline QA tuần tự: Build → Unit Tests → Integration Tests → E2E Tests.
> Sử dụng: `/qa` (full) hoặc `/qa quick` (chỉ build + unit tests)

// turbo-all

---

## Cách Chạy

| Lệnh | Mô tả |
|-------|--------|
| `/qa` | Full pipeline — build + client tests + server tests + E2E |
| `/qa quick` | Quick — chỉ build + client tests + server tests |
| `/qa client` | Chỉ client tests |
| `/qa server` | Chỉ server tests |
| `/qa e2e` | Chỉ E2E tests (cần dev servers running) |

---

## Pipeline Flow

```
┌────────────────────────────────────────────────────┐
│                    /qa PIPELINE                     │
│                                                     │
│  Step 1       Step 2        Step 3       Step 4     │
│ ┌────────┐  ┌──────────┐  ┌─────────┐  ┌───────┐  │
│ │ Build  │─▶│ Client   │─▶│ Server  │─▶│  E2E  │  │
│ │ Check  │  │  Tests   │  │  Tests  │  │ Tests │  │
│ └────────┘  └──────────┘  └─────────┘  └───────┘  │
│      │           │             │            │       │
│    FAIL?       FAIL?         FAIL?        FAIL?    │
│    → STOP      report        report       report   │
│                                                     │
│  ═══════════════════════════════════════════════    │
│                  QA REPORT                          │
│           PASS / FAIL (X/Y tests)                   │
└────────────────────────────────────────────────────┘
```

---

## Step 1: Build Check 🏗️

Build frontend để verify không có compilation errors.

```bash
cd client && npm run build
```

→ Verify: Exit code 0, không có errors

**Nếu FAIL:** Dừng pipeline. Không chạy tests khi code không build được.

---

## Step 2: Client Tests 🧪 (Vitest)

Chạy unit tests frontend.

```bash
cd client && npx vitest run
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
cd server && npx vitest run
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

> ⚠️ Chỉ chạy khi dev servers đang running (client + server).
> Nếu không running → SKIP step này.

```bash
npx playwright test
```

→ Verify: Ghi nhận kết quả. Screenshots lưu tự động khi fail.

### Trước khi viết E2E test mới

1. **Chụp screenshot / đọc DOM** trước → biết selectors thật
2. File location: `e2e/{feature}.spec.js`
3. Luôn chờ page loaded trước khi assert

---

## Output Format

```
🧪 QA REPORT — HTCoachingWeb
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/4] Build Check        ✅ PASS (Xs) / ❌ FAIL
[2/4] Client Tests       ✅ X passed, 0 failed / ❌ X passed, Y failed
[3/4] Server Tests       ✅ X passed, 0 failed / ❌ X passed, Y failed
[4/4] E2E Tests          ✅ X passed / ⏭️ SKIP (no dev servers)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 FAILED TESTS (nếu có):

| # | Layer  | Test Name                  | Error Summary        |
|---|--------|----------------------------|---------------------|
| 1 | Server | auth controller - login    | Expected 200, got 401 |
| 2 | Client | utils/format - formatVnd   | Expected "1.000đ"    |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 COVERAGE SUMMARY:
- Total tests: X
- Passed: X
- Failed: Y
- Skipped: Z

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULT: ✅ ALL PASS — QA gate cleared
        ❌ FAIL — X tests failed, fix trước khi deploy
```

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
| Trước deploy (trong /pre-deploy pipeline) | Tự động |
| Sau khi thêm feature mới | `/qa` |
| Chỉ sửa frontend | `/qa client` |
| Chỉ sửa backend | `/qa server` |
| Quick check trước commit | `/qa quick` |
