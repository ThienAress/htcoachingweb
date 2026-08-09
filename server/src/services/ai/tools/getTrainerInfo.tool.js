// Get Trainer Info Tool — Query Trainer model

import Trainer from "../../../models/Trainer.js";

/**
 * Lấy thông tin HLV
 * @param {{ specialty? }} params
 * @returns {{ text: string, uiCard: object }}
 */
export async function getTrainerInfo(params) {
  const { specialty } = params;
  const query = { status: "published" };

  // Đếm tổng số HLV để quyết định có gợi ý link trang HLV không
  const totalCount = await Trainer.countDocuments(query);

  const trainers = await Trainer.find(query)
    .sort({ isHeadCoach: -1, sortOrder: 1 })
    .limit(5)
    .lean();

  if (trainers.length === 0) {
    return {
      text: "Hiện tại chưa có thông tin huấn luyện viên trong hệ thống.",
      uiCard: null,
    };
  }

  // Nếu có specialty filter, ưu tiên trainer có specialties khớp
  let filteredTrainers = trainers;
  if (specialty) {
    const matched = trainers.filter((t) =>
      t.specialties?.some((s) => s.label?.toLowerCase().includes(specialty.toLowerCase()))
    );
    if (matched.length > 0) filteredTrainers = matched;
  }

  // Text chi tiết cho LLM — liệt kê đầy đủ thông tin từng HLV
  const trainerList = filteredTrainers
    .map((t, i) => {
      const specs = t.specialties?.map((s) => s.label).join(", ") || "Đa năng";
      const parts = [`${i + 1}. **${t.name}**`];
      if (t.title) parts.push(`— ${t.title}`);
      parts.push(`(${specs})`);
      if (t.experience) parts.push(`| ${t.experience} kinh nghiệm`);
      if (t.bio) parts.push(`\n   ${t.bio.substring(0, 150)}${t.bio.length > 150 ? "..." : ""}`);
      return parts.join(" ");
    })
    .join("\n");

  // Chỉ gợi ý link trang HLV khi có nhiều hơn 5 HLV
  let text = `Đội ngũ HLV tại HTCOACHING (Top ${filteredTrainers.length}):\n${trainerList}`;
  if (totalCount > 5) {
    text += `\n\nNếu muốn xem tất cả ${totalCount} huấn luyện viên, bạn có thể ghé trang [Huấn luyện viên](/huan-luyen-vien).`;
  }

  const uiCard = {
    cardType: "trainer",
    data: {
      trainers: filteredTrainers.map((t) => ({
        name: t.name,
        slug: t.slug,
        title: t.title || "",
        experience: t.experience || "",
        bio: t.bio || "",
        image: t.images?.[0] || t.image || "",
        specialties: t.specialties?.map((s) => s.label) || [],
        isHeadCoach: t.isHeadCoach || false,
      })),
      totalCount,
    },
  };

  return { text, uiCard };
}
