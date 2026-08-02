# Security context — HTCOACHINGWEB

File này cung cấp threat model và security invariants cho review thủ công, Codex và Codex Security.
Policy thực thi canonical nằm tại `.agents/rules/security/security.md`; build/test commands nằm trong
`AGENTS.md` và `.agents/skills/qa/SKILL.md`.

## System overview

- `client/`: React SPA trên Netlify; gọi Express API bằng axios với credentials/cookies.
- `server/`: Express API trên Render; JWT trong httpOnly cookies, CSRF double-submit token, Passport
  Google OAuth, Mongoose/MongoDB.
- Luồng backend chuẩn: route → middleware → controller → service → model.
- Integrations chính: Google OAuth, MongoDB Atlas, Cloudinary, email providers và Google GenAI.

## Assets và dữ liệu nhạy cảm

- Access/refresh tokens, OAuth state, CSRF token, cookies và provider credentials.
- Dữ liệu định danh, sức khỏe, đánh giá cơ thể, ảnh/video, chữ ký và hội thoại AI.
- Wallet balance, deposit, purchase, refund, subscription, contract và financial audit trail.
- Trainer/client assignment, admin actions và private coaching records.

## Entry points và untrusted inputs

- Public HTTP routes, JSON/form payloads, query/path parameters và pagination/filter/sort values.
- Google OAuth redirects/callbacks, provider responses, webhook/callback payloads và email links.
- File uploads, image metadata, external URLs và AI/tool inputs.
- Browser cookies/headers, preview origins và operational scripts nhận CLI/environment arguments.

Mọi input từ browser/provider/file/CLI đều không đáng tin cho tới khi validation, authorization và
business invariants đã pass ở backend.

## Trust boundaries

1. Browser ↔ Netlify SPA ↔ Render API: CORS, cookies, CSRF, JWT và request validation.
2. Anonymous/authenticated/trainer/admin: backend role, entitlement và ownership checks.
3. API ↔ MongoDB: allowlisted fields, bounded queries, transactions/indexes và least privilege.
4. API ↔ external providers: redirect/domain allowlist, signature/state/replay checks, timeout và safe logging.
5. Public/private media: authenticated delivery hoặc signed/expiring URLs cho dữ liệu nhạy cảm.
6. Local/CI/staging/production: không dùng dev bypass, seed, cleanup hoặc migration sai target.

## Security invariants

- Access/refresh tokens chỉ nằm trong httpOnly cookies; JSON response không trả token cho frontend.
- Mọi mutating request dùng cơ chế CSRF hiện có; comparison security token phải timing-safe.
- OAuth state phải signed, có TTL và bind với browser nonce trước khi exchange authorization code.
- Dev-login chỉ tồn tại khi explicit local development opt-in và phải reject non-loopback requests.
- Backend enforce role, entitlement và ownership/assignment; frontend visibility không phải authorization.
- Financial amount/status/ledger do backend tính canonical; mutation quan trọng giữ transaction/idempotency.
- Không spread raw `req.body` vào Mongoose create/update; dùng validation và field allowlist.
- Upload validate type/size/content; private media không mặc định public.
- Security-critical logging dùng `safeLog` với metadata allowlist; không log payload/token/PII thô.
- Không disable hoặc nới lỏng CSRF, httpOnly cookie, rate limit, CSP/CORS hay ownership để chữa lỗi tạm.

## Review priorities

Ưu tiên review theo thứ tự:

1. Auth/OAuth/JWT/CSRF, admin/trainer authorization và IDOR.
2. Payment/wallet/deposit/subscription/contract transitions và race conditions.
3. Health/private F1 data, uploads/media delivery, retention/export/delete.
4. External integrations, redirect/webhook/SSRF, secrets và production logging.
5. Injection, XSS, unsafe query construction và dependency vulnerabilities.

## Reportable findings

Chỉ xác nhận vulnerability khi có đủ root control/sink, attacker-controlled input, reachable attack path,
impact hợp lý và validation evidence. Nếu chưa chứng minh được, ghi candidate hoặc proof gap; không nâng
thành confirmed finding.

- **Critical/P0**: compromise production/admin, arbitrary financial mutation, broad sensitive-data access,
  credential exfiltration hoặc remote code execution.
- **High/P1**: auth bypass, practical IDOR, token exposure, CSRF trên action quan trọng, financial integrity
  break hoặc sensitive-data disclosure có đường khai thác thực tế.
- **Medium/P2**: defense-in-depth gap hoặc exploit cần điều kiện đáng kể nhưng vẫn có impact cụ thể.
- **Low/P3**: hardening/DX issue không có đường exploit thực tế đã chứng minh.

## Known exclusions và context

- Không report mixed quote style, file lớn/validation file đã biết hoặc backup file là security issue nếu
  không có exploit path cụ thể.
- Một số CSP/cross-origin/OAuth URL patterns là intentional theo `.agents/skills/known-issues/SKILL.md`;
  phải xác minh code và consumer trước khi đề xuất thay đổi.
- Không coi secret scan, dependency audit hoặc Codex Security output là proof duy nhất; finding vẫn phải vet.

## Coverage ledger contract

Security audit phải ghi:

- Target revision, diff/path/scope và threat-model assumptions.
- Reviewed surfaces và luồng entry point → validation → authorization → sink.
- Tests/static/runtime evidence đã dùng.
- Deferred surfaces, proof gaps và lý do.
- Accepted/rejected findings, severity rationale và re-validation sau fix.

## Scan và release policy

- Routine changes dùng local/CI gates; không tự chạy paid Codex Security.
- Auth/payment/wallet, release lớn hoặc trust boundary mới bắt đầu bằng diff/working-tree/path scan nhỏ.
- Full/deep scan cần explicit scope, cost acknowledgement và user authority; không chạy tự động trong CI.
- Dùng wrapper/runbook tại `docs/operations/runbooks/codex-security-scan.md`.
- `--max-cost` chỉ là estimate guard; request đang chạy có thể vượt giá trị đó.

## Verification commands

```text
npm run security:secrets
npm run security:data-boundaries
npm run security:audit --prefix client
npm run security:audit --prefix server
npm run test:unit:server
npm run agents:validate
```

Không chạy migration, seed, cleanup hoặc production write chỉ để verify security review.
