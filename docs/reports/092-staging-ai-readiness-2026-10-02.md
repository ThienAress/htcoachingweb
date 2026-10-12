# Staging AI readiness — 2026-10-02

## Phạm vi và kết quả

User yêu cầu tiếp tục bốn bước: xác minh staging, chuẩn bị/publish KB đủ điều kiện,
retest ca lỗi rồi chạy lại bộ 15 câu gốc. Giữ nguyên dirty tree ngoài phạm vi AI.
Kết quả hiện tại: **đã xác minh các blocker và sửa một lỗi category KB;
chưa deploy, re-embed, publish hoặc chạy acceptance**.

Không commit, push, checkout, merge, thay runtime code hoặc ghi production.
Snapshot source đọc từ GitHub exact SHA, không phải checkout/release mới.

## Deployment đã kiểm tra qua provider CLI

| Thành phần | Deployment | SHA | Kết quả |
|---|---|---|---|
| Netlify staging | `6abd1ad18828ed0008e5e585` | `ae1252881219e4842bb144e753e9498501dc594a` | ready |
| Render staging | `dep-darlv0e0tbcc73c4r3l0` | `fba17e6e1cf877edfb5e0bfba3cd0a08de0f5d9a` | live, từ 26/09 |

Frontend hiện hành: `https://staging--htcoachingweb.netlify.app`, HTTP200.
Backend: `https://htcoachingweb-staging.onrender.com`, readiness HTTP200.
URL cũ `htcoachingweb-staging.netlify.app` trả404 và không phải origin hiện hành.
Render đúng repository/branch staging nhưng `autoDeploy=no`.

CI run `36728449324` của `ae125288` PASS; client/server/E2E/secrets/docker đều success.
Không dùng QA local của root branch làm evidence cho SHA này.
Khoảng cách từ backend live đến `ae125288` có31 commit, gồm AI, KB, hợp đồng và ví.
Không tự đưa toàn bộ phạm vi đó vào một đợt được giới hạn chỉ AI.
Cần chốt phạm vi candidate trước deploy; frontend/backend chưa đạt invariant cùng SHA.

## KB live và phần đã sửa

Kiểm tra qua Doppler project server/config stg, xác minh URI và connected database
đúng `htcoaching_staging`. Chỉ đọc KnowledgeEntry và search-index metadata;
không truy cập hội thoại, sức khỏe hoặc thông tin tài khoản thật.

- Có28 entry, tất cả source_backed/draft/needs_review/embedding pending.
- Cả28 có sources, chưa có reviewedBy/reviewedAt; vector dimension hiện tại0.
- Hai index `kb_embedding_v2` và `kb_variant_embedding_v1` READY/queryable,
  dimension768, cosine và các filter fields phù hợp; nestedRoot là variants.
- Cả28 nội dung/nguồn khớp manifest đã sync; privacy validation28/28 PASS.
- Ban đầu metadata publication27/28 PASS. Mục manifest60 bị gán category `hlv`
  dù nội dung thuộc sức khỏe, gây `KNOWLEDGE_CANONICAL_INTERNAL_REQUIRED`.

Đã sửa đúng một mục `hlv` → `health` lúc11:02 ngày02/10, trong transaction có
target guard, digest, kiểm tra concurrent drift và preimage. Revision tăng1,
updatedAt cập nhật; nội dung, nguồn, draft/needs_review và embedding không đổi.
Post-state verified=true; kiểm lại lúc11:04: metadata publication28/28 PASS.
Đây là validation kỹ thuật, **không thay cho editorial/medical review**.

## Re-embed và recovery

Sync ngày30/09 đã ghi28 mục; không chạy lại sync. Apply re-embed run36756005564
từng bị chặn bởi `KB_REEMBED_FRESH_OFF_DEVICE_BACKUP_REQUIRED`, trước provider/write.

Fresh preflight02/10 PASS:28 documents,28 root vectors,0 variants,28 provider calls,
profile question-answering-v1, version gemini-embedding-2:768:question-answering-v1,
provider cap100. Digest:
`67f79a570ca24b16c4f17635cda5abf73a654d828a61e851b369ec36c7bd1c15`.
Category correction không thuộc vector-plan hash; vẫn phải rerun preflight trước apply.

Backup01/10 có off-device recovery verified; audit lúc11:04 age23.83h, release/DR ready.
Cửa sổ24h hết lúc **11:13:57 ngày02/10, Asia/Saigon**. Luôn đánh giá theo thời điểm apply;
không sửa timestamp hoặc tăng policy để vượt gate. PITR vẫn unavailable.

Chưa có snapshot key/custody được xác minh cho lần apply mới. Runbook yêu cầu key
lưu riêng trong Bitwarden và encrypted snapshot ngoài repository. Browser runtime
không khởi tạo được, vẫn lỗi sau reset (`failed to write kernel assets`, os error3).
Chưa sử dụng được phiên Admin staging để review/publish. Không giả lập reviewer.
Render runtime embedding profile/provider còn cần xác minh; Doppler stg riêng lẻ
không chứng minh cấu hình đang chạy trên Render.

## Bộ câu hỏi và phần chờ

Đã khôi phục14 prompt nguyên văn từ artifact thủ công và tạo corpus15 slots.
Câu5 không có prompt gốc trong hồ sơ; đã hỏi user. Câu5 cần baseline câu4;
câu7 cần baseline câu6 phù hợp. Không tự dựng nội dung câu5 hoặc chấm ca chưa chạy.
Formal reliability workflow11 prompt/round là corpus riêng, không thay bộ15 này.

Thứ tự tiếp theo:
1. Chốt candidate chỉ AI hoặc chấp nhận phạm vi toàn bộ ae125288; hoàn tất release
   gates cần thiết, deploy staging đã được cho phép và xác minh lại hai SHA.
2. Xác minh runtime profile, snapshot/key custody và backup còn hiệu lực;
   re-embed đúng digest → post-verify → review/publish qua Admin → retrieval smoke.
3. Retest1/4/9/15, partial12, missing5 và nhánh thành công của7 với đúng baseline.
4. Chạy đủ15 với evidence mới và cleanup theo đúng fixture của run.

## Files/evidence và validation

Evidence riêng: `.local-data/staging-ai-resume-20261002/`:
`source-provenance.json`, `ci-run.json`, `netlify-deploys.json`, `render-deploys.json`,
`staging-deploy-diff.json`, `live-readiness.json`, `reembed-preflight.json`,
`category-preflight.json`, `category-apply.json`, `category-preimage.json`,
`original-15-corpus.json`. Preimage chứa metadata của đúng một KB record; giữ private.
Các helper mới `readiness.mjs` và `correct-kb-category.mjs` đã pass `node --check`.
Readiness script không mutate; category script chỉ ghi sau explicit apply+digest.
Kế hoạch tiếp tục được lưu trong snapshot source tại docs/plans/092, README và state.

Full build/tests không chạy lại vì chưa sửa runtime code; không tuyên bố full
pre-deploy/ship PASS. Live AI acceptance và original15: NOT RUN, còn dependency gates.
Hai worker read-only yêu cầu Sol/high và Luna/low; actual routing chưa xác minh.
