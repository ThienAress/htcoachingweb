# Đối chiếu 7 bước Plan 096 qua các hội thoại — 2026-10-08

## Kết luận

**Kế hoạch 7 bước chưa hoàn tất.** Lượt ở chat hiện tại đã hoàn tất deploy staging
và retest WHO/Ronaldo; đó là phạm vi con, không phải nghiệm thu toàn Plan 096.
Hai câu vẫn FAIL grounding. Code đã làm được giữ trong PR 207 và đang chạy trên
staging; không có căn cứ nói toàn bộ công việc đã mất vì các lần ngắt phiên.

Kiểm tra này chỉ đọc hội thoại, source, tài liệu, artifact và metadata provider/CI.
Không sửa ứng dụng, gọi paid inference, test lại prompt, deploy hoặc ghi catalog.
Report này không cấp quyền chạy lại exact-15 hay mở rộng phạm vi live hiện tại.

## Nguồn yêu cầu và các lần tiếp tục

Đã đọc đủ các turn trả về của sáu thread; cả sáu đều `hasMore=false`.
Các final rỗng hoặc turn interrupted không được coi là bằng chứng công việc đã xong.
Đối chiếu thêm công việc và report 103–105 của chat hiện tại
`01a1172c-d836-7250-8396-275f41a6f75d`.

| Thread, dùng đúng tên hiện tại | Nội dung đối chiếu |
|---|---|
| [Tiếp tục kiểm thử staging UI và Vibi](codex://threads/01a11481-8519-7f43-a42e-d89e59b6f411) | Đề xuất đúng 7 bước, user duyệt, chọn Brave; tạo Plan 096, triển khai policy/search/presentation/metrics và audit catalog |
| [Tiếp tục công việc cuộc trò chuyện](codex://threads/01a115f1-c2e8-77e0-8f29-9464304f1f72) | Kiểm tra candidate đã có; WHO không nguồn; lỗi đọc inventory/Mongo, chưa chứng nhận live |
| [Tiếp tục công việc còn lại](codex://threads/01a11613-0dac-7ad0-bbe1-37b1064d9d06) | Nhiều turn interrupted; rà checkpoint/source; focused run bị sandbox/Mongo chặn |
| [Tiếp tục công việc Codex](codex://threads/01a11638-4d3a-70b1-87b4-887aa3fa67de) | 55 logic tests, 4 certification tests, syntax checks PASS; vẫn NO-GO theo inventory/receipt lúc đó |
| [Kiểm tra Brave không có credit](codex://threads/01a116eb-42a9-7140-af40-caa28ca89a9c) | Phân biệt credit với key; user lưu key mới Save only, yêu cầu retest search/UI |
| [Tiếp tục công việc thread](codex://threads/01a1170e-33f3-7ec1-9029-a9ad8d9934b2) | Inventory/probe Brave HTTP 200; UI vẫn không grounding, chưa deploy candidate mới |
| Chat hiện tại | Xác minh SHA cũ chưa có Brave adapter; QA/review PR 207, merge/deploy, test đúng hai câu; cả hai FAIL |

Nguồn canonical đã đọc: Plan 096, spec `vibi-evidence-and-certification.md`,
traceability 096, audit `096-vibi-exercise-variants.md`, runbook certification,
reports 102/104/105. Chỉ đọc lời nói trong chat chưa đủ để nâng trạng thái PASS.

## Trạng thái từng bước ban đầu

### 1. Chốt capability/provenance contract — đã triển khai policy, còn điểm cần chốt

Có `capabilityPolicy.js`, ba policy `no_web`, `web_optional`, `web_required`,
privacy/budget boundaries và tests. `requestRouter.js` đã dùng `resolveWebPolicy`.
Spec giữ metadata evidence hiện có theo hướng additive để tương thích.
Code này nằm trong PR 207, đã QA và deploy staging.

Tuy nhiên, chưa có một trường provenance thống nhất đủ năm loại như đề xuất ban đầu:
`deterministic_server`, `internal_kb`, `model_prior`, `web_grounded`,
`capability_unavailable`. Một phần đang phân biệt qua evidence/model prefix và
metadata search. `resolveAiCapabilities` hiện có definition và unit tests;
search source không thấy caller production ngoài module này.
Không đồng nhất module `sourceProvenance.js` (publisher/source URL) với provenance
nguồn gốc câu trả lời. Đây là điểm cần chốt contract hoặc ghi rõ cách biểu diễn
tương đương trước khi gọi bước 1 hoàn thành toàn bộ yêu cầu ban đầu.

### 2. Web grounding thật cho WHO/Ronaldo — chưa đạt

Brave adapter, evidence selector, DeepSeek synthesis, quote/source validation,
webSources card và test integration đã có, đã deploy.
Key hiện diện, provider Brave đúng; không còn blocker thiếu key của receipt cũ.

Retest mới trên đúng SHA: WHO và Ronaldo đều Brave HTTP 200 nhưng
`no_supported_source`, source count cuối 0. UI trả fallback, không citation/card.
Report 105 ghi rõ 2/2 FAIL. Metadata này chưa phân biệt selector không có evidence
với synthesis không tạo answer được chấp nhận; cần debug hai stage đó.

### 3. Audit/sửa exercise catalog — mới audit và chuẩn bị patch

Audit có snapshot fresh lúc thực hiện, 122 records trong phạm vi query, 13 row
records được review kỹ thuật có chủ đích; không chứng nhận toàn bộ row catalog.
Đã chuẩn bị đúng 2 patches: Dumbbell Romanian Deadlift và Inverted Row.
`catalog-patches.json` ghi `databaseWrites=0`, `prepared-not-applied` cho cả hai.
Không tìm thấy intent/completion apply receipt trong thư mục artifact đã kiểm tra.

Modified Hindu, một số Pike/Row variants vẫn REVIEW; nguồn/demo exact chưa được
xác minh đầy đủ. Chưa apply hai patches và chưa có case 9 live PASS sau sửa.
Hai patches đó cũng không sửa Modified Hindu nên không tự giải quyết FAIL case 9.
Snapshot 07/10 không đủ mới để apply bây giờ; cần preimage fresh và receipt/rollback.

Artifact thật nằm trong:
`.local-data/vibi-staging-20261006/.local-data/plan096-catalog/`.
Một số resume pointers nhắc `.local-data/plan096-catalog/` tại root, nhưng đường dẫn
root đó không tồn tại tại thời điểm kiểm tra. Cần dùng đúng candidate path.

### 4. Sửa presentation workout/meal — code, tests và deploy xong; thiếu nghiệm thu live

Workout draft có heading từng buổi, mỗi bài một list item, lịch tuần/progression/
safety/deload riêng. Meal card có `MealFoodList`, tách món, khẩu phần và tổng bữa.
Có renderer regression tests, focused tests, UI regression gate và full CI PASS.
Các file đã nằm trong PR 207 và staging hiện tại.

Bản triển khai workout dùng Markdown có cấu trúc, giữ return string hiện có;
meal tiếp tục dùng card contract. Không tuyên bố đã có schema JSON workout mới.
Lượt mới nhất chỉ test WHO/Ronaldo theo yêu cầu user; không chạy lại câu 8/meal.
Vì cả hai câu search chỉ trả fallback, cũng chưa nghiệm thu được presentation
câu trả lời grounded. Rendered desktop/mobile nghiệm thu nội dung dài còn thiếu.

### 5. TALK01 paid regression 3–5 lượt tool-call — chưa làm sau bản sửa

History repair PR 204 đã merge/deploy; code chuẩn hóa completed tool call/result
IDs, giữ các rejection guards, có RED→GREEN và regression tests PASS.
Đó là sửa code, không phải bằng chứng TALK01 live PASS.
Report 102 xác nhận chưa gửi lại paid TALK01 sau sửa; các thread tiếp theo và
report 105 cũng không cung cấp run mới 3–5 completed tool groups đạt yêu cầu.

### 6. Exact-15 certification mới — chưa làm, đã được hoãn trong phạm vi live mới

Grade 12 PASS / 3 FAIL trong report 102 có reuse ca 1–4 và ca 5 thay thế;
report nói rõ không phải certification exact-15 mới.
User sau đó yêu cầu giữ 12 PASS, không chạy lại 15 câu, chỉ retest WHO/Ronaldo.
Vì vậy bước 6 chưa hoàn tất, nhưng không tự chạy để lấp thiếu evidence.
Nếu sau này cần chứng nhận toàn plan/production, phải chốt lại phạm vi nghiệm thu
với user; giữ giới hạn mới cho đến khi có chỉ dẫn thay đổi.

### 7. Observability/release gate — code/test đã có; chưa đạt GO toàn plan

`deepseekRequestTelemetry.js` ghi duration, TTFT, token counts, tool count,
retry count, bounded provider error code; provider đã gọi telemetry.
`ai-certification-contract.mjs` kiểm canonical prompts/binding/SHA/model,
TALK01, CI 5 jobs, health, deployment identity và safety. Contract tests PASS.
Đây là validator evidence; script không tự publish/deploy hoặc cấp production approval.

Toàn plan vẫn NO-GO: grounding chưa PASS, catalog còn dang dở, TALK01 và exact-15
chưa có evidence mới. CI/build xanh không thay thế các nghiệm thu đó.

## Những phần đã xác minh hoàn tất và được giữ lại

- PR 204 merged, SHA `f52db97714ca1916a5d5bf7c711cd007c4602627`: history repair.
- PR 207 merged, SHA `17dcb5ad47a2729c382c6c61c60365b3bff5f587`: Plan 096 code slice.
- Merge CI 37662383696, attempt 2: completed/success trên exact SHA staging;
  client 945 tests, E2E 129/129; full server local 3670 tests PASS ở lượt release.
- Netlify `6ac686c197478b000857d0c1` ready và Render `dep-db38m2uk1f9s738ra8f0` live,
  cùng SHA `17dcb5ad47a2729c382c6c61c60365b3bff5f587`.
- Read-only provider snapshot mới lúc 09:43 ngày 08/10/2026, giờ Asia/Saigon,
  vẫn xác nhận các deploy này và Vibi `deepseek-v4.1-flash`, Brave key present.
- Report 105 giữ timestamps, safe runtime diagnostics, ảnh và chi phí của đúng hai retest.

Không chạy lại build/unit/E2E trong lượt đối chiếu lịch sử này; tái sử dụng đúng
evidence của bản release không bị sửa code. Không đọc raw secrets hoặc payload provider.

## Vì sao dễ tưởng đã xong hoặc bị mất việc

Các turn failed/interrupted và nhiều final rỗng làm phần bàn giao không liên tục.
Một số báo cáo dùng receipt cũ `keyPresent=false` hoặc `build_in_progress`, trong
khi state mới đã đổi. Không được dùng các receipt cũ đó để chẩn đoán runtime hiện tại.
Candidate có source, tests, spec và audit; root checkout dirty là checkout khác.
Đọc nhầm root sẽ có thể kết luận sai rằng adapter chưa tồn tại.

Plan/state 096 hiện vẫn `in_progress`, nhưng `verification=none`,
`rollout=not_started`, updated 07/10 chưa phản ánh code slice đã QA/deploy 08/10.
Không đổi thành DONE trong lượt kiểm tra. Cần reconcile các trường này khi cập nhật
kế hoạch thực thi tiếp theo, phân biệt rollout code với nghiệm thu toàn plan.

## Checkpoint tiếp theo

1. Chốt provenance representation và cập nhật checkpoint/status tài liệu.
2. Sửa `no_supported_source` bằng fixture, phân biệt selector và synthesis;
   giữ tests/gates, retest hai câu theo phạm vi đã duyệt.
3. Hoàn tất rendered review workout/meal khi phạm vi test được mở lại.
4. Hoàn tất nguồn exact biến thể/catalog, fresh preimages, patch receipt và case 9;
   không tự apply trong lượt đối chiếu này.
5. TALK01 và certification mới chỉ thực hiện khi phù hợp chỉ dẫn live mới của user.
6. Chỉ kết luận toàn plan DONE/GO khi các acceptance bắt buộc có evidence đầy đủ,
   hoặc thay đổi yêu cầu được chốt rõ và cập nhật spec/gate nhất quán.

Không làm lại history repair, adapter scaffolding, presentation code hoặc bộ tests
đã có chỉ vì chuyển sang một thread mới. Tiếp tục từ các gap trên.

## Liên kết bằng chứng

- [Plan 096](../../.local-data/vibi-staging-20261006/docs/plans/096-certify-vibi-with-grounded-evidence.md)
- [Spec](../../.local-data/vibi-staging-20261006/docs/specs/vibi-evidence-and-certification.md)
- [Catalog audit](../../.local-data/vibi-staging-20261006/docs/audits/096-vibi-exercise-variants.md)
- [Report 102](102-vibi-paid-staging-ui15-2026-10-07.md)
- [Report 104](104-brave-focused-retest-2026-10-08.md)
- [Report 105](105-brave-staging-release-two-case-retest-2026-10-08.md)
- [PR 204](https://github.com/ThienAress/htcoachingweb/pull/204)
- [PR 207](https://github.com/ThienAress/htcoachingweb/pull/207)
- [CI merge SHA](https://github.com/ThienAress/htcoachingweb/actions/runs/37662383696)
