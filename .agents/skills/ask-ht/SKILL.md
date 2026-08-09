---
name: ask-ht
description: Định tuyến user tới skill hoặc workflow phù hợp của HTCOACHINGWEB mà không tự thực thi. Chỉ dùng khi user gọi `$ask-ht` hoặc hỏi rõ nên dùng skill/flow nào tiếp theo.
---

# Ask HT

Đóng vai trò router, không phải executor. Đọc request, trạng thái repo và
[workflow map](../../reference/agent-workflow-map.md), sau đó đưa ra đúng next move có chi phí thấp nhất.

## Quy trình

1. Đọc `AGENTS.md`, Git status và instruction gần file đang xét.
2. Phân loại `SIMPLE`, `MODERATE` hoặc `COMPLEX` theo task-orchestration rule.
3. Xác định phase hiện tại: discovery, spec, plan, implementation, debugging, review, QA hay release.
4. Chọn một flow trong workflow map. Không liệt kê toàn catalog khi một next move đã rõ.
5. Trả lời theo format:

```text
Next move: $<skill>
Vì sao: <một câu dựa trên task/repo>
Tạo ra: <artifact hoặc evidence>
Sau đó: $<skill kế tiếp> | direct implementation | done
```

## Guardrails

- Chỉ định tuyến; không tự gọi skill, sửa file, tạo issue, commit, push hoặc deploy.
- Ưu tiên flow ngắn nhất đủ an toàn. Task `SIMPLE` không bị ép qua full ceremony.
- Khi request khớp skill domain bắt buộc (`schema-change`, `new-page`, `new-tool`), route trực tiếp tới skill đó.
- Nếu thiếu fact có thể đọc từ repo, nêu fact cần kiểm tra trong next move; không hỏi user thay cho việc tra cứu.
- Nếu nhiều skill cùng phù hợp, chọn orchestrator hoặc primitive gần phase hiện tại nhất.
- Không để router thành source policy. Khi map và `AGENTS.md` khác nhau, `AGENTS.md` thắng và phải báo drift.
