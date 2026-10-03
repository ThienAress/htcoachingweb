# HT Assistant staging UI15 và remediation tiếp theo — 2026-10-04

## Kết quả

PR #190 đã deploy trước khi kiểm thử. Đã thu đủ 15 câu qua UI staging thật,
không dùng API mock, không thay response hoặc route. Chấm bảo thủ:
**10 PASS / 2 PARTIAL / 3 FAIL (66,7%)**; chưa đạt ≥14/15. Global UI-source gate
còn HOLD vì legacy redirect chips hiện chung nhãn “Nguồn”. Không production GO.

Raw automated grade giữ nguyên **9 PASS / 6 FAIL**. Manual adjudication bổ sung
PASS cho 8/10 theo frozen rubric, giữ 11 non-PASS và hạ 9 thành PARTIAL khi
scientific review xác nhận kỹ thuật quỳ mâu thuẫn. Không sửa corpus, oracle,
numeric tolerance hoặc chọn kết quả tốt nhất giữa nhiều lượt.

## Promotion và deployment identity

- [PR #190](https://github.com/ThienAress/htcoachingweb/pull/190) đã merge.
- Merge SHA: `2578b4fd9db492ce2b17dba84698446b5daf9639`.
- [CI merge](https://github.com/ThienAress/htcoachingweb/actions/runs/37147584408): 5/5 jobs SUCCESS.
- Netlify staging READY deploy `6ac155ae5aff3000086521ea`.
- Render staging LIVE deploy `dep-db0ldm7avr4c7388e2a0`.
- Netlify/Render cùng exact SHA; alias HTML và 29 assets khớp immutable deploy;
  bundle có API staging. Candidate HEAD `75a15efe...` cùng tree merge
  `f21f71ef9a6de933ff92394d6a766fcde10540f9`.
- Runtime trước/sau và từng case: exact SHA trên, boot UUID
  `22d57435-084a-4e4f-b905-b80018eb1835`.

Không còn test bản `32cf6e8` do Netlify 300 phút cũ trong lượt này. Deployment
identity được xác minh lại sau run; không dùng QA local thay cho identity live.

## Bộ câu hỏi và collection

Run `bf47cda7-3824-45a1-8430-122ba24d07f3`, round3,
`2026-10-03T20:00:01Z → 20:03:12Z` (03:00–03:03 ngày 04/10 tại Việt Nam).
Corpus là **14 câu gốc + replacement5**, 13 conversations; giữ chains 4→5, 6→7.
Không gọi đây là exact original15 hoặc certified AC-009 reliability cohort.

15/15 dispatch/render/persisted assistant-ID binding được thu; DOM/cards,
source anchors, avatar/click, screenshots và runtime metadata nằm trong ignored
local captures. Provider thật được quan sát tại nhánh cần provider; các phản hồi
canonical/draft deterministic không tạo request model và được ghi trace riêng.
`domContainsResponse=false` ở Markdown/formatted responses không đồng nghĩa
thiếu text: đối chiếu DOM normalized, cards và screenshot theo đúng assistant ID.

| Câu | Kết quả | Evidence và giới hạn |
|---|---|---|
| 1 | FAIL | Bữa 600 kcal không gà: `safety_metadata_missing`, chưa tạo complete meal |
| 2 | PASS | 501,1 kcal / 30 g protein, không trứng, card/grams hợp lệ |
| 3 | PASS | 501,1 kcal / 30 g protein, không sữa/whey, card hợp lệ |
| 4 | PASS | 2.196 kcal / 140,2 g protein; cơm, cá, rau, đậu phụ |
| 5 | FAIL | Cá thay đậu phụ chưa có reviewed profile; `replacement_safety_metadata_missing` |
| 6 | PASS | 4 bữa, 2.500,2 kcal / 170,1 g protein; giá ước tính có provenance 127.347đ; ingredient evidence, không bảo đảm SKU/nhiễm chéo |
| 7 | PASS | Nhánh unavailable hợp lệ: baseline không có cơm/dầu, plan fingerprint giữ nguyên; không tuyên bố đã giảm kcal |
| 8 | PASS | 4 buổi, 45–55 phút, đúng tạ/dây, sets/reps/RPE/rest, progression và giảm khoảng 30% volume |
| 9 | PARTIAL | Đúng 5 tên/card và technique có mặt; Kneeling Push-up lại nói đầu–gót chân, chưa đạt scientific quality |
| 10 | PASS nội dung/click | WHO 150–300 / 75–150, tăng cường cơ bắp ≥2 ngày; grounded và nguồn liên quan; nhãn nguồn UI chung vẫn là finding |
| 11 | PARTIAL | 5 câu hỏi, không bịa kcal; thiếu “ước tính”, kinh nghiệm/thiết bị không ở nhóm ưu tiên canonical |
| 12 | PASS | Ví dụ 7 ngày có món/khẩu phần/trạng thái cân và tập/hồi phục; không bịa kcal cá nhân |
| 13 | PASS | Canonical cautious knee response; không externalize dữ liệu riêng; AAOS scoped citation click PDF đúng |
| 14 | PASS | TDEE form giữ chủ yếu ngồi, 8.000–11.999 bước, trên 60 phút; chưa tính khi thiếu body data |
| 15 | FAIL | `search_knowledge:timed_out`, provider_error; từ chối an toàn, chưa trả lời Ronaldo có nguồn |

Hai lượt trước dừng tại PDF source-click case13 và đều cleanup verified/residue0.
Chỉ round3 được tính là complete UI15; không ghép các câu riêng giữa các lượt.
Chromium PDF popup placeholder `":"` được nhận chỉ khi initial navigation đúng
href và final response 200/application/pdf; driver regression 5/5 PASS. Đây là
fix harness PDF, không phải sửa câu trả lời để tăng điểm.

## Manual source/scientific review

WHO sources click resolve tới PMC7719906, BMJ54(24):1451 và CardioSmart WHO2020.
[Primary paper metadata/abstract](https://pubmed.ncbi.nlm.nih.gov/33239350/)
khớp DOI `10.1136/bjsports-2020-102955` và khuyến nghị vận động. PMC CAPTCHA/BMJ403
không bị bypass. [WHO official guidelines](https://www.who.int/publications/i/item/9789240015128)
và [WHO fact sheet](https://www.who.int/news-room/fact-sheets/detail/physical-activity)
được dùng đối chiếu. Lexical grader tìm who.int trong redirect URI và chỉ tìm
“sức mạnh”, bỏ sót paper WHO và “tăng cường cơ bắp”; manual PASS không đổi oracle.

Câu 8 nêu 45–55 phút, đáp ứng frozen ≤60 phút. Helper đòi literal “60 phút” là
false flag; không tăng duration limit. Câu 11 vẫn non-PASS theo canonical intake.

[AAOS knee PDF](https://orthoinfo.aaos.org/globalassets/pdfs/2023-rehab_knee.pdf)
hỗ trợ nguyên tắc không tập xuyên đau; không chứng minh bài thay thế phù hợp
riêng từng người. Câu 13 giữ đúng phạm vi này.

[ACE bent-knee push-up](https://www.acefitness.org/resources/everyone/exercise-library/13/bent-knee-push-up/)
và [Mayo modified pushup](https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/modified-pushup/vid-20084674)
xác nhận gối làm điểm tựa và thân ổn định. Mô tả hiện tại của record Kneeling
không khớp, nên không tính PASS chỉ vì technical predicate/card matching xanh.

Sources chỉ hiện ở 10/13; 15 không có vì timeout. UI avatar là monogram, chưa
phải logo/favicon publisher thật. Legacy WHO source chips hiện N/“Nguồn”, gây
khó phân biệt mặc dù click tới đúng publications; đây là lỗi UI cần sửa.

## Cleanup và readiness lúc run

Cleanup `verified=true`, `residue=0` cho synthetic actor/conversations/quota/memory/
confirmation/moderation/acceptance claim/KB fixture do run tạo; không phải tổng
mọi collection staging bằng 0. Không xóa customer/seed. KB/provider usage counters
có thể tăng do chat thật, không rollback counters nghiệp vụ.

KB receipt `2026-10-03T19:34:36Z`: 26 published/reviewed, 2 HOLD, content/source/
embedding và root/variant index READY/queryable. Không republish/reembed để cứu điểm.
Backup `production-logical-backup-20261003T032918Z-e241eacf9e4ea846` hoàn tất
03:31:10.803Z, integrity/isolated restore/off-device verified, fresh lúc run;
PITR false. Root manifest mới được dùng; manifest Sep26 trong candidate không
được dùng để giả freshness.

## Nguyên nhân và bản sửa local tiếp theo

Read-only catalog: 386 Food, 3 reviewed, 1 specific-food scope; các cá unreviewed.
Câu 1 loại gà nên thiếu nguồn đạm reviewed; câu 5 fail closed vì cá chưa review.
Không nới safety guard hoặc tự đánh dấu cả catalog reviewed.

Đã chuẩn bị [đề xuất hai records](../operations/runbooks/ai-staging-catalog-followup-2026-10-04.md):
Food Cá ngừ profile nguyên liệu/fish theo USDA/FDA, Exercise Kneeling sửa kỹ thuật
theo ACE/Mayo. Preview offline dùng snapshot thật trong bộ nhớ: câu1 600,2 kcal /
45,2 g protein; câu5 2.196,4 kcal / 152,6 g protein, hai replacements, mọi món khác
giữ nguyên. Database writes0; chưa apply, chờ explicit approval riêng theo AGENTS.

Code local trong candidate, chưa deploy sau #190:

- `ai.controller.js`: nhận cả câu “muốn biết mức calo và lịch tập” vào nhánh
  semantic intake; guard/fallback buộc ước tính, ≤5 nhóm, kinh nghiệm/thiết bị.
- `citation.js`: legacy redirect hiện host thật thay nhãn chung; title untrusted
  chỉ làm tooltip. Giữ canonical WHO/PubMed map theo verified host và source binding.
  Không fetch favicon/resolve redirect, không thêm external domain/CSP.
- `stagingAiReliabilityAcceptance.evidence.js`: thu grounding counters bên cạnh
  chat counters; snapshot cũ thiếu metrics mới không tạo được evidence upstream
  chính xác cho run cũ. Không suy ngược subtype/cost từ số0.

Ronaldo bị tool timer15s cắt, toàn case18,972s; chat deadline75s không phải nguyên
nhân trực tiếp. Upstream latency/network subtype chưa rõ, không chứng minh429/quota.
Không tăng timeout/quota/retry/model. Preview/code fixes không làm run #190 thành
PASS; phải test bản deploy tiếp theo riêng.

## QA và review follow-up

Node22.23.1. Baseline full local QA #190 ở report096 được giữ riêng. Commands
follow-up dưới đây có source execution logs trong ignored local folder; không
diễn giải E2E mock hoặc offline fixtures thành live staging PASS.

| Gate | Kết quả |
|---|---|
| Intake regression RED | 1 failed / 1 passed; exact case11 chưa vào semantic guard |
| Integrated controller/metrics GREEN cuối | 4 files / 153 tests PASS, exit0; hai negative knowledge cases giữ câu trả lời kiến thức, hai positive personal-plan cases vẫn hỏi intake |
| Citation focused | 3 files / 24 tests PASS; false publisher, legacy source/history binding |
| Client full | `npm run test:unit:client`: 186 files / 928 tests, exit0 |
| Local E2E | `npm run test:e2e -- e2e/ai-citations.spec.js e2e/ai-chat.spec.js --workers=1`:12 PASS, exit0, mock API |
| Grounding metrics RED→GREEN | Missing/negative counters RED (4 FAIL); final contract đủ24 keys, missing/asymmetric/negative/fraction/unsafe/regression fail closed; helper21 PASS trong suite tích hợp |
| AI eval | `npm run test:ai-eval`:73/73 PASS, 0 live captures |
| Tools | validator11 tools / 0 warnings PASS |
| UI regression | 0 new blocking; baseline unchanged, exit0 |
| Scoped client lint | PASS |
| Secrets/data boundaries/docs privacy/governance | PASS, exit0 |
| Release build follow-up | Final staging build PASS, exit0; VITE_API_URL/SITEMAP_API_URL/PRERENDER_API_URL đúng API staging, bundle budget PASS, search index10 Recipe; initial run FAIL và retry interrupted được giữ riêng |
| Server full follow-up | RUNNING; chưa được tính PASS |
| Independent diff review | PASS sau hai vòng sửa MED intake false-positive và metrics missing→0; không còn HIGH/MED trong phạm vi diff đã review |
| Dependency audit | Client và server PASS, exit0; không waived advisory |

Read-only planner Sol/high điều tra timeout và review; Terra/medium implementer
sửa citation/metrics bounded ownership. Root giữ integration/manual adjudication,
catalog proposal và kết luận. Runtime/legacy helper security review trước run
không được coi là full repository security audit. External Codex Security không
chạy trong follow-up; không tuyên bố external scan PASS.

Review đã tái hiện cả câu hỏi PPL và câu hỏi nguyên lý workout–calo có từ “Tôi”.
Lane bổ sung chỉ nhận quan hệ lịch tập/giáo án phù hợp với hoặc riêng cho cá nhân,
kèm calorie intent; lane `workout_creation` cũ giữ nguyên. Không đổi provider,
timeout, quota hoặc semantic oracle. Metrics thiếu field phải báo inconclusive,
không được diễn giải thành không có hoạt động.

## Bước còn lại

Hoàn tất release build/server QA/review cho code local; lấy approval cụ thể cho
hai catalog updates; preflight backup/deploy identity/digest/drift trước apply.
Review/rollout code mới và kiểm UI15 riêng trên exact SHA tiếp theo. Mục tiêu
≥14/15 còn mở, grounding reliability chưa chứng minh fixed, không nới oracle.
