# DeepSeek staging trial runbook

Trạng thái: local implementation only (Plan095, 2026-10-06). Tài liệu này không
cho phép commit, deploy, gọi API trả phí hoặc ghi dữ liệu staging.

## Phạm vi và guard

- Chỉ bật profile thử nghiệm khi `APP_ENV=staging`, `AI_PROVIDER=deepseek`,
  `AI_STAGING_PROVIDER_TRIAL=deepseek`, `AI_KB_RETRIEVAL_MODE=llm_selection`
  và `DEEPSEEK_MODEL=deepseek-flash` cùng origin/database staging chính xác.
- Key chỉ nhập vào secret backend staging bởi owner; không ghi key vào repo,
  frontend, log, evidence hoặc chat. DeepSeek gọi server-side tới endpoint cố định.
- Generation và semantic KB selection dùng DeepSeek; Gemini, vector search và
  các luồng Meal Scan/KB write ngoài trial vẫn được giữ để rollback/đối chiếu.
- Web-required trả `unsupported_capability` và không gọi Gemini. Corpus KB vượt
  64 entry hoặc 64 KiB phải dừng, không tự cắt top-N.

## Preflight trước khi owner cho phép staging

1. Có trusted CI/review cho exact SHA; xác minh Render service, database
   `htcoaching_staging`, frontend/API origin và health endpoint. Không suy identity
   từ tên branch hay config cũ.
2. Chốt tài khoản/fixture synthetic, số lượt/call trả phí và cleanup record. Không
   dùng dữ liệu sức khỏe thật hoặc câu hỏi riêng tư.
3. Snapshot tên config cũ (không có secret value), chuẩn bị rollback về Gemini,
   kiểm tra corpus eligible/safe count và bytes trước lượt selection.
4. Owner nhập `DEEPSEEK_API_KEY` vào secret backend staging; Codex không nhận hoặc
   hiển thị giá trị key.

## Smoke cases có giới hạn

Chạy UI staging sau khi có approval deploy riêng: chat thường, follow-up giữ mạch,
KB paraphrase/reviewed variant, KB miss, read-only tool follow-up, Stop/Retry/reload
history và web-required unsupported. Ghi chỉ SHA, model/provider, latency, request
counts/token usage, retrieval method, entry IDs/revisions và PASS/FAIL; không lưu raw
prompt, response riêng tư, cookie hoặc key.

## Rollback và cleanup

Nếu lỗi provider, privacy, stale selection, timeout hoặc corpus overflow: dừng trial,
không retry mù. Khôi phục tên/giá trị config Gemini từ snapshot, redeploy exact known
SHA theo protection, rồi health-check. Chỉ xóa record test-owned sau khi owner xác nhận
đúng target; không cleanup rộng và không xóa vector/index. Usage counters của KB có thể
tăng và phải ghi nhận như side effect.

Trial evidence không thay AC009/Plan092 certification và không phải production GO.
