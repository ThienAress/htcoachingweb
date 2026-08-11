# Tài liệu HTCOACHINGWEB

Tài liệu được tổ chức theo vai trò để giữ root `docs/` gọn và giúp tìm đúng
nguồn canonical trước khi thay đổi code.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `specs/` | Yêu cầu sản phẩm và quyết định nghiệp vụ canonical |
| `plans/` | Implementation plan đang hoặc sẽ được thực thi |
| `phases/` | Báo cáo, inventory và runbook gắn với Phase 0–10 |
| `audits/` | Audit codebase và contract xuyên lớp |
| `architecture/` | Thiết kế hạ tầng hoặc kiến trúc dùng lâu dài |
| `operations/` | Release checklist, production, staging và runbook vận hành |
| `reports/` | Báo cáo kỹ thuật không thuộc riêng một phase |
| `handoffs/` | Bàn giao context giữa các đợt làm việc |

## Điểm vào chính

- [Implementation plans](./plans/README.md)
- [Today Dashboard spec](./specs/today-dashboard.md)
- [Wellness targets spec](./specs/wellness-targets.md)
- [Trainer client workspace spec](./specs/trainer-client-workspace.md)
- [Workspace navigation spec](./specs/workspace-navigation.md)
- [Wallet/Account Query migration spec](./specs/wallet-account-query-migration.md)
- [Meal Scan spec](./specs/meal-scan.md)
- [Value-first public journey spec](./specs/value-first-public-journey.md)
- [SEO & Conversion Analytics spec](./specs/seo-conversion-analytics.md)
- [Meal Plan personalization and safety spec](./specs/meal-plan-personalization-and-safety.md)
- [Home section media management spec](./specs/home-section-media-management.md)
- [Agent workflow modernization spec](./specs/agent-workflow-modernization.md)
- [Upstream Skill Radar spec](./specs/upstream-skill-radar.md)
- [Sitewide AI Assistant context and guest access spec](./specs/sitewide-ai-assistant.md)
- [Explicit AI Memory pilot spec](./specs/ai-explicit-memory.md)
- [Service access policy spec](./specs/service-access-policy.md)
- [Service access and quota matrix 2026-08-07](./reports/service-access-matrix-2026-08-07.md)
- [SEO indexing remediation evidence 2026-08-10](./reports/seo-indexing-remediation-2026-08-10.md)
- [Architecture Decision Records](./architecture/adr/README.md)
- [AI Technology Radar](./architecture/ai-technology-radar.md)
- [Release checklist](./operations/release-checklist.md)
- [Incident runbook](./operations/runbooks/incident-runbook.md)
- [Today Dashboard Release B runbook](./operations/runbooks/today-dashboard-release-b.md)
- [Today Dashboard Phase 5–6 runbook](./operations/runbooks/today-dashboard-phase5-6.md)
- [Wellness targets runbook](./operations/runbooks/wellness-targets.md)
- [Today Dashboard completion audit 2026-07-29](./audits/today-dashboard-completion-audit-2026-07-29.md)
- [Security audit 2026-08-02](./audits/security-audit-2026-08-02.md)
- [Security coverage ledger 2026-08-02](./audits/security-coverage-ledger-2026-08-02.md)
- [Codex Security scan runbook](./operations/runbooks/codex-security-scan.md)
- [Security workflow skill drift audit 2026-08-02](./audits/2026-08-02-security-workflow-skill-drift.md)
- [Skill Radar audit 2026-08](./audits/2026-08-skill-radar.md)
- [Production rollback](./operations/runbooks/production-rollback-runbook.md)

## Quy ước

- File mới thuộc một phase phải đặt trong `phases/phase-XX/`.
- Spec và plan không đặt trong phase report; chúng có lifecycle riêng trong
  `specs/` và `plans/`.
- Khi di chuyển tài liệu, phải cập nhật cả Markdown links lẫn path được nhúng
  trong code, runbook hoặc output observability.
- Không lưu secret, dữ liệu production hoặc bản export database trong `docs/`.
