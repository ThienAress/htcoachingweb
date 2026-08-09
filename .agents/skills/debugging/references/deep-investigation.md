# Deep Investigation

Đọc toàn bộ file này khi dùng Mode 2. Không áp workflow này cho typo, syntax error, build error rõ nguyên nhân hoặc UI styling đơn giản.

## Kết quả bắt buộc

Tạo một evidence log ngắn gồm:

- Bug contract: expected, actual, môi trường và fixture/input đã redact.
- Feedback command đã chạy và bằng chứng RED trước fix, GREEN sau fix.
- 3–5 hypotheses có thứ hạng; prediction, probe và kết quả cho từng hypothesis đã thử.
- Root cause đã chứng minh, regression seam và verification cuối.
- Instrumentation đã dọn; post-mortem hoặc lý do không cần post-mortem đầy đủ.

## 1. Thiết lập feedback loop

Chọn và **chạy thật** một command có hai trạng thái:

- RED khi behavior sai; GREEN khi behavior đúng. Command chỉ in log hoặc luôn exit `0` không phải red-capable.
- Ưu tiên deterministic, nhanh, chạy lại độc lập và agent-runnable: một test file/test name, script repro nhỏ, request local có assertion hoặc Playwright spec hẹp.
- Cố định fixture, seed, clock/randomness và environment liên quan khi khả thi. Không phụ thuộc thao tác browser thủ công nếu Playwright hoặc test harness hiện có mô tả được behavior.
- Dùng đúng public behavior; không mock chính đoạn code đang bị nghi ngờ.

Không patch khi chưa có bằng chứng RED. Nếu bug chỉ xuất hiện ở production, tiếp tục điều tra read-only bằng code, history và logs đã redact; dựng fixture local từ metadata tối thiểu. Nếu không thể chạy command red-capable an toàn, báo blocker/proof gap và không tuyên bố đã chứng minh root cause hoặc fix.

## 2. REPRODUCE và REDUCE

Ghi chính xác môi trường, điều kiện, tần suất và các bước trigger. Với bug intermittent, chạy lặp có giới hạn và ghi tỷ lệ fail thay vì gọi một lần pass là fixed.

Giảm reproduction về input và đường đi nhỏ nhất nhưng vẫn RED. Mỗi lần loại đúng một yếu tố và hỏi: “Nếu bỏ X, bug còn không?”. Không thay đổi nhiều biến hoặc sửa nhiều nguyên nhân trong cùng vòng.

## 3. LOCALIZE bằng hypotheses falsifiable

Lập 3–5 hypotheses trước khi thêm probe. Xếp hạng theo evidence và khả năng giải thích toàn bộ triệu chứng, không theo trực giác. Dùng format:

```text
H1 — Cause: <nguyên nhân cụ thể>
Evidence for/against: <bằng chứng hiện có>
Prediction: nếu H1 đúng, <probe> sẽ cho <kết quả quan sát được>; nếu sai, <kết quả khác>
```

Mỗi probe phải:

1. Gắn với đúng một hypothesis và prediction viết trước khi chạy.
2. Chỉ thay đổi một biến hoặc quan sát một boundary.
3. Ghi command/action và actual result.
4. Đánh dấu hypothesis là `supported`, `weakened` hoặc `rejected`, rồi xếp hạng lại.

Không thêm logging rải rác rồi diễn giải sau. Với flow dài, dùng Binary Search: đo ở boundary giữa; nửa nào vi phạm invariant thì tiếp tục chia đôi. Ví dụ `Client → Route → Controller → Service → Mongoose → Response`: kiểm tra contract tại Controller trước, rồi chia tiếp về phía producer hoặc consumer theo kết quả.

Sau tối đa ba vòng không tăng evidence hoặc không thu hẹp được phạm vi, dừng patch thử-sai; báo feedback command, hypotheses đã bác bỏ, proof gap và input cần thêm.

## 4. FIX và regression seam

Chỉ patch nguyên nhân đã được probe phân biệt chứng minh. Giữ fix tối thiểu; không refactor code lân cận. Chạy feedback command để xác nhận GREEN và kiểm tra negative/adjacent case tương xứng.

Trước fix, chuyển reproduction thành failing regression test và chạy để ghi RED. Đặt test ở public seam gần behavior nhất, không chọn seam chỉ vì đó là file sắp sửa:

- Pure business rule/helper/service: unit test qua API công khai của module.
- HTTP contract, middleware, auth, ownership hoặc validation: integration test qua route bằng Supertest.
- Component behavior: test qua UI observable với Testing Library; không assert implementation detail.
- Cookie, navigation hoặc flow xuyên client-server: E2E bằng Playwright khi unit/integration không chứng minh được bug.

Đọc `../../tdd-guide/SKILL.md` khi cần convention, setup helper hoặc command test của repo. Không export production internals chỉ để test. Nếu test harness không thể quan sát behavior một cách an toàn, ghi rõ proof gap và dùng feedback command tương đương; không tuyên bố bug đã có regression guard.

## 5. Instrumentation, security và GUARD

Gắn cùng một tag dễ tìm cho mọi probe tạm, ví dụ `DEBUG(<issue-id>)`. Chỉ instrument local; dùng `safeLog` với metadata allowlist. Không log raw body, token, cookie, authorization header, health/financial data, nội dung hội thoại, credential hoặc PII. Không giảm CSRF, auth, ownership, validation hay rate limit để reproduction chạy được.

Trước bàn giao, chạy `rg -n "DEBUG\(<issue-id>\)" <paths>` và yêu cầu không còn kết quả; xóa script/fixture/log tạm không thuộc regression guard. Thêm comment chỉ khi fix không self-evident; ghi known issue khi bug nghiêm trọng và còn constraint vận hành.

## 6. Post-mortem tương xứng

Với production incident, security/data exposure, lỗi lặp lại hoặc blast radius lớn, ghi: impact, timeline ngắn, root cause, vì sao guard cũ bỏ sót, fix, prevention owner/check và remaining risk. Với Deep Investigation rủi ro thấp, chỉ cần closing note gồm root cause, evidence RED → GREEN, guard mới và remaining risk; không tạo ceremony dài.
