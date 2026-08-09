---
name: handoff
description: Tạo bàn giao context ngắn, durable và đã redact cho session/agent tiếp theo. Chỉ dùng khi user gọi `$handoff`, yêu cầu bàn giao, hoặc chủ động kết thúc một phase cần tiếp tục trong context mới.
---

# Handoff — HTCOACHINGWEB

Tạo continuation brief trong `docs/handoffs/`; không biến handoff thành bản sao của conversation.

## Quy trình

1. Đọc Git status/diff và artifact canonical liên quan: spec, plan, ADR, audit, QA evidence.
2. Chọn filename `docs/handoffs/YYYY-MM-DD-<topic>.md`; không ghi đè handoff có sẵn.
3. Reference artifact bằng path/URL thay vì chép nội dung đã tồn tại.
4. Ghi fact đã xác minh tách khỏi decision/open question.
5. Redact token, cookie, secret, credential, PII, health data và production payload.
6. Đưa ra đúng next command hoặc next skill để session mới bắt đầu được ngay.

## Template

```markdown
# Handoff: <topic>

## Read Order
1. <spec/plan/ADR chính>
2. <file/code hotspot cần đọc>

## Current State
- Branch/HEAD: <read-only fact>
- Working tree: <clean/dirty + in-scope files; không chép payload nhạy cảm>
- Completed: <behavior + evidence>

## Decisions
| Decision | Why | Canonical source |
|---|---|---|

## Open Work
1. <next vertical slice> — verify: `<command>`

## Blockers and Risks
- <blocker hoặc `None known`>

## Next Move
- Skill/command: `$<skill>` hoặc `<command>`
- Done when: <observable criterion>
```

## Guardrails

- Không tuyên bố test/build pass nếu không có output thật.
- Không lưu handoff tạm vào root repo hoặc nhúng raw logs dài.
- Không duplicate spec/plan/ADR; nếu source stale, cập nhật source trước rồi trỏ tới nó.
- Handoff không cấp quyền commit, push, deploy, migration hoặc external write.
- Nếu task hoàn thành hoàn toàn và không có continuation value, không tạo handoff chỉ để đủ thủ tục.
