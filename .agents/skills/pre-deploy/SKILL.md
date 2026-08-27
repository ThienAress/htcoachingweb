---
name: pre-deploy
description: Pipeline điều phối 7 gates trước push/deploy; gom findings, tái sử dụng QA evidence và áp release-promotion contract trước khi kết luận READY theo target.
---

# $pre-deploy — Full Release Pipeline

`$pre-deploy` điều phối các workflow chuyên trách. Nó không chép hoặc chạy trùng logic build/test của `$qa`, và không thay quyền quyết định cuối của `$ship`.

Trước khi chạy, khai báo target `staging` hoặc `production` và đọc policy canonical
`.agents/rules/workflow/release-promotion.md`. Commands/evidence lifecycle nằm tại
`docs/operations/runbooks/release-promotion.md`.

Các gate độc lập có thể chạy song song khi không phụ thuộc nhau. Gate 7 chỉ chạy sau khi đã gom evidence. Nếu một gate fail, vẫn có thể hoàn tất các kiểm tra read-only an toàn để báo cáo đầy đủ; tuyệt đối không deploy.

---

## Cách Chạy

| Lệnh | Mô tả |
|-------|--------|
| `$pre-deploy` | Full pipeline — 7 gates, có thể song song các gate độc lập |
| `$pre-deploy skip-audit` | Chỉ bỏ qua khi có report hợp lệ cho đúng working tree |
| `$pre-deploy skip-ai` | Bỏ qua khi diff không chạm hệ thống AI |
| `$pre-deploy skip-qa` | Chỉ bỏ qua khi có release QA evidence hợp lệ cho đúng working tree |
| `$pre-deploy skip-ui` | Bỏ qua khi diff không chạm UI/layout/CSS/interaction |

---

## Pipeline Flow

`$audit quick` → `$ai-check` → `$qa` → `$ui-check` → `$seo-check` → `npm run agents:validate` → `$ship`.

Gom findings và evidence sau sáu gate đầu. Fix/invalidate/re-check phần bị ảnh hưởng, sau đó để `$ship` quyết định `GO`, `GO WITH WARNINGS` hoặc `NO-GO`.

---

## Gate 1: Audit Quick 🔍 (Code Quality)

Chạy `$audit quick` — quét hotspots, top findings, HIGH confidence only.

**Focus:** Bugs, Security và Tests trong code thay đổi gần đây.

**Hành vi:**
- Quét files có churn cao (git log)
- Quét critical paths (auth, payment, wallet, contract)
- **Security focus:** IDOR patterns (`findById` không kèm ownership check), timing-safe CSRF, CSP headers, PII trong logs
- Chỉ báo findings có confidence HIGH

**External Codex Security evidence (risk-based):**

- Routine changes: dùng local/CI gates, ghi `SKIP (policy does not require paid scan)`.
- Auth/payment/wallet, release lớn hoặc trust boundary mới: bắt đầu bằng bounded working-tree/diff/path.
- Full/deep chỉ khi bounded evidence/threat model yêu cầu và có explicit scope + cost authority.
- Dùng wrapper/runbook; không thêm automatic paid scan vào CI.
- Ghi đúng trạng thái `SKIP`, `PREFLIGHT ONLY`, `COMPLETE`, `PARTIAL/BLOCKED`.
- `PREFLIGHT ONLY` không phải PASS. Nếu release plan bắt buộc completed scan mà scan chưa complete, gate BLOCKED.

**Output gate:** Findings table hoặc "Clean ✓"

**Không dừng pipeline khi có findings** — gom lại, tiếp tục gate tiếp theo.

---

## Gate 2: AI Check 🤖 (AI Chat System)

Chạy `$ai-check` — kiểm tra hệ thống HT Assistant.

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

## Gate 3: QA Evidence 🧪

Chạy `$qa` đúng một lần. `$qa` sở hữu release build, client unit tests, server unit/integration tests và trạng thái E2E.

**Output gate:** QA evidence theo contract tại `.agents/skills/qa/SKILL.md`.

- Không dùng `$qa quick` làm release evidence.
- Chỉ skip khi đã có evidence đúng `HEAD`, working tree, scope và chưa hết hạn.
- Chuyển nguyên evidence sang Gate 7; `$ship` không chạy lại build/tests nếu working tree chưa thay đổi.
- E2E phải là `PASS`, hoặc `SKIP` kèm lý do và đánh giá rủi ro; không được báo pass giả.

---

## Gate 4: UI Check 🎨 (Design Quality)

Chạy `$ui-check` — quét toàn bộ UI theo 8 dimensions.

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

Chạy `$seo-check` — quét tất cả trang public.

**Focus:** SEO component, JSON-LD, Internal Links, Sitemap, Prerender, AI SEO.

**Hành vi:**
- Thu thập danh sách routes public
- Check từng trang theo 6 dimensions
- So sánh routes vs sitemap vs prerender

**Output gate:** Pass/Fail per page + findings table

**SKIP khi:** Không có thay đổi liên quan đến routes hoặc public pages.

---

## Gate 6: Agent-System Validation 📡

Chạy validator canonical; không hardcode lại danh sách skill hoặc tên tài liệu trong workflow này:

```bash
npm run agents:validate
```

Validator kiểm tra cấu trúc, frontmatter, references, commands và các drift có thể tự động phát hiện trong `AGENTS.md`/`.agents/`.

- Exit code khác `0`: gate `FAIL`, release `NO-GO`.
- Warning MED/LOW không làm gate fail nếu được document đầy đủ.
- Không skip trước release.
- Không tự rewrite skill trong pipeline; dùng `$goad` trong task riêng sau khi user duyệt.

---

## Gate 7: Ship 🚢

Chạy `$ship` với QA evidence từ Gate 3, SEO report từ Gate 5 và toàn bộ findings đã gom.

`$ship` validate evidence rồi chạy security, cleanup và release decision. Nếu `$ship` chạy lại build/tests dù evidence còn hợp lệ, đó là lỗi workflow.

- Target `staging`: chưa yêu cầu live acceptance; kết quả tối đa là `GO FOR STAGING`.
- Target `production`: bắt buộc có per-release candidate manifest từ
  `Staging Live Acceptance`, exact SHA/deploy IDs, cleanup residue `0`, current
  release + off-device recovery và rollback IDs. Chạy candidate verifier theo
  release runbook; thiếu evidence là `NO-GO FOR PRODUCTION`.
- Không chạy acceptance mutating lên production và không coi report lịch sử là
  candidate evidence hiện tại.

**Output gate:** `GO FOR STAGING`, `GO`, `GO WITH WARNINGS` hoặc `NO-GO`, tùy target.

- Gate bắt buộc `FAIL`/`BLOCKED`, hoặc còn `BLOCK`/`HIGH` → `NO-GO`.
- MED chỉ được chấp nhận khi gate vẫn pass và có evidence, residual risk, lý do, owner, follow-up.
- MED không được dùng để hạ cấp build/test/security failure.

---

## Tổng Hợp & Report

Sau khi chạy xong 7 gates, tổng hợp:

```
🚀 PRE-DEPLOY PIPELINE — HTCoachingWeb
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Gate 1/7] Audit Quick      ✅ Clean / ⚠️ X findings / ⏭️ SKIP
[Gate 2/7] AI Check         ✅ Pass / ⚠️ X findings / ⏭️ SKIP
[Gate 3/7] QA Evidence      ✅ PASS (valid) / ❌ FAIL / ⛔ BLOCKED
[Gate 4/7] UI Check (?/40)  ✅ Pass / ⚠️ X findings / ⏭️ SKIP
[Gate 5/7] SEO Check        ✅ Pass / ⚠️ X findings / ⏭️ SKIP
[Gate 6/7] Agent Validation ✅ PASS / ⚠️ PASS WITH WARNINGS / ❌ FAIL
[Gate 7/7] Ship             ✅ GO FOR STAGING / GO / ⚠️ GO WITH WARNINGS / ❌ NO-GO
Release target              staging | production
Promotion evidence          ⏳ post-staging / ✅ current candidate / ❌ missing-stale-mismatch

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 ALL FINDINGS (X total, sorted by severity)

| # | Gate | Finding | File | Severity | Category |
|---|------|---------|------|:--------:|----------|
| 1 | QA | Release build failed | - | 🔴 BLOCK | Build |
| 2 | Audit | Missing CSRF on route | file:line | 🔴 HIGH | Security |
| 3 | AI | Prompt links to /online-coaching | systemPrompt.js | 🔴 HIGH | AI |
| 4 | UI | Bounce easing in Hero | file:line | 🔴 HIGH | Slop |
| 5 | SEO | Missing JSON-LD | file | 🟡 MED | SEO |
| 6 | UI | Gray text on color bg | file:line | 🟡 MED | Color |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 BLOCKING (must fix before push):
- #1 Build failed — fix build errors first
- #2 Missing CSRF — add csrfProtection middleware
- #3 AI prompt exposes restricted route — correct prompt policy
- #4 Critical UI violation — fix before release

⚠️ SHOULD FIX (strongly recommended):
- #5 Missing JSON-LD — add Article schema or document accepted MED
- #6 Gray on color — correct contrast or document accepted MED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULT: ❌ NOT READY — Gate fail hoặc còn BLOCK/HIGH
        ⚠️ READY WITH WARNINGS — All required gates pass; MED documented
        ✅ READY TO PUSH — All required gates pass, no significant findings
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
- Có findings 🟡 MED với evidence, residual risk, reason, owner và follow-up
- Ship gate = GO WITH WARNINGS

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
| "skip #5, push" | Document MED đầy đủ; chỉ GO WITH WARNINGS nếu mọi gate pass và không còn 🔴 |

**Sau khi fix → AI tự động:**
1. Invalidate evidence bị ảnh hưởng bởi diff mới
2. Re-check chỉ gate/lệnh bị ảnh hưởng và tạo evidence mới
3. Chạy lại `$ship` với evidence cập nhật
4. Cập nhật report → confirm READY hoặc còn findings

---

## Khi Nào Chạy

| Tình huống | Lệnh |
|------------|-------|
| Trước khi push code lên remote | `$pre-deploy` target `staging` |
| Trước khi deploy staging | `$pre-deploy` target `staging`; sau deploy chạy Staging Live Acceptance |
| Trước khi deploy production | `$pre-deploy` target `production` với candidate artifact hiện tại |
| Chỉ sửa backend, muốn nhanh | `$pre-deploy skip-ui` |
| Vừa chạy audit xong, muốn tiếp | `$pre-deploy skip-audit` |
| Chỉ muốn check 1 thứ | `$audit`, `$ui-check`, `$seo-check`, `$ship` riêng lẻ |
