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

  // Text cho LLM
  const trainerList = filteredTrainers
    .map((t, i) => {
      const specs = t.specialties?.map((s) => s.label).join(", ") || "Đa năng";
      return `${i + 1}. ${t.name}${t.title ? ` — ${t.title}` : ""} (${specs})${t.experience ? `, ${t.experience} kinh nghiệm` : ""}`;
    })
    .join("\n");

  const text = `Đội ngũ HLV tại HTCOACHING:\n${trainerList}`;

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
    },
  };

  return { text, uiCard };
}
