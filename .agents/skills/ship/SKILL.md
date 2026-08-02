---
name: ship
description: Release gate cuối cho HTCOACHINGWEB; tái sử dụng QA evidence hợp lệ, kiểm tra security, SEO, cleanup và kết luận GO/NO-GO mà không chạy trùng build/tests.
---

# $ship — Release Gate

`$ship` ra quyết định phát hành, không phải một QA pipeline thứ hai. `GO` không tự cấp quyền push/deploy; chỉ thực hiện khi user yêu cầu rõ.

---

## Cách chạy

Khi user gọi `$ship`, AI báo từng gate và kết luận `GO`, `GO WITH WARNINGS` hoặc `NO-GO`.

---

## Gate 1: QA evidence 🧪

1. Tìm evidence theo contract tại `.agents/skills/qa/SKILL.md`.
2. Nếu evidence đúng `HEAD`, working tree, scope và chưa hết hạn, tái sử dụng; **không chạy lại build/tests**.
3. Nếu thiếu hoặc hết hạn, chạy/ủy quyền `$qa` đúng một lần rồi dùng evidence mới. Không chép lệnh build/test vào `$ship`.
4. Khi chạy trong `$pre-deploy`, nhận nguyên QA evidence từ Gate 3.

Gate `PASS` khi release build và các test bắt buộc pass, E2E là `PASS` hoặc `SKIP` có lý do hợp lệ, và không có thay đổi liên quan sau QA. QA `FAIL`/`BLOCKED` hoặc evidence không hợp lệ dẫn đến `NO-GO`.


---

## Gate 2: Security 🔐

Đọc code thay đổi và kiểm tra:

**Hardening cơ bản:**
- [ ] Không có credentials, API keys, secrets bị hardcode
- [ ] `X-CSRF-Token` vẫn được gửi trong mọi request mutating (không bị disabled)
- [ ] Route mới có auth middleware phù hợp (`protect`, `requireRoles`, `requireTrainerAccess`)
- [ ] Input validation có ở cả FE (Zod) VÀ BE (express-validator)
- [ ] Không có `console.log()` in ra sensitive data (token, password, user info)

**IDOR Protection:**
- [ ] Endpoint user-accessible có `findById(req.params.id)` → PHẢI có ownership check (`userId: req.user.id`, `assertCustomerAccess()`, hoặc nằm sau `requireRoles("admin")`)
- [ ] Pattern đúng: `findOne({ _id: id, userId: req.user.id })` hoặc check `clientId`/`trainerId` match `req.user.id`

**Timing-safe & Headers:**
- [ ] CSRF token comparison dùng `crypto.timingSafeEqual()` (KHÔNG revert về `!==`)
- [ ] Helmet CSP config vẫn intact trong `server.js` (production-only, whitelist đúng domains)
- [ ] `security.txt` tồn tại tại `client/public/.well-known/security.txt`

**Logging:**
- [ ] Error handlers trong security-critical paths (auth, payment, contract) dùng `safeLog` thay vì `console.error`
- [ ] Không log PII (password, phone, signatureImage, tokens) ra production logs

**Coverage ledger:**
- [ ] Security-sensitive diff ghi target/scope, reviewed surfaces, entry point → validation → authorization → sink
- [ ] Deferred areas và proof gaps được ghi rõ; finding accepted/rejected có evidence
- [ ] Focused regression và re-validation tồn tại cho accepted finding đã fix

**Codex Security evidence:**
- [ ] Routine change có thể `SKIP` theo policy; local security gates vẫn bắt buộc
- [ ] High-risk/release change ghi `PREFLIGHT ONLY`, `COMPLETE` hoặc `PARTIAL/BLOCKED` đúng thực tế
- [ ] Paid/full/deep scan không chạy nếu thiếu explicit scope, cost authority hoặc acknowledgement
- [ ] Preflight/raw output không được dùng làm PASS hoặc confirmed finding

**Dependency scan:**
```bash
npm run security:secrets
npm run security:data-boundaries
npm run security:audit --prefix client
npm run security:audit --prefix server
```
- [ ] Không có lỗ hổng mức `high` hoặc `critical`

**PASS khi:** Tất cả items trên ✅.
**FAIL khi:** Bất kỳ item nào ❌ — liệt kê rõ item nào và lý do.

---

## Gate 3: SEO 🔍

Nếu diff chạm public route, metadata, sitemap hoặc prerender, chạy `$seo-check`; tái sử dụng report còn hợp lệ từ `$pre-deploy` thay vì audit lần hai.

- [ ] Page public mới có `<SEO>` component với đủ `title`, `description`, `canonical`
- [ ] Trang hệ thống (admin, trainer, account) có `noindex={true}`
- [ ] Route public mới đã được thêm vào `client/scripts/generate-sitemap.js`
- [ ] Route public mới đã được thêm vào `client/scripts/prerender.js`

**PASS khi:** Tất cả items applicable ✅.  
**SKIP khi:** Không có thay đổi liên quan đến routes/pages.  
**FAIL khi:** Bất kỳ item nào bị bỏ sót.

---

## Gate 4: Cleanup 🧹

Áp dụng `.agents/skills/cleanup-delivery/SKILL.md`.

- [ ] Không có `console.log()` debug tạm thời
- [ ] Không có commented-out code mới
- [ ] Không có unused imports
- [ ] Không có hardcoded values (API URLs, credentials)
- [ ] File mới ≤ 300 dòng

**PASS khi:** Tất cả items bắt buộc đạt.
**FAIL khi:** Finding gây lỗi, rò rỉ dữ liệu, breaking change hoặc vi phạm điều kiện hoàn thành; liệt kê `file:line`.

---

## Gate 5: Release decision

| Điều kiện | Kết quả |
|---|---|
| Bất kỳ gate bắt buộc `FAIL`/`BLOCKED` | `NO-GO` |
| Còn finding `BLOCK` hoặc `HIGH` | `NO-GO` |
| Mọi gate pass, không còn `BLOCK`/`HIGH`, có MED được document | `GO WITH WARNINGS` |
| Mọi gate pass, không còn finding đáng kể | `GO` |

Mỗi MED được chấp nhận phải có bằng chứng, rủi ro còn lại, lý do chưa sửa, owner và follow-up. MED không được dùng để hạ cấp build/test/security failure. LOW là tùy chọn nhưng vẫn ghi trong report.

---

## Output Format

```
SHIP REPORT — HTCoachingWeb

QA evidence: PASS (reused | generated once) | FAIL
Security: PASS | FAIL
SEO: PASS | SKIP (<evidence>) | FAIL
Cleanup: PASS | FAIL
Coverage ledger: PASS | SKIP (not security-sensitive) | FAIL
Codex Security: COMPLETE | PREFLIGHT ONLY | SKIP (<policy>) | PARTIAL/BLOCKED

BLOCK/HIGH: 0 | <findings>
MED accepted: 0 | <finding + risk + owner + follow-up>

RESULT: GO | GO WITH WARNINGS | NO-GO
Reason: <evidence-backed conclusion>
```
