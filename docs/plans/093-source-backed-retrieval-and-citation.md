# Plan 093: Ưu tiên Knowledge Base nguồn đã duyệt trước web search

## Status

- **Priority**: P1
- **Complexity**: MODERATE
- **Effort**: M
- **Risk**: HIGH — evidence attribution, stale source và guest privacy
- **Depends on**: 090, 090A, 092
- **Category**: feature | reliability | security | tests
- **Lifecycle**: IN PROGRESS
- **Verification**: FOCUSED LOCAL — PASS (Node 24 cache; Node 22 unavailable offline)
- **Rollout**: STAGING PENDING
- **Owner**: root
- **Updated at**: 2026-09-28

## Objective

Khi user yêu cầu nguồn, HT Assistant phải thử curated Knowledge Base trước. Chỉ
entry đã publish, embedding đúng version, review còn hiệu lực và có source HTTPS
phù hợp mới được dùng để trả lời/citation. Nếu curated KB không có evidence đủ
điều kiện, luồng hiện tại vẫn dùng web search (authenticated) hoặc fail-closed
theo policy guest/provider.

## Scope and Netlify impact

- Chỉ sửa server routing/retrieval boundary và regression tests.
- Không đổi schema, migration, corpus, embedding index, provider/model, quota,
  auth hoặc guest web-search policy.
- Không sửa `client/`; không cần Netlify build/deploy cho slice này.
- Không chạy staging/production data write. Việc thêm source vào KB vẫn qua API
  admin hiện có và review server-authoritative ở rollout riêng.

## Steps

### Step 1: Probe curated evidence before web search

Cho phép controller truy vấn curated KB cho `web_required` bằng query đã qua
   privacy gate, trước khi tính external web query.

### Step 2: Promote citable hits and lock tool route

Nếu kết quả có citable source-backed HTTPS evidence, chuyển request sang
   `internal_kb`, khóa web tool và giữ source IDs/citations trong answer trace.

### Step 3: Preserve no-hit fallback and observability

Giữ nguyên fallback web/fail-closed khi không có citable hit; thêm reason code
   deterministic để observability phân biệt curated hit với web provider outcome.

### Step 4: Verify source-backed routing regressions

Bổ sung integration/router regression cho curated hit, no-hit và tool least
   privilege; chạy focused AI tests, security scans và diff hygiene.

## Acceptance criteria

- AC-030: Câu hỏi cần nguồn có curated hit không gọi Google Search, không expose
  `search_knowledge`, câu trả lời giữ source HTTPS và trace ghi `internal_kb`.
- AC-031: Hit stale, legacy, chưa review hoặc không có source phù hợp không được
  nâng thành evidence; authenticated no-hit vẫn đi web, guest no-hit vẫn fail closed.
- AC-032: Query đưa vào curated retrieval vẫn qua privacy boundary; không log raw
  question/answer/source payload.
- AC-033: Retrieval filter/embedding version và citation sanitizer hiện có không
  bị nới lỏng; test focused chứng minh không có tool ngoài route.
- AC-034: Không có thay đổi dưới `client/`, vì vậy Netlify không nằm trên đường
  triển khai của slice này.

## Verification

- `npx -y node@22.23.1 server/node_modules/vitest/vitest.mjs run server/src/controllers/__tests__/aiFeedbackTrace.integration.test.js server/src/services/ai/__tests__/requestRouter.test.js server/src/services/ai/__tests__/systemPrompt.test.js server/src/services/ai/__tests__/embedding.service.test.js`
- `npm run security:secrets`
- `npm run security:data-boundaries`
- `npm run agents:validate`
- `git diff --check`

Full client build is not required unless a later slice changes `client/`.
