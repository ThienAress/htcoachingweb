# HTCOACHINGWEB Agent Workflow Map

Đây là catalog/routing reference; policy canonical vẫn nằm trong `AGENTS.md` và `.agents/rules/`.
`ask-ht` đọc file này để chọn next move nhưng không tự thực thi.

## Main flows

| Situation | Flow |
|---|---|
| Task `SIMPLE`, behavior rõ | relevant primitive → focused verification → `$cleanup-delivery` |
| Feature còn decision/domain ambiguity | `$domain-modeling` → `$feature-spec` → implementation flow |
| Feature `MODERATE`/`COMPLEX` | `$feature-spec` → `$plan-template` → `$impact-check` → `$tdd-guide` → `$code-review` → `$cleanup-delivery` |
| Bug rõ, repro trực tiếp | `$debugging` Quick Triage → regression guard → `$cleanup-delivery` |
| Bug khó/performance/intermittent | `$debugging` Deep Investigation → `$tdd-guide` → `$impact-check` → `$code-review` |
| Mongoose schema | `$schema-change` + `$impact-check` → tests → `$code-review` |
| Public page/SEO | `$new-page` → `$seo-check` → `$cleanup-delivery` |
| AI Chat/tool | `$ai-chat-system` hoặc `$new-tool` → `$ai-check` → `$cleanup-delivery` |
| UI component/layout | `$ui-quality` → implementation → baseline regression `ui:audit` → rendered/manual `$ui-check` → `$cleanup-delivery` |
| Dịch vụ có quota/dùng thử/paywall | `$service-access-policy` → `$impact-check` → tests → `$code-review` → `$cleanup-delivery` |
| Production database backup/off-device restore | `$production-backup` → backup/restore runbook → recovery gates → `$cleanup-delivery` |
| Codebase health/periodic review | `$audit` → findings/plan backlog; không tự sửa nếu user chỉ yêu cầu review |
| PDF project artifact | `$pdf-generation` → focused verification → `$cleanup-delivery` |
| Theo dõi upstream skill/repo | user gọi `$skill-radar`; scan + audit draft, không tự sửa local canonical source |
| Skill/rule có dấu hiệu stale | user gọi `$goad`; audit draft trước, apply chỉ sau approval |
| Release candidate | user gọi `$pre-deploy`; pipeline điều phối `$qa`, checks và `$ship` |
| Production promotion | `$pre-deploy` target production → candidate manifest/recovery gate → protected approval → read-only post-deploy observation |
| Chuyển session/agent | user gọi `$handoff` sau khi cập nhật artifact canonical |

## Invocation catalog

`user` nghĩa là chỉ chạy khi user gọi rõ; `model` nghĩa là Codex có thể tự kích hoạt khi description khớp.

| Skill | Invocation | Role |
|---|---|---|
| `$ai-chat-system` | model | AI architecture reference |
| `$ai-check` | model | AI change gate |
| `$ask-ht` | user | workflow router |
| `$audit` | model | codebase health workflow |
| `$audit-playbook` | model | audit reference |
| `$cleanup-delivery` | model | final cleanup primitive |
| `$code-review` | model | three-axis review |
| `$debugging` | model | bug diagnosis primitive |
| `$domain-modeling` | model | glossary/ADR discipline |
| `$feature-spec` | model | feature specification workflow |
| `$goad` | user | approved skill-drift workflow |
| `$handoff` | user | session handoff workflow |
| `$impact-check` | model | dependency/contract tracing |
| `$known-issues` | model | intentional-workaround reference |
| `$new-page` | model | public page workflow |
| `$new-tool` | model | AI tool workflow |
| `$pdf-generation` | model | project PDF reference |
| `$plan-template` | model | durable implementation planning |
| `$pre-deploy` | user | full release orchestrator |
| `$production-backup` | model | production backup và off-device recovery workflow |
| `$qa` | model | build/test evidence owner |
| `$schema-change` | model | Mongoose schema workflow |
| `$service-access-policy` | model | access, quota và entitlement workflow |
| `$skill-radar` | user | upstream discovery và external drift review |
| `$seo-check` | model | SEO gate |
| `$ship` | model | release decision primitive |
| `$tdd-guide` | model | TDD/testing primitive |
| `$ui-check` | model | UI quality gate |
| `$ui-quality` | model | UI implementation reference |

## Routing rules

- Chọn flow nhỏ nhất đủ chứng minh thay đổi; không ép task `SIMPLE` qua spec/plan/release pipeline.
- Skill domain-specific thắng skill generic khi contract nhạy cảm.
- `pre-deploy` là user-controlled entry; gate con vẫn model-invoked để orchestrator gọi được.
- `skill-radar`, `goad` và `handoff` giữ user-controlled vì có lifecycle/side effect không nên tự khởi động từ một request gần nghĩa.
- Khi thêm/rename/xóa skill, cập nhật catalog, router-facing flow và `agents/openai.yaml` trong cùng diff.
