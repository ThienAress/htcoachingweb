---
name: audit
trigger: /audit
description: Quét proactive codebase tìm vấn đề ẩn (bugs, security, performance, test gaps, tech debt, dependencies, DX). Chạy khi muốn health-check project trước khi push lớn hoặc review định kỳ. Bổ sung /ship (gate trước deploy) bằng cách phát hiện vấn đề sâu hơn.
---

# /audit — Quét Codebase Tìm Vấn Đề Ẩn

> **Nguyên tắc:** AI là advisor — quét, phân tích, report findings, viết plans.
> AI vẫn **implement trực tiếp** nếu user yêu cầu (KHÔNG áp dụng rule "never modify code" của improve gốc).

---

## Cách Chạy

| Lệnh | Mô tả |
|-------|--------|
| `/audit` | Full audit — 7 categories, key files |
| `/audit quick` | Chỉ hotspots, top ~5 findings, HIGH confidence only |
| `/audit security` | Chỉ quét security category |
| `/audit perf` | Chỉ quét performance category |
| `/audit tests` | Chỉ quét test coverage |
| `/audit <category>` | Chỉ quét 1 category cụ thể |

---

## Workflow — 4 Phases

### Phase 1: Recon (Luôn chạy)

Map territory trước khi đánh giá:

1. Đọc `GEMINI.md` — nắm architecture, patterns, conventions, known issues
2. Đọc `package.json` (client + server) — dependencies, scripts
3. Đọc `server.js` — route registrations, middlewares
4. Đọc `client/src/App.jsx` — routes, lazy loading
5. Check `.agents/skills/reference/known_issues.md` — biết cái gì by-design
6. `git log --oneline -20` — xem files đang active thay đổi (hotspots)

**Output Recon:**
```
📋 RECON — HTCoachingWeb
━━━━━━━━━━━━━━━━━━━━━━━
Stack: React 19 + Vite 8 | Express 5 + Mongoose 9 | MongoDB
Build: cd client && npm run build
Dev:   cd client && npm run dev | cd server && npm run dev
Tests: ⚠️ Chưa có
Hotspots: [top 5 files thay đổi gần đây]
Known Issues: [7 items từ known_issues.md]
━━━━━━━━━━━━━━━━━━━━━━━
```

### Phase 2: Audit

Đọc `.agents/skills/quality/audit-playbook.md` và quét theo depth level:

**Quick:**
- Chỉ quét hotspots (files churn cao) + critical paths (auth, payment, wallet)
- 3 categories: Security + Bugs + Tests
- Output: Top ~5 findings, HIGH confidence only

**Standard:**
- Quét key packages: routes, controllers, services, models, middlewares, hooks, pages chính
- 7 categories: Bugs, Security, Performance, Tests, Tech Debt, Dependencies, DX
- Output: Full findings table

**Focused (security/perf/tests/...):**
- 1 category, quét sâu

### Phase 3: Vet & Prioritize

**Trước khi trình bày — vet mọi finding:**

1. **Mở code tại file:line cited** — confirm finding đúng
2. **Loại false positives** — check by-design list trong audit-playbook
3. **Loại mis-attributed** — finding đúng nhưng sai file/line → sửa
4. **Loại duplicates** — cùng vấn đề report nhiều lần
5. **Xếp hạng** — `leverage = impact ÷ effort × confidence`

### Phase 4: Report & Act

Trình bày findings table:

```markdown
🔍 AUDIT REPORT — HTCoachingWeb
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Depth: standard | Audited: routes, controllers, services, models, middlewares
Not audited: client/src/sections/ (landing page sections)

| # | Finding | Category | Impact | Effort | Risk | Evidence |
|---|---------|----------|--------|--------|------|----------|
| 1 | ...     | security | HIGH   | S      | LOW  | file:line |
| 2 | ...     | bugs     | HIGH   | M      | MED  | file:line |
| 3 | ...     | perf     | MED    | S      | LOW  | file:line |

Considered and rejected:
- [SEC-01] inline imports server.js → by-design
- [TD-01] TrainerCoaching.jsx 50K → known issue, chưa ưu tiên

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Bạn muốn tạo plan cho findings nào? (Gợi ý: #1, #2, #3)
Hoặc nói "fix #1" để tôi implement trực tiếp.
```

**Sau khi user chọn:**

| User nói | AI làm |
|----------|--------|
| "plan #1, #3" | Viết plans theo `plan-template.md` vào `plans/` folder |
| "fix #1" | Implement trực tiếp (không cần plan cho task nhỏ) |
| "plan tất cả" | Viết plans cho tất cả findings |

---

## Reconcile — Quản Lý Backlog Plans

Khi user gõ `/audit reconcile` hoặc "check lại plans":

Đọc `plans/README.md` và mỗi plan file, xử lý theo status:

| Status | Action |
|--------|--------|
| **DONE** | Spot-check done criteria còn hold không. Mark verified |
| **BLOCKED** | Investigate obstacle. Rewrite plan hoặc mark REJECTED |
| **IN PROGRESS** (stale) | Flag cho user — có thể bị abandoned giữa chừng |
| **TODO** | Check drift — code đã thay đổi? Finding còn tồn tại? Refresh hoặc mark REJECTED ("fixed independently") |

**Output:**
```
🔄 RECONCILE — plans/
━━━━━━━━━━━━━━━━━━━━
✅ DONE (verified): 001, 003
🔄 REFRESHED: 002 (code changed, updated excerpts)
❌ REJECTED: 004 (fixed independently in commit abc123)
🚀 READY TO EXECUTE: 002, 005
```

---

## Kết Hợp Với /ship

`/audit` và `/ship` bổ sung nhau:

| `/audit` | `/ship` |
|----------|---------|
| **Proactive** — tìm vấn đề sâu | **Gate** — checklist trước deploy |
| Chạy **khi muốn** (weekly, monthly) | Chạy **mỗi lần deploy** |
| Output: findings + plans | Output: GO / NO-GO |
| Quét toàn bộ codebase | Quét chỉ code thay đổi |

**Flow khuyến nghị:**
```
/audit quick → fix findings → code features → /ship → deploy
```
