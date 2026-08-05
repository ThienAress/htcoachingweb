# Plan 022: Thay chữ ký tay bằng xác nhận hợp đồng qua OTP

> **SUPERSEDED BY PLAN 023 / NOT DEPLOYED**: eSMS xác nhận tài khoản cá nhân kinh doanh hiện chưa đủ điều kiện cấp SMS Brandname. Toàn bộ implementation OTP local của plan này được gỡ trước khi commit/deploy; không có migration hoặc dữ liệu OTP trên staging/production.

> **Hướng dẫn thực thi**: Thực hiện theo thứ tự, chạy verification của từng bước và dừng nếu gặp STOP condition.
>
> **Drift check**: `git status --short` và `git diff -- <in-scope files>` trước khi sửa. Các thay đổi của Plan 021 và `.vscode/` là ngoài phạm vi, phải được giữ nguyên.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: 002, 019, 020
- **Category**: security
- **Planned at**: 2026-08-02
- **Execution**: SUPERSEDED BY 023 / NOT DEPLOYED

## Why This Matters

Luồng hiện tại yêu cầu HLV và khách hàng vẽ chữ ký, trong khi quyết định sản phẩm mới coi việc admin phát hành hợp đồng là xác nhận của Bên A và OTP là hành động chấp thuận của khách hàng. OTP phải được gắn với đúng khách hàng, đúng phiên bản hợp đồng và tạo bằng chứng kiểm tra được; không được chỉ đổi payload `signatureImage` thành một chuỗi sáu số.

## Current State

- `client/src/pages/ContractSign.jsx:10,169` dùng `SignatureCanvas` và gửi ảnh base64.
- `client/src/pages/admin/ContractEditModal.jsx:6,31,112` yêu cầu chữ ký HLV trước khi gửi.
- `server/src/routes/contract.routes.js:52` có JWT + CSRF nhưng chỉ có một endpoint `/sign`.
- `server/src/services/contract.service.js:381-425` reserve trạng thái `signing`, sinh PDF rồi hash sau khi ký.
- `server/src/models/Contract.js:89-100` lưu ảnh chữ ký, PDF cuối và audit trail cơ bản.
- Chưa có SMS provider, OTP challenge hoặc test chuyên biệt cho ký hợp đồng.

## Product Contract

- Admin lưu và phát hành hợp đồng là xác nhận của Bên A; không thu chữ ký HLV.
- Khách phải xem tới cuối, tick đồng ý, yêu cầu OTP và nhập đúng OTP để ký.
- OTP gồm 6 chữ số, TTL 5 phút, resend cooldown 60 giây, tối đa 5 lần gửi/giờ và 5 lần nhập sai/challenge.
- OTP chỉ dùng một lần, chỉ hợp lệ cho đúng `contractId`, `clientId`, `challengeId` và `contentHash`.
- Không lưu/log OTP thô. Dùng HMAC-SHA256 với `CONTRACT_OTP_PEPPER`.
- Production dùng adapter eSMS qua native `fetch`; thiếu credentials hoặc provider lỗi thì fail closed.
- Local/test chỉ dùng mock khi `NODE_ENV !== production`; mã test chỉ lấy từ env, không trả về API.
- Giữ field chữ ký cũ để đọc documents lịch sử; không migration/xóa dữ liệu production.
- UI và PDF dùng cụm từ “xác nhận ký bằng OTP”, không tuyên bố là chữ ký số.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused server tests | `npm run test:unit:server -- --run <test-files>` | exit 0 |
| Server suite | `npm run test:unit:server` | exit 0 |
| Client tests | `npm run test:unit:client` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Client build | `npm run build --prefix client` | exit 0 |
| Security boundaries | `npm run security:data-boundaries` | exit 0 |
| Secrets | `npm run security:secrets` | exit 0 |

## Scope

**In scope**:

- `docs/plans/022-replace-contract-signatures-with-otp.md`
- `docs/plans/README.md`
- `server/src/models/Contract.js`
- `server/src/models/ContractOtpChallenge.js`
- `server/src/services/contract.service.js`
- `server/src/services/contractOtp.service.js`
- `server/src/services/contractSigningOtp.service.js`
- `server/src/services/sms.service.js`
- `server/src/controllers/contract.controller.js`
- `server/src/routes/contract.routes.js`
- `server/src/middlewares/validation.js`
- `server/src/middlewares/rateLimit.js`
- Contract-focused tests under `server/src/**/__tests__/`
- `client/src/pages/ContractSign.jsx`
- `client/src/pages/admin/ContractEditModal.jsx`
- `client/src/services/contract.service.js`
- `client/src/i18n/locales/{vi,en}/coaching.json`
- Contract-focused client tests if needed
- `e2e/contract.spec.js`

**Out of scope**:

- Xóa dữ liệu chữ ký lịch sử hoặc chạy migration/backfill trên staging/production.
- Public verification route/QR, chữ ký số công cộng hoặc provider chứng thực hợp đồng.
- Auth cookie, JWT refresh, CSRF interceptor và payment/wallet.
- Deploy, cấu hình Doppler hoặc mua/đăng ký SMS Brandname.
- Mọi file đang thay đổi bởi Plan 021 và `.vscode/`.

## Steps

### Step 1: Khóa schema và evidence contract

Thêm challenge model có TTL cleanup; mở rộng `Contract` bằng `contentHash`, snapshot file/version và `signingEvidence`. Field mới optional/default để documents cũ tiếp tục đọc được.

### Step 2: Viết OTP/SMS services và tests RED→GREEN

Tạo OTP bằng CSPRNG, chuẩn hóa số Việt Nam, hash bằng pepper, timing-safe compare, cooldown/attempt/replay guards. Adapter eSMS chỉ nhận allowlisted config và dùng timeout; test/mock không log hoặc trả OTP qua HTTP.

### Step 3: Tạo snapshot PDF và signing ceremony

Giữ PDF builder trong `contract.service.js` để tránh một refactor lớn ngoài phạm vi. Khi gửi hợp đồng, sinh snapshot + SHA-256; khi OTP hợp lệ, reserve atomic, sinh PDF cuối có evidence OTP, lưu GridFS và audit. Existing active contracts thiếu snapshot được lazy-create trước lần gửi OTP đầu tiên.

### Step 4: Cập nhật routes/controllers/validation/rate limit

Thêm `POST /:id/sign/otp`, đổi `POST /:id/sign` thành verify OTP, giữ JWT + CSRF + ownership server-side, thêm limiter riêng và error contract ổn định.

### Step 5: Bỏ chữ ký tay và xây UI OTP

Xóa tab/canvas HLV, bỏ requirement chữ ký khi gửi. Trang khách có document progress, bottom sentinel, checkbox consent, masked phone, 6-digit OTP, resend countdown và loading/error/signed states; mobile có sticky CTA.

### Step 6: Re-trace, QA và cleanup

Chạy lại dependency search cho các field/endpoint cũ và mới, rà diff, security scans và update plan/index bằng kết quả thật.

## Test Plan

- Unit: phone normalization, OTP generation/hash/compare, SMS provider payload/timeout/fail-closed.
- Integration: owner request/verify, non-owner denied, must-view-first, invalid/expired/locked/replayed OTP, content hash mismatch, signed idempotency/conflict.
- Regression: admin có thể gửi contract không cần `trainerSignature`; old signed documents vẫn tải PDF cũ.
- UI: request/verify loading, resend cooldown, API error, disabled until viewed+consent, accessibility labels and mobile sticky CTA.

## Verification Evidence

- Timestamp: `2026-08-03T00:27:18+07:00`.
- Target revision: `e2fcc24e3818a867f05c87c0131a74ede06a9fcc`; working tree dirty với Plan 021 được giữ nguyên.
- Release build: `npm run build --prefix client` — PASS; 2,771 modules, prerender 784/784 routes, bundle budget PASS.
- Client unit: `npm run test:unit:client` — PASS, 42 files và 230/230 tests.
- Server unit/integration: `npm run test:unit:server` — PASS, 88 files và 409/409 tests.
- Focused OTP: 3 files và 24/24 tests PASS, gồm fail-safe không lộ lỗi cấu hình nội bộ.
- E2E: `npm run test:e2e` — PASS, 62/62 tests; contract mobile flow và critical accessibility smoke đều PASS.
- Client lint: PASS với 0 errors; còn 1 warning trong `Pricing.jsx` thuộc Plan 021, ngoài phạm vi Plan 022.
- Security: secret scan PASS; repository data-boundary scan PASS với 0 violations.
- Agent validation: PASS, 22 skills và 5 rule files hợp lệ.
- Diff hygiene: `git diff --check` PASS.
- UI scoped review: không có AI-slop finding; contrast/focus/disabled states đạt yêu cầu và touch target chính trên mobile tối thiểu 44 px.

QA result: **PASS**. Release evidence local hợp lệ cho phần code Plan 022.
Production activation còn chờ cấu hình eSMS/Doppler; không gọi SMS thật, không migration và không ghi dữ liệu staging/production trong plan này.

## Done Criteria

- [x] Không còn UI hoặc luồng mới yêu cầu vẽ chữ ký.
- [x] OTP không xuất hiện trong response/log/database dạng thô.
- [x] Provider production thiếu config hoặc lỗi luôn fail closed.
- [x] Verify atomic, chống replay và bind đúng contract/version/user.
- [x] PDF cuối có evidence OTP + content hash; documents cũ vẫn đọc/tải được.
- [x] Tests, lint, build, secret/data-boundary scans đã chạy và kết quả được ghi lại.
- [x] Không chạm thay đổi Plan 021 hoặc `.vscode/`.

## STOP Conditions

- Cần chạy migration/ghi dữ liệu thật hoặc thay đổi production credentials.
- eSMS contract thực tế khác tài liệu chính thức và không thể mock/verify an toàn.
- Số điện thoại contract không thể chuẩn hóa mà vẫn phải cho phép ký.
- Cần nới CSRF/JWT/ownership hoặc trả OTP thô để test.
- Cùng verification fail ba vòng sau các sửa có căn cứ.

## Maintenance Notes

- Brandname và template eSMS phải được đăng ký trước khi bật production transport.
- `CONTRACT_OTP_PEPPER`, eSMS API key/secret/brandname/template thuộc secret/config store, không commit.
- QR/public verification và nhà cung cấp chữ ký số được defer; không trộn vào signing ceremony này.
