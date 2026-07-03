---
name: pre-deploy
trigger: /pre-deploy
description: Pipeline đầy đủ trước khi push code. Chạy tuần tự 5 gates (audit quick → ai-check → ui-check → seo-check → ship). Gom TẤT CẢ findings, yêu cầu fix hết, re-check cho đến khi ALL PASS → mới được push. Mỗi workflow con vẫn chạy riêng lẻ được bằng lệnh riêng.
---

# /pre-deploy — Full Pipeline Trước Khi Push Code

> **Nguyên tắc:** Chạy 5 gates tuần tự. Gom tất cả findings. Fix hết. Re-check. Chỉ khi ALL PASS → mới được push/deploy.
> **Mỗi gate vẫn chạy riêng lẻ được:** `/audit quick`, `/ai-check`, `/ui-check`, `/seo-check`, `/ship`.

---

## Cách Chạy

| Lệnh | Mô tả |
|-------|--------|
| `/pre-deploy` | Full pipeline — 5 gates tuần tự |
| `/pre-deploy skip-audit` | Bỏ qua audit (khi vừa chạy `/audit` xong gần đây) |
| `/pre-deploy skip-ai` | Bỏ qua ai-check (khi không sửa file AI nào) |
| `/pre-deploy skip-ui` | Bỏ qua ui-check (khi chỉ sửa backend) |

---

## Pipeline Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         /pre-deploy PIPELINE                                │
│                                                                              │
│  Gate 1        Gate 2        Gate 3        Gate 4        Gate 5              │
│  ┌────────┐   ┌────────┐   ┌────────┐   ┌──────────┐   ┌────────┐         │
│  │/audit  │──▶│/ai-    │──▶│/ui-    │──▶│/seo-     │──▶│ /ship  │         │
│  │ quick  │   │ check  │   │ check  │   │ check    │   │        │         │
│  └────────┘   └────────┘   └────────┘   └──────────┘   └────────┘         │
│       │            │            │              │              │              │
│       ▼            ▼            ▼              ▼              ▼              │
│   findings     findings     findings       findings      GO/NO-GO          │
│                                                                              │
│  ════════════════════════════════════════════════════════════════            │
│                    GOM TẤT CẢ FINDINGS                                      │
│                    ↓                                                         │
│              FIX → RE-CHECK → ALL PASS?                                     │
│                    ↓               ↓                                         │
│                   NO              YES                                        │
│                    ↓               ↓                                         │
│              FIX TIẾP        ✅ READY TO PUSH                               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Gate 1: Audit Quick 🔍 (Code Quality)

Chạy `/audit quick` — quét hotspots, top findings, HIGH confidence only.

**Focus:** Bugs, Security, Performance trong code thay đổi gần đây.

**Hành vi:**
- Quét files có churn cao (git log)
- Quét critical paths (auth, payment, wallet)
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

## Gate 3: UI Check 🎨 (Design Quality)

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

## Gate 4: SEO Check 🔎 (SEO Compliance)

Chạy `/seo-check` — quét tất cả trang public.

**Focus:** SEO component, JSON-LD, Internal Links, Sitemap, Prerender, AI SEO.

**Hành vi:**
- Thu thập danh sách routes public
- Check từng trang theo 6 dimensions
- So sánh routes vs sitemap vs prerender

**Output gate:** Pass/Fail per page + findings table

**SKIP khi:** Không có thay đổi liên quan đến routes hoặc public pages.

---

## Gate 5: Ship 🚢 (Deploy Gate)

Chạy `/ship` — pre-deploy checklist cứng.

**Focus:** Build, Tests, Security, SEO basics, Cleanup.

**Hành vi:**
- `npm run build` → phải pass
- `vitest run` (client + server) → phải pass
- Security scan → phải pass
- SEO basics (nếu có route changes) → phải pass
- Cleanup check → phải pass

**Output gate:** GO / NO-GO

**Gate này là hard gate:** 1 item FAIL = NO-GO. Không tiếp tục.

---

## Tổng Hợp & Report

Sau khi chạy xong 5 gates, tổng hợp:

```
🚀 PRE-DEPLOY PIPELINE — HTCoachingWeb
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Gate 1/5] Audit Quick      ✅ Clean / ⚠️ X findings / ⏭️ SKIP
[Gate 2/5] AI Check         ✅ Pass / ⚠️ X findings / ⏭️ SKIP
[Gate 3/5] UI Check (?/40)  ✅ Pass / ⚠️ X findings / ⏭️ SKIP
[Gate 4/5] SEO Check        ✅ Pass / ⚠️ X findings / ⏭️ SKIP
[Gate 5/5] Ship             ✅ GO / ❌ NO-GO

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
