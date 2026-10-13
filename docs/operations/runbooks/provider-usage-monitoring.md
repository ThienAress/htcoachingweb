# Provider usage monitoring

Các metric dưới đây là cost/usage driver local, không phải hóa đơn, spend cap hay quota remaining
do provider xác nhận. Registry không dùng dynamic labels và không chứa prompt/response, ảnh, email,
user ID, Cloudinary public ID, SePay payload/token hay Netlify hook URL.

## Signals

| Provider | Prometheus counters chính | Cách dùng |
| --- | --- | --- |
| Gemini Chat | `htcoaching_provider_gemini_chat_requests`, `_succeeded`, `_failed`, `_unavailable`, `_rate_limited`, `_not_required`, `_prompt_tokens`, `_output_tokens`, `_total_tokens` | `requests` là provider attempts (kể cả retry); `unavailable` tách 5xx khỏi `rate_limited` 429; `not_required` là static safety response không gọi model |
| Gemini Meal Scan | `htcoaching_provider_gemini_meal_scan_requests`, `_succeeded`, `_failed`, `_prompt_tokens`, `_output_tokens`, `_total_tokens` | tách ảnh scan khỏi hội thoại |
| Gemini Search Grounding | `htcoaching_provider_gemini_search_grounding_requests`, `_succeeded`, `_failed`, `_prompt_tokens`, `_output_tokens`, `_total_tokens` | tách chi phí tra cứu có Google Search grounding khỏi chat chính |
| Gemini Embedding | `htcoaching_provider_gemini_embedding_requests`, `_succeeded`, `_failed`, `_prompt_tokens`, `_output_tokens`, `_total_tokens` | theo dõi request tạo vector thực tế; cache hit và caller dùng chung không tăng request |
| Gemini KB Suggestion | `htcoaching_provider_gemini_kb_suggestion_requests`, `_succeeded`, `_failed`, `_prompt_tokens`, `_output_tokens`, `_total_tokens` | theo dõi batch gợi ý Knowledge Base do admin kích hoạt |
| Resend | `htcoaching_provider_resend_attempts`, `_sent`, `_failed`, `_disabled` | so delivery attempt với provider dashboard |
| Cloudinary | `htcoaching_provider_cloudinary_uploads`, `_upload_bytes`, `_upload_failures`, `_deletes`, `_delete_failures` | theo dõi byte ingest và lifecycle failure; không suy storage hiện tại chỉ từ counter |
| SePay | `htcoaching_provider_sepay_api_requests`, `_api_pages`, `_transactions_received`, `_api_failures` | đo polling/page volume và rate-limit pressure |
| Netlify | `htcoaching_provider_netlify_build_scheduled`, `_coalesced`, `_triggered`, `_failed`, `_skipped` | đo hiệu quả batching và build-hook volume |

## Operating rule

1. Scrape `/api/ops/metrics/prometheus` bằng auth hiện có và aggregate mọi Render instance. Counter
   là process-local, reset khi restart/deploy và không bền như billing ledger.
2. Ghi deploy/restart markers. Tính rate theo 5 phút, 1 giờ và ngày; không so raw cumulative counter
   qua restart.
3. Reconcile định kỳ với dashboard/quota provider. Chỉ tạo threshold tiền sau khi owner nhập giá,
   currency, tax và billing period hiện hành vào monitoring bên ngoài repository.
   Dashboard có thể cập nhật trễ; request bị chặn trước provider hoặc thất bại trước khi sinh token
   có thể không làm quota token thay đổi, nên không dùng quota dashboard làm bằng chứng duy nhất.
4. Cảnh báo sớm theo ratio và velocity: failure/retry tăng, token/byte/page/build tăng đột biến hoặc
   sent/attempt lệch. Không tự nâng gói hoặc tắt service chỉ từ một sample.
5. Khi scale nhiều instance, thiếu scrape của bất kỳ instance nào làm cost estimate không đầy đủ;
   đánh dấu partial thay vì coi là zero.

## Chi phí AI theo lượt (`AiUsageRecord`)

Mỗi lượt HT Assistant hoặc Meal Scan đã qua quota và có gọi provider sẽ lưu một bản ghi
`AiUsageRecord` (TTL 90 ngày): loại thao tác (`chat`, `chat_image`, `chat_smart_search`,
`meal_scan`), tier, số lần gọi và token DeepSeek (kèm cache hit/miss), token Gemini, số request
Brave context/images và `estimatedCostUsd`. Bản ghi không chứa userId, guestKey, câu hỏi hay câu trả lời.

- Admin xem tổng hợp: `GET /api/admin/service-access-policies/ai-usage?days=7` (1–90 ngày): số lượt,
  tổng/trung bình/p50/p95/max chi phí theo thao tác và theo tier.
- Đơn giá mặc định ở `server/src/config/aiPricing.js` (bảng giá công khai). Production đi qua Vibi nên
  owner đặt env theo hóa đơn thật: `AI_PRICE_DEEPSEEK_INPUT_MISS_PER_M`,
  `AI_PRICE_DEEPSEEK_INPUT_HIT_PER_M`, `AI_PRICE_DEEPSEEK_OUTPUT_PER_M`, `AI_PRICE_GEMINI_INPUT_PER_M`,
  `AI_PRICE_GEMINI_OUTPUT_PER_M` (USD/1M token), `AI_PRICE_BRAVE_CONTEXT_PER_REQUEST`,
  `AI_PRICE_BRAVE_IMAGE_PER_REQUEST` (USD/request).
- `estimatedCostUsd` là ước tính để định giá credit, không thay hóa đơn provider. Call provider chạy sau
  khi response đóng (nếu có) không được tính.

## Privacy và incident response

- Không thêm recipient, actor, model prompt, asset key, bank reference hay URL làm metric label.
- Gemini/Resend/Cloudinary/SePay/Netlify failure spike đi theo
  [incident runbook](./incident-runbook.md#external-providers).
- Cloudinary active-delete counter không chứng minh backup-version purge. Dùng privacy lifecycle và
  synthetic canary trong backup/restore runbook.
