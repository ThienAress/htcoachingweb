# DeepSeek staging trial runbook

Trạng thái: PR202 đã publish, CI5/5 và E2E129 PASS (Plan095, 2026-10-06).
Owner đã duyệt commit, merge PR202 và deploy staging ngày 2026-10-06; đang thực hiện.
Chưa duyệt gọi API trả phí hoặc ghi dữ liệu trial. Checkpoint chi tiết ở
[Plan095](../../plans/095-integrate-deepseek-staging-trial.md).

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

## Cấu hình và thứ tự bật trial

Target dự kiến: Render service `srv-d9g8em61a83c73b4l61g`. Xác minh lại service,
database và deployment trong control plane trước khi nhập key hoặc sửa config.
PR head đã kiểm CI: `089cb700dde95716c1d7c546c09eb42e8a7bef8f`.

| Biến | Giá trị trial |
|---|---|
| `APP_ENV` | `staging` |
| `AI_PROVIDER` | `deepseek` |
| `AI_STAGING_PROVIDER_TRIAL` | `deepseek` |
| `AI_KB_RETRIEVAL_MODE` | `llm_selection` |
| `DEEPSEEK_MODEL` | `deepseek-flash` |
| `CLIENT_URL` | `https://staging--htcoachingweb.netlify.app` |
| `PUBLIC_API_ORIGIN` | `https://htcoachingweb-staging.onrender.com` |
| `ALLOWED_ORIGINS` | `https://staging--htcoachingweb.netlify.app` |
| `DEEPSEEK_API_KEY` | Owner nhập trực tiếp ở backend secret |

Giữ các guard staging: DB `htcoaching_staging`, `BACKGROUND_JOBS_ENABLED=false`,
`EMAIL_DELIVERY_MODE=disabled`, `F1_RETENTION_ENFORCE=false`, không có
`NETLIFY_BUILD_HOOK_URL`, reminder không bật; SePay nếu bật phải dùng sandbox.
Không xóa `GEMINI_API_KEY`: readiness và các chức năng ngoài assistant trial vẫn
cần cấu hình Gemini hiện hữu. Không thay các secret dùng cho auth hoặc DB.

1. Sau approval merge/deploy, triển khai code với profile Gemini hiện hữu và xác
   minh CI, exact merged SHA, deployment identity cùng health. Không lấy build
   tĩnh của PR hoặc preview làm bằng chứng staging đã sẵn sàng.
2. Snapshot nonsecret config cùng SHA rollback thực tế; kiểm corpus và thống nhất
   fixture/call cap/cleanup trước khi chạy trial. Hiện các mục này chưa có evidence live.
3. Owner nhập key trực tiếp. Áp dụng đầy đủ profile trên trong cùng một đợt deploy
   được duyệt; không redeploy profile DeepSeek thiếu key hoặc thiếu một biến bắt buộc.
4. Xác minh lại SHA/health/config active trước smoke test. Chỉ gọi API khi owner đã
   duyệt số call trả phí; tool loop và KB selection cũng tính vào tổng call.

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
