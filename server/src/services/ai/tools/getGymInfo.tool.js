// Get Gym Info Tool — Query Gym model (read-only, public)

import Gym from "../../../models/Gym.js";

/**
 * Lấy thông tin phòng tập mà HLV HTCOACHING đang dạy
 * @param {{ district?: string }} params
 * @returns {{ text: string, uiCard: object|null }}
 */
export async function getGymInfo(params) {
  try {
    const { district } = params;

    const query = { status: "active" };
    if (district) {
      query.district = { $regex: district, $options: "i" };
    }

    const gyms = await Gym.find(query).sort({ sortOrder: 1 }).lean();

    if (gyms.length === 0) {
      if (district) {
        return {
          text: `Hiện tại chưa có phòng tập nào ở ${district}. Bạn có thể xem danh sách tất cả phòng tập tại [CLB](/club).`,
          uiCard: null,
        };
      }
      return {
        text: "Chưa có thông tin phòng tập trong hệ thống. Vui lòng liên hệ HTCOACHING để biết thêm chi tiết!",
        uiCard: null,
      };
    }

    let text = `🏠 **Các phòng tập mà HLV HTCOACHING đang dạy** (${gyms.length} phòng):\n`;

    gyms.forEach((gym, i) => {
      text += `\n${i + 1}. **${gym.name}**`;
      text += `\n   📍 ${gym.address}`;
      text += ` (${gym.district})`;
      if (gym.openingHours) text += `\n   🕐 Giờ mở cửa: ${gym.openingHours}`;
      if (gym.hasKickfit) text += `\n   🥊 Có lớp Kickfit`;
      if (gym.note) text += `\n   📝 ${gym.note}`;
      if (gym.googleMapsUrl) text += `\n   🗺️ [Xem trên Google Maps](${gym.googleMapsUrl})`;
    });

    text += `\n\nXem chi tiết tại [Câu lạc bộ](/club).`;

    const uiCard = {
      cardType: "gymInfo",
      data: {
        gyms: gyms.map((g) => ({
          name: g.name,
          address: g.address,
          district: g.district,
          openingHours: g.openingHours || "24/7",
          hasKickfit: g.hasKickfit,
          googleMapsUrl: g.googleMapsUrl || "",
          note: g.note || "",
          image: g.image || "",
        })),
      },
    };

    return { text, uiCard };
  } catch {
    return {
      text: "Không thể tải thông tin phòng tập lúc này. Bạn có thể xem tại [CLB](/club).",
      uiCard: null,
    };
  }
}
