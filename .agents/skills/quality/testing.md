---
name: testing-conventions
description: Quy ước viết test cho htcoachingweb. Use khi cần viết test mới, debug test failures, hoặc hỏi về test stack/structure.
---

# Testing Conventions — HTCoachingWeb

> Project có **160 tests** chạy qua 3 layers: Unit, Integration, E2E.

---

## Test Stack

| Layer | Tool | Scope |
|-------|------|-------|
| **Unit (FE)** | Vitest | Pure functions, utils, helpers |
| **Unit (BE)** | Vitest | Controller helpers, format functions |
| **Integration (BE)** | Vitest + Supertest + mongodb-memory-server | API endpoints, middleware chains, DB operations |
| **E2E** | Playwright (Chromium) | UI rendering, navigation, SEO meta tags |

---

## Cấu Trúc Test Files

```
client/src/{module}/__tests__/{file}.test.js     ← Unit tests
server/src/{module}/__tests__/{file}.test.js      ← Unit + Integration tests  
server/src/__tests__/setup.js                     ← Test infrastructure
e2e/{feature}.spec.js                             ← E2E tests (root level)
```

---

## Chạy Tests

```bash
cd client && npx vitest run         # Client units
cd server && npx vitest run         # Server units + integration
npx playwright test                 # E2E (cần dev servers running)
cd client && npx vitest             # Watch mode
cd server && npx vitest             # Watch mode
```

---

## Integration Test Infrastructure

File `server/src/__tests__/setup.js` cung cấp:

| Helper | Vai trò |
|--------|---------|
| `setupTestDB()` | Tạo MongoDB in-memory + set env vars |
| `teardownTestDB()` | Drop DB + disconnect |
| `clearCollections()` | Xóa data giữa các tests |
| `createTestUser(overrides)` | Tạo user + JWT tokens trong DB |
| `createTestApp()` | Express app minimal (không cron/external services) |
| `withAuth(request, token)` | Gắn cookies + CSRF header cho supertest |

---

## Quy Tắc Viết Test

| Quy tắc | Chi tiết |
|---------|---------|
| **TDD** | Viết failing test TRƯỚC → implement → verify pass |
| **Naming** | `{filename}.test.{js\|jsx}` trong `__tests__/` |
| **Independence** | Mỗi test chạy độc lập — `afterEach` clear data |
| **No test-only code** | KHÔNG thêm exports vào production code chỉ cho test |
| **E2E Recon** | Chụp screenshot/đọc DOM trước → viết test dựa trên selectors thật |
| **Assertion** | Mỗi test ≥ 1 assertion rõ ràng |

---

## Debugging SOP (Khi Test Fail)

```
1. ĐỌC error → file, dòng, assertion nào fail
2. PHÂN TÍCH → root cause (logic sai? selector sai? data sai?)
3. SỬA → chỉ chỗ gây lỗi
4. CHẠY LẠI → verify fix (tối đa 3 retries)
5. BÁO CÁO → nếu 3 lần vẫn fail → dừng, báo cáo
```
