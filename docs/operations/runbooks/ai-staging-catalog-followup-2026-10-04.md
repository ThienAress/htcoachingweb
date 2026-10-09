# Đề xuất sửa catalog sau UI15 — 2026-10-04

Trạng thái: PREVIEW ONLY; chưa có quyền apply dữ liệu thật. Target duy nhất:
`htcoaching_staging`, release `2578b4fd9db492ce2b17dba84698446b5daf9639`.
Đề xuất gồm đúng hai update, không insert/delete, không thay schema hoặc macro.

| Record | Fields được sửa | Nội dung sau sửa |
|---|---|---|
| Food `6a7ae5a3828bd6ac69ce62e9` — Cá ngừ | `allergenProfile` | `reviewStatus=reviewed`, `contains=[fish]`, `mayContain=[]`, `reviewedScopes=[]`, `specificContains=[]`, `sourceType=official_database`, `sourceUrl=https://fdc.nal.usda.gov/log/`, `reviewedAt` theo lần review thực tế |
| Exercise `6a4b4c41a5de82055378b184` — Kneeling Push-up (male) | `description`, `instructions` | Gối làm điểm tựa; đầu-vai-hông-gối cùng trục; hạ/đẩy có kiểm soát; bỏ hướng dẫn đầu-gót chân và bước generic nói bóng/BOSU/tạ; dừng nếu đau |

`updatedAt` đổi khi apply; rollback khôi phục đúng preimage, bao gồm timestamp.
Không sửa `Food.source=legacy_unknown`, nutrition, giá, media hoặc độ khó bài tập.
Không suy review taxonomy dị ứng thành xác minh số liệu dinh dưỡng.

## Evidence cho từng field

[USDA FoodData Central inventory](https://fdc.nal.usda.gov/log/) ghi nhận tuna
trong nhóm thực phẩm nguyên bản; [USDA SR Legacy EPA table](https://www.nal.usda.gov/sites/default/files/page-files/EPA.pdf)
cũng phân loại tuna là fish. Chỉ dùng để xác minh identity/taxonomy của thực phẩm
chung; không gán species hoặc SKU mà catalog chưa có. [FDA](https://www.fda.gov/food/buy-store-serve-safe-food/food-allergies-what-you-need-know)
liệt kê fish trong nhóm dị ứng và yêu cầu đọc nhãn. Profile này không chứng minh
không nhiễm chéo; output vẫn là `ingredient_verified` với cảnh báo nhãn sản phẩm.
`mayContain=[]` chỉ có nghĩa chưa ghi nhận cross-contact tại cấp ingredient này.
Yêu cầu package-label/manufacturer/no-cross-contact vẫn phải fail closed.

[ACE bent-knee push-up](https://www.acefitness.org/resources/everyone/exercise-library/13/bent-knee-push-up/)
và [Mayo Clinic modified pushup](https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/modified-pushup/vid-20084674)
xác minh kỹ thuật quỳ, thân ổn định và hạ/đẩy có kiểm soát. Nội dung đề xuất là
paraphrase, không đưa khuyến cáo điều trị/chẩn đoán hay bảo đảm hết đau.

## Preview và quyền hạn

Read-only snapshot staging lúc `2026-10-03T20:23:02.241Z`, 386 Food và đúng
Exercise ở trên; database writes 0. Offline preview dùng canonical tool request
builder, catalog thật trong bộ nhớ và baseline câu 4 từ live UI15:

- Câu 1: trước `safety_metadata_missing`; sau `complete`, 600,2 kcal / 45,2 g protein.
- Câu 5: trước `replacement_safety_metadata_missing`; sau `complete`,
  2.196,4 kcal / 152,6 g protein; thay hai vị trí đậu phụ và giữ nguyên mọi món khác.
- Không đổi oracle/tolerance. Đây là preview offline, không phải live PASS.

Manifest/preimages nằm ở ignored local artifact
`.local-data/staging-ai-resume-20261003/catalog-followup-plan.json`.
Digest được review:
`78d6a798c0a99afd182b9461bfee23973450e11aeacbb7ee7628bce692f5b952`.
Digest là fingerprint của plan, không phải credential.

Apply chỉ được chạy sau approval rõ cho hai records trên staging, preflight
exact identity/SHA/database/digest và freshness backup hiện tại. Nếu data drift,
không sửa digest bằng tay để vượt guard; tạo lại preview và review.

## Rollback và side effects

Giữ preimages trước mutation; thực hiện cả hai update trong transaction, verify
post-state. Rollback chỉ restore đúng fields/IDs khi state đang khớp receipt sau
apply; abort nếu có thay đổi mới của Admin. Không xóa dữ liệu/customer/seed.

Exercise đang thuộc cohort rollout cũ. Phải restore preimage của sửa này trước
khi dùng rollback cohort Plan 092; không sửa marker cũ để bỏ qua drift check.
Sau apply và deploy code sửa intake/citation, test 15 câu trên đúng SHA mới;
grounding timeout vẫn là rủi ro chưa chứng minh fixed.
