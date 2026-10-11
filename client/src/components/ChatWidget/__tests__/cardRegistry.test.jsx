import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import ChatBubble from "../ChatBubble";

const renderAssistantCard = (card) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <ChatBubble
        message={{ role: "assistant", content: "", uiCards: [card] }}
      />
    </MemoryRouter>,
  );

describe("HT Assistant card registry", () => {
  it.each([
    [
      "tdee",
      { bmr: 1672, tdee: 2430, targetCalories: 2100, macros: null },
      "KẾT QUẢ TDEE",
    ],
    [
      "tdeeForm",
      {
        prefill: {
          gender: "male",
          age: 28,
          trainingFrequency: "three_four",
        },
      },
      "TÍNH TDEE",
    ],
    [
      "meal",
      {
        meals: [
          {
            label: "Bữa sáng",
            foods: [{ name: "Yến mạch", calories: 300 }],
          },
        ],
        totals: { calories: 300, protein: 12, carb: 45, fat: 8 },
      },
      "THỰC ĐƠN GỢI Ý",
    ],
    [
      "blogList",
      {
        query: "Tăng cơ tự nhiên",
        posts: [
          {
            title: "Progressive overload",
            slug: "progressive-overload",
            categoryLabel: "Tập luyện",
            readTime: 6,
          },
        ],
      },
      "BÀI VIẾT PHÙ HỢP",
    ],
    [
      "webSources",
      {
        topic: "Creatine monohydrate",
        searchedAt: "2026-09-20T03:42:00.000Z",
        sources: [
          {
            title: "Creatine supplementation and exercise (jissn.biomedcentral.com)",
            uri: "https://jissn.biomedcentral.com/articles/creatine",
          },
        ],
      },
      "Nguồn tham khảo",
    ],
    [
      "exercise",
      {
        searchedFor: "Thân sau với tạ đơn",
        exercises: [
          {
            name: "Dumbbell Romanian Deadlift",
            muscleGroup: "Đùi sau",
          },
        ],
      },
      "THƯ VIỆN BÀI TẬP",
    ],
    [
      "workoutPlan",
      {
        plans: [
          {
            title: "Lower body",
            planDate: "2026-09-20",
            status: "active",
            sections: [],
          },
        ],
      },
      "GIÁO ÁN TẬP LUYỆN",
    ],
    [
      "trainingSchedule",
      {
        todayLabel: "Thứ 6 20/09/2026",
        todaySchedules: [
          {
            startTime: "18:30",
            endTime: "19:30",
            exerciseType: "Lower body",
            notes: "Mang dây mini band",
          },
        ],
        coachingDay: null,
        weekSchedule: [],
      },
      "LỊCH TẬP",
    ],
    [
      "checkinHistory",
      {
        activeOrders: [
          {
            package: "PT 1:1",
            gym: "HT Fitness Quận 7",
            totalSessions: 20,
            remainingSessions: 8,
            usedSessions: 12,
          },
        ],
        recentCheckins: [],
        totalCheckins: 12,
      },
      "LỊCH SỬ TẬP",
    ],
    [
      "trainer",
      {
        trainers: [
          {
            name: "Minh Hoàng",
            experience: "8 năm",
            specialties: ["Hypertrophy"],
          },
        ],
      },
      "HUẤN LUYỆN VIÊN",
    ],
    [
      "gymInfo",
      {
        gyms: [
          {
            name: "HT Fitness Nguyễn Thị Thập",
            address: "120 Nguyễn Thị Thập",
            district: "Quận 7",
            openingHours: "05:30–22:30",
            hasKickfit: true,
            googleMapsUrl: "https://maps.google.com/example",
          },
        ],
      },
      "CÂU LẠC BỘ",
    ],
    [
      "wallet",
      { balance: 1250000, currency: "VND", transactions: [] },
      "VÍ CỦA TÔI",
    ],
  ])("renders the %s read-only card", (cardType, data, label) => {
    const html = renderAssistantCard({ cardType, data });

    expect(html).toContain(label);
  });

  it("does not expose mutation confirmation cards in the chat UI", () => {
    const html = renderAssistantCard({
      cardType: "confirmation",
      data: {
        expiresAt: "2026-09-20T06:00:00.000Z",
        title: "Đổi lịch tập",
        description: "Hành động này làm thay đổi dữ liệu.",
      },
    });

    expect(html).toBe("");
  });

  it("does not render unsafe external map URLs", () => {
    const html = renderAssistantCard({
      cardType: "gymInfo",
      data: {
        gyms: [
          {
            name: "HT Fitness",
            address: "Quận 7",
            googleMapsUrl: "javascript:alert(1)",
          },
        ],
      },
    });

    expect(html).toContain("HT Fitness");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain('target="_blank"');
  });
});
