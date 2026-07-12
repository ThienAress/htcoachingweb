---
name: tdd-guide
description: Hướng dẫn viết test theo TDD cho htcoachingweb. Use khi viết unit test, integration test, hoặc E2E test mới. Bao gồm patterns, setup helpers, và test organization.
---

# TDD Guide — HTCoachingWeb

> Hướng dẫn viết test cho dự án. Đọc trước khi tạo test file mới.

---

## Test Stack

| Layer | Tool | File Pattern |
|-------|------|-------------|
| **Unit (BE)** | Vitest | `server/src/**/__tests__/*.test.js` |
| **Integration (BE)** | Vitest + Supertest + MongoDB Memory | `server/src/**/__tests__/*.integration.test.js` |
| **Unit (FE)** | Vitest + React Testing Library | `client/src/**/__tests__/*.test.jsx` |
| **E2E** | Playwright | `e2e/*.spec.js` |

---

## Quick Start — Backend Test

```javascript
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import {
  setupTestDB, teardownTestDB, clearCollections,
  createTestUser, createTestApp, withAuth
} from '../__tests__/setup.js';

describe('Module Name', () => {
  beforeAll(async () => await setupTestDB());
  afterAll(async () => await teardownTestDB());
  afterEach(async () => await clearCollections());

  test('should do something', async () => {
    // Arrange
    const { user, accessToken } = await createTestUser();
    // Act
    const result = await someFunction(user._id);
    // Assert
    expect(result).toBeDefined();
  });
});
```

---

## Test Helpers Reference

| Helper | Trả về | Dùng cho |
|--------|--------|----------|
| `setupTestDB()` | - | Tạo MongoDB in-memory, connect |
| `teardownTestDB()` | - | Drop DB + disconnect |
| `clearCollections()` | - | Xóa data giữa tests |
| `createTestUser(overrides)` | `{ user, accessToken, refreshToken }` | Tạo user + JWT |
| `createTestApp()` | `express app` | Express app minimal |
| `withAuth(request, token)` | `request` | Gắn cookies + CSRF vào supertest request |

---

## Test Organization

### Backend

```
server/src/
├── controllers/
│   └── __tests__/
│       └── wallet.controller.test.js     ← Integration test
├── services/
│   └── ai/
│       └── __tests__/
│           └── contentModeration.test.js  ← Unit test
└── __tests__/
    └── setup.js                           ← Shared helpers
```

### Frontend

```
client/src/
├── utils/
│   └── __tests__/
│       └── formatters.test.js
└── components/
    └── __tests__/
        └── SEO.test.jsx
```

---

## Patterns

### Pattern 1: API Integration Test

```javascript
import request from 'supertest';
import { createTestApp, createTestUser, withAuth } from '../__tests__/setup.js';
import walletRoutes from '../routes/wallet.routes.js';

describe('GET /api/wallet', () => {
  let app;

  beforeAll(async () => {
    await setupTestDB();
    app = createTestApp();
    app.use('/api/wallet', walletRoutes);
  });

  test('returns wallet balance for authenticated user', async () => {
    const { user, accessToken } = await createTestUser();

    const res = await withAuth(
      request(app).get('/api/wallet'),
      accessToken
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('balance');
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
  test('renders nothing when no data', () => {
    const { container } = render(<BlogListCard data={null} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders posts', () => {
    const data = {
      posts: [{ title: 'Test Post', slug: 'test', categoryLabel: 'Tập luyện', readTime: 3 }],
      query: 'test'
    };
    render(
      <MemoryRouter>
        <BlogListCard data={data} />
      </MemoryRouter>
    );
    expect(screen.getByText('Test Post')).toBeInTheDocument();
  });
});
```

---

## TDD Flow

```
1. RED    → Viết test mô tả behavior mong muốn → chạy → FAIL
2. GREEN  → Viết code tối thiểu để test PASS
3. REFACTOR → Cải thiện code, giữ tests xanh
```

### Khi nào viết test?

| Tình huống | Viết test? | Loại test |
|------------|:----------:|-----------|
| Thêm API endpoint mới | ✅ | Integration |
| Sửa business logic | ✅ | Unit |
| Fix bug | ✅ | Test reproduce bug trước |
| Thêm UI component đơn giản | ❌ | Chỉ test nếu có logic phức tạp |
| Sửa CSS/styling | ❌ | Không cần |
| Thêm AI tool mới | ✅ | Unit test cho tool function |

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

## Chạy Tests

```bash
# Client tests
cd client && npm test         # hoặc npx vitest run

# Server tests
cd server && npm test         # hoặc npx vitest run

# Chạy 1 file cụ thể
npx vitest run path/to/file.test.js

# Watch mode (tự chạy lại khi sửa code)
npx vitest --watch
```

---

## Anti-patterns

| ❌ SAI | ✅ ĐÚNG |
|--------|--------|
| Test phụ thuộc lẫn nhau | Mỗi test độc lập (`afterEach` cleanup) |
| Test gọi API thật (production DB) | Dùng MongoDB Memory Server |
| Hardcode ObjectId trong test | Tạo dynamic bằng `createTestUser()` |
| Test quá nhiều thứ trong 1 `test()` | 1 test = 1 assertion chính |
| Skip test fail thay vì fix | Fix hoặc xóa — không để skip lâu dài |
