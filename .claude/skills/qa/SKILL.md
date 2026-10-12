---
name: qa
description: Workflow QA duy nhất sở hữu việc chạy compile/release build, unit, integration và E2E của HTCOACHINGWEB; tạo evidence có thể tái sử dụng bởi /release. Dùng khi cần chạy test/build có bằng chứng hoặc trước khi bàn giao/release.
---

# /qa — Quality Assurance

`/qa` là nguồn sự thật duy nhất cho build và test. `/release` phải tái sử dụng QA evidence hợp lệ thay vì chạy lại cùng lệnh.

---

## Cách Chạy

| Lệnh | Mô tả |
|-------|--------|
| `/qa` | Release build + client tests + server tests + E2E khi đủ điều kiện; tạo release evidence |
| `/qa quick` | Compile-only + client tests + server tests; không phải release evidence |
| `/qa client` | Compile-only + client tests |
| `/qa server` | Server tests |
| `/qa e2e` | E2E; bổ sung vào evidence hiện có |

---

## Step 1: Build Check 🏗️

`/qa quick` và `/qa client` dùng compile-only, không chạy lifecycle `prebuild`/`postbuild`:

```bash
cd client && npx vite build
```

`/qa` dùng release build. Lệnh này chạy sitemap, Vite build, prerender và bundle budget theo npm lifecycle:

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

---

## Step 3: Server Tests 🔧 (Vitest + Supertest)

Chạy unit + integration tests backend.

```bash
npm run test:unit:server
```

→ Verify: Ghi nhận số tests passed/failed/skipped

**Nếu FAIL:** Ghi nhận findings, tiếp tục step tiếp theo (không dừng).

Quy ước viết test (vị trí file, helper `server/src/__tests__/setup.js`, thứ tự ưu tiên theo rủi ro) nằm ở
`.claude/rules/testing.md`.

---

## Step 4: E2E Tests 🌐 (Playwright)

> Chỉ chạy khi dev servers và dữ liệu thử nghiệm cần thiết đã sẵn sàng.
> Nếu thiếu điều kiện, ghi `SKIP` kèm lý do; không được báo `PASS`.
> Khi dùng Playwright MCP/browser agent để recon, đọc
> [Browser-agent evidence](references/browser-agent-evidence.md). Exploration, screenshot hoặc trace
> chỉ là diagnostic; phải chuyển behavior thành Playwright spec deterministic và chạy command canonical
> trước khi ghi E2E/Release `PASS`.

```bash
npm run test:e2e
```

→ Verify: Ghi nhận kết quả. Screenshots lưu tự động khi fail. Với auth, payment, wallet, contract hoặc workflow chính, E2E là bắt buộc nếu tiêu chí nghiệm thu yêu cầu.

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

### Machine-readable evidence contract

JSON evidence dùng closed schema tại `.agents/scripts/qa-evidence-contract.mjs` và được
kiểm bằng lệnh sau trước khi `/release` tái sử dụng:

```bash
npm run qa:evidence:validate -- --evidence .local-data/qa-evidence/<evidence-name>.json
```

Contract kiểm exact command allowlist, status/exit/test counts, expiry, PII/secret,
working-tree fingerprint và điều kiện `releaseEligible`. Nó chỉ xác minh schema cùng
tính nhất quán của evidence tự khai; không chứng minh command thật sự đã chạy và
không thay quyền sở hữu QA của skill này. CLI luôn ghi
`attestationTrust: SELF_ATTESTED` và `releaseAuthorized: false`.

`/release` không được dùng JSON tự khai này làm nguồn duy nhất để cho
phép release. Cho tới khi có artifact từ trusted CI/runner với provenance bất biến,
phải đối chiếu evidence với nguồn thực thi đáng tin cậy hoặc chạy lại gate cần thiết.
Evidence writer phải tạo fingerprint sau khi chạy command; mọi thay đổi liên quan
tiếp theo làm evidence stale và cần chạy lại đúng gate bị ảnh hưởng.
Artifact evidence phải là file JSON **untracked** trực tiếp trong
`.local-data/qa-evidence/`; validator không chấp nhận path tracked hoặc path product
để artifact không thể tự loại một thay đổi runtime khỏi working-tree fingerprint.

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

Result: PASS | PASS_WITH_RISK | FAIL | BLOCKED
Machine evidence eligibility: ELIGIBLE | NOT ELIGIBLE
Attestation trust: SELF_ATTESTED
Release authorization: NOT PROVIDED
```

`PASS` nghĩa là evidence tự khai cho biết mọi lệnh bắt buộc của mode đã pass.
`PASS_WITH_RISK` chỉ dùng khi E2E được `SKIP` có reason và residual risk hợp lệ;
không được trình bày nó như `PASS`. Chỉ `/qa` full có thể đạt
`releaseEligible: true`; eligibility không phải release authorization.

---

## Khi Nào Chạy

| Tình huống | Lệnh |
|------------|-------|
| Trước deploy (trong `/release`) | `/qa` full đúng một lần |
| Sau khi thêm feature mới | `/qa` |
| Chỉ sửa frontend | `/qa client` |
| Chỉ sửa backend | `/qa server` |
| Quick check trước commit | `/qa quick` |
