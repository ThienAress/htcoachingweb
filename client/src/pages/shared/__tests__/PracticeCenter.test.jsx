import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: {},
  mutation: { mutate: vi.fn(), isPending: false },
  refetch: vi.fn(),
  setQueryData: vi.fn(),
  mutationOptions: null,
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ ...mocks.query, refetch: mocks.refetch }),
  useMutation: (options) => {
    mocks.mutationOptions = options;
    return mocks.mutation;
  },
  useQueryClient: () => ({ setQueryData: mocks.setQueryData }),
}));
vi.mock("react-toastify", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));
vi.mock("../../../components/SEO", () => ({
  default: () => null,
}));

import PracticeCenter from "../PracticeCenter";

const readyData = {
  recipient: "trainer@example.com",
  scenarios: [
    {
      key: "order",
      label: "Order được duyệt",
      description: "Email xác nhận gói tập.",
      cost: 1,
    },
    {
      key: "checkin",
      label: "Check-in buổi tập",
      description: "Email ghi nhận buổi tập.",
      cost: 1,
    },
    {
      key: "journey",
      label: "Toàn bộ hành trình",
      description: "Nhận cả hai email.",
      cost: 2,
    },
  ],
  quota: {
    serviceKey: "practice_email",
    tier: "trainer",
    limit: 2,
    remaining: 2,
    resetAt: null,
  },
};

beforeEach(() => {
  mocks.query = {
    data: readyData,
    isLoading: false,
    isError: false,
    isFetching: false,
  };
  mocks.mutation = { mutate: vi.fn(), isPending: false };
  mocks.mutationOptions = null;
  vi.clearAllMocks();
});

describe("PracticeCenter", () => {
  it("renders loading and recoverable error states", () => {
    mocks.query = { isLoading: true, isError: false };
    const loading = renderToStaticMarkup(<PracticeCenter />);
    mocks.query = {
      isLoading: false,
      isError: true,
      error: { response: { data: { message: "Dịch vụ tạm gián đoạn" } } },
    };
    const error = renderToStaticMarkup(<PracticeCenter />);

    expect(loading).toContain("Đang tải Trung tâm thực hành");
    expect(error).toContain("Dịch vụ tạm gián đoạn");
    expect(error).toContain("Thử lại");
  });

  it("shows the login recipient, three scenarios and server quota", () => {
    const html = renderToStaticMarkup(<PracticeCenter />);

    expect(html).toContain("trainer@example.com");
    expect(html).toContain("Order được duyệt");
    expect(html).toContain("Check-in buổi tập");
    expect(html).toContain("Toàn bộ hành trình");
    expect(html).toContain("2 / 2 lượt còn lại");
    expect(html).not.toContain('name="recipient"');
  });

  it("disables delivery when no quota remains", () => {
    mocks.query = {
      ...mocks.query,
      data: {
        ...readyData,
        quota: { ...readyData.quota, remaining: 0 },
      },
    };

    const html = renderToStaticMarkup(<PracticeCenter />);

    expect(html).toContain("Bạn đã dùng hết lượt mô phỏng");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*Gửi email mô phỏng<\/button>/s);
  });

  it("renders an empty state instead of a broken form", () => {
    mocks.query = {
      ...mocks.query,
      data: { ...readyData, scenarios: [] },
    };

    const html = renderToStaticMarkup(<PracticeCenter />);

    expect(html).toContain("Chưa có kịch bản mô phỏng");
    expect(html).not.toContain("Gửi email mô phỏng");
  });

  it("announces the confirmed delivery through the global toast channel", () => {
    renderToStaticMarkup(<PracticeCenter />);

    mocks.mutationOptions.onSuccess({
      recipient: "trainer@example.com",
      quota: { ...readyData.quota, remaining: 1 },
    });

    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Đã gửi email mô phỏng tới email đăng nhập",
    );
    expect(mocks.setQueryData).toHaveBeenCalled();
  });

  it("announces a delivery failure with the server message", () => {
    renderToStaticMarkup(<PracticeCenter />);

    mocks.mutationOptions.onError({
      response: { data: { message: "Dịch vụ email đang bận" } },
    });

    expect(mocks.toastError).toHaveBeenCalledWith("Dịch vụ email đang bận");
  });
});
