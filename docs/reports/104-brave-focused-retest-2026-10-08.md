# Kiểm tra tập trung search và trình bày trên staging — 2026-10-08

## Phạm vi

Task `01a1172c-d836-7250-8396-275f41a6f75d`, tiếp tục thread
`01a1170e-33f3-7ec1-9029-a9ad8d9934b2`.
User yêu cầu test câu cần search và câu trình bày chưa đẹp; không chạy lại bộ 15 câu.
Giữ nguyên kết quả lịch sử **12 PASS / 3 FAIL** trong report 102.
Đây là retest tập trung, không phải certification mới hoặc evidence PASS cho candidate local.

Target: `https://staging--htcoachingweb.netlify.app`, backend Render
`htcoachingweb-staging`. SHA được redeploy trong report 103:
`f52db97714ca1916a5d5bf7c711cd007c4602627`.

## Kết quả mới

Mỗi prompt gửi đúng một lần trong hội thoại mới, qua UI tài khoản admin staging.
WHO/Ronaldo được gửi trước khi khôi phục context; evidence được tiếp tục giữ lại.

| Ca | Kết quả retest | Evidence và lý do |
|---:|---|---|
| 10 — WHO | FAIL grounding | Trả chưa thể xác minh; không có citation/link nguồn |
| 15 — Ronaldo | FAIL grounding | Trả chưa thể xác minh; không có card nguồn |
| 9 — 5 bài ngực | FAIL nội dung | Đủ 5 bài, nhưng Modified Hindu vẫn mô tả push-up thường |
| 8 — lịch tập 4 ngày | FAIL trình bày | 4 buổi, tiến độ và deload gom vào một paragraph khoảng 1.800 ký tự |

Ca 8 chỉ được kiểm tra bổ sung về presentation theo plan 096; không hạ hoặc thay
grade nội dung PASS đã ghi trong report 102. 11 ca PASS khác không được gửi lại.
Ca 9 được kiểm tra trước khi đọc được plan 096, do report 102 ghi đây là ca lỗi
chất lượng; sau đó plan xác định lỗi gom đoạn nằm ở workout draft, nên kiểm thêm ca 8.

### Prompt sử dụng

- Ca 10: Theo khuyến nghị mới nhất của WHO, người trưởng thành nên vận động bao nhiêu
  phút mỗi tuần? Hãy trả lời kèm nguồn công khai cập nhật.
- Ca 15: Cristiano Ronaldo là ai? Dựa trên nguồn công khai cập nhật, hãy trả lời có nguồn.
- Ca 9: Tìm 5 bài tập ngực không cần dụng cụ dành cho người mới, kèm hướng dẫn kỹ thuật.
- Ca 8: Tạo lịch tập tăng cơ 4 ngày/tuần cho người mới, chỉ có đôi tạ đơn điều chỉnh
  và dây kháng lực; mỗi buổi tối đa 60 phút, kèm deload.

### Quan sát UI

Ca 9 có 5 cards và danh sách text lặp lại nội dung card, thêm các bước chung rất dài.
Modified Hindu thiếu mô tả chuyển động riêng của biến thể; wide-hand vẫn có wording
tay rộng nhưng khuỷu sát thân như finding cũ. Chưa đủ căn cứ cho PASS kỹ thuật.

Ca 8 hoàn tất, có 45–55 phút, hiệp/lần/RPE/nghỉ, tiến độ và deload giảm khoảng 30%.
DOM chỉ có một paragraph cho toàn bộ lịch; không có tiêu đề từng buổi hoặc list từng bài.
Ảnh ở viewport browser hiện tại cho thấy đoạn text dày, khó quét; không giả lập breakpoint mới.
Không thực hiện một cuộc kiểm tra y khoa hoặc review toàn bộ kỹ thuật của lịch tập.

## Root cause search đã xác minh

Đọc source trên GitHub của **đúng SHA staging**, không suy từ root worktree cũ:
[searchKnowledge.tool.js tại f52db97](https://github.com/ThienAress/htcoachingweb/blob/f52db97714ca1916a5d5bf7c711cd007c4602627/server/src/services/ai/tools/searchKnowledge.tool.js).

Nhánh `isDeepseekStagingTrial()` trả `unsupported_capability`,
`searchOutcome=not_called`, `providerRequestMade=false` ngay trước privacy/network path.
File deployed không có import/call `braveSearchKnowledge` hoặc `AI_WEB_SEARCH_PROVIDER`.
Vì vậy key và redeploy cùng SHA không thể kích hoạt Brave trong bản này.

Runtime logs phù hợp với source: WHO `search_knowledge` 2 ms lúc
`2026-10-07T17:13:53.712Z`; Ronaldo 0 ms lúc `2026-10-07T17:15:08.212Z`.
Hai `chat_end` đều `iterations=0`, `toolCalls=1`, `kbHits=0`.
Trường success của logger không được dùng làm chứng nhận grounding.

Render Environment UI đã xác minh riêng **`AI_WEB_SEARCH_PROVIDER=brave`**.
Chỉ reveal provider không nhạy cảm, sau đó ẩn lại; không reveal key.
Thread trước có probe Brave HTTP 200, nhưng lượt này không chạy lại probe và không
lấy probe cũ làm chứng nhận live route. Không cần kết luận key hỏng từ fallback UI.

Checkout `.local-data/vibi-staging-20261006` đang có các thay đổi chưa commit của
plan 096: Brave adapter, search integration và workout/meal presentation.
`braveSearch.adapter.js` là untracked; `searchKnowledge.tool.js`, `workoutDraft.js`
và các integration files đang modified. Các sửa này chưa nằm trong SHA deployed.

## Runtime, chi phí và side effects

Ví đầu lượt: $9.78, tổng dùng $0.2236, 19 API requests.
Ví cuối lượt sau reload: **$9.75**, tổng dùng **$0.2513**, **21 API requests**.
Delta tổng dùng **$0.0277**, thêm **2 provider API requests**; UI đã gửi 4 prompts.
Không suy số provider requests từ số prompt; không suy delta chính xác từ balance làm tròn.
Ngưỡng dừng $3 chưa chạm; không đổi sang Gemini.

Chỉ thêm các hội thoại test trên staging, giữ để user xem. Không sửa catalog/database,
source ứng dụng, secret, commit/push hoặc deploy mới trong lượt retest này.
Root checkout và checkout plan 096 đều có thay đổi có sẵn; không ghi đè chúng.

## Evidence và giới hạn

Thư mục local: `.local-data/brave-focused-retest-20261008/`.

- `case-10-dom.txt`, `case-10.png`: WHO.
- `case-15-dom.txt`, `case-15.png`: Ronaldo.
- `case-9-dom.txt`, `case-9.png`: bài ngực; ảnh ở cuối câu trả lời.
- `case-8-dom.txt`, `case-8-presentation.png`: lịch tập và bố cục đoạn dài.
- `deployed-search-source.txt`: source lấy từ textbox file content của GitHub đúng SHA.
- `wallet-final-dom.txt`: wallet UI cuối lượt; giữ local, không đưa nội dung riêng vào Git.

Đã kiểm tra rendered UI, DOM, runtime log tối thiểu, source đúng SHA và wallet.
Không chạy lại build/unit/E2E/source UI audit: lượt này không sửa code ứng dụng.
Không chứng nhận local candidate; chưa chạy live Brave synthesis của candidate mới.

## Bước cần tiếp theo

Hoàn tất QA/review candidate plan 096, đưa bản sửa Brave và presentation lên staging,
rồi chỉ retest hai câu search và câu lịch tập. Catalog ca 9 cần review/patch riêng theo
preimage/receipt/rollback; không tự ghi dữ liệu để đổi grade. Redeploy thêm cùng
`f52db97` sẽ giữ nguyên lỗi đã chứng minh.
