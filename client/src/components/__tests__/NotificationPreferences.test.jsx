import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutationConfig: null,
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: {
      inAppEnabled: true,
      comments: true,
      journal: true,
      weekly: true,
      morningHealthEmail: false,
      checkinEmail: false,
      customerEmailConfigured: true,
      emailEligible: true,
      revision: 1,
    },
    isLoading: false,
    isError: false,
  }),
  useMutation: (config) => {
    mocks.mutationConfig = config;
    return { mutate: vi.fn(), isPending: false, isError: false };
  },
  useQueryClient: () => ({
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("react-toastify", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

vi.mock("../../services/notification.service", () => ({
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}));

import { NotificationPreferences } from "../NotificationPreferences";
import { getInitialEmailSelectionError } from "../notificationPreferences.utils";

describe("NotificationPreferences", () => {
  beforeEach(() => {
    mocks.mutationConfig = null;
    mocks.success.mockClear();
    mocks.error.mockClear();
  });

  it("shows both email opt-ins and locks a saved preference behind Cập nhật", () => {
    const html = renderToStaticMarkup(
      <NotificationPreferences userId="user-1" channel="email" />,
    );

    expect(html).toContain("Nhắc cập nhật Mục tiêu sức khỏe mỗi sáng");
    expect(html).toContain("Thông báo check-in buổi tập");
    expect(html).not.toContain("Bật thông báo trong ứng dụng");
    expect(html).toContain("Cập nhật");
  });

  it("keeps the email opt-in out of existing in-app notification surfaces", () => {
    const html = renderToStaticMarkup(
      <NotificationPreferences userId="user-1" />,
    );

    expect(html).toContain("Bật thông báo trong ứng dụng");
    expect(html).not.toContain("Nhắc cập nhật Mục tiêu sức khỏe mỗi sáng");
  });

  it("requires an initial email choice but allows a saved user to opt out", () => {
    expect(
      getInitialEmailSelectionError({
        customerEmailConfigured: false,
        morningHealthEmail: false,
        checkinEmail: false,
      }),
    ).toBe("Hãy chọn ít nhất một email thông báo trước khi lưu");
    expect(
      getInitialEmailSelectionError({
        customerEmailConfigured: true,
        morningHealthEmail: false,
        checkinEmail: false,
      }),
    ).toBe("");
  });

  it("uses global success and error feedback after the preference request", () => {
    renderToStaticMarkup(
      <NotificationPreferences userId="user-1" channel="email" />,
    );

    mocks.mutationConfig.onSuccess({ data: { data: { revision: 2 } } });
    mocks.mutationConfig.onError({
      response: { data: { message: "Không lưu được" } },
    });

    expect(mocks.success).toHaveBeenCalledWith("Đã lưu email thông báo");
    expect(mocks.error).toHaveBeenCalledWith("Không lưu được");
  });
});
