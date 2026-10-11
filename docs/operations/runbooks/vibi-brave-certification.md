# Vibi + Brave staging certification

Target duy nhất: Render `htcoachingweb-staging`, database `htcoaching_staging`,
client `https://staging--htcoachingweb.netlify.app`. Production không thuộc lượt này.

## Cấu hình

Giữ `AI_PROVIDER=deepseek`, `AI_STAGING_PROVIDER_TRIAL=deepseek`,
`AI_KB_RETRIEVAL_MODE=llm_selection`, `DEEPSEEK_ENDPOINT_PROFILE=vibi`,
`DEEPSEEK_MODEL=deepseek-v4.1-flash`.

Thêm `AI_WEB_SEARCH_PROVIDER=brave` và `BRAVE_SEARCH_API_KEY` trên đúng Render
staging. Key cần quyền Brave LLM Context endpoint. Không dán key vào chat/report/Git.
Không đổi existing DeepSeek/Gemini key. Kiểm inventory chỉ xuất tên và boolean.

Docs primary:
[Brave LLM Context](https://api-dashboard.search.brave.com/documentation/services/llm-context),
[Vibi client capabilities](https://vibi.top/docs-setup/en/docs/clients).

## Hành vi và budget

Web-required đi qua privacy gate → Brave fixed HTTPS endpoint (POST, không redirect,
tối đa 192 KiB response, 10 giây) → tối đa 3 nguồn → DeepSeek forced function synthesis
(1200 output tokens, 15 giây) → server kiểm source IDs, quote nguyên văn, số liệu,
identity scope và dựng citation. Tool budget riêng 30 giây, request deadline vẫn 75 giây.
Không tự retry, không switch provider nếu lỗi. Thiếu key/permission/evidence: fail closed.

Không fetch arbitrary article URLs nên không tạo network SSRF surface qua nguồn.
Source quotes giới hạn nội dung bằng chứng; matching quote không phải bằng chứng
toán học về semantic entailment. Reviewer live phải kiểm claim thực sự được nguồn hỗ trợ.

## Release gate

Chỉ chạy paid sau local QA, CI 5/5, client/server staging đúng cùng candidate SHA,
health 200 và wallet Vibi trên $3. Kiểm wallet trước request và giữa các nhóm case;
không tạo request mới nếu số dư không xác minh được hoặc còn tối đa $3.

TALK01 tạo conversation mới, 3–5 completed tool groups qua request riêng. Exact-15
dùng đúng canonical corpus và parent mới trong run; chụp UI/evidence trước follow-up.
Không reuse lịch sử, không thay prompt fail bằng prompt khác rồi chấm PASS.

`node scripts/ai-certification-contract.mjs <new-evidence.json> <canonical-corpus.json>`
trả GO khi tất cả binds/gates cùng pass. Script không tự cấp quyền production deploy.

## Rollback

Code: deploy lại baseline staging SHA theo runbook release hiện có.
Brave: bỏ lựa chọn `AI_WEB_SEARCH_PROVIDER` để trở về DeepSeek fail-closed web path;
không xóa hay thay key khác. Catalog: chỉ rollback entry exact hậu ảnh patch; nếu
entry đổi sau patch thì dừng, không ghi đè thay đổi mới.
