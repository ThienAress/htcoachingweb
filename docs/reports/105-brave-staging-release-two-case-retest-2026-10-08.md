# Brave staging release và retest hai câu — 2026-10-08

## Phạm vi và bản phát hành

User yêu cầu đưa bản sửa lên staging và chỉ test WHO/Ronaldo một lần mỗi câu.
Không chạy lại bộ 15 câu; giữ 12 PASS lịch sử trong report 102.
Không test workout/catalog, không migration hoặc sửa dữ liệu catalog.

- Task: `01a1172c-d836-7250-8396-275f41a6f75d`.
- Candidate isolated checkout: `.local-data/vibi-staging-20261006`.
- Candidate: `f27065e763865f740e1087c6a092ac7dbc8f1333`.
- [PR 207](https://github.com/ThienAress/htcoachingweb/pull/207), base staging, đã merge.
- Merge SHA: `17dcb5ad47a2729c382c6c61c60365b3bff5f587`.
- Client: `https://staging--htcoachingweb.netlify.app`.
- Server: `https://htcoachingweb-staging.onrender.com`.
- Database target đã xác minh: `htcoaching_staging`.

Root checkout có thay đổi có sẵn; không dùng để build/deploy và không ghi đè code.
Source thay đổi nằm trong PR: Brave adapter/search routing, evidence synthesis/guards,
safe telemetry, workout/meal presentation và regression tests.
Provider vẫn DeepSeek trial qua Vibi, model `deepseek-v4.1-flash`; web search Brave.
Không reveal hoặc thay secret.

## QA/review trước phát hành

- Candidate [CI 37661179423](https://github.com/ThienAress/htcoachingweb/actions/runs/37661179423):
  client, server, E2E, secrets và Docker đều PASS.
- Local full server: **317 files / 3670 tests PASS**, Node 22, Mongo in-memory cô lập.
- Local full client: **187 files / 944 tests PASS** trước regression email mới;
  renderer focused sau đó **2 tests PASS**. Merge CI **188 files / 945 tests PASS**.
- Local E2E: **129/129 PASS**.
- Local lint: **0 errors / 1 warning** react-hooks/incompatible-library có sẵn.
- UI regression: **0 new blocking**, không cập nhật baseline.
- Dependency audit client/server, secrets, data boundaries, docs privacy,
  agents validator, runtime logging và tool validator đều PASS.
- Local static-only build PASS; artifact này không dùng để deploy.
  Netlify staging phải chạy đầy đủ dynamic build với API staging.
- Independent review phát hiện bare email có thể thành mailto ngoài sources.
  Đã neutralize; test qua ChatBubble thấy RED trước sửa và GREEN sau sửa.
  Không còn BLOCK/HIGH được review báo; entailment vẫn cần review nguồn live.

Preview `6ac68492ab6a070008e593cd` FAIL vì public API nội dung timeout,
prerender không dựng đủ recipe cohort. Preview không phải staging deploy.
Không bypass hoặc hạ build gate; kiểm tra riêng branch-deploy staging.

Evidence local: `.local-data/brave-release-20261008/`.

## Deployment identity và retest

Netlify branch deploy `6ac686c197478b000857d0c1` đã ready đúng merge SHA.
Build staging strict PASS, prerender **44/44 routes**, search-index build gate PASS.
Monitor [37662383949](https://github.com/ThienAress/htcoachingweb/actions/runs/37662383949)
PASS; đây là health/security đọc staging, không thay deployment identity check.

Merge [CI 37662383696](https://github.com/ThienAress/htcoachingweb/actions/runs/37662383696)
client/server/secrets/Docker đã PASS. Attempt 1 E2E kẹt ở Ubuntu apt mirror
hơn 10 phút trước khi chạy test; đã cancel và rerun riêng job E2E trên exact SHA.
Attempt 2 đã PASS E2E; toàn bộ 5 jobs của merge SHA đã PASS.
Render deploy `dep-db38m2uk1f9s738ra8f0` đã được trigger exact merge SHA sau CI PASS.
Rollback trước phát hành: server `dep-db37njcs728c73bkc0h0`, client
`6ac67b3ae2089c4f45ad54a2`, cùng SHA `f52db97714ca1916a5d5bf7c711cd007c4602627`.

Sau reload frontend, admin session đã hết. Luồng login chuẩn dẫn tới Google account chooser.
Automatic approval review chặn chọn tài khoản vì cần quyền OAuth cụ thể;
đã yêu cầu user cho phép dùng lại tài khoản staging cũ, không bypass.
Sau đó tab đã trở về staging với đúng tài khoản admin; user đã hoàn tất chọn tài khoản.
Không còn blocker đăng nhập; agent không thực hiện action đã bị reject.

Ví trước test: **$9.75**, tổng dùng **$0.2513**, **21 API requests**.
Không chạy direct Brave probe.

### Identity đã xác minh

Provider API đã xác minh trực tiếp deployment details, không chỉ đọc dashboard:

| Thành phần | Deployment ID | Trạng thái | SHA |
|---|---|---|---|
| Netlify branch staging | `6ac686c197478b000857d0c1` | ready | `17dcb5ad47a2729c382c6c61c60365b3bff5f587` |
| Render staging | `dep-db38m2uk1f9s738ra8f0` | live | `17dcb5ad47a2729c382c6c61c60365b3bff5f587` |

CI push staging cùng SHA, 5 jobs PASS ở attempt 2 (E2E rerun, các job PASS được giữ).
API `/api/ops/health/ready` **200** trước khi gửi prompt.
Identity checked `2026-10-07T18:12:13Z`; canonical evidence giữ trong thư mục local.

### Kết quả đúng hai câu

Mỗi prompt gửi một lần, trong hội thoại mới đã xác minh transcript rỗng,
qua phiên admin staging. Không gửi lại prompt sau FAIL.

| Ca | Gửi lúc UTC | Kết quả | Quan sát |
|---|---|---|---|
| WHO | `2026-10-07T18:12:27.392Z` | FAIL grounding | Câu dự phòng chưa thể xác minh; không citation hoặc webSources card |
| Ronaldo | `2026-10-07T18:13:00.103Z` | FAIL grounding | Câu dự phòng chưa thể xác minh; không citation hoặc webSources card |

Prompt WHO: Theo khuyến nghị mới nhất của WHO, người trưởng thành nên vận động bao
nhiêu phút mỗi tuần? Hãy trả lời kèm nguồn công khai cập nhật.

Prompt Ronaldo: Cristiano Ronaldo là ai? Dựa trên nguồn công khai cập nhật, hãy trả
lời có nguồn.

UI đã trả lời xong, input hoạt động lại và không trộn transcript của hai hội thoại.
DOM và ảnh đều thấy fallback rõ ràng; không có nội dung có nguồn để đánh giá
semantic entailment hoặc bố cục câu trả lời grounded. Không tuyên bố presentation
PASS chỉ vì fallback ngắn. Workout/meal presentation chưa được live retest trong lượt này.

### Metadata runtime và giới hạn chẩn đoán

| Ca | Brave HTTP | Duration Brave | Diagnostic | Source count cuối |
|---|---:|---:|---|---:|
| WHO | 200 | 816 ms | `no_supported_source` | 0 |
| Ronaldo | 200 | 5402 ms | `no_supported_source` | 0 |

Brave đã được gọi qua runtime staging mới. Khác lỗi `unsupported_capability/not_called`
của SHA cũ: adapter mới hiện diện và upstream trả HTTP 200.
Pipeline vẫn không tạo được câu trả lời có evidence được chấp nhận.
`no_supported_source` được dùng cả khi selector không tìm evidence và khi synthesis
không tạo answer hợp lệ, nên metadata hiện tại chưa phân biệt chắc chắn hai stage.
Không suy key hỏng hoặc claim PASS từ `tool_call.success=true`.
Hai `chat_end` có `toolCalls=1`, `iterations=0`, `kbHits=0`.
Chỉ lưu whitelist metadata runtime, không lưu raw provider response, payload chat từ logs hoặc secret.

### Chi phí, side effects và kết luận

Ví cuối sau reload: **$9.74**, tổng dùng **$0.2607**, **22 API requests**.
Delta tổng dùng **$0.0094**, thêm **1 provider API request** theo wallet;
không suy số provider requests từ hai prompt và không tính phí Brave từ ví Vibi.
Ngưỡng dừng $3 chưa chạm; không đổi provider/model hoặc fallback sang Gemini.

Đã thêm đúng hai hội thoại test và giữ để user xem. Không cleanup staging,
catalog writes, migration, production deploy hoặc production data writes.
Source release vẫn đúng SHA đã QA, không sửa ứng dụng sau CI.

**Deploy staging hoàn tất; retest 2/2 FAIL grounding.** Giữ nguyên 12 PASS lịch sử;
không certification mới hoặc GO production. Bước sửa tiếp theo cần phân biệt
evidence selection và synthesis validation dựa trên contract/fixture có căn cứ,
không tự gửi thêm paid prompt trong lượt này.

Evidence chính:

- `canonical-identity-*.json`, `identity-*.json`: exact SHA/deploy identity.
- `ci-client-final.log`, `ci-e2e-final.log`: 945 client tests và 129 E2E PASS.
- `netlify-staging-log.txt`: build strict 44/44 routes PASS.
- `who-dom.txt`, `who.png`: WHO.
- `ronaldo-dom.txt`, `ronaldo-final.png`, `ronaldo-links.json`: Ronaldo và links rỗng.
- `retest-times.json`, `diagnostics-*.json`: timestamps và safe runtime metadata.
- `wallet-before.txt`, `wallet-after.txt`: ví; chỉ giữ local.
