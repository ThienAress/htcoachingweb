---
name: codex-session-governor
description: Đo log và metadata context/model của task Codex, đề xuất checkpoint/model và chuẩn bị chuyển phiên; dùng khi user hỏi sức khỏe phiên, model theo độ khó hoặc footer định kỳ, không dùng để debug HT Assistant.
---

# Codex Session Governor

Policy canonical: [session governance](../../rules/workflow/session-governance.md).
Đọc policy trước khi khuyến nghị; footer thông thường chỉ chạy helper theo AGENTS,
không đọc thêm toàn bộ references mỗi lượt.

## Đo và báo cáo

```powershell
node .agents/skills/codex-session-governor/scripts/session-governor.mjs --footer
node .agents/skills/codex-session-governor/scripts/session-governor.mjs --task-type planning --risk medium --complexity complex
```

CLI mặc định JSON metadata đã lọc; `--footer` in một dòng. Dùng `--thread-id` nếu
runtime không có CODEX_THREAD_ID, nhưng ID phải được xác minh. `--rollout` là path
explicit vẫn bắt buộc header session_meta.id khớp ID; `--codex-home` chỉ đổi nơi
tìm. Không fallback newest, không đọc auth/config/state.db hoặc raw message/tool text.

Khi user báo lỗi hiển thị thật: `--symptom history-broken`; lỗi resume được xác minh:
`--symptom resume-failed`. Không suy triệu chứng từ một `turn_aborted`.

Đọc `coverage`, timestamp và source trước giải thích. Log lớn + tail incomplete
không cho biết tổng compaction hoặc mọi model. Context estimate stale/reset/missing
phải là unknown. Footer phải nói model ghi nhận, không chứng thực backend execution.

## Model recommendations

Task types: lookup, mechanical, implementation, planning, debugging, security.
Risk: low,medium,high,critical. Complexity: simple,moderate,complex.
Traits: precision normal/high, ambiguity normal/high, verifiability low/high.
Ví dụ plan đặc biệt tỉ mỉ:
`--task-type planning --risk high --complexity complex --precision high` → Astra xhigh.
`recommended` là advisoryOnly, hoàn toàn tách khỏi `model` và `modelHistory`.
Security ưu tiên Astra theo user. Luôn kiểm explicit model choice và available
host efforts trước dispatch; không tự switch root, tạo task hoặc bật Ultra.

User đã yêu cầu **conditional multi-model delegation**. Đọc mục Conditional
dispatch trong rule và áp dụng gate: independent/substantial/bounded/verifiable,
runtime cho phép và root có useful local work. Khi đạt, thực sự spawn role/model
phù hợp, không dừng ở recommendation. Khi không đạt, root làm trực tiếp.
`.codex/agents/ht-*` có role/model native; tool explicit override dùng model và
effort tương ứng với fork context bounded. `scripts/worker-routing.mjs` xuất
`planWorker(input)` để test/lập kế hoạch dispatch; không phải daemon tự đổi model.

Nếu có worker, inspect đúng rollout/turn của worker khi có ID, báo scope riêng.
Requested model không được biến thành actual. Không ghi ledger thủ công như bằng
chứng thực thi; v1 dùng metadata native read-only, không tạo bản sao chat/PII.

## Checkpoint

File resume có hậu tố `_session-id` được kiểm header cùng threadId; chọn phần
cập nhật gần nhất trong đúng task. Footer MB tổng các phần, context/model từ
phần đang ghi và luôn có giờ đo. Nguồn cũ không được diễn giải là current.

Khi helper khuyên task mới, nêu lý do heuristic + trạng thái việc chính. Đề xuất
handoff ngắn qua workflow đã có, không copy log. Không tạo task mới hoặc handoff
file khi user chưa yêu cầu phù hợp; footer không mở rộng authority.

## Maintenance / tests

Đọc [sources and decisions](references/sources-and-decisions.md) khi thay policy
model/context; ưu tiên docs chính thức và runtime thật, không lấy stars làm chất lượng.

```powershell
node --test .agents/skills/codex-session-governor/scripts/session-governor.test.mjs
node --test .agents/skills/codex-session-governor/scripts/worker-routing.test.mjs
npm run agents:validate
```

Không cài hook/global profile/dependency mới. Chỉ skill/rule project HTCOACHINGWEB;
muốn áp dụng mọi project cần user yêu cầu riêng cho global AGENTS/installation.
