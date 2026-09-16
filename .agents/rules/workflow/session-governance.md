---
name: session-governance
description: Footer telemetry cục bộ và lựa chọn model có bằng chứng cho task Codex; không phải policy của HT Assistant.
---

# Session governance

## Cuối mỗi lượt trả lời trong project

Trước final, chạy đúng một lần:

```powershell
node .agents/skills/codex-session-governor/scripts/session-governor.mjs --footer
```

Helper dùng CODEX_THREAD_ID từ runtime; nếu không có, chỉ truyền `--thread-id`
từ tool/runtime xác minh đúng task hiện tại. Không chọn file mới nhất, không suy ID
từ title hoặc log task khác. Nếu không chạy được, vẫn trả lời việc chính và thêm
`Phiên: không xác định | model: không xác định | chưa đủ số liệu.`

Footer là số đo trước final (chưa gồm final). MB=bytes/1e6 tổng các phần rollout
cùng task đã xác minh header ID; gồm bản ghi trùng nếu Codex copy khi resume,
không tổng attachments/worker logs, không phải RAM/context/tokens hay tiền sử dụng.
Discovery nhận tên gốc và hậu tố resume `_session-id`; chỉ chọn file có mtime
mới nhất TRONG nhóm cùng threadId đã xác minh (không newest toàn máy). Count/path
trùng mơ hồ hoặc identity không đọc được phải unknown. Model/context lấy từ phần
đang cập nhật, không cộng context của các phần. Mỗi lần gọi đều stat/đọc lại,
không cache snapshot. Footer có giờ đo; nguồn >10phút phải ghi nguồn cũ, không xanh.
Tối đa32 candidate headers64KiB + tail4MiB của phần được chọn. Không đọc lại toàn chat.
Khi người dùng đổi High→Medium, chỉ xác nhận khi turn_context mới phản ánh Medium;
không suy từ cấu hình cũ. Sau final hiện tại, lượt sau sẽ đọc phần final đã ghi;
không có hook nền đảm bảo đo được sau khi model đã kết thúc lượt.
`ctx gần nhất` là ước lượng last input/window được log trong10phút, không live
context. Không trừ cached input, không lấy cumulative total làm context.
`model ghi nhận` là turn_context configuration, không chứng nhận backend routing.
Model/effort thiếu hoặc stale phải nói rõ, không suy ra từ model khuyến nghị.

Đây là best-effort instruction, không đảm bảo footer xuất hiện khi turn bị hủy,
app crash, model không tuân thủ hoặc môi trường không có rollout local.

## Khi nào nên tiếp tục/chuyển task

Ngưỡng bảo thủ, điều chỉnh được qua rule+tests; KHÔNG là giới hạn chính thức OpenAI:

| Tín hiệu quan sát | Khuyến nghị |
|---|---|
| ctx estimate <70%, log<50MB, không cluster compaction gần đây, telemetry đủ | Có thể tiếp tục; không bảo đảm chất lượng |
| ctx>=70% hoặc log>=50MB hoặc >=3 canonical compaction trong15phút được scan | Chuẩn bị checkpoint, thu gọn output |
| ctx>=85% hoặc log>=200MB hoặc user/agent xác minh history/resume lỗi | Khuyên task mới sau checkpoint an toàn |
| Context/model không xác định, chưa có tín hiệu rủi ro rõ | Chưa đủ số liệu; không tự gắn xanh |

Không xem tổng số compaction hay `interrupted` là corruption. Count từ bounded tail
chỉ là phần quan sát được; ngưỡng không chứng minh nguyên nhân lỗi UI hoặc chất lượng
suy giảm. Kết thúc slice an toàn, đề xuất `$handoff`; chỉ thực thi handoff/task mới
khi có yêu cầu phù hợp. Không tự archive/xóa/rewrite/compact lịch sử, không bật hooks.

## Model theo việc, không theo thói quen

Với yêu cầu mới, đánh giá complexity theo task-orchestration, kèm risk và độ dễ verify.
Gợi ý hiện tại (2026-09-09):

- Lookup rõ, cơ học, ít rủi ro và verify dễ: Luna low/medium.
- Implementation thường: Terra medium.
- Planning/debug phức tạp: Sol high/xhigh làm điểm bắt đầu; nhiều mơ hồ, yêu cầu
  độ tỉ mỉ cao, khó verify hoặc rủi ro cao xuyên nhiều layer → Astra high/xhigh.
- Security review, Auth/CSRF/JWT/ownership/secrets hoặc critical: Astra high/xhigh
  theo preference user; không hạ security review để tiết kiệm.

Ưu tiên explicit user model/effort; nếu conflict với mức rủi ro, giải thích và hỏi,
không tự thay. Các model trên là recommendation, không lời hứa rẻ hơn mỗi task.
Ultra chỉ cân nhắc cho workstreams thực sự độc lập và host hỗ trợ; không mặc định
cho mọi plan. Kiểm tools/runtime model/effort availability trước dispatch, không
đổi config global hoặc tự tạo conversation chỉ để đổi model.

Không thể tự thay root model của lượt đang chạy bằng văn bản/skill. Nếu host không
có switch hợp lệ, đề nghị user chọn model cho lượt tiếp theo. Việc trivial root đã
đọc đủ thì làm luôn; không spawn agent chỉ để tìm một symbol hay đổi nhãn model.
Delegation vẫn tuân quyền môi trường và task-orchestration, chỉ cho subtask độc lập.
Worker được override phải có prompt giới hạn, không full-history fork gây nặng log.

## Conditional dispatch đã được user yêu cầu

Trong project này, chủ động dùng subagent phù hợp khi TẤT CẢ điều kiện đạt:
phần việc độc lập; đủ lớn để bù chi phí giao/đọc/review; input context giới hạn;
output có verification cụ thể; root vẫn có việc hữu ích làm song song; môi trường
cho phép. Không yêu cầu user nhắc lại giao agent mỗi lần đạt gate. Đây không phải
quyền vượt chính sách system/developer hoặc quyền product mutation.

Root giữ model user chọn ở thanh chat, kế hoạch tổng thể, tích hợp và kết luận.
Một hoặc hai lệnh tìm file/symbol, typo hoặc việc root đã biết → làm trực tiếp.
Không chia thành nhiều microtask chỉ để dùng model rẻ, không chạy trùng worker
và root cùng investigation, không tạo task sidebar riêng qua create_thread.

Vai trò repo-local trong `.codex/agents/`:

Role planning/exploration/security chỉ đọc; không giao implementation vào role
read-only chỉ vì cùng model. Với implementer cần model cao hơn default Terra,
dùng explicit model dispatch + ownership (helper đánh dấu explicitModelDispatchRequired),
không gọi named role fixed-Terra rồi báo đã dùng Astra/Sol.

| Vai trò | Model/effort mặc định | Phạm vi |
|---|---|---|
| ht-explorer | Luna low | Tra cứu đủ lớn, độc lập, read-only |
| ht-implementer | Terra medium | Implement scope rõ, tests, file ownership |
| ht-planner | Sol high | Phân tích/plan khó nhưng bounded, read-only |
| ht-architect | Astra xhigh | Plan rất tỉ mỉ, nhiều mơ hồ/khó đảo ngược |
| ht-security | Astra xhigh | Review trust boundary/security, read-only |

Khi host có named custom agents, dùng đúng role và capability metadata. Khi tool
chỉ có explicit model override, gọi spawn với model+reasoning_effort đã chọn và
`fork_turns="none"`, prompt tự chứa scope, files, allowed actions, verify và
return format. Không đoán tên tham số; dùng schema tool thực tế. Các file TOML
là cấu hình cho client hỗ trợ custom agents, không chứng minh hot-load ở task đang mở.

Có thể dùng `planWorker` trong `scripts/worker-routing.mjs` của skill để lập
dispatch plan với các cờ gate và danh sách model/effort từ runtime. Helper không
spawn; root phải thực sự gọi tool rồi kiểm outcome. Không truyền hardcoded danh
sách availability như bằng chứng mới. Nếu override rõ của user chỉ cho root,
worker vẫn theo routing; nếu user yêu cầu mọi phần dùng một model thì giữ đúng.

Trước dispatch báo ngắn vai trò/model được yêu cầu. Sau dispatch không khai actual
từ TOML: dùng metadata execution nếu có, không có thì ghi requested/unverified.
Model không available/effort unsupported → không thử mù hoặc lặng lẽ fallback;
root tự làm nếu đủ năng lực hoặc hỏi model khác. Failure do thiếu dữ liệu/tool/
permission không chữa bằng tăng model. Nếu do năng lực, dùng1 lần escalation có
bằng chứng; tránh lặp vòng worker, tổng retry vẫn theo task-orchestration.

Chi phí thực = root điều phối + worker model/tool + root review + retry. Tổng
token có thể tăng nhưng chi phí quy đổi khác theo model/cache; không hứa ít token,
ít tiền hoặc ít hạn mức hơn. Chưa có benchmark đo thì chỉ nói kỳ vọng, không % tiết kiệm.

Nếu nhiều model tham gia, báo `điều phối` và `worker` riêng; chỉ ghi executed khi có
execution metadata/receipt của đúng worker/turn. Spawn request chỉ là requested;
không xác nhận được thì ghi requested/unverified. Không coi turn_context history
của root là danh sách tất cả worker. Không tự học routing từ vài pass tự khai.

## Giữ chi phí context nhỏ

Search paths/symbols trước → đọc đúng section. Output dài có byte/token cap; lưu
artifact test ở local rồi chỉ đưa failure summary vào context. Không dump toàn bộ
JSONL một dòng lớn. Giới hạn output không được dùng để đọc thiếu SKILL bắt buộc:
file instruction phải đọc hết, chia call nếu cần. Không lặp đọc các file đã biết
chưa thay đổi trong cùng task. Không đổi system prompt theo upstream.
