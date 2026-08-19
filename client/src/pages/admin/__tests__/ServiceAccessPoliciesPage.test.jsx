import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const matrix = {
  version: "test",
  columns: [{ id: "guest", label: "Khách", tiers: [] }],
  services: [
    {
      serviceKey: "meal_plan",
      label: "Meal Plan",
      category: "Dinh dưỡng",
      description: "Tạo thực đơn",
      policies: {},
    },
  ],
  trainerPlans: {
    columns: [{ id: "free", label: "Free", prices: {}, durationDays: null }],
    benefits: [
      {
        key: "clients",
        label: "Khách hàng",
        category: { label: "Quản lý" },
        valueType: "capacity",
        values: { free: 1 },
      },
    ],
  },
  communityFeatures: {
    items: [{ featureKey: "meal_plan" }],
  },
  emailNotifications: {
    version: "test",
    items: [
      {
        notificationKey: "order_approved",
        feature: "Duyệt đơn hàng",
        trigger: "Admin duyệt đơn",
        recipient: "Khách hàng",
        condition: "Đơn có email",
        delivery: "Best-effort",
        templateKey: "order",
        sender: "sendMail",
      },
    ],
  },
};

vi.mock("@tanstack/react-query", () => ({
  queryOptions: (options) => options,
  useQuery: () => ({ data: matrix, isPending: false, isError: false }),
}));
vi.mock("../../../components/SEO", () => ({ default: () => null }));
vi.mock("../service-access-policies/CommunityFeatureTable", () => ({
  default: () => <div>Danh mục tính năng</div>,
}));

import ServiceAccessPoliciesPage from "../ServiceAccessPoliciesPage";

describe("ServiceAccessPoliciesPage section order", () => {
  it("renders community, trainer, quota, email and dependency sections in product order", () => {
    const html = renderToStaticMarkup(<ServiceAccessPoliciesPage />);
    const headings = [
      "Tính năng cộng đồng &amp; khách hàng",
      "Quyền lợi gói HLV",
      "Hạn mức công cụ",
      "Thông báo email tự động",
      "Phụ thuộc &amp; phiên bản hệ thống",
    ];
    const positions = headings.map((heading) => html.indexOf(heading));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
  });
});
