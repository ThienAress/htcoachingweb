# Spec: TDEE có độ tin cậy, độ phức tạp bài tập và Tiến trình cơ thể

## Objective

Nâng ba capability ưu tiên cho cộng đồng và khách hàng:

1. TDEE là một ước tính có giải thích, không suy hệ số vận động chỉ từ số buổi tập và không tự chọn mức vận động ngầm.
2. Thư viện bài tập hiển thị `Độ phức tạp kỹ thuật` từ 1–5 sao theo rubric có thể kiểm tra, tách khỏi mức tạ/cường độ cá nhân.
3. Today/Progress hiển thị `Tiến trình cơ thể` theo phong cách báo cáo trực quan: giá trị hiện tại, thay đổi và lịch sử từ dữ liệu đo thật.

Thành công nghĩa là web, AI Chat, Admin và read model dùng cùng semantics; dữ liệu thiếu được trình bày là thiếu, không biến thành mặc định hoặc chỉ số suy đoán.

## Vocabulary và product contract

### TDEE estimate

- BMR mặc định dùng Mifflin–St Jeor; Katch–McArdle vẫn là lựa chọn khi người dùng có `% mỡ` hợp lệ.
- Hệ số hoạt động phản ánh vận động cả ngày: công việc/di chuyển, bước chân và thời lượng/cường độ tập. Số buổi tập đơn lẻ không quyết định hệ số.
- Kết quả phải có estimate trung tâm, khoảng ước tính và giải thích nguồn sai số.
- Không dùng copy “chính xác”; không dùng kết quả như chẩn đoán hoặc đơn thuốc dinh dưỡng.
- Web và AI Chat không được mặc định/fallback im lặng sang `moderate = 1.55`.
- Người dùng được hướng dẫn theo dõi tối thiểu 14 ngày rồi hiệu chỉnh nhỏ dựa trên xu hướng cân nặng và mức tuân thủ; hệ thống không tự đổi mục tiêu calo khi thiếu dữ liệu.

### Exercise technical complexity

- Tên canonical: `Độ phức tạp kỹ thuật`; không gọi là “mức nặng”.
- Năm tiêu chí, mỗi tiêu chí 0–2: phối hợp kỹ thuật, thăng bằng/ổn định, mobility/ROM, setup/thiết bị và hậu quả khi sai.
- Tổng 0–1 → 1 sao; 2–3 → 2 sao; 4–5 → 3 sao; 6–7 → 4 sao; 8–10 → 5 sao.
- Chỉ có rating khi đủ cả năm tiêu chí. Bài cũ hoặc rubric chưa hoàn tất trả `null` và hiển thị `Chưa đánh giá`.
- Sets, reps, tempo, tải, RPE/RIR và mức phù hợp với một khách cụ thể không nằm trong số sao này.

### Body progress

- Tên UI canonical: `Tiến trình cơ thể`.
- MVP dùng `weightKg` và `waistCm` từ Weekly Check-in đã submit/reviewed.
- Mỗi metric ghi rõ đơn vị, ngày đo, delta từ lần đầu đến lần gần nhất trong khoảng và chuỗi lịch sử.
- Missing data không thành zero. Không tạo InBody score, mỡ nội tạng, khối cơ hoặc phân đoạn tay/chân khi không có nguồn đo.
- Không auto-link F1 bằng email và không thêm nguồn dữ liệu sức khỏe mới trong release này.

## Affected architecture

- TDEE public page và HT Assistant tool/card; tool schema vẫn yêu cầu input rõ ràng và fail closed.
- `Exercise` Mongoose model, controller allowlist/query, Admin editor và public exercise library.
- Progress source/read model và presentation dùng chung cho khách hàng cùng góc nhìn trainer/admin hiện có.
- Không thêm dependency, public route, entitlement, migration ghi dữ liệu thật hoặc external provider.

## UX brief

- Audience: khách tự ước tính năng lượng; HLV/admin quản lý bài tập; khách và HLV theo dõi thay đổi cơ thể.
- Surface mode: TDEE là `Operate + Read`; Exercise là `Operate`; Body Progress là `Read`.
- Product palette giữ slate cùng orange/emerald/cyan hiện có, không gradient text/glass card mới.
- TDEE ưu tiên giải thích quyết định; sao có tooltip/legend; body report dùng hàng chỉ số và đường xu hướng thay vì sao chép thương hiệu InBody.
- Loading, empty, error, disabled và keyboard/focus states phải rõ trên desktop/mobile.

## Compatibility và data policy

- `technicalDifficulty` là optional/null; document Exercise cũ không cần backfill và không fail validation.
- API Exercise hiện có giữ response envelope và route/method; filter mới là additive.
- Progress response thêm `bodyProgress` theo version mới nhưng giữ `weightTrend` trong compatibility window cho consumer cũ.
- WeeklyCheckin schema không đổi; chỉ mở projection/read model cho `waistCm` đã tồn tại.
- Không chạy migration/seed/staging/production write trong implementation này.

## Testing strategy

- TDD cho activity recommendation/uncertainty, AI tool invalid activity và no-default UI state.
- Model/controller/service tests cho rubric đầy đủ, incomplete → null, filter và backward compatibility.
- Progress read-model/presentation tests cho weight + waist, một điểm đo, missing data và date ordering.
- Focused tests mỗi phase, sau đó client/server unit, lint, compile/release build phù hợp, AI tool validation, UI check và code review độc lập.

## Success criteria

- [ ] TDEE web và AI Chat không còn default/fallback activity ngầm; cùng labels/multipliers và cùng uncertainty contract.
- [ ] Kết quả TDEE nói rõ đây là ước tính, hiển thị khoảng hợp lý và hướng dẫn hiệu chỉnh sau 14 ngày.
- [ ] Exercise rating chỉ xuất hiện khi đủ rubric; Admin sửa được rubric; public list lọc/đọc được 1–5 sao hoặc `Chưa đánh giá`.
- [ ] Exercise cũ không cần migration và vẫn đọc/sửa bình thường.
- [ ] Progress trả và hiển thị cân nặng + vòng eo với current/delta/history; không bịa chỉ số khi thiếu nguồn.
- [ ] Khách và góc nhìn trainer/admin hiện có dùng cùng read model và ownership guard.
- [ ] Không regress sidebar HLV đang thay đổi trong working tree.

## Boundaries

- Always: server-authoritative validation, service/API patterns hiện có, noindex/private route hiện có, test trước behavior.
- Ask first: migration/backfill dữ liệu thật, thêm body-composition field mới, tự động thay đổi mục tiêu calo.
- Never: chẩn đoán y khoa, InBody score giả, default Exercise thành 1 sao, default TDEE thành 1.55, log raw health data.
