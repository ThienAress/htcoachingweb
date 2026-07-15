---
name: pre-deploy
trigger: /pre-deploy
description: Pipeline đầy đủ trước khi push code. Chạy tuần tự 7 gates (audit quick → ai-check → qa → ui-check → seo-check → skill-drift → ship). Gom TẤT CẢ findings, yêu cầu fix hết, re-check cho đến khi ALL PASS → mới được push. Mỗi workflow con vẫn chạy riêng lẻ được bằng lệnh riêng.
---

# /pre-deploy — Full Pipeline Trước Khi Push Code

> **Nguyên tắc:** Chạy 7 gates tuần tự. Gom tất cả findings. Fix hết. Re-check. Chỉ khi ALL PASS → mới được push/deploy.
> **Mỗi gate vẫn chạy riêng lẻ được:** `/audit quick`, `/ai-check`, `/qa`, `/ui-check`, `/seo-check`, `/ship`.

---

## Cách Chạy

| Lệnh | Mô tả |
|-------|--------|
| `/pre-deploy` | Full pipeline — 7 gates tuần tự |
| `/pre-deploy skip-audit` | Bỏ qua audit (khi vừa chạy `/audit` xong gần đây) |
| `/pre-deploy skip-ai` | Bỏ qua ai-check (khi không sửa file AI nào) |
| `/pre-deploy skip-qa` | Bỏ qua QA (khi vừa chạy `/qa` xong gần đây) |
| `/pre-deploy skip-ui` | Bỏ qua ui-check (khi chỉ sửa backend) |
| `/pre-deploy skip-drift` | Bỏ qua skill-drift (khi chỉ fix bug nhỏ) |

---

## Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              /pre-deploy PIPELINE                                       │
│                                                                                         │
│  Gate 1       Gate 2       Gate 3      Gate 4       Gate 5       Gate 6      Gate 7     │
│  ┌────────┐  ┌────────┐  ┌───────┐  ┌────────┐  ┌──────────┐  ┌───────┐  ┌────────┐   │
│  │/audit  │─▶│/ai-    │─▶│ /qa   │─▶│/ui-    │─▶│/seo-     │─▶│skill- │─▶│ /ship  │   │
│  │ quick  │  │ check  │  │       │  │ check  │  │ check    │  │ drift │  │        │   │
│  └────────┘  └────────┘  └───────┘  └────────┘  └──────────┘  └───────┘  └────────┘   │
│       │           │           │          │            │            │           │         │
│       ▼           ▼           ▼          ▼            ▼            ▼           ▼         │
│   findings    findings    test results findings    findings    warnings     GO/NO-GO    │
│                                                                                         │
│  ════════════════════════════════════════════════════════════════════════════            │
│                    GOM TẤT CẢ FINDINGS                                                  │
│                    ↓                                                                     │
│              FIX → RE-CHECK → ALL PASS?                                                 │
│                    ↓               ↓                                                     │
│                   NO              YES                                                    │
│                    ↓               ↓                                                     │
│              FIX TIẾP        ✅ READY TO PUSH                                           │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Gate 1: Audit Quick 🔍 (Code Quality)

Chạy `/audit quick` — quét hotspots, top findings, HIGH confidence only.

**Focus:** Bugs, Security, Performance trong code thay đổi gần đây.

**Hành vi:**
- Quét files có churn cao (git log)
- Quét critical paths (auth, payment, wallet, contract)
- **Security focus:** IDOR patterns (`findById` không kèm ownership check), timing-safe CSRF, CSP headers, PII trong logs
- Chỉ báo findings có confidence HIGH

**Output gate:** Findings table hoặc "Clean ✓"

**Không dừng pipeline khi có findings** — gom lại, tiếp tục gate tiếp theo.

---

## Gate 2: AI Check 🤖 (AI Chat System)

Chạy `/ai-check` — kiểm tra hệ thống HT Assistant.

**Focus:** System prompt chính xác, links đúng, content moderation, tool schemas.

**Hành vi:**
- Verify system prompt: dịch vụ, bộ môn, links, liên hệ, quy tắc theo chủ đề
- Verify KHÔNG gửi link `/online-coaching` (chỉ cho người đã mua gói)
- Verify `/club` mô tả đúng (tìm phòng tập, không phải bảng giá)
- Verify content moderation rules
- Verify tool schemas đầy đủ

**Output gate:** Findings table hoặc "Clean ✓"

**SKIP khi:** Không có thay đổi nào trong `server/src/services/ai/`, `client/src/components/ChatWidget/`, `client/src/hooks/useAiChat.js`.

---

## Gate 3: QA Check 🧪 (Tests)

Chạy `/qa quick` — build + unit tests + integration tests.

**Focus:** Verify code không broken, tests pass.

**Hành vi:**
- `cd client && npm run build` → phải exit 0
- `cd client && npx vitest run` → client unit tests
- `cd server && npx vitest run` → server unit + integration tests

**Output gate:** Test results (X passed, Y failed) hoặc "All pass ✓"

**SKIP khi:** Không có thay đổi logic code (chỉ sửa docs, configs, styling).

> ⚠️ E2E tests KHÔNG chạy trong pre-deploy pipeline (cần dev servers). Chạy riêng bằng `/qa e2e`.

---

## Gate 4: UI Check 🎨 (Design Quality)

Chạy `/ui-check` — quét toàn bộ UI theo 8 dimensions.

**Focus:** AI Slop, Color, Typography, Layout, Motion, Interaction States, Accessibility, Responsive.

**Hành vi:**
- Phân loại surfaces (Brand/Product)
- Grep 12 absolute bans
- Check color, typography, motion rules
- Chấm điểm /40

**Output gate:** Scorecard + findings table

**SKIP khi:** Không có thay đổi nào trong `client/src/pages/`, `client/src/sections/`, `client/src/components/`, `client/src/layouts/`.

---

## Gate 5: SEO Check 🔎 (SEO Compliance)

Chạy `/seo-check` — quét tất cả trang public.

**Focus:** SEO component, JSON-LD, Internal Links, Sitemap, Prerender, AI SEO.

**Hành vi:**
- Thu thập danh sách routes public
- Check từng trang theo 6 dimensions
- So sánh routes vs sitemap vs prerender

**Output gate:** Pass/Fail per page + findings table

**SKIP khi:** Không có thay đổi liên quan đến routes hoặc public pages.

---

## Gate 6: Skill Drift 📡 (AI Knowledge Freshness)

Detect-only — kiểm tra skill files có bị lỗi thời không. **KHÔNG tự rewrite, KHÔNG block deploy.**

**Focus:** Phát hiện drift giữa codebase thực tế và nội dung skill files.

**Hành vi — 4 checks nhanh:**

1. **AI Tools drift**: So sánh files trong `server/src/services/ai/tools/*.tool.js` vs danh sách trong `ai-chat-system.md` → báo nếu có tool mới chưa documented
2. **Test count drift**: Đếm test files trong `client/src/**/__tests__/` + `server/src/**/__tests__/` + `e2e/` → so với số ghi trong `tdd.md` → báo nếu lệch >2 files
3. **Known issues drift**: Check nhanh các issues trong `known_issues.md` còn đúng không (file tồn tại? pattern vẫn còn?)
4. **By-design sync**: Verify by-design list trong `audit-playbook.md` khớp với `known_issues.md`

**Output gate:** Warnings hoặc "No drift ✓"

**KHÔNG block deploy** — chỉ output warnings dạng:
```
⚠️ SKILL DRIFT DETECTED:
- ai-chat-system.md: 1 new tool file not documented (newTool.tool.js)
- tdd.md: test count changed (10 → 12 files)
→ Recommend: run /goad on affected files after deploy
```

**SKIP khi:** Không có thay đổi nào trong `server/src/services/ai/tools/`, `server/src/**/__tests__/`, `client/src/**/__tests__/`, `e2e/`.

---

## Gate 7: Ship 🚢 (Deploy Gate)

Chạy `/ship` — pre-deploy checklist cứng.

**Focus:** Build, Tests, Security, SEO basics, Cleanup.

**Hành vi:**
- `npm run build` → phải pass
- `vitest run` (client + server) → phải pass
- Security scan (IDOR, CSRF timing-safe, CSP, safeLog, `npm run security:audit`, security.txt) → phải pass
- SEO basics (nếu có route changes) → phải pass
- Cleanup check → phải pass

**Output gate:** GO / NO-GO

**Gate này là hard gate:** 1 item FAIL = NO-GO. Không tiếp tục.

---

## Tổng Hợp & Report

Sau khi chạy xong 7 gates, tổng hợp:

```
🚀 PRE-DEPLOY PIPELINE — HTCoachingWeb
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Gate 1/7] Audit Quick      ✅ Clean / ⚠️ X findings / ⏭️ SKIP
[Gate 2/7] AI Check         ✅ Pass / ⚠️ X findings / ⏭️ SKIP
[Gate 3/7] QA Check         ✅ All pass (X tests) / ❌ Y failed / ⏭️ SKIP
[Gate 4/7] UI Check (?/40)  ✅ Pass / ⚠️ X findings / ⏭️ SKIP
[Gate 5/7] SEO Check        ✅ Pass / ⚠️ X findings / ⏭️ SKIP
[Gate 6/7] Skill Drift      ✅ No drift / ⚠️ X warnings / ⏭️ SKIP
[Gate 7/7] Ship             ✅ GO / ❌ NO-GO

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 ALL FINDINGS (X total, sorted by severity)

| # | Gate | Finding | File | Severity | Category |
|---|------|---------|------|:--------:|----------|
| 1 | Ship | Build failed | - | 🔴 BLOCK | Build |
| 2 | Audit | Missing CSRF on route | file:line | 🔴 HIGH | Security |
| 3 | AI | Prompt links to /online-coaching | systemPrompt.js | 🔴 HIGH | AI |
| 4 | UI | Bounce easing in Hero | file:line | 🔴 HIGH | Slop |
| 5 | SEO | Missing JSON-LD | file | 🟡 MED | SEO |
| 6 | UI | Gray text on color bg | file:line | 🟡 MED | Color |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 BLOCKING (must fix before push):
- #1 Build failed — fix build errors first
- #2 Missing CSRF — add csrfProtection middleware

⚠️ SHOULD FIX (strongly recommended):
- #3 Bounce easing — change to power3.out
- #4 Missing JSON-LD — add Article schema
- #5 Gray on color — use same-hue lighter shade

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULT: ❌ NOT READY — Fix 2 blocking + 3 warnings trước khi push
        ✅ READY TO PUSH — All gates passed, 0 findings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Phân Loại Findings

| Severity | Ý nghĩa | Bắt buộc fix? |
|:--------:|---------|:-------------:|
| 🔴 **BLOCK** | Build fail, test fail, security hole | ✅ PHẢI fix |
| 🔴 **HIGH** | Security issue, WCAG violation, critical AI slop | ✅ PHẢI fix |
| 🟡 **MED** | Quality issue, missing SEO, design inconsistency | ⚠️ Nên fix |
| 🟢 **LOW** | Minor improvement, nice-to-have | 💡 Tùy chọn |

### Điều kiện READY TO PUSH

```
✅ READY khi:
- 0 findings 🔴 BLOCK
- 0 findings 🔴 HIGH
- Ship gate = GO

⚠️ READY WITH WARNINGS khi:
- 0 findings 🔴
- Có findings 🟡 MED (documented, sẽ fix sau)
- Ship gate = GO

❌ NOT READY khi:
- Còn bất kỳ finding 🔴 nào
- HOẶC Ship gate = NO-GO
```

---

## Sau Report — Fix Loop

| User nói | AI làm |
|----------|--------|
| "fix all 🔴" | Fix tất cả BLOCK + HIGH findings |
| "fix all" | Fix tất cả findings |
| "fix #2, #3" | Fix findings cụ thể |
| "skip #5, push" | Ghi nhận skip, chỉ push nếu không còn 🔴 |

**Sau khi fix → AI tự động:**
1. Chạy `npm run build` verify
2. Re-check chỉ các gates có findings (không chạy lại toàn bộ)
3. Cập nhật report → confirm READY hoặc còn findings

---

## Khi Nào Chạy

| Tình huống | Lệnh |
|------------|-------|
| Trước khi push code lên remote | `/pre-deploy` |
| Trước khi deploy Netlify/Render | `/pre-deploy` |
| Chỉ sửa backend, muốn nhanh | `/pre-deploy skip-ui` |
| Vừa chạy audit xong, muốn tiếp | `/pre-deploy skip-audit` |
| Chỉ muốn check 1 thứ | `/audit`, `/ui-check`, `/seo-check`, `/ship` riêng lẻ |
