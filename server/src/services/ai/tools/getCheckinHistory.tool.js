// Get Checkin History Tool — Query Checkin + Order model (read-only)

import Checkin from "../../../models/Checkin.js";
import Order from "../../../models/Order.js";

/**
 * Xem lịch sử check-in và thông tin gói tập của user
 * @param {{ limit?: number }} params
 * @param {{ userId: string }} context
 * @returns {{ text: string, uiCard: object|null }}
 */
export async function getCheckinHistory(params, context) {
  try {
    const { limit = 10 } = params;

    if (!context.userId) {
      return {
        text: "Bạn cần đăng nhập để xem lịch sử check-in. Hãy đăng nhập tại [trang đăng nhập](/login).",
        uiCard: null,
      };
    }

    // Tìm orders của user (gói tập)
    const orders = await Order.find({
      userId: context.userId,
      status: { $in: ["approved", "completed", "pending"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!orders || orders.length === 0) {
      return {
        text: "Bạn chưa có gói tập nào trong hệ thống. Liên hệ HTCOACHING để đăng ký gói tập nhé! Xem [Bảng giá](/#pricing).",
        uiCard: null,
      };
    }

    const orderIds = orders.map((o) => o._id);

    // Lấy check-in history
    const checkins = await Checkin.find({ orderId: { $in: orderIds } })
      .sort({ time: -1 })
      .limit(Math.min(limit, 20))
      .lean();

    // Tổng hợp theo từng gói
    const orderSummaries = orders.map((order) => {
      const orderCheckins = checkins.filter(
        (c) => c.orderId?.toString() === order._id.toString()
      );
      const totalCheckins = orderCheckins.length;
      const remainingSessions = order.sessions ?? 0;
      const totalSessions = order.totalSessions ?? 0;
      const usedSessions = totalSessions - remainingSessions;

      return {
        orderId: order._id,
        package: order.package || "Gói tập",
        gym: order.gym || "",
        status: order.status,
        totalSessions,
        remainingSessions,
        usedSessions,
        checkins: orderCheckins,
        totalCheckins,
      };
    });

    // Lọc gói đang hoạt động (approved)
    const activeOrders = orderSummaries.filter((o) => o.status === "approved");
    const allCheckins = checkins;

    // Text cho LLM
    let text = "";

    if (activeOrders.length > 0) {
      text += "📋 **Gói tập đang hoạt động:**\n";
      activeOrders.forEach((o) => {
        text += `\n• **${o.package}**`;
        if (o.gym) text += ` (${o.gym})`;
        if (o.totalSessions > 0) {
          text += `\n  Đã tập: **${o.usedSessions}/${o.totalSessions}** buổi`;
          text += ` — Còn lại: **${o.remainingSessions}** buổi`;
        }
      });
    } else {
      text += "Bạn chưa có gói tập nào đang hoạt động.";
    }

    if (allCheckins.length > 0) {
      text += `\n\n🏋️ **${allCheckins.length} buổi check-in gần nhất:**`;
      allCheckins.slice(0, 5).forEach((c, i) => {
        const date = c.time
          ? new Date(c.time).toLocaleDateString("vi-VN")
          : new Date(c.createdAt).toLocaleDateString("vi-VN");
        text += `\n${i + 1}. ${date}`;
        if (c.muscle) text += ` — ${c.muscle}`;
        if (c.note) text += ` (${c.note.substring(0, 50)})`;
      });
    } else {
      text += "\n\nChưa có lượt check-in nào.";
    }

    text += `\n\nXem chi tiết tại [Lịch sử tập](/my-history).`;

    // UI Card data
    const uiCard = {
      cardType: "checkinHistory",
      data: {
        activeOrders: activeOrders.map((o) => ({
          package: o.package,
          gym: o.gym,
          totalSessions: o.totalSessions,
          remainingSessions: o.remainingSessions,
          usedSessions: o.usedSessions,
        })),
        recentCheckins: allCheckins.slice(0, 10).map((c) => ({
          time: c.time || c.createdAt,
          muscle: c.muscle || "",
          note: c.note || "",
          package: c.package || "",
        })),
        totalCheckins: allCheckins.length,
      },
    };

    return { text, uiCard };
  } catch {
    return {
      text: "Chưa có dữ liệu check-in. Bạn có thể xem tại [Lịch sử tập](/my-history) hoặc liên hệ HLV để được hỗ trợ!",
      uiCard: null,
    };
  }
}
