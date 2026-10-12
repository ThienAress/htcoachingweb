# HT Assistant LLM threat matrix

Đọc reference này khi thay prompt/context, provider, RAG/embedding, tool, output renderer, logging, quota hoặc retention.
Mỗi risk phải map tới entry point, guard thật và focused test. Thiếu evidence là `proof gap`, không phải PASS.

| Risk | Entry points của project | Guard/evidence hiện có | Check bắt buộc khi thay đổi |
|---|---|---|---|
| LLM01 Prompt injection | User message, CMS blog/recipe/trainer context, KB result, tool result | `contextEnricher.js` sanitize/bound size; `systemPrompt.js` đánh dấu CMS untrusted; `pageContext.integration.test.js` | Tách data khỏi instruction; không cho CMS/tool text đổi policy, auth hoặc tool permission; thêm indirect-injection case |
| LLM02 Sensitive disclosure | Prompt assembly, conversation/history API, provider request, logs | `ai.controller.js` dùng owner filter; history routes có auth; policy cấm log raw conversation | Chỉ gửi field cần thiết; test ownership; log metadata allowlist; không đưa health/financial data vào error context |
| LLM03 Supply chain | Provider/model env, SDK/dependency, upstream prompt/reference | `providers/index.js` allowlist provider và production fail closed | Đọc package/source/docs đúng version; không dùng model/API từ memory; review license, provenance và migration trước provider mới |
| LLM04 Data/model poisoning | KnowledgeEntry write/import, embedding refresh, CMS content | Model có validation/integrity limits; context vẫn được đánh dấu untrusted | Xác minh admin/ownership của write path, provenance, duplicate/version và rollback; chưa trace đủ thì ghi proof gap |
| LLM05 Improper output handling | Assistant markdown, links, UI cards, tool responses | `assistantOutput.js` sanitize; React rendering không được thực thi raw HTML tùy ý | Coi output là untrusted; allowlist URL/card shape; không ghép output vào query/shell/action; test hostile markdown/URL |
| LLM06 Excessive agency | Tool schema và `executeTool` | Registry auth/guest/confirmation flags, AJV validation, timeout; `toolEngine.test.js` | Least privilege + ownership ở execution time; write tool cần confirmation/idempotency; schema không thay authorization |
| LLM07 System prompt leakage | User asks for hidden prompt/config/secret | API key chỉ nằm env; output sanitizer là defense bổ sung | Không đặt secret trong prompt; từ chối tiết lộ instruction nội bộ; không tuyên bố prompt có thể bí mật tuyệt đối |
| LLM08 Vector/embedding weakness | Embedding query, fallback scan, KB document | Limit/candidate/threshold bounds trong `embedding.service.js` | Trace tenant/role/provenance, poisoned document và fallback equivalence; không trả raw private document ngoài quyền |
| LLM09 Misinformation | Tư vấn sức khỏe, TDEE/meal result, CMS/KB answer | Tool-backed structured calculations và verified context ưu tiên | Gắn source/uncertainty phù hợp; không biến estimate thành chẩn đoán; test high-risk advice và stale source behavior |
| LLM10 Unbounded consumption | Guest/user chat, history/context, provider loop, tool execution | Route rate limit/quota, `MAX_ITERATIONS`, history/context bounds, request/tool deadlines | Test quota tier, max iterations/tool calls, timeout/abort, response/context size; không tăng cap nếu thiếu cost evidence |

## Review output

Với mỗi risk liên quan, ghi:

1. `entry point → validation → authorization/ownership → provider/tool/output sink`;
2. evidence `file:line` và focused test;
3. trạng thái `covered`, `proof_gap`, `not_applicable` hoặc `finding`;
4. dữ liệu/cost/privacy side effect và rollback.

Không log raw prompt/output để chứng minh test. Dùng fixture synthetic và metadata đã sanitize.
