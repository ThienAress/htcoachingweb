# Nguồn và quyết định — xác minh 2026-09-09

Đã đọc tài liệu chuyên gia `toiuu.txt` do user đưa; không nhận có zip/code đã tồn tại
chỉ vì tài liệu nói đã build. Không tải/cài bất kỳ upstream nào.

## Official guidance

- [Codex Models](https://learn.chatgpt.com/docs/models): Luna cho việc rõ/lặp lại,
  Terra thường ngày, Sol phức tạp, Astra end-to-end khó. Lowest effective effort;
  Max/Ultra không cần cho đa số task. Ultra có delegation; không coi là phép
  so sánh tuyến tính Sol Ultra = Astra XHigh.
- [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents): mặc
  định kế thừa model/effort; override phải hợp lệ với host. Supported efforts
  giữa API, app picker và custom agent có thể khác nhau.
- [App Server](https://learn.chatgpt.com/docs/app-server): tokenUsage notifications,
  contextCompaction lifecycle và model/rerouted là metadata riêng. Không có hướng
  dẫn MB→quality hoặc ngưỡng six compactions=corruption.
- [Model guidance](https://developers.openai.com/api/docs/guides/latest-model):
  capability/cost per token không thay measured cost per completed task.

Local rollout thực tế có session_meta.id, turn_context.model/effort/turn_id,
event_msg.token_count.info.last_token_usage.input_tokens/model_context_window.
Định dạng nội bộ có thể đổi; helper fail unknown, không sửa log. last_input là
proxy estimate trước call, không tương đương live active context đầy đủ.

## Repo user nêu — mức review README/AGENTS, không audit toàn source

| Repo | Học gì | Không đưa vào project |
|---|---|---|
| [openai/codex](https://github.com/openai/codex/blob/main/AGENTS.md) | nguồn upstream về client, tránh reset/injection lớn không cần thiết | policy Rust/build riêng không áp cho HT |
| [oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex) | metadata HUD, bounded teams, cảnh báo over-orchestration | cài framework/hook/config, yolo, thay AGENTS; README hiện nói fresh default Astra nên không coi là sẵn cheap-router |
| [openai/plugins](https://github.com/openai/plugins) | packaging ecosystem | không cần plugin cho một skill repo-local |
| [agents-md](https://github.com/Austin1serb/agents-md) | byte cap output, đọc section thay whole file | replace system prompt; claim tiết kiệm50% chưa benchmark trên HT |
| [awesome-context-engineering](https://github.com/yzfly/awesome-context-engineering) | danh mục phương pháp để học tiếp | không phải bằng chứng lỗi chat hiện tại hoặc lý do cài RAG |
| [codex-model-router](https://github.com/capitalparser/codex-model-router) | requested/observed, bounded workers, evidence-gated routing | không auto-dispatch hoặc tự học policy từ mẫu ít/pass tự khai |

Không lưu stars vì không giúp contract và thay đổi theo thời gian. Không khẳng định
openai/skills deprecated hoặc Stop hook lỗi từ tư vấn khi chưa xác minh nguồn phù hợp.
V1 không phụ thuộc hooks nên không cần dùng các claim đó để quyết định.

## Follow-up conditional delegation

Ngày2026-09-09 user yêu cầu nối recommendation tới worker thực tế. Theo docs
Subagents, project instructions có thể yêu cầu delegation và custom agent
`.codex/agents/*.toml` dùng name/description/developer_instructions/model/
model_reasoning_effort. Dùng prefix ht- tránh override built-in explorer.
Read-only role không mở quyền writes; implementer kế thừa sandbox parent.
Không thêm `[agents]` default model toàn cục vì sẽ đẩy mọi worker về một model.
Official docs lưu ý subagents dùng nhiều token hơn comparable single-agent run;
không quy token thành chi phí cố định hoặc quota saving chưa đo.

## Khác biệt với tư vấn

- 50/200MB và70/85% là default heuristic bảo thủ có tests, không số đo khoa học.
- Tổng compaction trong cả task không đủ để kết luận mất chất lượng; chỉ cluster
  quan sát gần đây nhắc checkpoint. Interrupted có thể là user stop.
- Tail4MiB + header64KiB, line cap256KiB; bounded memory/read và không thêm raw
  transcript vào context. MB exact snapshot, counts có coverage partial.

Fix thực tế09/09: Codex resume tạo filename chứa `_session-id` sau threadId.
Helper cũ bỏ file này nên đọc phần frozen; đây là bug discovery của helper,
không phải bằng chứng Codex ngừng ghi hoặc cần nhiều câu hỏi mới có telemetry.
Hiện hỗ trợ tối đa32 header của các phần cùng ID đã xác minh và chỉ tail phần
mới nhất; giới hạn read toàn bộ discovery cao hơn bản đầu nhưng vẫn bounded.
- Footer luôn qua rule; skill chỉ nâng workflow. Không hook đảm bảo tuyệt đối.
- Script Node native hợp repo hơn bộ Python chưa được cung cấp.
- Không ledger mới: metadata native đủ cho v1; worker executed cần log/receipt riêng.
- Không sửa bug Codex, không dùng kích thước log làm kết luận nguyên nhân; case chat
  cũ chỉ chứng minh raw log vẫn còn trong khi history reader/UI không phản ánh đủ.
