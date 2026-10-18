---
paths:
  - "**/__tests__/**"
  - "**/*.test.js"
  - "**/*.test.jsx"
  - "**/*.test.mjs"
  - "e2e/**"
---

# Testing conventions — HTCOACHINGWEB

| Layer | Công cụ | Vị trí |
|---|---|---|
| Client unit | Vitest | `client/src/**/__tests__/*.test.{js,jsx}` |
| Server unit | Vitest | `server/src/**/__tests__/*.test.js` |
| Server integration | Vitest + Supertest + mongodb-memory-server | `server/src/**/__tests__/*.integration.test.js` |
| E2E | Playwright | `e2e/*.spec.js` |
| Scripts/tooling | `node --test` | `scripts/**/*.test.mjs`, `.agents/scripts/*.test.mjs` |

Server test helpers trong `server/src/__tests__/setup.js`: `setupTestDB()`, `teardownTestDB()`,
`clearCollections()`, `createTestUser(overrides)` → `{ user, accessToken, refreshToken }`, `createTestApp()`,
`withAuth(request, accessToken)` (gắn cookie + CSRF). Chọn test gần domain nhất làm mẫu.

- Test hành vi qua public seam ổn định (HTTP contract, exported service, tương tác UI); không mock internals
  hay thứ tự gọi nội bộ, không thêm export chỉ để test.
- Fix bug: viết test tái hiện (RED) trước, rồi sửa (GREEN).
- Expected value lấy từ literal/worked example/spec, không tính lại bằng chính công thức của code.
- Mỗi test độc lập (`afterEach` cleanup); không hardcode ObjectId; không gọi DB/API thật.
- Không skip test đang fail để qua CI.
- Ưu tiên theo rủi ro: auth/refresh, wallet/payment, CSRF (P0) → AI tools, coaching CRUD, content moderation (P1)
  → SEO rendering, Zod schemas (P2).
- E2E: đọc accessibility snapshot trước, dùng locator theo role/label; synthetic account và fixture cô lập,
  không dùng auth state production; assert trạng thái cuối, không chỉ assert đã click.

## Tệp sinh tự động và đổi component dùng chung

- `.agents/reference/project-inventory.json` do `npm run agents:inventory` sinh. Mọi PR thêm hoặc xóa test, script, skill, rule đều làm nó lệch
  và CI `secrets` đỏ. Sau `git add` file mới: `npm run agents:inventory`, `npm run agents:inventory:check`, rồi stage lại file JSON.
- Conflict ở file này: lấy bản của nhánh nền rồi tái tạo bằng `npm run agents:inventory`; không sửa tay, không chọn từng hunk.
- Đổi component dùng chung (`SelectField`, `RoundedSelect`, modal, layout): trước khi push `grep` role, label, text cũ trong `e2e/` và
  `**/__tests__/`, cập nhật locator rồi chạy lại spec liên quan (ví dụ `getByRole("option").first()` hỏng sau khi đổi ô chọn).
