// Seed Knowledge Base — 20 FAQ chất lượng nhất
// Chạy: node src/scripts/seedKnowledgeBase.js

import dns from "dns";
dns.setServers(["1.1.1.1", "1.0.0.1"]);

import "../config/env.js";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import KnowledgeEntry from "../models/KnowledgeEntry.js";
import { generateEmbedding } from "../services/ai/embedding.service.js";

const SEED_DATA = [
  // === DỊCH VỤ ===
  {
    question: "Gói PT 1 kèm 1 giá bao nhiêu và bao gồm những gì?",
    answer: "HTCOACHING cung cấp gói PT 1 kèm 1 — HLV chuyên nghiệp kèm riêng tại phòng tập, thiết kế giáo án cá nhân hóa theo mục tiêu của bạn (giảm mỡ, tăng cơ, cải thiện sức khỏe). Mỗi buổi tập HLV sẽ hướng dẫn kỹ thuật, điều chỉnh chương trình theo tiến độ. Bạn xem chi tiết bảng giá tại trang Bảng giá (/#pricing) hoặc liên hệ tư vấn miễn phí qua form liên hệ (/#contact) hoặc gọi 0934.215.227.",
    category: "service",
    tags: ["PT", "giá", "gói tập", "1 kèm 1"],
  },
  {
    question: "Online Coaching là gì, phù hợp với ai?",
    answer: "Online Coaching là gói tập từ xa — HLV thiết kế giáo án tập và lịch ăn online cho bạn. Bạn tập theo giáo án tại phòng tập gần nhà, và check-in báo cáo tiến độ qua hệ thống. Gói này phù hợp với người ở xa TP.HCM, bận rộn, hoặc muốn tiết kiệm chi phí hơn so với PT trực tiếp. Xem bảng giá tại (/#pricing).",
    category: "service",
    tags: ["online coaching", "tập từ xa", "giáo án"],
  },
  {
    question: "Đăng ký tập ở đâu, liên hệ như thế nào?",
    answer: "Bạn có thể đăng ký tư vấn miễn phí qua: 1) Form liên hệ trên website (/#contact), 2) Gọi trực tiếp: 0934.215.227, 3) Email: hoangthiengym99@gmail.com. Giờ làm việc: Thứ 2 - Chủ nhật, 6:00 - 22:00. Đội ngũ sẽ tư vấn gói tập phù hợp với mục tiêu và ngân sách của bạn.",
    category: "service",
    tags: ["đăng ký", "liên hệ", "tư vấn"],
  },

  // === DINH DƯỠNG ===
  {
    question: "TDEE là gì và tại sao cần biết?",
    answer: "TDEE (Total Daily Energy Expenditure) là tổng năng lượng cơ thể tiêu hao mỗi ngày, bao gồm: chuyển hóa cơ bản (BMR) + hoạt động hàng ngày + tập luyện. Biết TDEE giúp bạn: ăn ít hơn TDEE để giảm mỡ, ăn nhiều hơn TDEE để tăng cơ, hoặc ăn bằng TDEE để duy trì cân nặng. Bạn có thể tính TDEE miễn phí tại (/tdee-calculator).",
    category: "nutrition",
    tags: ["TDEE", "calo", "dinh dưỡng cơ bản"],
  },
  {
    question: "Ăn bao nhiêu protein mỗi ngày để tăng cơ?",
    answer: "Để tăng cơ hiệu quả, bạn nên ăn 1.6–2.2g protein/kg cân nặng mỗi ngày. VD: người 70kg cần 112–154g protein/ngày. Nguồn protein tốt: ức gà, cá, trứng, thịt bò nạc, đậu phụ, whey protein. Chia đều protein vào 3-5 bữa để cơ thể hấp thu tốt hơn. Kết hợp tính TDEE (/tdee-calculator) rồi lên thực đơn phù hợp (/mealplan).",
    category: "nutrition",
    tags: ["protein", "tăng cơ", "macro"],
  },
  {
    question: "Muốn giảm mỡ nên ăn gì, kiêng gì?",
    answer: "Giảm mỡ = ăn ít calo hơn TDEE (thâm hụt 300-500 calo/ngày). Nên ăn: nhiều protein (giữ cơ), rau xanh, ngũ cốc nguyên hạt, chất béo lành mạnh. Hạn chế: đồ chiên, nước ngọt, bánh kẹo, rượu bia. Không cần kiêng cực đoan — chỉ cần thâm hụt calo vừa phải và ăn đủ protein. Tính TDEE (/tdee-calculator) → lên thực đơn (/mealplan) để có kế hoạch cụ thể.",
    category: "nutrition",
    tags: ["giảm mỡ", "chế độ ăn", "thâm hụt calo"],
  },
  {
    question: "Bulking và cutting là gì?",
    answer: "Bulking = giai đoạn ăn thặng dư calo để tăng cơ (ăn nhiều hơn TDEE 200-500 calo). Cutting = giai đoạn ăn thâm hụt calo để giảm mỡ mà giữ cơ (ăn ít hơn TDEE 300-500 calo). Chu kỳ phổ biến: bulk 3-6 tháng → cut 2-3 tháng. Người mới tập có thể vừa tăng cơ vừa giảm mỡ cùng lúc (body recomposition) nếu ăn đủ protein và tập nặng.",
    category: "nutrition",
    tags: ["bulking", "cutting", "recomp"],
  },

  // === TẬP LUYỆN ===
  {
    question: "Người mới bắt đầu tập gym nên tập gì?",
    answer: "Người mới nên: 1) Tập toàn thân (full-body) 3 buổi/tuần, 2) Ưu tiên bài tập compound: Squat, Deadlift, Bench Press, Overhead Press, Row — tập sức mạnh nền tảng, 3) Mỗi bài 3-4 set x 8-12 reps, 4) Tăng dần tạ mỗi tuần (progressive overload). Xem thư viện 400+ bài tập tại (/exercises). Nếu chưa biết kỹ thuật, nên tập với HLV để tránh chấn thương.",
    category: "training",
    tags: ["người mới", "newbie", "bắt đầu"],
  },
  {
    question: "PPL là gì, phân chia ngày tập như thế nào?",
    answer: "PPL (Push-Pull-Legs) là phương pháp chia 3 ngày: Push (ngực, vai, tay sau) → Pull (lưng, tay trước) → Legs (chân, mông). Lặp lại 2 lần/tuần = 6 buổi tập. Đây là phương pháp phổ biến nhất cho người tập trung cấp trở lên vì tối ưu tần suất tập mỗi nhóm cơ 2 lần/tuần. Người mới có thể tập PPL 3 buổi/tuần (mỗi ngày 1 lần).",
    category: "training",
    tags: ["PPL", "giáo án", "split"],
  },
  {
    question: "Tập bao lâu thì thấy kết quả?",
    answer: "Với chế độ tập luyện và dinh dưỡng đúng: 2-4 tuần — cảm nhận sức mạnh tăng, tinh thần tốt hơn. 1-2 tháng — bắt đầu thấy thay đổi ngoại hình. 3-6 tháng — thay đổi rõ rệt, người xung quanh nhận ra. Chìa khóa: kiên trì, tập đều đặn, ăn uống đúng. Xem kết quả thực tế từ học viên HTCOACHING tại (/ket-qua-khach-hang).",
    category: "training",
    tags: ["kết quả", "thời gian", "tiến độ"],
  },

  // === THỰC PHẨM BỔ SUNG ===
  {
    question: "Whey Protein có cần thiết không, uống lúc nào?",
    answer: "Whey protein là thực phẩm bổ sung protein tiện lợi, KHÔNG bắt buộc — nếu bạn ăn đủ protein từ thực phẩm thì không cần. Nên dùng khi: khó ăn đủ protein (bận rộn, ăn chay), hoặc cần bổ sung nhanh sau tập. Uống lúc nào cũng được — sau tập, giữa bữa, hoặc trộn vào sinh tố. Liều: 1-2 scoop/ngày (25-50g protein).",
    category: "supplement",
    tags: ["whey", "protein", "supplement"],
  },
  {
    question: "Creatine có an toàn không, uống bao nhiêu?",
    answer: "Creatine là supplement được nghiên cứu nhiều nhất — an toàn cho người khỏe mạnh khi dùng đúng liều. Tác dụng: tăng sức mạnh, sức bền tập nặng, phục hồi nhanh hơn. Liều: 3-5g/ngày (creatine monohydrate), không cần loading phase. Uống hàng ngày, kể cả ngày nghỉ. Nên uống đủ nước (2-3L/ngày).",
    category: "supplement",
    tags: ["creatine", "supplement", "an toàn"],
  },

  // === SỨC KHỎE ===
  {
    question: "Đau cơ sau tập có bình thường không?",
    answer: "Đau cơ sau tập (DOMS - Delayed Onset Muscle Soreness) hoàn toàn bình thường, đặc biệt khi mới tập hoặc đổi bài mới. Thường xuất hiện 24-72h sau tập và tự hết. Giảm đau: nghỉ ngơi đủ, ăn đủ protein, giãn cơ nhẹ, ngâm nước ấm. Nếu đau nhói, sưng, hoặc đau kéo dài > 5 ngày → nên gặp bác sĩ vì có thể là chấn thương.",
    category: "health",
    tags: ["DOMS", "đau cơ", "phục hồi"],
  },
  {
    question: "Nên nghỉ ngơi bao nhiêu giữa các buổi tập?",
    answer: "Mỗi nhóm cơ cần 48-72h nghỉ để phục hồi. VD: tập ngực thứ 2 → tập ngực lại thứ 4 hoặc 5. Tuy nhiên bạn có thể tập hàng ngày nếu chia nhóm cơ khác nhau (VD: PPL). Giấc ngủ 7-9h/đêm rất quan trọng — cơ thể phục hồi và tăng trưởng chủ yếu khi ngủ. Nếu cảm thấy mệt mỏi kéo dài, nên nghỉ 1-2 ngày hoàn toàn.",
    category: "health",
    tags: ["nghỉ ngơi", "phục hồi", "giấc ngủ"],
  },

  // === NỀN TẢNG ===
  {
    question: "Website HTCOACHING có những công cụ miễn phí gì?",
    answer: "HTCOACHING cung cấp nhiều công cụ miễn phí: 1) Tính TDEE & Macro (/tdee-calculator) — tính calo và phân bổ dinh dưỡng, 2) Gợi ý thực đơn (/mealplan) — tạo thực đơn từ 500+ món ăn Việt Nam, 3) Thư viện bài tập (/exercises) — 400+ bài tập có ảnh/video minh họa, 4) Tạo giáo án (/workout-plan) — thiết kế chương trình tập cá nhân hóa, 5) Tìm phòng tập (/club) — danh sách phòng tập gần bạn. Tất cả miễn phí, không cần đăng ký gói tập.",
    category: "platform",
    tags: ["website", "công cụ", "miễn phí"],
  },
  {
    question: "HTCOACHING có hỗ trợ HLV quản lý khách hàng không?",
    answer: "Có! HTCOACHING không chỉ phục vụ người tập mà còn cung cấp hệ thống quản lý khách hàng chuyên nghiệp cho HLV: quản lý học viên, lên giáo án, theo dõi check-in, lịch tập, quản lý hợp đồng — tất cả trên 1 nền tảng. Hệ thống coaching online giúp HLV phục vụ khách hàng từ xa hiệu quả. Nếu bạn là HLV và muốn sử dụng hệ thống, liên hệ qua form liên hệ (/#contact) hoặc gọi 0934.215.227.",
    category: "platform",
    tags: ["HLV", "quản lý", "hệ thống"],
  },

  // === DỤNG CỤ ===
  {
    question: "Dây kháng lực (resistance band) có tập thay tạ được không?",
    answer: "Dây kháng lực là dụng cụ bổ trợ tốt nhưng KHÔNG thay thế hoàn toàn tạ tự do. Ưu điểm: gọn nhẹ, tập ở nhà, phù hợp warm-up và bài isolation. Hạn chế: khó progressive overload (tăng tải dần), không hiệu quả bằng tạ cho bài compound nặng. Tốt nhất: kết hợp dây band + tạ. Người mới tập ở nhà có thể bắt đầu bằng dây band, sau đó chuyển sang phòng tập.",
    category: "equipment",
    tags: ["dây kháng lực", "band", "dụng cụ"],
  },

  // === VĐV ===
  {
    question: "Chris Bumstead (CBum) là ai?",
    answer: "Chris Bumstead (CBum) là vận động viên thể hình người Canada, Mr. Olympia Classic Physique 5 lần liên tiếp (2019-2023). Anh nổi tiếng với vóc dáng cân đối theo phong cách bodybuilding cổ điển — không quá to nhưng rất aesthetic. CBum là nguồn cảm hứng lớn cho nhiều người tập gym vì body vừa to vừa đẹp. Anh đã tuyên bố giải nghệ sau Olympia 2023.",
    category: "athlete",
    tags: ["CBum", "Mr Olympia", "Classic Physique"],
  },

  // === HLV ===
  {
    question: "HLV Hoàng Thiện là ai?",
    answer: "Hoàng Thiện là Head Coach và founder của HTCOACHING — nền tảng huấn luyện thể hình chuyên nghiệp tại TP.HCM. Với kinh nghiệm nhiều năm trong ngành fitness, Hoàng Thiện chuyên về giảm mỡ, tăng cơ, và cải thiện thể lực. Hoàng Thiện không chỉ là HLV mà còn xây dựng hệ thống công nghệ giúp quản lý khách hàng và coaching online hiệu quả.",
    category: "hlv",
    tags: ["Hoàng Thiện", "Head Coach", "founder"],
  },
];

async function seedKnowledgeBase() {
  await connectDB();
  console.log("🌱 Seeding Knowledge Base...\n");

  // Tìm admin user để gán createdBy
  const User = (await import("../models/User.js")).default;
  const admin = await User.findOne({ role: "admin" }).lean();
  if (!admin) {
    console.error("❌ Không tìm thấy admin user. Hãy đăng nhập admin trước.");
    process.exit(1);
  }

  let success = 0;
  let failed = 0;

  for (const item of SEED_DATA) {
    try {
      // Kiểm tra trùng
      const existing = await KnowledgeEntry.findOne({ question: item.question });
      if (existing) {
        console.log(`⏭️  Bỏ qua (đã tồn tại): ${item.question.slice(0, 50)}...`);
        continue;
      }

      // Tạo embedding
      console.log(`🔄 Tạo embedding: ${item.question.slice(0, 50)}...`);
      let embedding = [];
      try {
        embedding = await generateEmbedding(item.question);
      } catch (err) {
        console.warn(`⚠️  Embedding lỗi: ${err.message}`);
      }

      await KnowledgeEntry.create({
        ...item,
        embedding,
        status: "published",
        createdBy: admin._id,
      });

      success++;
      console.log(`✅ ${item.category}: ${item.question.slice(0, 50)}...`);

      // Delay để tránh rate limit Gemini API
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      failed++;
      console.error(`❌ Lỗi: ${err.message}`);
    }
  }

  console.log(`\n🎉 Seed hoàn tất: ${success} thành công, ${failed} lỗi`);
  await mongoose.disconnect();
  process.exit(0);
}

seedKnowledgeBase();
