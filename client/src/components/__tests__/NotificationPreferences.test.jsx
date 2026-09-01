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

describe("NotificationPreferences", () => {
  beforeEach(() => {
    mocks.mutationConfig = null;
    mocks.success.mockClear();
    mocks.error.mockClear();
  });

  it("shows only the morning health email opt-in on the account email channel", () => {
    const html = renderToStaticMarkup(
      <NotificationPreferences userId="user-1" channel="email" />,
    );

    expect(html).toContain("Nhắc cập nhật Mục tiêu sức khỏe mỗi sáng");
    expect(html).not.toContain("Bật thông báo trong ứng dụng");
    expect(html).toContain("Lưu tùy chọn email");
  });

  it("keeps the email opt-in out of existing in-app notification surfaces", () => {
    const html = renderToStaticMarkup(
      <NotificationPreferences userId="user-1" />,
    );

    expect(html).toContain("Bật thông báo trong ứng dụng");
    expect(html).not.toContain("Nhắc cập nhật Mục tiêu sức khỏe mỗi sáng");
  });

  it("uses global success and error feedback after the preference request", () => {
    renderToStaticMarkup(
      <NotificationPreferences userId="user-1" channel="email" />,
    );

    mocks.mutationConfig.onSuccess({ data: { data: { revision: 2 } } });
    mocks.mutationConfig.onError({
      response: { data: { message: "Không lưu được" } },
    });

    expect(mocks.success).toHaveBeenCalledWith("Đã lưu tùy chọn email");
    expect(mocks.error).toHaveBeenCalledWith("Không lưu được");
  });
});
