---
name: tdd-guide
description: Hướng dẫn test và TDD cho htcoachingweb. Dùng khi viết hoặc sửa unit test, integration test hay E2E test, gồm conventions, setup helpers và tổ chức test.
---

# TDD & Testing Guide — HTCoachingWeb

> Hướng dẫn viết test cho dự án. Đọc trước khi tạo test file mới.

---

## 🛑 KHI NÀO DÙNG / KHÔNG DÙNG

**Dùng khi:**
- Thêm API endpoint mới → Integration test
- Sửa business logic (service/controller) → Unit test
- Fix bug → Test reproduce bug trước, rồi fix
- Thêm AI tool mới → Unit test cho tool function

**KHÔNG dùng khi:**
- Thêm UI component đơn giản (chỉ test nếu có logic phức tạp)
- Sửa CSS/styling
- Typo fixes

---

## 🛠️ MODES

### Mode 1: TDD New Feature
Khi implement feature mới có business logic:
1. RED → Viết failing test cho **một behavior** qua public seam ổn định; confirm test fail vì đúng behavior còn thiếu
2. GREEN → Viết code tối thiểu qua các layer cần thiết để behavior đó PASS
3. REFACTOR → Chỉ micro-refactor an toàn (naming, local duplication, extraction nhỏ), rồi chạy lại focused test

Lặp vòng này theo từng vertical behavior slice. Không viết toàn bộ tests theo layer trước rồi mới
implement tất cả. Structural refactor, đổi boundary hoặc tổ chức lại nhiều module được defer sang
review/refactor task riêng sau khi behavior đã xanh.

### Mode 2: Regression Guard
Khi fix bug hoặc bổ sung test cho code có sẵn:
1. Reproduce bug scenario trong test → confirm FAIL
2. Fix code → confirm test PASS
3. Chỉ micro-refactor nếu cần → chạy lại regression test
4. Ghi vào `../known-issues/SKILL.md` nếu bug nghiêm trọng và có giá trị dùng lại lâu dài

---

## Test Stack

| Layer | Tool | File Pattern |
|-------|------|-------------|
| **Unit (FE)** | Vitest 4.x | `client/src/**/__tests__/*.test.js` |
| **Unit (BE)** | Vitest 4.x | `server/src/**/__tests__/*.test.js` |
| **Integration (BE)** | Vitest + Supertest + mongodb-memory-server | `server/src/**/__tests__/*.integration.test.js` |
| **E2E** | Playwright (Chromium) | `e2e/*.spec.js` |

---

## Test Inventory Hiện Tại

Không ghi tổng số hoặc danh sách snapshot trong skill vì test suite thay đổi thường xuyên.
Lấy inventory trực tiếp từ repo khi bắt đầu task:

```bash
rg --files client/src server/src e2e | rg "(test|spec)\.(js|jsx|ts|tsx)$"
```

Test infrastructure dùng chung nằm tại `server/src/__tests__/setup.js`. Chọn exemplar
gần domain đang sửa nhất thay vì mặc định sao chép một test cũ được liệt kê trong tài liệu.

---

## Chạy Tests

```bash
cd client && npx vitest run         # Client units
cd server && npx vitest run         # Server units + integration
npx playwright test                 # E2E (cần dev servers running)
cd client && npx vitest             # Watch mode
cd server && npx vitest             # Watch mode
npx vitest run path/to/file.test.js # Chạy 1 file cụ thể
```

---

## Test Helpers Reference

File `server/src/__tests__/setup.js` cung cấp:

| Helper | Trả về | Dùng cho |
|--------|--------|----------|
| `setupTestDB()` | - | Tạo MongoDB in-memory + set env vars |
| `teardownTestDB()` | - | Drop DB + disconnect |
| `clearCollections()` | - | Xóa data giữa tests |
| `createTestUser(overrides)` | `{ user, accessToken, refreshToken }` | Tạo user + JWT tokens |
| `createTestApp()` | `express app` | Express app minimal |
| `withAuth(request, token)` | `request` | Gắn cookies + CSRF vào supertest |

---

## Patterns

### Pattern 1: API Integration Test

```javascript
import request from 'supertest';
import { setupTestDB, teardownTestDB, clearCollections,
  createTestUser, createTestApp, withAuth } from '../__tests__/setup.js';
import walletRoutes from '../routes/wallet.routes.js';

describe('GET /api/wallet', () => {
  let app;
  beforeAll(async () => {
    await setupTestDB();
    app = createTestApp();
    app.use('/api/wallet', walletRoutes);
  });
  afterAll(async () => await teardownTestDB());
  afterEach(async () => await clearCollections());

  test('returns wallet balance for authenticated user', async () => {
    const { user, accessToken } = await createTestUser();
    const res = await withAuth(request(app).get('/api/wallet'), accessToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 401 without auth', async () => {
    const res = await request(app).get('/api/wallet');
    expect(res.status).toBe(401);
  });
});
```

### Pattern 2: Unit Test (Service/Utility)

```javascript
import { describe, test, expect } from 'vitest';
import { moderateContent } from '../contentModeration.js';

describe('moderateContent', () => {
  test('allows normal message', () => {
    const result = moderateContent('user1', 'Xin chào, tôi muốn tập gym');
    expect(result.safe).toBe(true);
  });

  test('blocks URL', () => {
    const result = moderateContent('user1', 'Vào đây nè https://scam.com');
    expect(result.safe).toBe(false);
  });
});
```

### Pattern 3: Frontend Component Test

```jsx
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BlogListCard from '../cards/BlogListCard';

describe('BlogListCard', () => {
  test('renders posts', () => {
    const data = { posts: [{ title: 'Test', slug: 'test', categoryLabel: 'Tập', readTime: 3 }], query: 'test' };
    render(<MemoryRouter><BlogListCard data={data} /></MemoryRouter>);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

---

## Quy Tắc Viết Test

| Quy tắc | Chi tiết |
|---------|---------|
| **TDD flow** | RED → GREEN → micro-REFACTOR cho từng behavior slice; structural refactor ở review |
| **Public seam** | Ưu tiên HTTP contract, exported service/function hoặc UI qua user interaction; tránh private helper và internal call order |
| **Behavior-first** | Test observable outcome; không couple test với implementation detail và không viết tất cả tests theo horizontal layer trước |
| **Naming** | `{filename}.test.{js\|jsx}` trong `__tests__/` |
| **Independence** | Mỗi test chạy độc lập — `afterEach` clear data |
| **No test-only code** | KHÔNG thêm exports vào production code chỉ cho test |
| **E2E Recon** | Chụp screenshot/đọc DOM trước → viết test dựa trên selectors thật |
| **1 test = 1 assertion** | Mỗi test có 1 assertion chính rõ ràng |

---

## Critical Paths Cần Test

| Priority | Module | Lý do |
|:--------:|--------|-------|
| 🔴 P0 | Auth (login/logout/refresh) | Lỗi = mất access |
| 🔴 P0 | Wallet (deposit/purchase/refund) | Lỗi = mất tiền |
| 🔴 P0 | CSRF validation | Lỗi = security hole |
| 🟡 P1 | AI tools (TDEE, search, wallet check) | Lỗi = AI trả kết quả sai |
| 🟡 P1 | Content moderation | Lỗi = nội dung xấu lọt qua |
| 🟢 P2 | Zod form schemas | Lỗi = bad data vào DB |

---

## Anti-patterns

| ❌ SAI | ✅ ĐÚNG |
|--------|--------|
| Test phụ thuộc lẫn nhau | Mỗi test độc lập (`afterEach` cleanup) |
| Test gọi API thật (production DB) | Dùng MongoDB Memory Server |
| Hardcode ObjectId trong test | Tạo dynamic bằng `createTestUser()` |
| Test quá nhiều thứ trong 1 `test()` | 1 test = 1 assertion chính |
| Mock private internals/call order | Assert behavior qua public seam ổn định |
| Viết toàn bộ tests DB/API/UI rồi mới implement | Hoàn tất RED → GREEN → micro-REFACTOR cho từng vertical behavior slice |
| Structural refactor ngay trong GREEN | Defer sang review/refactor task; GREEN chỉ thêm code tối thiểu |
| Skip test fail thay vì fix | Fix hoặc xóa — không để skip lâu dài |

---

## Debugging Test Failures

```
1. ĐỌC error → file, dòng, assertion nào fail
2. PHÂN TÍCH → root cause (logic sai? selector sai? data sai?)
3. SỬA → chỉ chỗ gây lỗi
4. CHẠY LẠI → verify fix (tối đa 3 retries)
5. BÁO CÁO → nếu 3 lần vẫn fail → dừng, báo cáo
```
