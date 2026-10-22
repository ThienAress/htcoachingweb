# Plan 112: Giảm nhận diện nhầm của bộ lọc quyền riêng tư Knowledge Base

> **Hướng dẫn thực thi**: Làm tuần tự từng step. Chạy mọi verification và xác nhận kết quả trước khi sang step kế. Gặp STOP condition thì dừng
> và báo cáo, không improvise.
>
> **Drift check (chạy đầu tiên)**: `git log -5 --oneline -- server/src/services/ai/knowledgePrivacy.js server/src/services/ai/personalHealthData.js`
> và so excerpt trong "Current State". Không khớp thì STOP.

Spec canonical: [`docs/specs/knowledge-privacy-false-positive-tuning.md`](../specs/knowledge-privacy-false-positive-tuning.md).

## Status

- **Priority**: P1
- **Complexity**: COMPLEX
- **Effort**: M
- **Risk**: HIGH (bộ lọc quyền riêng tư; sai theo hướng nới có thể để lọt dữ liệu cá nhân vào kho kiến thức)
- **Depends on**: Plan 096C (cùng nhóm 28 bản nháp)
- **Category**: security
- **Planned at**: 2026-10-22
- **Lifecycle**: IN PROGRESS
- **Verification**: FOCUSED
- **Rollout**: NOT STARTED
- **Owner**: root
- **Updated at**: 2026-10-22

## Why This Matters

Admin bấm "Cập nhật" mục kiến thức production (ví dụ "Skinny Fat") và nhận lỗi chung "không được chứa dữ liệu sức khỏe hoặc định danh cá nhân" dù đã có nguồn.
Chạy bộ lọc offline cho thấy nguyên nhân là nhận diện nhầm: thuật ngữ thể hình viết hoa bị coi là tên người, dòng dẫn nguồn có chữ "Sports Medicine"
bị coi là sức khỏe cá nhân, DOI/PMID trong tiêu đề nguồn bị coi là mã định danh. Cùng bộ lọc còn chặn các câu khách hay hỏi ("Em bị béo bụng thì nên tập gì?")
ở bước tìm kiếm nội bộ. 28/28 bản nháp production đang không xuất bản được (Plan 096C). Mục tiêu: nới đúng chỗ nhận diện nhầm, giữ chặn mọi định danh và dữ liệu y tế
cụ thể gắn với một người.

## Current State

- `server/src/services/ai/knowledgePrivacy.js` (1797 dòng): `validateKnowledgeEntryPrivacy` (dòng 1637) ghép question, matchedQuestion, answer, variants, tags thành một khối rồi kiểm
  `containsSensitivePersonalHealth` (1191) → `hasDirectKnowledgeIdentifier` trên nội dung và metadata nguồn → `extractContextualPrivateNames` / `extractUnboundPrivateNames`
  (tên riêng viết hoa) → heuristic metadata nguồn → `sourceUrlPrivateRecordRisk`. Lý do trả về: `sensitive_personal_health`, `direct_identifier`, `ambiguous_person_identity`.
- `prepareKnowledgeRetrievalQuery` (1579) và `prepareExternalKnowledgeQuery` (1525): lọc truy vấn tìm kiếm nội bộ và gửi ra ngoài; có trường `eligible`, `redacted`.
- `server/src/services/ai/personalHealthData.js` (365 dòng): nhận diện dữ liệu sức khỏe cá nhân.
- `server/src/controllers/knowledgeBase.controller.js`: `validateFullKnowledgeEntry` (260) gọi validator ở `createEntry` (~433), `updateEntry` (~534), tạo từ cuộc trò chuyện và gợi ý AI; trả 400 `KNOWLEDGE_QUERY_SENSITIVE`
  với thông báo chung.
- Test hiện có: `server/src/services/ai/__tests__/knowledgePrivacy.test.js`, `.generalSyntax`, `.generalTerms`, `.organizationAcronym`, `.publicFigureLookup`, `.publicRole`, và `personalHealthData.test.js`.
- Bằng chứng offline (2026-10-22, mục "Skinny Fat", chỉ đọc):
  - tiêu đề nguồn có `(DOI: … ) (PMID: …)` → `direct_identifier`;
  - câu "Ưu tiên … Body Recomposition (Tăng cơ, giảm mỡ cùng lúc)." và "…(Progressive Overload) — …" → `ambiguous_person_identity`;
  - "Cardio: …hỗ trợ tim mạch." và "Nguồn tham khảo: NASM (National Academy of Sports Medicine)…" → `sensitive_personal_health`;
  - "Em bị béo bụng…", "Mình bị thừa cân 10kg…", "Tôi bị đau lưng…", "Tôi bị tiểu đường type 2…" → bị chặn cả ở mục kiến thức lẫn truy vấn nội bộ.
- Production: 67 mục (28 nháp, 39 đã xuất bản). Không commit nội dung KB production vào repo (Plan 096C).

## Commands You Will Need

| Mục đích | Lệnh (PowerShell, tại root repo) | Mong đợi |
|---|---|---|
| Test bộ lọc | `fnm exec --using=22.23.1 cmd /c "cd server && npx vitest run src/services/ai/__tests__/knowledgePrivacy.test.js src/services/ai/__tests__/knowledgePrivacy.generalSyntax.test.js src/services/ai/__tests__/knowledgePrivacy.generalTerms.test.js src/services/ai/__tests__/knowledgePrivacy.organizationAcronym.test.js src/services/ai/__tests__/knowledgePrivacy.publicFigureLookup.test.js src/services/ai/__tests__/knowledgePrivacy.publicRole.test.js src/services/ai/__tests__/personalHealthData.test.js"` | pass |
| Server unit | `npm run test:unit:server` | pass |
| Cấu hình agent | `npm run agents:validate` | ALL PASS |
| Inventory | `npm run agents:inventory` rồi `npm run agents:inventory:check` | đồng bộ |
| Secret | `npm run security:secrets` | pass |

## Scope

**In scope**
- `server/src/services/ai/knowledgePrivacy.js`, `server/src/services/ai/personalHealthData.js`, module hằng số thuật ngữ mới trong `server/src/services/ai/` (nếu cần).
- Test tương ứng trong `server/src/services/ai/__tests__/`.
- Docs: spec này, `docs/specs/fitness-first-ai-and-knowledge-quality.md` (mục chính sách), `docs/plans/README.md`, `plan-state.json`, `traceability/112.json`.
- Quy tắc lưu ý bác sĩ trong prompt trợ lý chỉ khi Step 6 chứng minh còn thiếu (dùng skill `ai-chat-system`).

**Out of scope**
- Schema, route, auth, quota, client, thông báo lỗi chung (đề xuất hiển thị lý do cụ thể là follow-up).
- Tiểu sử VĐV công khai có năm sinh và chuyện gia đình (Plan 096C).
- Sửa, xuất bản hay xóa mục nào trên production; chạy migration hoặc script ghi dữ liệu.

## Steps

### Step 1: Đo baseline trên 67 mục production (chỉ đọc, chỉ ghi số đếm)

Đọc 67 mục qua phiên admin (`GET /api/knowledge-base` và `/:id/variants`), chạy `validateKnowledgeEntryPrivacy` offline và ghi: số mục theo lý do, số câu/cụm gây lỗi theo nhóm
(thuật ngữ viết hoa, dẫn nguồn, từ y khoa, DOI/PMID, tự mô tả, định danh thật). Bản chụp chỉ nằm trong scratchpad, bị xóa sau khi đo; báo cáo chỉ có số đếm và id rút gọn.

**Behavior**: có bảng baseline "mục × lý do" và danh sách nhóm nhận diện nhầm xếp theo số mục ảnh hưởng.
**Blast radius**: không có file repo nào đổi (kết quả ghi vào plan này).
**Depends on**: owner cho phép đường chuyển dữ liệu từ trình duyệt về máy (cần máy nhận cục bộ hoặc chuyển theo từng đoạn).
**Verify**: bảng baseline được dán vào mục "Kết quả đo" cuối plan; `git status` không có file dữ liệu KB.

### Step 2: Viết test đỏ cho từng nhóm (RED)

Thêm test tổng hợp (câu tự viết, không dùng nội dung production) cho: thuật ngữ viết hoa, dẫn nguồn, từ y khoa ngữ cảnh chung, DOI/PMID trong tiêu đề nguồn, tự mô tả tình trạng thông thường (cả ở truy vấn nội bộ), **và** các ca phải vẫn bị chặn
(số điện thoại, email, ngày sinh, địa chỉ, "Tôi tên là … bị …", kết quả xét nghiệm, thuốc kèm liều, URL bản ghi riêng tư).

**Behavior**: bộ test mới đỏ đúng chỗ nhận diện nhầm, xanh ở các ca chặn.
**Blast radius**: `server/src/services/ai/__tests__/knowledgePrivacy.falsePositives.test.js` (mới).
**Depends on**: Step 1 (danh sách thuật ngữ).
**Verify**: chạy file test mới → chỉ các ca nhận diện nhầm đỏ; các test hiện có vẫn xanh.

### Step 3: Thuật ngữ viết hoa, dẫn nguồn và từ y khoa ngữ cảnh chung

Bổ sung danh sách thuật ngữ thể hình/dinh dưỡng và tổ chức nổi tiếng cho nhánh tên riêng; chỉ coi từ y khoa là sức khỏe cá nhân khi có dấu hiệu ngôi thứ nhất hoặc đối tượng cụ thể.
Sửa nhỏ nhất ở `extractUnboundPrivateNames`, `extractContextualPrivateNames`, `containsSensitivePersonalHealth`.

**Behavior**: câu giáo dục có thuật ngữ viết hoa và dòng dẫn nguồn qua; ca "vẫn chặn" của Step 2 vẫn chặn.
**Blast radius**: `knowledgePrivacy.js`, `personalHealthData.js`, module hằng số.
**Depends on**: Step 2.
**Verify**: toàn bộ lệnh "Test bộ lọc" → pass; không kỳ vọng cũ nào bị đổi (nếu đổi, ghi lý do vào plan).

### Step 4: DOI/PMID trong tiêu đề nguồn

Cho phép đúng mẫu `DOI: 10.\d{4,9}/…` và `PMID: \d{6,9}` chỉ trong tiêu đề nguồn (`sourceMetadataFields`); các trường khác giữ nguyên chặn mã định danh.

**Behavior**: nguồn PubMed giữ nguyên tiêu đề có DOI/PMID mà không bị chặn; cùng chuỗi trong câu trả lời vẫn bị chặn.
**Blast radius**: `knowledgePrivacy.js` (`hasDirectKnowledgeIdentifier` theo ngữ cảnh trường).
**Depends on**: Step 2.
**Verify**: test AC-004 hai chiều pass; test hiện có pass.

### Step 5: Tự mô tả tình trạng thông thường (bậc 2)

Cho phép xưng ngôi thứ nhất kèm tình trạng thông thường khi không có định danh, ở `validateKnowledgeEntryPrivacy` và `prepareKnowledgeRetrievalQuery`; giữ chặn khi có định danh hoặc dữ liệu y tế cụ thể (bậc 1).

**Behavior**: "Tôi bị skinny fat…", "Em bị béo bụng…", "Tôi bị đau lưng…", "Tôi bị tiểu đường type 2…" được chấp nhận; cùng câu kèm tên, số điện thoại hoặc kết quả xét nghiệm vẫn bị chặn.
**Blast radius**: `knowledgePrivacy.js`, `personalHealthData.js`.
**Depends on**: Step 3.
**Verify**: test AC-005, AC-006, AC-007 pass; `npm run test:unit:server` pass.

### Step 6: Truy vấn gửi ra ngoài và lưu ý bác sĩ

(a) Xác nhận bằng test rằng `prepareExternalKnowledgeQuery` không để mô tả bệnh cá nhân hoặc định danh ra ngoài; nếu bậc 2 làm hở thì chặn lại hoặc cắt phần mô tả (`redacted: true`).
(b) Kiểm trợ lý có nói lưu ý tham khảo bác sĩ khi khách nêu bệnh lý nặng (đọc system prompt và chạy bộ AI eval hiện có theo skill `ai-chat-system`); chỉ thêm một dòng quy tắc nếu thiếu.

**Behavior**: truy vấn gửi ra ngoài giữ mức chặt hiện tại; trả lời cho bệnh lý nặng có lưu ý bác sĩ.
**Blast radius**: `knowledgePrivacy.js` (truy vấn ngoài), có thể một dòng trong prompt ở `server/src/services/ai/`.
**Depends on**: Step 5.
**Verify**: test AC-008, AC-009 pass; nếu sửa prompt thì `npm run test:ai-eval` pass.

### Step 7: Đo lại, rà bảo mật, cập nhật tài liệu

Chạy lại phép đo Step 1 với code mới. Yêu cầu: số mục bị chặn giảm, 0 mục đã xuất bản bị chặn thêm, các ca định danh thật vẫn bị chặn. Cho `security-reviewer` rà diff; cập nhật spec chất lượng kiến thức và `traceability/112.json`.

**Behavior**: có bảng trước/sau và kết luận review.
**Blast radius**: docs; không đổi code ngoài sửa theo review.
**Depends on**: Step 6.
**Verify**: `npm run test:unit:server`, `npm run agents:validate`, `npm run agents:inventory:check`, `npm run security:secrets` đều pass; review không có finding chặn.

### Step 8: PR vào staging và kiểm lại bằng tay

Mở PR vào `staging`; sau khi merge và deploy (theo skill `staging-verify`), admin thử lại thao tác "Cập nhật" trên mục kiến thức tương tự ở staging. Production chỉ nhận thay đổi qua quy trình release thông thường (`.claude/rules/release-promotion.md`), không bấm "Cập nhật" hay xuất bản thay owner.

**Behavior**: mục từng bị chặn lưu được trên staging.
**Blast radius**: không.
**Depends on**: Step 7.
**Verify**: bảng `PASS | FAIL | NOT RUN` của `staging-verify`.

## Test Plan

- Test tổng hợp mới `knowledgePrivacy.falsePositives.test.js` (Step 2) chia theo AC-001 … AC-009, mỗi nhóm có ca "cho qua" và ca "vẫn chặn".
- Giữ nguyên các test `knowledgePrivacy*` và `personalHealthData` hiện có; mô hình cấu trúc theo `knowledgePrivacy.generalTerms.test.js`.
- Expected value viết tay từ ví dụ, không tính lại bằng chính regex của code.
- `npm run test:unit:server` toàn bộ trước khi mở PR.

## Done Criteria

- [ ] Bảng baseline (Step 1) và bảng sau khi sửa (Step 7) nằm trong plan; 0 mục đã xuất bản bị chặn thêm.
- [ ] Mọi ca "vẫn chặn" (số điện thoại, email, ngày sinh, địa chỉ, tên + thông tin cá nhân, xét nghiệm, thuốc kèm liều, URL riêng tư) pass.
- [ ] Test `knowledgePrivacy*` và `personalHealthData` hiện có pass; kỳ vọng đổi (nếu có) có lý do.
- [ ] `security-reviewer` không có finding chặn.
- [ ] Không có nội dung Knowledge Base production trong repo hoặc log; scratchpad đã xóa bản chụp.
- [ ] Không có thao tác ghi nào lên production.
- [ ] `docs/plans/README.md`, `plan-state.json`, `traceability/112.json` cập nhật.

## STOP Conditions

- Code ở "Current State" không khớp (validator đã đổi cấu trúc).
- Một ca "vẫn chặn" trở thành cho qua và không sửa được mà không làm hở thêm ca khác.
- Cần đổi hành vi truy vấn gửi ra ngoài ngoài mức đã mô tả, hoặc sửa prompt ngoài một dòng lưu ý.
- Số đo cho thấy mục đã xuất bản bị chặn thêm sau thay đổi.
- Cần ghi, sửa, xuất bản hoặc xóa mục trên production để kiểm chứng.
- Verification thất bại hai lần sau sửa có căn cứ.

## Maintenance Notes

- Mọi thuật ngữ thêm vào danh sách cho qua phải có test "vẫn chặn" tương ứng cho cùng dạng câu có định danh.
- Reviewer soi: nhánh cho qua không dựa vào vai trò admin; không có đường cho dữ liệu từ cuộc trò chuyện vượt qua bậc 1; không log nội dung.
- Follow-up deferred: hiển thị lý do cụ thể (không lộ nội dung) trong lỗi cho admin; quyết định riêng cho tiểu sử VĐV công khai (Plan 096C).

## Kết quả đo

(điền ở Step 1 và Step 7)

### Baseline (Step 1, 2026-10-22, từ file xuất của nút "Tải toàn bộ": 67 mục, 28 nháp và 39 đã xuất bản)

- Bộ lọc hiện tại chặn **62/67** mục (28/28 nháp, 34/39 đã xuất bản): `sensitive_personal_health` 50, `ambiguous_person_identity` 12.
- Phần gây chặn theo thành phần: câu trả lời (sức khỏe 45, tên người 15), biến thể câu hỏi (tên người 44, sức khỏe 27), câu hỏi (tên người 22), nguồn (DOI/PMID 5).
- Nhóm nhận diện nhầm xác định bằng cách đo từng hàm: thuật ngữ thể hình viết hoa (Body Recomposition, Fat Burner, Mass Gainer...), địa danh/tổ chức (Việt Nam, Hoa Kỳ, NASM...), từ chức năng đầu câu (Nếu, Không, Khi...), tiêu đề tài liệu chứa từ y khoa, DOI/PMID trong nguồn, mô tả tình trạng thông thường (bậc 2). Tên vận động viên công khai (tiểu sử) thuộc Plan 096C, không đổi ở đây.

### Step 3 (2026-10-22)

- Thêm `server/src/services/ai/knowledgeGeneralTerms.js` (từ vựng khái niệm chung, tiêu đề tài liệu) và 8 từ chức năng vào `NON_NAME_CAPITALIZED_STARTS`.
- Đo lại: **53/67** mục còn bị chặn (từ 62); 14 mục hợp lệ (11 đã xuất bản, 3 nháp). 0 mục hợp lệ trước đó bị chặn thêm.
- Test bộ lọc cũ 657/657 pass; test mới AC-001/002/003 và các ca "vẫn chặn" pass; AC-004 (Step 4) và AC-005 (Step 5) còn đỏ theo kế hoạch.

### Step 4 (2026-10-22)

- Thêm `stripBibliographicIdentifiers` trong `knowledgePrivacy.js`: bỏ qua DOI (có nhãn `DOI:` hoặc `doi.org/`) và PMID (có nhãn) chỉ ở tiêu đề/nhà xuất bản và URL nguồn; hậu tố DOI có dạng số điện thoại Việt Nam vẫn bị chặn.
- Đo lại 67 mục: nguồn bị chặn vì mã định danh giảm từ 5 xuống **0**. Số mục bị chặn toàn bộ vẫn 53 vì các phần khác (biến thể "Tôi bị...", nội dung "khách hàng bị...", tiểu sử vận động viên) còn lại thuộc Step 5 và Plan 096C.
- Còn lại ngoài phạm vi: 3 câu trả lời chứa số điện thoại và email liên hệ của HTCOACHING (thông tin liên hệ doanh nghiệp) bị chặn đúng theo bậc 1; cần quyết định riêng nếu muốn cho phép liên hệ doanh nghiệp đã đăng ký.
- Test bộ lọc: 666/666 pass; nhóm test Knowledge: 26 file / 833 test pass. Test AC-005 (tự mô tả tình trạng) chưa đưa vào commit, thêm ở Step 5.

### Rà soát bảo mật độc lập (Step 3 và 4, 2026-10-22)

- `security-reviewer`: 0 BLOCK/HIGH. 1 MED đã sửa: pattern DOI nuốt toàn bộ phần đuôi nên email, số điện thoại hoặc token sau `doi.org/10.x/...?email=...` lọt qua; nay DOI chỉ gồm ký tự hợp lệ, phần dư vẫn được kiểm định danh, và DOI có đoạn số giống số điện thoại Việt Nam vẫn bị chặn. 1 LOW đã sửa: địa danh/danh hiệu trong từ vựng không còn bị hạ chữ thường khi đứng sau từ xưng hô (Chị/Ông/Ms...), nên "Chị Thanh Hóa" vẫn bị coi là tên.
- Rủi ro còn lại đã biết: CCCD 12 chữ số nằm trong hậu tố DOI không phân biệt được với DOI số thật (ví dụ 201010050); chấp nhận vì chỉ áp ở tiêu đề/URL nguồn do admin nhập.
- Ngoài phạm vi review: `sourceUrlPrivateRecordRisk`, phía controller (ai được tạo entry kèm nguồn).
