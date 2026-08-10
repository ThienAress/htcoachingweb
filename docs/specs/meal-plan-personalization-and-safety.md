# Spec: Cá nhân hóa và an toàn tham khảo cho Meal Plan

Status: APPROVED / IN PROGRESS

Ngày chốt: 2026-08-10

## Objective

Trước khi tạo thực đơn, Meal Plan hỏi người dùng về dị ứng thực phẩm và ngân sách tham khảo không bắt buộc. Hệ thống lưu
preference của tài khoản theo nguyên tắc dữ liệu sức khỏe nhạy cảm, loại trừ theo metadata đã kiểm duyệt và ước tính chi
phí theo snapshot thị trường online tại TP.HCM. Kết quả luôn là gợi ý tham khảo, không phải tư vấn y tế hay cam kết giá.

## Quyết định sản phẩm

- Đặt bước `Điều kiện thực đơn` tại `/mealplan`, sau chọn macro/số bữa và trước nút tạo; không đặt tại TDEE.
- User trả lời câu `Bạn có dị ứng thực phẩm không?` bằng `Không có dị ứng`, chọn một hoặc nhiều nhóm, hoặc `Không chắc / cần kiểm tra` trước khi tiêu quota/tạo preview.
- Nhóm `Khác` nhận tên thực phẩm/thành phần dạng text ngắn; không nhận mô tả triệu chứng hoặc thông tin định danh. Mục nhận diện được lọc qua metadata; mục chưa nhận diện được lưu nhưng generator dừng fail-closed.
- Ô `Khác` v2 tách nhiều mục theo dấu phẩy, chấm phẩy, xuống dòng hoặc chuỗi toàn từ khóa đã nhận diện. Ví dụ `gà bò cá` hoặc bản không dấu tiếng Việt `ga bo ca` đều được hiểu là ba mục; dấu chấm giữa thực phẩm như `bò.gà.heo` bị từ chối với hướng dẫn dùng dấu phẩy hoặc khoảng trắng.
- Parser dùng longest-match để `thịt bò` là một mục bò. Từ mơ hồ `thịt`, `các loại thịt`, `tất cả loại thịt` hoặc `tất cả thịt trên cạn` bị từ chối và UI yêu cầu nhập rõ từng loại như gà, bò, heo, vịt, dê hoặc cừu; không có lựa chọn xác nhận dị ứng tất cả thịt.
- Mục nhận diện được ánh xạ vào taxonomy server-authoritative. Mục chưa nhận diện vẫn được lưu để user theo dõi nhưng tiếp tục chặn generation trước quota.
- Tài khoản đăng nhập lưu preference và có thể chỉnh tại Meal Plan. Guest chỉ giữ constraint trong phiên hiện tại.
- Sở thích là soft preference; dị ứng là hard exclusion; ngân sách là soft constraint.
- Giá v1 là khoảng giá online tham khảo chung tại TP.HCM; không cá nhân hóa theo tỉnh và không gọi retailer runtime.

## Nguồn tham khảo và giới hạn tuyên bố

- [FDA — Food Allergies](https://www.fda.gov/food/buy-store-serve-safe-food/food-allergies-what-you-need-know): nhóm allergen lớn, triệu chứng thường gặp và rủi ro
  cross-contact.
- [Codex CXS 1-1985](https://www.fao.org/fao-who-codexalimentarius/codex-texts/list-standards/en/): chuẩn FAO/WHO về
  ghi nhãn thực phẩm đóng gói.
- [Bệnh viện Bạch Mai — Dị ứng thực phẩm](https://bachmai.gov.vn/bai-viet/dac-san-mua-he-dung-de-cuoc-vui-%E2%80%9Cdut-ganh%E2%80%9D-vi-di-ung-thuc-pham?id=fece6ef8-d50c-4264-b1e5-33c37ded360b): biểu hiện trên da, tiêu hóa, hô hấp, tim mạch và dấu hiệu cần đi cấp cứu.
- [Cục Phòng bệnh Việt Nam — Dự phòng và xử trí dị ứng thức ăn](https://vncdc.gov.vn/cach-du-phong-va-xu-tri-khi-bi-di-ung-thuc-an-nd14930.html): dị nguyên thường gặp và khuyến nghị tham khảo chuyên gia.
- [Bộ Y tế — hệ thống cấp cứu 115](https://moh.gov.vn/hoat-dong-cua-dia-phuong/-/asset_publisher/gHbla8vOQDuS/content/cap-cuu-ngoai-vien-co-the-cuu-song-ca-mang-nguoi): đầu mối cấp cứu ngoại viện tại Việt Nam.
- Giá lấy từ snapshot có ngày quan sát và URL của ít nhất hai nguồn được duyệt, ưu tiên
  [Bách Hóa Xanh](https://www.bachhoaxanh.com/), [WinMart](https://winmart.vn/) và
  [Co.op Online](https://cooponline.vn/), với khu vực giao/niêm yết TP.HCM khi nguồn hỗ trợ.

Copy bắt buộc:

- “Dựa trên dữ liệu nhãn và nguồn tham khảo hiện có; không thay thế tư vấn của bác sĩ/chuyên gia dinh dưỡng.”
- “Không bảo đảm loại trừ cross-contact; người có tiền sử phản ứng nặng cần kiểm tra nhãn và trao đổi với chuyên gia.”
- “Chi phí là khoảng ước tính tại TP.HCM theo ngày cập nhật; giá thực tế thay đổi theo nơi bán và khuyến mãi.”
- “Các dấu hiệu sau ăn chỉ giúp nhận biết phản ứng nghi ngờ, không đủ để tự chẩn đoán thực phẩm gây dị ứng.”
- “Nếu khó thở, nghẹn hoặc sưng họng, choáng váng hay ngất sau khi ăn: ngừng ăn và gọi cấp cứu 115/đến cơ sở y tế ngay.”

Không dùng các từ `an toàn tuyệt đối`, `chữa`, `điều trị`, `chắc chắn không dị ứng`, `giá chính xác`.

## Preference theo tài khoản

`User.mealPlanPreferences` là field `select:false`:

```js
{
  allergyStatus: "none_known" | "declared" | "unsure",
  allergens: ["milk" | "egg" | "fish" | "crustacean_shellfish" | "tree_nut" | "peanut" | "wheat" | "soy" | "sesame"],
  otherAllergenText: String,
  budgetVndPerDay: Number | null,
  reviewedAt: Date
}
```

- `declared` cần ít nhất một allergen hoặc `otherAllergenText`; trạng thái khác buộc `allergens=[]` và `otherAllergenText=""`.
- `otherAllergenText` được trim/collapse whitespace, tối đa 120 ký tự, không chấp nhận URL, email, control character hoặc markup; generator không tự suy luận/match tên Food từ text này.
- `otherAllergenText` được canonicalize sau parse (`gà bò cá`/`ga bo ca` → `Gà, Bò, Cá`). Parser chỉ bỏ dấu tiếng Việt cho taxonomy đã định nghĩa, không dùng fuzzy/name matching; dấu chấm là separator không hợp lệ và từ `thịt` chưa xác nhận bị server từ chối.
- Budget optional, integer VND/day, có min/max server-authoritative; `null` nghĩa không giới hạn.
- Chỉ endpoint owner-only được explicit select/return field này; generic User DTO/admin list không được lộ.
- `PUT` thay toàn bộ object đã normalize, qua auth + CSRF + validation allowlist; client cũ chưa gửi `otherAllergenText` vẫn tương thích và được normalize thành chuỗi rỗng.
- Không gửi preference vào GA4, log, error context hoặc `SavedMealPlan`.
- Export dữ liệu tài khoản phải đặt preference trong mục dữ liệu sức khỏe; luồng xóa tài khoản tự xóa cùng User.

API:

- `GET /api/user/me/meal-plan-preferences`
- `PUT /api/user/me/meal-plan-preferences`

## Food allergen contract

`Food.allergenProfile` là optional, mặc định fail-closed:

```js
{
  reviewStatus: "unreviewed" | "reviewed",
  contains: [AllergenKey],
  mayContain: [AllergenKey],
  reviewedScopes: ["specific_foods"],
  specificContains: ["beef" | "chicken" | "pork" | "duck" | "goat" | "lamb"],
  sourceType: "package_label" | "manufacturer" | "official_database" | null,
  sourceUrl: String | null,
  reviewedAt: Date | null
}
```

- Document cũ mặc định `unreviewed`, không suy luận là không có allergen.
- `reviewedScopes` mặc định rỗng. Khi preference có thực phẩm cụ thể, chỉ Food đã kiểm duyệt scope `specific_foods` mới được xét; Food thiếu scope này bị loại fail-closed.
- Chỉ các loại thịt cụ thể đã được parser nhận diện mới tạo exclusion tương ứng. Không suy luận species từ `Food.label` và không có scope đại diện cho tất cả thịt.
- Khi có allergen được khai báo, generator loại `contains`, `mayContain` và Food `unreviewed`.
- `unsure` không tạo tuyên bố an toàn; UI hướng dẫn kiểm tra nhãn/chuyên gia và chỉ dùng flow an toàn đã định nghĩa.
- Admin chỉ đánh dấu `reviewed` khi có nguồn/nhãn; mọi update qua validation allowlist.

## Price observation contract

```js
{
  foodId: ObjectId,
  sourceKey: "bach_hoa_xanh" | "winmart" | "coop_online",
  region: "ho_chi_minh",
  currency: "VND",
  packGrams: Number,
  regularPriceVnd: Number,
  promotionalPriceVnd: Number | null,
  sourceUrl: "https://...",
  observedAt: Date
}
```

- Index phục vụ lookup theo `foodId`, `region`, `sourceKey`, `observedAt`; URL HTTPS và thuộc allowlist.
- DTO chỉ trả aggregate `low/typical/high VND per 100g`, `asOf`, `sourceCount`, `coverageStatus`.
- Giá khuyến mãi được đánh dấu riêng, không âm thầm dùng làm giá điển hình.
- Ít hơn hai nhà bán lẻ online khác nhau hoặc stale → `coverageStatus=insufficient`; UI không tuyên bố đạt ngân sách.
- Snapshot được nhập/import có kiểm duyệt; v1 không tự động scrape retailer.

## Generation policy

Thứ tự bất biến:

1. Validate preference trước guest preview marker và trước `recordGeneration()`.
2. Parse `otherAllergenText`; dấu chấm và từ `thịt` quá chung chung bị từ chối, mục chưa nhận diện dừng generation trước quota.
3. Mục nhận diện được ánh xạ vào major allergen hoặc specific-food key. Loại Food có rủi ro, chưa kiểm duyệt hoặc thiếu scope `specific_foods` tương ứng.
4. Tạo tổ hợp đạt macro trong giới hạn khẩu phần hiện có.
5. Ưu tiên sở thích nếu không vi phạm bước 3.
6. Tối ưu chi phí tham khảo và hiển thị khoảng `low–high`; ngân sách không được đánh đổi exclusion.

Nếu không đủ Food/pricing coverage, generator trả trạng thái giải thích được thay vì bỏ qua constraint hoặc tiêu quota.

## API, UI và privacy

- `Điều kiện thực đơn` có loading/error/retry, save state, keyboard/focus states và nội dung tiếng Việt về 10 dấu hiệu thường gặp, dấu hiệu cấp cứu và nguồn tham khảo.
- Câu hỏi dùng copy `Bạn có dị ứng thực phẩm không?`; ngân sách ghi rõ `không bắt buộc`.
- Kết quả hiển thị exclusions đã áp dụng, chi phí tham khảo/ngày, khu vực TP.HCM và ngày cập nhật.
- Public Food read giữ backward compatibility bằng field optional.
- Mutation allergen/price là admin-only, qua auth, CSRF, validation và rate limit phù hợp.
- Saved plan tiếp tục lưu immutable food/nutrition snapshot, không copy preference sức khỏe.

## Rollout và dữ liệu cũ

- Các schema field mới optional; `otherAllergenText` mặc định rỗng, `reviewedScopes=[]` và `specificContains=[]` nên document/client cũ tiếp tục đọc/ghi được và không cần migration/backfill.
- Food legacy không tự được coi là đã kiểm duyệt specific-food. Admin phải duyệt thủ công scope này; không suy luận hoặc tự backfill từ `label`.
- Tạo audit coverage read-only; import/backfill dữ liệu là bước riêng cần source snapshot và owner approval, không tự chạy staging/production.
- Index của price observation có preflight/apply production guard riêng; chỉ chạy sau approval và kiểm tra duplicate.
- Feature generation chỉ mở sau khi coverage chứng minh đủ Food protein/carb/fat cho các số bữa hỗ trợ.
- Không tự gắn allergen/giá cho Food legacy bằng suy luận tên.

## Testing strategy

- User model/route: enum, conditional validation, `otherAllergenText` safe text, backward compatibility, select:false, owner-only, CSRF, generic DTO và export/delete.
- Food/price: enum, URL allowlist, admin ownership, normalization, stale/insufficient coverage.
- Generator: hard exclusion, unreviewed fail-closed, parser nhiều mục, specific-food scope, mục chưa nhận diện chặn trước quota, preference không vượt allergy, budget feasible/over/unknown.
- UI: load/save/edit preference, validation trước quota, disclaimer/source, guest/session và accessibility.
- Regression: quota, favorites, custom builder, save/revise và các Food consumers hiện có.

## Success criteria

- Tài khoản lưu/chỉnh được preference tại Meal Plan nhưng field không lọt generic DTO/log/GA4/saved plan.
- Không thể tạo Meal Plan khi chưa xác nhận allergy state.
- Có thể lưu dị ứng `Khác`; mục đã ánh xạ và có metadata Food kiểm duyệt được loại tự động, mục chưa nhận diện tiếp tục chặn generation.
- Không Food `unreviewed` nào vào kết quả khi có allergen được khai báo.
- Giá luôn có source count, as-of, vùng TP.HCM và range; thiếu coverage được nói rõ.
- Không có câu chữ chẩn đoán, điều trị, bảo đảm dị ứng hoặc cam kết giá.
- TDEE không chứa trường allergy/budget và luồng TDEE → Meal Plan vẫn hoạt động.
- Không production data write/backfill trước approval riêng của owner.
