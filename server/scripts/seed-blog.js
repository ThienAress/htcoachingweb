// Script tạo bài blog mẫu cho các category
// Chạy: node scripts/seed-blog.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

import BlogPost from "../src/models/BlogPost.js";
import Trainer from "../src/models/Trainer.js";

const seedBlogs = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Tìm trainer đầu tiên để gán author
    const trainer = await Trainer.findOne({ status: "published" }).lean();
    const authorId = trainer?._id || null;

    const blogs = [
      {
        title: "Giáo án OPT Model – Hướng dẫn xây dựng chương trình tập toàn diện",
        slug: "giao-an-opt-model-huong-dan-xay-dung-chuong-trinh-tap-toan-dien",
        category: "giao-an-opt",
        excerpt: "Tìm hiểu mô hình OPT (Optimum Performance Training) của NASM – nền tảng khoa học giúp HLV thiết kế giáo án tập luyện hiệu quả cho mọi đối tượng.",
        tags: ["OPT", "NASM", "giáo án", "periodization"],
        metaTitle: "Giáo án OPT Model – Xây dựng chương trình tập khoa học | HTCOACHING",
        metaDescription: "Hướng dẫn chi tiết mô hình OPT của NASM. Cách chia phase Stabilization, Strength, Power để tối ưu kết quả tập luyện.",
        focusKeyword: "giáo án OPT model",
        readTime: 5,
        content: `## OPT Model là gì?

OPT (Optimum Performance Training) là mô hình huấn luyện do **NASM** (National Academy of Sports Medicine) phát triển. Đây là hệ thống chia chương trình tập thành **5 phase** với mục tiêu rõ ràng.

## 5 Phase của OPT Model

### Phase 1: Stabilization Endurance

Mục tiêu: Xây dựng nền tảng ổn định cơ thể, cải thiện sự linh hoạt và sức bền cơ bản.

- **Thời gian:** 4 tuần
- **Reps:** 12-20 reps
- **Tempo:** 4/2/1 (chậm - giữ - nhanh)
- **Rest:** 0-90 giây

> Đây là phase quan trọng nhất cho người mới bắt đầu. Đừng bỏ qua bước này!

### Phase 2: Strength Endurance

Kết hợp bài tập ổn định với bài tập sức mạnh. Sử dụng kỹ thuật **superset** giữa bài ổn định và bài truyền thống.

### Phase 3: Muscular Development (Hypertrophy)

Tập trung vào **phì đại cơ**. Volume cao hơn, thời gian nghỉ tối ưu.

- **Reps:** 6-12 reps
- **Sets:** 3-5 sets
- **Rest:** 45-90 giây

### Phase 4: Maximal Strength

Tập trung vào sức mạnh tối đa với tạ nặng.

- **Reps:** 1-5 reps
- **Sets:** 4-6 sets
- **Rest:** 3-5 phút

### Phase 5: Power

Phase cuối cùng, kết hợp sức mạnh với tốc độ. Phù hợp cho vận động viên.

## Cách áp dụng cho học viên PT

1. **Đánh giá thể lực** ban đầu (F1 Assessment)
2. **Xác định mục tiêu** của học viên
3. **Chọn phase phù hợp** dựa trên trình độ
4. **Theo dõi và điều chỉnh** sau mỗi 4-6 tuần

## Kết luận

OPT Model không chỉ là lý thuyết — đây là công cụ thực tế mà mọi HLV nên nắm vững để tạo ra giáo án khoa học, an toàn và hiệu quả cho học viên.`,
      },
      {
        title: "Đánh giá F1 – Cách đo lường thể lực toàn diện cho học viên",
        slug: "danh-gia-f1-cach-do-luong-the-luc-toan-dien",
        category: "danh-gia-f1",
        excerpt: "Quy trình đánh giá F1 giúp HLV xác định điểm mạnh, điểm yếu của học viên và xây dựng chương trình tập phù hợp nhất.",
        tags: ["F1", "đánh giá thể lực", "assessment", "PT"],
        metaTitle: "Đánh giá F1 – Đo lường thể lực toàn diện | HTCOACHING",
        metaDescription: "Quy trình đánh giá F1 chi tiết: overhead squat, push-up, plank test. Cách HLV đo lường và phân tích thể lực học viên.",
        focusKeyword: "đánh giá F1 thể lực",
        readTime: 4,
        content: `## Đánh giá F1 là gì?

Đánh giá F1 (Fitness Level 1) là quy trình **kiểm tra thể lực tổng quát** được thực hiện trước khi bắt đầu chương trình tập. Đây là bước không thể bỏ qua trong Personal Training.

## Tại sao cần đánh giá F1?

- Xác định **điểm mạnh và điểm yếu** của học viên
- Phát hiện **rủi ro chấn thương** tiềm ẩn
- Thiết lập **baseline** để theo dõi tiến độ
- Chọn đúng **phase tập** trong mô hình OPT

## Các bài test trong F1

### 1. Overhead Squat Assessment

Bài test đánh giá sự cân bằng và linh hoạt toàn thân:

- **Quan sát chính diện:** Đầu gối có vào trong không? Bàn chân có xoay ngoài không?
- **Quan sát bên:** Lưng có quá cong? Cánh tay có đổ về phía trước không?
- **Quan sát phía sau:** Gót chân có nhấc lên không?

### 2. Push-up Test

Đo sức bền phần thân trên:

- **Nam:** Push-up tiêu chuẩn
- **Nữ:** Push-up trên đầu gối
- **Đánh giá:** Số reps tối đa trong 60 giây

### 3. Plank Test

Đánh giá sức mạnh core:

- Giữ plank tiêu chuẩn
- Ghi nhận thời gian tối đa
- Quan sát hông có chùng hoặc nhô lên không

### 4. Đo chỉ số cơ thể

- **BMI** – Chỉ số khối cơ thể
- **Body Fat %** – Tỉ lệ mỡ cơ thể
- **Vòng eo, vòng hông** – Tỉ lệ WHR

## Cách phân tích kết quả

| Chỉ số | Tốt | Trung bình | Cần cải thiện |
|--------|-----|------------|---------------|
| Push-up (nam) | >30 | 15-30 | <15 |
| Push-up (nữ) | >20 | 10-20 | <10 |
| Plank | >90s | 45-90s | <45s |

## Kết luận

Đánh giá F1 là nền tảng của mọi chương trình PT chuyên nghiệp. Không đánh giá đúng → không thể thiết kế giáo án đúng → không đạt kết quả.`,
      },
      {
        title: "Dinh dưỡng cho người tập Gym – Hướng dẫn từ A đến Z",
        slug: "dinh-duong-cho-nguoi-tap-gym-huong-dan-a-z",
        category: "dinh-duong",
        excerpt: "Hướng dẫn đầy đủ về dinh dưỡng cho người tập gym: cách tính macro, thời điểm ăn, thực phẩm nên ăn và nên tránh.",
        tags: ["dinh dưỡng", "macro", "protein", "gym"],
        metaTitle: "Dinh dưỡng cho người tập Gym – Hướng dẫn A-Z | HTCOACHING",
        metaDescription: "Hướng dẫn dinh dưỡng đầy đủ cho người tập gym. Cách tính TDEE, chia macro, chọn thực phẩm tối ưu cho tăng cơ giảm mỡ.",
        focusKeyword: "dinh dưỡng tập gym",
        readTime: 6,
        content: `## Tại sao dinh dưỡng quan trọng hơn tập luyện?

Nhiều người nghĩ rằng tập nặng là đủ. Sự thật: **kết quả tập luyện phụ thuộc 70% vào dinh dưỡng**. Bạn không thể "out-train" một chế độ ăn tồi.

## Bước 1: Tính TDEE

TDEE (Total Daily Energy Expenditure) là tổng năng lượng cơ thể tiêu hao mỗi ngày.

- **Giảm mỡ:** Ăn dưới TDEE 300-500 calo
- **Tăng cơ:** Ăn trên TDEE 200-300 calo
- **Giữ cân:** Ăn đúng TDEE

> Bạn có thể sử dụng công cụ [Tính TDEE](/tdee-calculator) của HTCOACHING để xác định nhanh.

## Bước 2: Chia tỉ lệ Macro

Macro gồm 3 nhóm chính:

### Protein (Đạm)

- **Liều lượng:** 1.6-2.2g/kg cân nặng/ngày
- **Nguồn tốt:** Ức gà, cá, trứng, whey protein, đậu hũ
- **Vai trò:** Xây dựng và phục hồi cơ bắp

### Carbohydrate (Tinh bột)

- **Liều lượng:** 3-5g/kg cân nặng/ngày (tùy mục tiêu)
- **Nguồn tốt:** Cơm gạo lứt, khoai lang, yến mạch, trái cây
- **Vai trò:** Cung cấp năng lượng cho tập luyện

### Fat (Chất béo)

- **Liều lượng:** 0.8-1.2g/kg cân nặng/ngày
- **Nguồn tốt:** Bơ, dầu olive, các loại hạt, cá hồi
- **Vai trò:** Hỗ trợ hormone, hấp thu vitamin

## Bước 3: Timing – Ăn vào lúc nào?

### Pre-workout (1-2 giờ trước tập)

Bữa ăn giàu carb + protein vừa phải:
- 1 chén cơm gạo lứt + 100g ức gà
- Hoặc 1 quả chuối + 1 scoop whey

### Post-workout (Trong vòng 1 giờ sau tập)

Protein + carb nhanh:
- 1 scoop whey protein + 1 quả chuối
- Hoặc 150g ức gà + 1 chén cơm

## Thực phẩm nên TRÁNH

- ❌ Đồ chiên rán, fast food
- ❌ Nước ngọt có gas
- ❌ Bánh kẹo, đường tinh luyện
- ❌ Rượu bia (ảnh hưởng phục hồi cơ)

## Meal Prep – Bí quyết ăn sạch dễ dàng

1. **Chọn 1 ngày** trong tuần để chuẩn bị (Chủ Nhật)
2. **Nấu sẵn** protein (ức gà, cá) cho 3-4 ngày
3. **Chia hộp** theo từng bữa
4. **Bảo quản** trong tủ lạnh

> Sử dụng công cụ [Gợi ý thực đơn](/mealplan) của HTCOACHING để tạo meal plan tự động.

## Kết luận

Dinh dưỡng không cần phức tạp. Nắm vững 3 bước: Tính TDEE → Chia macro → Ăn đúng thời điểm. Kết hợp với chương trình tập khoa học, bạn sẽ thấy kết quả rõ rệt trong 4-8 tuần.`,
      },
      {
        title: "Periodization trong Gym – Tại sao HLV cần phân kỳ giáo án?",
        slug: "periodization-trong-gym-phan-ky-giao-an",
        category: "giao-an-opt",
        excerpt: "Phân kỳ huấn luyện (Periodization) giúp tránh plateau, giảm chấn thương và tối ưu kết quả tập luyện. Tìm hiểu 3 mô hình phân kỳ phổ biến.",
        tags: ["periodization", "phân kỳ", "giáo án", "plateau"],
        metaTitle: "Periodization – Phân kỳ giáo án tập luyện hiệu quả | HTCOACHING",
        metaDescription: "Tìm hiểu 3 mô hình phân kỳ huấn luyện: Linear, Undulating, Block. Cách HLV áp dụng periodization để tối ưu kết quả.",
        focusKeyword: "periodization phân kỳ gym",
        readTime: 4,
        content: `## Periodization là gì?

Periodization (phân kỳ) là việc **chia chương trình tập thành các giai đoạn** có mục tiêu, volume và intensity khác nhau. Đây là nguyên tắc cốt lõi giúp tránh plateau.

## Tại sao cần phân kỳ?

Nếu bạn tập cùng 1 chương trình, cùng 1 volume suốt 6 tháng — cơ thể sẽ **thích nghi** và ngừng phát triển. Phân kỳ giúp:

- **Tránh plateau** (bục trần)
- **Giảm nguy cơ** chấn thương do quá tải
- **Tối ưu phục hồi** giữa các phase
- **Duy trì động lực** cho học viên

## 3 Mô hình phân kỳ phổ biến

### 1. Linear Periodization (Phân kỳ tuyến tính)

Tăng intensity + giảm volume theo thời gian:

- **Tuần 1-4:** 4 sets x 12 reps (nhẹ)
- **Tuần 5-8:** 4 sets x 8 reps (trung bình)
- **Tuần 9-12:** 5 sets x 5 reps (nặng)

> Phù hợp cho: Người mới, mục tiêu tăng sức mạnh nền tảng.

### 2. Daily Undulating Periodization (DUP)

Thay đổi volume/intensity **trong tuần**:

- **Thứ 2:** Strength (5x5)
- **Thứ 4:** Hypertrophy (4x10)
- **Thứ 6:** Power (3x3)

> Phù hợp cho: Người tập trung cấp, muốn đa dạng kích thích.

### 3. Block Periodization

Chia thành các **block 3-4 tuần**, mỗi block tập trung 1 mục tiêu:

- **Block 1:** Accumulation (volume cao)
- **Block 2:** Transmutation (intensity cao)
- **Block 3:** Realization (peak performance)

> Phù hợp cho: Vận động viên, người tập nâng cao.

## Cách áp dụng thực tế

1. **Đánh giá** trình độ học viên
2. **Chọn mô hình** phù hợp
3. **Lên kế hoạch** cho 12-16 tuần
4. **Deload** mỗi 4-6 tuần (giảm volume 40-60%)
5. **Đánh giá lại** và điều chỉnh

## Kết luận

Phân kỳ không phải là luxury — đó là **necessity**. HLV nào không phân kỳ giáo án cho học viên, người đó đang để lại kết quả trên bàn.`,
      },
    ];

    for (const blog of blogs) {
      const existing = await BlogPost.findOne({ slug: blog.slug });
      if (existing) {
        console.log(`⏭️  Skip (đã tồn tại): ${blog.title}`);
        continue;
      }

      const doc = new BlogPost({
        ...blog,
        author: authorId,
        status: "published",
        featured: false,
        publishedAt: new Date(),
      });
      await doc.save();
      console.log(`✅ Created: ${blog.title}`);
    }

    console.log("\n🎉 Seed blog mẫu hoàn tất!");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed error:", err);
    process.exit(1);
  }
};

seedBlogs();
