---
name: ship
trigger: /ship
description: Pre-deploy gate cho htcoachingweb. Chạy trước MỌI lần deploy lên Netlify/Render. Tất cả bước phải PASS — 1 bước FAIL → NO-GO, không deploy.
---

# /ship — Pre-Deploy Checklist

> **Nguyên tắc:** Chỉ deploy khi tất cả bước dưới đây xanh. Không có ngoại lệ.

---

## Cách chạy

Khi user gõ `/ship`, AI thực hiện tuần tự từng bước, báo cáo kết quả từng bước, và kết luận GO hoặc NO-GO.

---

## Bước 1: Build Check 🏗️

```bash
cd client && npm run build
```

**PASS khi:** Build thành công, 0 errors.  
**FAIL khi:** Có bất kỳ error nào.  
**Nếu FAIL:** Dừng tại đây, báo cáo lỗi cụ thể, không tiếp tục.

---

## Bước 2: Test Check 🧪

// turbo
```bash
cd client && npx vitest run
```

// turbo
```bash
cd server && npx vitest run
```

**PASS khi:** Tất cả tests pass (client + server).  
**FAIL khi:** Có bất kỳ test fail. Dừng tại đây, báo cáo test nào fail.

> ⚠️ E2E tests (`npx playwright test`) chỉ chạy khi dev servers đang running. Nếu không running → SKIP E2E, chỉ chạy unit + integration.


---

## Bước 3: Security Scan 🔐

Đọc code thay đổi và kiểm tra:

- [ ] Không có credentials, API keys, secrets bị hardcode
- [ ] `X-CSRF-Token` vẫn được gửi trong mọi request mutating (không bị disabled)
- [ ] Route mới có auth middleware phù hợp (`requireAuth`, role check)
- [ ] Input validation có ở cả FE (Zod) VÀ BE (express-validator)
- [ ] Không có `console.log()` in ra sensitive data (token, password, user info)

**PASS khi:** Tất cả items trên ✅.  
**FAIL khi:** Bất kỳ item nào ❌ — liệt kê rõ item nào và lý do.

---

## Bước 4: SEO Check 🔍

*Chỉ chạy nếu có thay đổi liên quan đến routes hoặc pages.*

- [ ] Page public mới có `<SEO>` component với đủ `title`, `description`, `canonical`
- [ ] Trang hệ thống (admin, trainer, account) có `noindex={true}`
- [ ] Route mới đã được thêm vào `scripts/generate-sitemap.js`
- [ ] Route mới đã được thêm vào `scripts/prerender.js`

**PASS khi:** Tất cả items applicable ✅.  
**SKIP khi:** Không có thay đổi liên quan đến routes/pages.  
**FAIL khi:** Bất kỳ item nào bị bỏ sót.

---

## Bước 5: Cleanup Check 🧹

- [ ] Không có `console.log()` debug tạm thời
- [ ] Không có commented-out code mới
- [ ] Không có unused imports
- [ ] Không có hardcoded values (API URLs, credentials)
- [ ] File mới ≤ 300 dòng

**PASS khi:** Tất cả items ✅.  
**FAIL khi:** Bất kỳ item nào ❌ — liệt kê file và dòng cụ thể.

---

## Output Format

```
🚢 SHIP CHECKLIST — HTCoachingWeb
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/5] Build Check      ✅ PASS / ❌ FAIL
[2/5] Test Check       ✅ PASS (X/Y passed) / ❌ FAIL
[3/5] Security Scan    ✅ PASS / ❌ FAIL
[4/5] SEO Check        ✅ PASS / ⏭️ SKIP (no route changes)
[5/5] Cleanup Check    ✅ PASS / ❌ FAIL

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULT: ✅ GO — Sẵn sàng deploy
        ❌ NO-GO — [Liệt kê items cần fix]
```
