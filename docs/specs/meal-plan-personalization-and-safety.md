# Spec: Cá nhân hóa và an toàn tham khảo cho Meal Plan

Status: APPROVED / IN PROGRESS

Ngày chốt: 2026-08-10

## Objective

Trước khi tạo thực đơn, Meal Plan hỏi người dùng về dị ứng thực phẩm. Hệ thống lưu preference của tài khoản theo nguyên
tắc dữ liệu sức khỏe nhạy cảm, loại trừ theo metadata đã kiểm duyệt hoặc mapping tên deterministic khi metadata còn thiếu,
rồi hiển thị giá mỗi 100 g theo nguồn bán lẻ đã duyệt. Kết quả luôn là gợi ý tham khảo,
không phải tư vấn y tế hay cam kết giá.

## Quyết định sản phẩm

- Đặt bước `Điều kiện thực đơn` tại `/mealplan`, sau chọn macro/số bữa và trước nút tạo; không đặt tại TDEE.
- User trả lời câu `Bạn có dị ứng thực phẩm không?` bằng `Không có dị ứng`, chọn một hoặc nhiều nhóm, hoặc `Không chắc / cần kiểm tra` trước khi tiêu quota/tạo preview.
- Nhóm `Khác` nhận tên thực phẩm/thành phần dạng text ngắn; không nhận mô tả triệu chứng hoặc thông tin định danh. Mục nhận diện được lọc qua metadata; mục chưa nhận diện được lưu nhưng generator dừng fail-closed.
- Ô `Khác` v2 tách nhiều mục theo dấu phẩy, chấm phẩy, xuống dòng hoặc chuỗi toàn từ khóa đã nhận diện. Ví dụ `gà bò cá` hoặc bản không dấu tiếng Việt `ga bo ca` đều được hiểu là ba mục; dấu chấm giữa thực phẩm như `bò.gà.heo` bị từ chối với hướng dẫn dùng dấu phẩy hoặc khoảng trắng.
- Parser dùng longest-match để `thịt bò` là một mục bò. Từ mơ hồ `thịt`, `các loại thịt`, `tất cả loại thịt` hoặc `tất cả thịt trên cạn` bị từ chối và UI yêu cầu nhập rõ từng loại như gà, bò, heo, vịt, dê hoặc cừu; không có lựa chọn xác nhận dị ứng tất cả thịt.
- Cụm phổ biến `ức gà` và bản không dấu `uc ga` được canonical hóa thành nhóm `Gà`; hard exclusion loại mọi Food thuộc nhóm gà thay vì chỉ một phần thịt.
- Mục nhận diện được ánh xạ vào taxonomy server-authoritative. Mục chưa nhận diện vẫn được lưu để user theo dõi nhưng tiếp tục chặn generation trước quota.
- Tài khoản đăng nhập lưu preference và có thể chỉnh tại Meal Plan. Guest chỉ giữ constraint trong phiên hiện tại.
- Sở thích là soft preference; dị ứng là hard exclusion. Ngân sách không còn xuất hiện hoặc tác động generator.
- Giá v1 dùng aggregate online đã kiểm duyệt; không cá nhân hóa theo tỉnh và không gọi retailer runtime.

## Nguồn tham khảo và giới hạn tuyên bố

- [FDA — Food Allergies](https://www.fda.gov/food/buy-store-serve-safe-food/food-allergies-what-you-need-know): nhóm allergen lớn, triệu chứng thường gặp và rủi ro
  cross-contact.
- [Codex CXS 1-1985](https://www.fao.org/fao-who-codexalimentarius/codex-texts/list-standards/en/): chuẩn FAO/WHO về
  ghi nhãn thực phẩm đóng gói.
- [Bệnh viện Bạch Mai — Dị ứng thực phẩm](https://bachmai.gov.vn/bai-viet/dac-san-mua-he-dung-de-cuoc-vui-%E2%80%9Cdut-ganh%E2%80%9D-vi-di-ung-thuc-pham?id=fece6ef8-d50c-4264-b1e5-33c37ded360b): biểu hiện trên da, tiêu hóa, hô hấp, tim mạch và dấu hiệu cần đi cấp cứu.
- Giá lấy từ một quan sát còn hiệu lực có ngày quan sát và URL của nguồn được duyệt, ưu tiên
  [Bách Hóa Xanh](https://www.bachhoaxanh.com/), [WinMart](https://winmart.vn/) và
  [Co.op Online](https://cooponline.vn/), với khu vực giao/niêm yết TP.HCM khi nguồn hỗ trợ.

Copy hiển thị bắt buộc:

- “Các dấu hiệu sau ăn chỉ giúp nhận biết phản ứng nghi ngờ, không đủ để tự chẩn đoán thực phẩm gây dị ứng.”
- “Giá chỉ là ước tính và có thể thay đổi theo nơi bán.”
- “Giá trị dinh dưỡng tham khảo từ Viện Dinh dưỡng Quốc gia.”

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
- `budgetVndPerDay` chỉ còn là field tương thích API/schema cũ. Client Meal Plan không hiển thị hoặc dùng field này và
  luôn gửi `null`; backend tiếp tục chấp nhận client cũ trong thời gian chuyển tiếp.
- Chỉ endpoint owner-only được explicit select/return field này; generic User DTO/admin list không được lộ.
- `PUT` thay toàn bộ object đã normalize, qua auth + CSRF + validation allowlist; client cũ chưa gửi `otherAllergenText` vẫn tương thích và được normalize thành chuỗi rỗng.
- Không gửi preference vào GA4, log, error context hoặc `SavedMealPlan`.
- Export dữ liệu tài khoản phải đặt preference trong mục dữ liệu sức khỏe; luồng xóa tài khoản tự xóa cùng User.

API:

- `GET /api/user/me/meal-plan-preferences`
- `PUT /api/user/me/meal-plan-preferences`

## Food allergen contract

`Food.allergenProfile` là optional và mặc định `unreviewed`:

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

- Document cũ mặc định `unreviewed`, không suy luận là không có allergen; metadata `contains`/`mayContain` đã kiểm duyệt
  luôn được ưu tiên loại trừ.
- Khi metadata chưa đủ, cả nhóm dị ứng có sẵn và loại thịt cụ thể dùng mapping cụm từ exact từ `label || name`; không
  fuzzy-match và không ghi ngược suy luận vào document. Riêng tiếng Việt phải giữ dấu để `Cá` không khớp `Cà chua`.
- Food khớp cụm từ bị loại; Food không liên quan được giữ để catalog còn đủ đạm, tinh bột và chất béo.
- `reviewedScopes` mặc định rỗng. Metadata `reviewed + specific_foods` là nguồn ưu tiên cho loại thịt cụ thể; khi thiếu
  scope mới fallback sang label.
- `unsure` không tạo tuyên bố an toàn; UI hướng dẫn kiểm tra nhãn/chuyên gia và chỉ dùng flow an toàn đã định nghĩa.
- Admin chỉ đánh dấu `reviewed` khi có nguồn/nhãn; mọi update qua validation allowlist.

## Food catalog eat-clean

- Collection `Food` production là catalog vận hành cho Meal Plan, không phải bản sao lưu trữ toàn bộ công cụ tra cứu của nguồn ngoài.
- Owner duyệt hard-delete bốn nhóm khỏi catalog ngày 2026-08-11: tên hiếm/khó hiểu không phù hợp người dùng phổ thông;
  nội tạng/động vật ít phù hợp; rượu, nước ngọt, kẹo, mứt và snack; cùng manifest bột/gia vị/nguyên liệu thô đã chọn.
- Giữ dầu nấu ăn, bơ thực vật, bột ca cao, gừng/nghệ bột, hạt tiêu, mật ong và muối để người dùng chủ động sử dụng;
  các mục này không thuộc manifest hard-delete.
- Danh sách xóa phải là manifest label/ID cố định có preflight, backup và production guard; không xóa production bằng regex.
- Các biến thể có macro khác nhau phải giữ thành document riêng. Cụ thể `Quả bơ vỏ tím` và `Quả bơ vỏ xanh`
  không merge và không lấy số liệu của biến thể này ghi đè biến thể kia.
- Saved Meal Plan lịch sử tiếp tục đọc snapshot label/macro bất biến. Không tự thay hoặc xóa thực phẩm trong snapshot của user;
  thao tác revise mới dùng Food đã bị xóa tiếp tục trả contract `MEAL_PLAN_FOOD_NOT_FOUND` hiện có.
- Mỗi lần import Food mới phải review mức phù hợp với Meal Plan eat-clean trước khi production generator được sử dụng.

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
- Không có quan sát hợp lệ còn hiệu lực → `coverageStatus=insufficient`; một quan sát hợp lệ là đủ để hiển thị giá tham khảo.
- Nếu còn nhiều quan sát lịch sử, aggregate chỉ chọn một: quan sát mới nhất thắng; cùng ngày dùng thứ tự ổn định
  Bách Hóa Xanh → WinMart → Co.op Online. Lịch sử không bị xóa.
- Snapshot được nhập/import có kiểm duyệt; v1 không tự động scrape retailer.

## Generation policy

Thứ tự bất biến:

1. Validate preference trước guest preview marker và trước `recordGeneration()`.
2. Parse `otherAllergenText`; dấu chấm và từ `thịt` quá chung chung bị từ chối, mục chưa nhận diện dừng generation trước quota.
3. Mục nhận diện được ánh xạ vào major allergen hoặc specific-food key. Loại theo metadata đã kiểm duyệt trước, sau đó
   fallback cụm từ exact trong label khi metadata/scope còn thiếu.
4. Tạo tổ hợp đạt macro trong giới hạn khẩu phần hiện có.
5. Ưu tiên sở thích nếu không vi phạm bước 3.
6. Khi ưu tiên dinh dưỡng ngang nhau, ưu tiên Food có giá đủ coverage. Giá chỉ hiển thị theo `/100g` trong bảng Food;
   không cộng tổng tiền theo bữa hoặc theo ngày.

Nếu không đủ Food sau khi loại dị ứng, generator trả trạng thái giải thích được thay vì bỏ qua constraint hoặc tiêu quota.

## API, UI và privacy

- `Điều kiện thực đơn` có loading/error/retry, save state, keyboard/focus states và nội dung tiếng Việt về 10 dấu hiệu thường gặp.
- Câu hỏi dùng copy `Bạn có dị ứng thực phẩm không?`; không hiển thị input ngân sách, cảnh báo 115, hai link chết hoặc
  khối `Nguồn & giới hạn tham khảo`.
- Bảng Food hiển thị `Giá / 100g` sau `Calo`, `—` khi thiếu giá và hai câu ghi chú bắt buộc. Bảng kết quả Meal Plan
  không hiển thị tổng tiền theo bữa hoặc theo ngày.
- Public Food read giữ backward compatibility bằng field optional.
- Mutation allergen/price là admin-only, qua auth, CSRF, validation và rate limit phù hợp.
- Saved plan tiếp tục lưu immutable food/nutrition snapshot, không copy preference sức khỏe.

## Rollout và dữ liệu cũ

- Các schema field mới optional; `otherAllergenText` mặc định rỗng, `reviewedScopes=[]` và `specificContains=[]` nên document/client cũ tiếp tục đọc/ghi được và không cần migration/backfill.
- Food legacy không được backfill hay ghi metadata bằng suy luận. Fallback cụm từ exact chỉ diễn ra
  lúc đọc/lọc ở client và không thay đổi document.
- Tạo audit coverage read-only; import/backfill dữ liệu là bước riêng cần source snapshot và owner approval, không tự chạy staging/production.
- Index của price observation có preflight/apply production guard riêng; chỉ chạy sau approval và kiểm tra duplicate.
- Feature generation chỉ mở sau khi coverage chứng minh đủ Food protein/carb/fat cho các số bữa hỗ trợ.
- Không tự ghi allergen/giá vào Food legacy bằng suy luận tên.

## Testing strategy

- User model/route: enum, conditional validation, `otherAllergenText` safe text, backward compatibility, select:false, owner-only, CSRF, generic DTO và export/delete.
- Food/price: enum, URL allowlist, admin ownership, normalization, stale/insufficient coverage.
- Generator: parser nhiều mục, metadata + exact-label fallback cho nhóm có sẵn và loại thịt cụ thể, mục chưa nhận diện
  chặn trước quota và preference không vượt allergy.
- Giá: một nguồn còn hiệu lực là đủ, chọn quan sát mới nhất với tie-break ổn định và không tạo tổng chi phí Meal Plan.
- UI: load/save/edit preference, validation trước quota, Food DB loading/error/empty, giá/ghi chú, guest/session và accessibility.
- Regression: quota, favorites, custom builder, save/revise và các Food consumers hiện có.

## Success criteria

- Tài khoản lưu/chỉnh được preference tại Meal Plan nhưng field không lọt generic DTO/log/GA4/saved plan.
- Không thể tạo Meal Plan khi chưa xác nhận allergy state.
- Có thể lưu dị ứng `Khác`; mục đã ánh xạ và có metadata Food kiểm duyệt được loại tự động, mục chưa nhận diện tiếp tục chặn generation.
- Nhóm dị ứng có sẵn và loại thịt cụ thể loại đúng Food có metadata hoặc label khớp exact, không làm rỗng toàn bộ Food
  `unreviewed`; `Cá` không được nhầm với `Cà`.
- Chỉ giá một nguồn đủ coverage mới được hiển thị theo `/100g`; thiếu coverage hiển thị `—`.
- Không có câu chữ chẩn đoán, điều trị, bảo đảm dị ứng hoặc cam kết giá.
- TDEE không chứa trường allergy/budget và luồng TDEE → Meal Plan vẫn hoạt động.
- Không production data write/backfill trước approval riêng của owner.
