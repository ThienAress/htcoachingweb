// Xóa blog cũ (Markdown) + tạo lại dạng HTML
// Chạy: node scripts/reseed-blog-html.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

import BlogPost from "../src/models/BlogPost.js";
import Trainer from "../src/models/Trainer.js";

const OLD_SLUGS = [
  "giao-an-opt-model-huong-dan-xay-dung-chuong-trinh-tap-toan-dien",
  "danh-gia-f1-cach-do-luong-the-luc-toan-dien",
  "dinh-duong-cho-nguoi-tap-gym-huong-dan-a-z",
  "periodization-trong-gym-phan-ky-giao-an",
];

const htmlBlogs = [
  {
    title: "Giáo án OPT Model – Hướng dẫn xây dựng chương trình tập toàn diện",
    slug: "giao-an-opt-model-huong-dan-xay-dung-chuong-trinh-tap-toan-dien",
    category: "giao-an-opt",
    excerpt: "Tìm hiểu mô hình OPT (Optimum Performance Training) của NASM – nền tảng khoa học giúp HLV thiết kế giáo án tập luyện hiệu quả.",
    tags: ["OPT", "NASM", "giáo án", "periodization"],
    metaTitle: "Giáo án OPT Model – Xây dựng chương trình tập khoa học | HTCOACHING",
    metaDescription: "Hướng dẫn chi tiết mô hình OPT của NASM. Cách chia phase Stabilization, Strength, Power để tối ưu kết quả tập luyện.",
    focusKeyword: "giáo án OPT model",
    content: `<h2>OPT Model là gì?</h2><p>OPT (Optimum Performance Training) là mô hình huấn luyện do <strong>NASM</strong> (National Academy of Sports Medicine) phát triển. Đây là hệ thống chia chương trình tập thành <strong>5 phase</strong> với mục tiêu rõ ràng.</p><h2>5 Phase của OPT Model</h2><h3>Phase 1: Stabilization Endurance</h3><p>Mục tiêu: Xây dựng nền tảng ổn định cơ thể, cải thiện sự linh hoạt và sức bền cơ bản.</p><ul><li><strong>Thời gian:</strong> 4 tuần</li><li><strong>Reps:</strong> 12-20 reps</li><li><strong>Tempo:</strong> 4/2/1 (chậm - giữ - nhanh)</li><li><strong>Rest:</strong> 0-90 giây</li></ul><blockquote><p>Đây là phase quan trọng nhất cho người mới bắt đầu. Đừng bỏ qua bước này!</p></blockquote><h3>Phase 2: Strength Endurance</h3><p>Kết hợp bài tập ổn định với bài tập sức mạnh. Sử dụng kỹ thuật <strong>superset</strong> giữa bài ổn định và bài truyền thống.</p><h3>Phase 3: Muscular Development (Hypertrophy)</h3><p>Tập trung vào <strong>phì đại cơ</strong>. Volume cao hơn, thời gian nghỉ tối ưu.</p><ul><li><strong>Reps:</strong> 6-12 reps</li><li><strong>Sets:</strong> 3-5 sets</li><li><strong>Rest:</strong> 45-90 giây</li></ul><h3>Phase 4: Maximal Strength</h3><p>Tập trung vào sức mạnh tối đa với tạ nặng.</p><ul><li><strong>Reps:</strong> 1-5 reps</li><li><strong>Sets:</strong> 4-6 sets</li><li><strong>Rest:</strong> 3-5 phút</li></ul><h3>Phase 5: Power</h3><p>Phase cuối cùng, kết hợp sức mạnh với tốc độ. Phù hợp cho vận động viên.</p><h2>Cách áp dụng cho học viên PT</h2><ol><li><strong>Đánh giá thể lực</strong> ban đầu (F1 Assessment)</li><li><strong>Xác định mục tiêu</strong> của học viên</li><li><strong>Chọn phase phù hợp</strong> dựa trên trình độ</li><li><strong>Theo dõi và điều chỉnh</strong> sau mỗi 4-6 tuần</li></ol><h2>Kết luận</h2><p>OPT Model không chỉ là lý thuyết — đây là công cụ thực tế mà mọi HLV nên nắm vững để tạo ra giáo án khoa học, an toàn và hiệu quả cho học viên.</p>`,
  },
  {
    title: "Đánh giá F1 – Cách đo lường thể lực toàn diện cho học viên",
    slug: "danh-gia-f1-cach-do-luong-the-luc-toan-dien",
    category: "danh-gia-f1",
    excerpt: "Quy trình đánh giá F1 giúp HLV xác định điểm mạnh, điểm yếu của học viên và xây dựng chương trình tập phù hợp nhất.",
    tags: ["F1", "đánh giá thể lực", "assessment", "PT"],
    metaTitle: "Đánh giá F1 – Đo lường thể lực toàn diện | HTCOACHING",
    metaDescription: "Quy trình đánh giá F1 chi tiết: overhead squat, push-up, plank test.",
    focusKeyword: "đánh giá F1 thể lực",
    content: `<h2>Đánh giá F1 là gì?</h2><p>Đánh giá F1 (Fitness Level 1) là quy trình <strong>kiểm tra thể lực tổng quát</strong> được thực hiện trước khi bắt đầu chương trình tập. Đây là bước không thể bỏ qua trong Personal Training.</p><h2>Tại sao cần đánh giá F1?</h2><ul><li>Xác định <strong>điểm mạnh và điểm yếu</strong> của học viên</li><li>Phát hiện <strong>rủi ro chấn thương</strong> tiềm ẩn</li><li>Thiết lập <strong>baseline</strong> để theo dõi tiến độ</li><li>Chọn đúng <strong>phase tập</strong> trong mô hình OPT</li></ul><h2>Các bài test trong F1</h2><h3>Overhead Squat Assessment</h3><p>Bài test đánh giá sự cân bằng và linh hoạt toàn thân:</p><ul><li><strong>Quan sát chính diện:</strong> Đầu gối có vào trong không?</li><li><strong>Quan sát bên:</strong> Lưng có quá cong? Cánh tay có đổ về phía trước?</li><li><strong>Quan sát phía sau:</strong> Gót chân có nhấc lên không?</li></ul><h3>Push-up Test</h3><p>Đo sức bền phần thân trên:</p><ul><li><strong>Nam:</strong> Push-up tiêu chuẩn</li><li><strong>Nữ:</strong> Push-up trên đầu gối</li><li><strong>Đánh giá:</strong> Số reps tối đa trong 60 giây</li></ul><h3>Plank Test</h3><p>Đánh giá sức mạnh core: giữ plank tiêu chuẩn, ghi nhận thời gian tối đa.</p><h2>Kết luận</h2><p>Đánh giá F1 là nền tảng của mọi chương trình PT chuyên nghiệp. Không đánh giá đúng → không thể thiết kế giáo án đúng → không đạt kết quả.</p>`,
  },
  {
    title: "Dinh dưỡng cho người tập Gym – Hướng dẫn từ A đến Z",
    slug: "dinh-duong-cho-nguoi-tap-gym-huong-dan-a-z",
    category: "dinh-duong",
    excerpt: "Hướng dẫn đầy đủ về dinh dưỡng cho người tập gym: cách tính macro, thời điểm ăn, thực phẩm nên ăn và nên tránh.",
    tags: ["dinh dưỡng", "macro", "protein", "gym"],
    metaTitle: "Dinh dưỡng cho người tập Gym – Hướng dẫn A-Z | HTCOACHING",
    metaDescription: "Hướng dẫn dinh dưỡng đầy đủ cho người tập gym. Cách tính TDEE, chia macro.",
    focusKeyword: "dinh dưỡng tập gym",
    content: `<h2>Tại sao dinh dưỡng quan trọng hơn tập luyện?</h2><p>Nhiều người nghĩ rằng tập nặng là đủ. Sự thật: <strong>kết quả tập luyện phụ thuộc 70% vào dinh dưỡng</strong>. Bạn không thể "out-train" một chế độ ăn tồi.</p><h2>Bước 1: Tính TDEE</h2><p>TDEE (Total Daily Energy Expenditure) là tổng năng lượng cơ thể tiêu hao mỗi ngày.</p><ul><li><strong>Giảm mỡ:</strong> Ăn dưới TDEE 300-500 calo</li><li><strong>Tăng cơ:</strong> Ăn trên TDEE 200-300 calo</li><li><strong>Giữ cân:</strong> Ăn đúng TDEE</li></ul><blockquote><p>Bạn có thể sử dụng công cụ <a href="/tdee-calculator">Tính TDEE</a> của HTCOACHING để xác định nhanh.</p></blockquote><h2>Bước 2: Chia tỉ lệ Macro</h2><h3>Protein (Đạm)</h3><ul><li><strong>Liều lượng:</strong> 1.6-2.2g/kg cân nặng/ngày</li><li><strong>Nguồn tốt:</strong> Ức gà, cá, trứng, whey protein, đậu hũ</li></ul><h3>Carbohydrate (Tinh bột)</h3><ul><li><strong>Liều lượng:</strong> 3-5g/kg cân nặng/ngày</li><li><strong>Nguồn tốt:</strong> Cơm gạo lứt, khoai lang, yến mạch</li></ul><h3>Fat (Chất béo)</h3><ul><li><strong>Liều lượng:</strong> 0.8-1.2g/kg cân nặng/ngày</li><li><strong>Nguồn tốt:</strong> Bơ, dầu olive, các loại hạt, cá hồi</li></ul><h2>Bước 3: Timing – Ăn vào lúc nào?</h2><h3>Pre-workout (1-2 giờ trước tập)</h3><p>Bữa ăn giàu carb + protein vừa phải: 1 chén cơm gạo lứt + 100g ức gà.</p><h3>Post-workout (Trong vòng 1 giờ sau tập)</h3><p>Protein + carb nhanh: 1 scoop whey protein + 1 quả chuối.</p><h2>Kết luận</h2><p>Dinh dưỡng không cần phức tạp. Nắm vững 3 bước: Tính TDEE → Chia macro → Ăn đúng thời điểm. Kết hợp với chương trình tập khoa học, bạn sẽ thấy kết quả rõ rệt trong 4-8 tuần.</p>`,
  },
  {
    title: "Periodization trong Gym – Tại sao HLV cần phân kỳ giáo án?",
    slug: "periodization-trong-gym-phan-ky-giao-an",
    category: "giao-an-opt",
    excerpt: "Phân kỳ huấn luyện (Periodization) giúp tránh plateau, giảm chấn thương và tối ưu kết quả tập luyện.",
    tags: ["periodization", "phân kỳ", "giáo án", "plateau"],
    metaTitle: "Periodization – Phân kỳ giáo án tập luyện hiệu quả | HTCOACHING",
    metaDescription: "Tìm hiểu 3 mô hình phân kỳ huấn luyện: Linear, Undulating, Block.",
    focusKeyword: "periodization phân kỳ gym",
    content: `<h2>Periodization là gì?</h2><p>Periodization (phân kỳ) là việc <strong>chia chương trình tập thành các giai đoạn</strong> có mục tiêu, volume và intensity khác nhau. Đây là nguyên tắc cốt lõi giúp tránh plateau.</p><h2>Tại sao cần phân kỳ?</h2><p>Nếu bạn tập cùng 1 chương trình suốt 6 tháng — cơ thể sẽ <strong>thích nghi</strong> và ngừng phát triển. Phân kỳ giúp:</p><ul><li><strong>Tránh plateau</strong> (bục trần)</li><li><strong>Giảm nguy cơ</strong> chấn thương do quá tải</li><li><strong>Tối ưu phục hồi</strong> giữa các phase</li><li><strong>Duy trì động lực</strong> cho học viên</li></ul><h2>3 Mô hình phân kỳ phổ biến</h2><h3>Linear Periodization (Phân kỳ tuyến tính)</h3><p>Tăng intensity + giảm volume theo thời gian:</p><ul><li><strong>Tuần 1-4:</strong> 4 sets x 12 reps (nhẹ)</li><li><strong>Tuần 5-8:</strong> 4 sets x 8 reps (trung bình)</li><li><strong>Tuần 9-12:</strong> 5 sets x 5 reps (nặng)</li></ul><blockquote><p>Phù hợp cho: Người mới, mục tiêu tăng sức mạnh nền tảng.</p></blockquote><h3>Daily Undulating Periodization (DUP)</h3><p>Thay đổi volume/intensity <strong>trong tuần</strong>:</p><ul><li><strong>Thứ 2:</strong> Strength (5x5)</li><li><strong>Thứ 4:</strong> Hypertrophy (4x10)</li><li><strong>Thứ 6:</strong> Power (3x3)</li></ul><h3>Block Periodization</h3><p>Chia thành các <strong>block 3-4 tuần</strong>, mỗi block tập trung 1 mục tiêu.</p><h2>Kết luận</h2><p>Phân kỳ không phải là luxury — đó là <strong>necessity</strong>. HLV nào không phân kỳ giáo án cho học viên, người đó đang để lại kết quả trên bàn.</p>`,
  },
];

const reseed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const trainer = await Trainer.findOne({ status: "published" }).lean();
    const authorId = trainer?._id || null;

    // Xóa bài cũ
    const delResult = await BlogPost.deleteMany({ slug: { $in: OLD_SLUGS } });
    console.log(`🗑️  Đã xóa ${delResult.deletedCount} bài cũ (Markdown)`);

    // Tạo lại dạng HTML
    for (const blog of htmlBlogs) {
      const doc = new BlogPost({
        ...blog,
        author: authorId,
        status: "published",
        featured: false,
        publishedAt: new Date(),
      });
      await doc.save();
      console.log(`✅ Created (HTML): ${blog.title}`);
    }

    console.log("\n🎉 Re-seed blog HTML hoàn tất!");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

reseed();
