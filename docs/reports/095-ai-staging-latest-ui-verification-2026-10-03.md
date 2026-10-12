# Xác minh bản staging mới nhất và 15 câu trên UI — 2026-10-03

Bản AI của PR #189 đã thực sự lên staging: GitHub, Netlify và backend Render
cùng SHA `32cf6e80ce698b98669d0761461b038072bff36e`. Frontend đang phục vụ đúng
bundle của deploy đó. Lượt API trước và lượt UI mới đều diễn ra sau deployment.
Các lỗi còn thấy là lỗi hành vi trên bản này, không phải bằng chứng đang dùng
bundle Netlify cũ.

Đã gửi đủ 15 câu trực tiếp trong HT Assistant trên UI staging, mỗi câu một lần.
Kết quả chức năng: **7 PASS, 4 PARTIAL, 4 FAIL**. Nguồn dẫn được đánh giá riêng;
PASS chức năng không chứng nhận mọi citation hỗ trợ câu trả lời. Chưa đạt nghiệm
thu nội dung toàn bộ 15 câu.

## 1. Deployment và tình trạng build

| Hạng mục | Bằng chứng đã đối chiếu |
|---|---|
| GitHub | [PR #189](https://github.com/ThienAress/htcoachingweb/pull/189) merged lúc `2026-10-02T18:25:48Z`; GET nhánh `staging` kiểm tra lại vẫn trả SHA trên |
| Source candidate | Checkout sạch tại `161f5a5cbf795b8325a86826046a58f18fe63dd2`; tree `c00e7c7cb54697963e0e29f1380f5631c1ae2764` khớp tree merge xác minh bằng GitHub GET |
| CI đúng merge SHA | [Run 37047525381](https://github.com/ThienAress/htcoachingweb/actions/runs/37047525381): client, server, secrets, docker, e2e đều SUCCESS, 5/5 |
| Monitor staging | [Run 37047525826](https://github.com/ThienAress/htcoachingweb/actions/runs/37047525826): `read-only-monitor` SUCCESS; recovery job SKIPPED, không tính là PASS |
| Netlify | Latest staging ready deploy `6abff77f59ccf10008b1024d`, SHA khớp; tạo lúc `2026-10-02T18:27:11.911Z` |
| Frontend thực tế | Probe `2026-10-03T13:04:07.331Z`: HTML và 29 assets JS/CSS ở staging alias có SHA256 khớp immutable permalink của deploy |
| Tab UI thực tế | Reload trước lượt kiểm tra; script `/assets/index-CmpKqyHS.js` khớp probe frontend |
| Render | Deploy `dep-davvjqe0tbcc73fj3la0` LIVE, SHA khớp; hoàn tất lúc `2026-10-02T18:38:42.910921Z` |
| Backend đang chạy | Protected metrics kiểm tra `2026-10-03T13:09:56.550Z`: runtime SHA khớp; instance UUID khớp lượt API trước |

Staging: [HTCOACHING staging](https://staging--htcoachingweb.netlify.app).
Permalink đối chiếu:
[Netlify deploy đã xác minh](https://6abff77f59ccf10008b1024d--htcoachingweb.netlify.app).

Netlify trả `buildsStopped=false`; latest staging deploy đang `ready`.
Plan metadata có included build minutes 300, nhưng chưa kiểm chứng billing meter
thực tế nên **không kết luận còn bao nhiêu phút**. Hạn mức build Netlify ảnh hưởng
việc build/deploy; GitHub push và Netlify deploy là hai thao tác khác nhau.
[Tài liệu billing Netlify](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/billing-for-legacy-plans/).

Checkout root đang dirty, HEAD `b102572c626b1b79c290a786c96a51ebfc28c242`.
Source AI tại root không phải một bản vá mới hơn candidate: thiếu các module
router/parser mới. Không dùng root dirty làm chuẩn phiên bản đang deploy.
Mọi thay đổi có sẵn tại root được giữ nguyên.

## 2. KB đã publish và có thể truy vấn

Đọc metadata staging lúc `2026-10-03T13:22:44.134Z`, không ghi DB:

- **26 entries published/reviewed**.
- **2 entries draft/needs_review**, tương ứng HOLD 29/33 do chưa xác minh đầy đủ
  identity/source mapping; không publish thêm hai mục này.
- Cả 28 root vectors đều `ready`, 768 dimensions, profile
  `gemini-embedding-2:768:question-answering-v1`.
- `kb_embedding_v2` và `kb_variant_embedding_v1` đều READY/queryable.

Backup/key-custody gates đã PASS ở bước trước, không cần nhập lại khóa.
Off-device recovery và isolated restore đã được xác minh; PITR vẫn chưa có.
KB có nguồn và embedding hoạt động không đảm bảo retrieval chọn đúng nguồn cho
từng câu hỏi, hoặc citation hỗ trợ đúng claim.

## 3. Lượt test trực tiếp UI

Corpus gồm **14 câu gốc + một câu thay thế ở vị trí 5**, không phải bản sao nguyên
vẹn 15 câu ban đầu. Chuỗi 4→5 và 6→7 giữ cùng chat. Prompt là dữ liệu giả lập.

Thực hiện từ marker `2026-10-03T12:56:02.452Z`; câu 1 hoàn tất lúc
`12:58:28.931Z`, câu 15 hoàn tất lúc `13:25:39.357Z` cùng ngày
(19:58–20:25 Asia/Saigon). Dùng phiên Admin staging đã được user đăng nhập;
AI memory được kiểm tra đang tắt, không đổi consent/preferences.

Read-only reconcile lúc `2026-10-03T13:35:03.406Z` xác minh đúng owner, **13 chat
mới, 15 prompt khớp corpus**, đúng hai chuỗi follow-up, không còn active stream.
Không đọc các chat cũ để đánh giá bộ câu hỏi này.

| Câu | Yêu cầu rút gọn | Kết quả UI mới | Nguồn dẫn / giới hạn |
|---|---|---|---|
| 1 | Bữa Việt ~600 kcal, không thịt gà, ghi grams | PARTIAL: khoảng 600 kcal/45 g protein, cá và trứng; trứng ghi 1 quả, thiếu grams | Protein timing, time-restricted eating và DIETFITS không chứng minh khẩu phần này |
| 2 | Bữa sáng ~500 kcal, ≥30 g protein, không trứng | PASS: 501,1 kcal/30 g protein; 104 g ức gà, 251 g khoai tây, 107 g bơ; card và chữ khớp | Số liệu server/catalog; không có khối citation công khai |
| 3 | Bữa ~500 kcal, ≥30 g protein, không sữa/whey | PASS: 501,1 kcal/30 g protein, grams đầy đủ, card và chữ khớp | Không chứng nhận độc lập nguồn nutrient/cooking state |
| 4 | Ngày ~2.200 kcal, ≥140 g protein, cơm/cá/rau/đậu phụ | PASS về số liệu: 2.196 kcal/140,2 g protein; đủ nhóm yêu cầu và grams | Chất lượng thực tế còn yếu: có sắn khô/tôm khô |
| 5 | Thay đậu phụ bằng cá, giữ các món khác | FAIL: báo giới hạn xử lý công cụ, không có thay đổi trước/sau | Vẫn đính kèm nguồn nutrition; nguồn không giải quyết lỗi thao tác |
| 6 | 2.500 kcal, ≥170 g protein, 4 bữa, loại trừ và ngân sách | PASS: 2.500,2 kcal/170,1 g protein; 127.347đ ≤150.000đ; nguyên liệu hiển thị không whey/lactose/đậu phộng | Giá là ước tính catalog, không phải giá thị trường hiện thời; menu chỉ khoai tây/ức gà/bơ |
| 7 | Hạ xuống ~2.200 kcal chỉ bằng lượng cơm/dầu | PARTIAL: từ chối có cơ sở vì menu câu 6 không có cơm/dầu; chưa đạt tổng mới | Đây là guard hợp lý với baseline; cần hỏi lại phạm vi được phép đổi |
| 8 | Lịch 4 ngày cho người mới, tạ đơn/dây, ≤60 phút, deload | FAIL: từ chối tạo lịch; thiếu 4 ngày và deload | Không có plan/card đạt yêu cầu |
| 9 | 5 bài ngực cho người mới, không dụng cụ | FAIL: card có Plyo/Clock và các bài khác phần chữ; chữ có Incline cần ghế/bàn | Protein timing/training sequence không chứng minh suitability; card/chữ không cùng danh sách |
| 10 | Khuyến nghị WHO, có nguồn công khai cập nhật | PASS: 150–300 phút mức vừa hoặc 75–150 phút mức mạnh; strength ≥2 ngày/tuần | Có webSources; trace `web_required`, `webSearchUsed=true`; giá trị khớp WHO |
| 11 | Thiếu dữ liệu: hỏi tối đa 5 câu, không đoán | PASS: 5 nhóm intake, không tự đưa calo/lịch cá nhân | Vẫn thêm nguồn training/nutrition không cần thiết; chưa đạt chất lượng citation |
| 12 | Kế hoạch ăn/tập chi tiết 7 ngày | PARTIAL: đủ 7 ngày nhưng nhóm thực phẩm và buổi toàn thân còn chung chung | Thiếu món/khẩu phần và bài tập cụ thể |
| 13 | Khó chịu đầu gối khi squat | PARTIAL: có dừng/đi khám khi đau nhói hoặc kéo dài; vẫn đưa claim giảm áp lực gối thiếu hỗ trợ | Footwear/deadlift/knee-wrap không thiết lập các claim Hip Thrust/Leg Press/Bulgarian; trace `model_prior` còn 3 KB entries |
| 14 | Văn phòng, 10.000 bước, tập 60–90 phút: tính TDEE | PASS về không đoán: trả form và yêu cầu dữ liệu còn thiếu | Ngồi nhiều/số bước tự điền đúng; lỗi phụ: thời lượng vẫn “Chọn” dù prompt đã có |
| 15 | Ronaldo, nguồn công khai cập nhật | FAIL về nguồn: có giới thiệu FIFA/UEFA/Al-Nassr nhưng khối 📎Nguồn là NIH supplement/NEJM/JAMA giảm cân | Trace `internal_kb`, `webSearchUsed=false`, 3 KB entries; các link gợi ý không chứng minh đã truy xuất nguồn cập nhật |

Các số dinh dưỡng kiểm tra phép cộng/constraint hiển thị không thay thế việc
xác minh độc lập nutrient provenance, cách chế biến, chất lượng menu hoặc giá.
Khuyến nghị ở câu 10 được đối chiếu với
[WHO Guidelines on Physical Activity and Sedentary Behaviour](https://www.who.int/publications/i/item/9789240015128).
Câu 13 lượt UI mới **không có claim knee-sleeve**; không gộp claim của lượt API
cũ vào bằng chứng mới.

## 4. Vì sao có nguồn mà vẫn sai

Independent source review dùng candidate sạch có cùng tree với deployment;
root đối chiếu lại trace mới và code liên quan. Ba đường lỗi nổi bật:

1. **Yêu cầu web bị hạ về KB**. Exact prompt Ronaldo ban đầu được router đánh dấu
   `web_required` do yêu cầu nguồn, nhưng “cập nhật” không làm freshness đổi khỏi
   `stable`. Controller lấy tối đa 3 KB hits, threshold 0,75; có bất kỳ citable KB
   source nào và freshness stable là đổi sang `internal_kb`, tắt web. Chưa có guard
   buộc source hỗ trợ đúng entity/claim Ronaldo.
   [requestRouter.js:444](https://github.com/ThienAress/htcoachingweb/blob/32cf6e80ce698b98669d0761461b038072bff36e/server/src/services/ai/requestRouter.js#L444),
   [ai.controller.js:1317](https://github.com/ThienAress/htcoachingweb/blob/32cf6e80ce698b98669d0761461b038072bff36e/server/src/controllers/ai.controller.js#L1317).
2. **Citation eligibility chưa phải claim relevance**. Citable-source helper
   kiểm publication/review metadata; evidence boundary nối citation vào câu trả
   lời. Khi downgrade sang `model_prior`, citation state chưa được xóa, giải
   thích case 13 có trace model prior nhưng vẫn ba nguồn KB. “Khó chịu” đầu gối
   cũng lọt classifier high-stakes mặc dù exercise safety parser nhận biết từ này.
   [systemPrompt.js:235](https://github.com/ThienAress/htcoachingweb/blob/32cf6e80ce698b98669d0761461b038072bff36e/server/src/services/ai/systemPrompt.js#L235),
   [ai.controller.js:1147](https://github.com/ThienAress/htcoachingweb/blob/32cf6e80ce698b98669d0761461b038072bff36e/server/src/controllers/ai.controller.js#L1147),
   [ai.controller.js:2040](https://github.com/ThienAress/htcoachingweb/blob/32cf6e80ce698b98669d0761461b038072bff36e/server/src/controllers/ai.controller.js#L2040),
   [requestRouter.js:450](https://github.com/ThienAress/htcoachingweb/blob/32cf6e80ce698b98669d0761461b038072bff36e/server/src/services/ai/requestRouter.js#L450).
3. **Exercise card và chữ có hai producer**. Parser giữ đúng beginner/no-equipment,
   nhưng runtime ranking chưa loại đúng Plyo; predicate readiness nghiêm hơn chưa
   được runtime dùng. Card stream từ tool, chữ do model viết riêng, chưa có guard
   cùng exercise set.
   [searchExercises.tool.js:48](https://github.com/ThienAress/htcoachingweb/blob/32cf6e80ce698b98669d0761461b038072bff36e/server/src/services/ai/tools/searchExercises.tool.js#L48),
   [exerciseCatalogCompatibility.js:44](https://github.com/ThienAress/htcoachingweb/blob/32cf6e80ce698b98669d0761461b038072bff36e/server/src/services/ai/exerciseCatalogCompatibility.js#L44),
   [ai.controller.js:1989](https://github.com/ThienAress/htcoachingweb/blob/32cf6e80ce698b98669d0761461b038072bff36e/server/src/controllers/ai.controller.js#L1989).

Đề xuất bước sửa tiếp: giữ web-required khi cần nguồn cập nhật; ràng buộc citation
với claim; đồng bộ pain routing; dùng một danh sách bài tập canonical cho card/chữ;
sửa substitution và constrained-workout fallback. Đây là đề xuất, chưa triển khai
hoặc deploy bản vá các lỗi mới trong lượt kiểm chứng này.

## 5. Validation, side effects và bằng chứng

- Protected runtime helper đã được user cho phép tạo đúng một Admin giả lập,
  đọc metrics rồi cleanup. Kết quả `verified=true`, `residue=0`; không gửi chat,
  không ghi dữ liệu owner bằng helper này.
- Lượt UI tạo **13 chat trong tài khoản Admin đang đăng nhập và dùng 15 lượt
  quota**. Các chat mới được giữ để user xem; không xóa chat cũ.
- Reconcile chỉ đọc cohort sau marker, DB writes 0. Helper ban đầu lỗi shape
  marker (`UI15_CORPUS_INVALID`) trước khi connectDB. Regression xác nhận RED;
  sửa wrapper parser local, kiểm lại **3/3 PASS**, reconcile exit 0. Không đổi
  marker, không chuẩn bị lại hoặc gửi lại câu hỏi.
- Independent source worker chạy ba test files router/exercise parser/search:
  **296/296 PASS**. Các tests hiện tại chưa bắt được những lỗi semantic vừa thấy.
- Scoped documentation privacy check cho báo cáo này: **PASS**, exit 0 qua
  `node scripts/check-docs-privacy.mjs` với đúng file báo cáo.
- Không chạy lại full build/canonical E2E trong lượt này vì không sửa app source.
  CI merge SHA ở trên là evidence riêng. Test UI qua phiên Admin hiện có là
  **manual diagnostic**, không phải một canonical E2E/release acceptance PASS mới.
- Worker hỗ trợ bridge local và review source độc lập; root thực hiện UI,
  provider/runtime checks, reconcile và tổng hợp. Model worker được yêu cầu:
  Terra/medium và Sol/high; chưa có execution receipt để xác nhận model thực thi.

Bằng chứng riêng tư lưu trong thư mục evidence ignored của lượt
`staging-ai-resume-20261003`:
`current-served-deployment-final-20261003.json`, `runtime-audit-identity.json`,
`kb-current-readonly.json`, `ui15-browser-evidence.json`,
`ui15-readonly-reconcile.json`, ảnh `ui15-case-02.png` đến `ui15-case-15.png`
và `ui15-case-15-source-context.png`. Câu 1 có DOM snapshot, không có screenshot.
Không dùng các deployment probe v1/v2/v3 lỗi helper làm bằng chứng app deploy lỗi.

Lượt API trước được giữ nguyên trong báo cáo triển khai 094 ngày 2026-10-03.
Lượt kiểm chứng này không commit, push, publish thêm KB hoặc deploy ứng dụng;
không có production write.
