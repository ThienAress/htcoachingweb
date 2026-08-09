# Agent Workflow Modernization

## Objective

Nâng hệ thống agent của HTCOACHINGWEB bằng các pattern tốt từ `mattpocock/skills` mà không làm yếu
policy, security, Git safety, project-specific knowledge hoặc CI enforcement hiện có. Sau thay đổi,
user và Codex phải chọn đúng workflow nhanh hơn, dùng terminology nhất quán hơn và để lại artifact
đủ bền cho session sau.

## User Stories

1. Là maintainer, tôi muốn hỏi một router duy nhất để biết skill/flow tiếp theo, để không phải nhớ toàn bộ catalog.
2. Là Codex, tôi muốn biết skill nào được tự kích hoạt và workflow nào chỉ user được gọi, để tránh side effect ngoài ý muốn.
3. Là developer đang debug bug khó, tôi muốn có feedback loop red-capable và hypothesis falsifiable, để không sửa theo phỏng đoán.
4. Là người lập kế hoạch, tôi muốn task được chia theo behavior end-to-end, để mỗi slice có thể demo và verify độc lập.
5. Là team, tôi muốn glossary và ADR discipline gọn, để domain language và quyết định khó đảo ngược không chỉ nằm trong chat.
6. Là reviewer, tôi muốn Standards, Spec/Contract và Security/Operations được đánh giá tách biệt rồi tổng hợp theo severity.
7. Là agent tiếp quản, tôi muốn handoff trỏ tới artifact canonical và đã redact, để tiếp tục mà không sao chép context dài.
8. Là maintainer skill, tôi muốn validator phát hiện metadata/catalog/reference drift, để prompt policy quan trọng có enforcement.

## Workflow Decisions

- Giữ `AGENTS.md` và `.agents/rules/` là policy canonical; router và skill chỉ link, không chép lại policy.
- Tạo `ask-ht` như user-invoked router, không thực thi workflow và không tự ghi file ngoài artifact được user yêu cầu.
- Tách skill thành `user-invoked` hoặc `model-invoked` qua `agents/openai.yaml`.
- Áp dụng tight feedback-loop gate cho Deep Investigation; Quick Triage vẫn nhẹ khi lỗi rõ và repro trực tiếp.
- Chia task theo vertical behavior slice; số file là tín hiệu blast radius, không phải hard limit.
- `CONTEXT.md` chỉ là glossary nghiệp vụ. ADR nằm trong `docs/architecture/adr/`, chỉ dùng cho quyết định khó đảo ngược,
  gây bất ngờ nếu thiếu context và có trade-off thật.
- `code-review` có ba axis độc lập nhưng root reviewer phải deduplicate, xếp severity và đưa ra verdict tích hợp.
- `handoff` chỉ reference spec/plan/diff/evidence đã có, redact secret/PII và không thay thế source canonical.
- Dùng progressive disclosure: core workflow ở `SKILL.md`, chi tiết/example theo domain nằm trong `references/` khi cần.

## Boundaries

- Không import hoặc cài nguyên bộ skill upstream.
- Không cho skill tự commit, push, deploy, sửa issue tracker hoặc ghi secret.
- Không thay behavior runtime frontend/backend, schema, API, auth, payment, wallet, SEO hoặc dữ liệu.
- Không sửa/xóa thay đổi product đang có trong working tree.
- Không tạo duplicate policy giữa `AGENTS.md`, rules, reference và skills.

## Success Criteria

- Có router rõ cho feature, bug, schema, public page, AI và release workflows.
- Mọi skill user-invoked có `allow_implicit_invocation: false`; validator bắt drift metadata/router.
- Deep debugging, vertical slices, domain vocabulary, three-axis review và durable handoff có workflow thực thi được.
- Skill mới được khởi tạo/validate theo `skill-creator`; không có placeholder còn sót.
- `npm run agents:validate` và `git diff --check` pass.

## Out of Scope

- Issue-tracker triage state machine, Wayfinder và prototype branch workflow.
- Refactor toàn bộ 22 skill trong một lần; chỉ tách progressive disclosure ở hotspot trực tiếp thuộc thay đổi này.
- Product implementation hoặc release/deploy.
