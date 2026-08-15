import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQuery: ({ queryKey }) =>
    queryKey[0] === "admin-incoming-bank-transactions"
      ? {
          data: {
            items: [
              {
                _id: "incoming-1",
                gateway: "TPBank",
                maskedAccountNumber: "******0000",
                amount: 149000,
                transactionAt: "2026-08-15T03:30:00.000Z",
                depositCode: "HTC-AB12-CD34",
                status: "needs_review",
                reviewReason: "AMOUNT_MISMATCH",
                userId: { name: "Khách thử", email: "user@example.com" },
                depositRequestId: {
                  _id: "deposit-1",
                  amount: 150000,
                  depositCode: "HTC-AB12-CD34",
                },
              },
            ],
            pagination: { total: 26, page: 1, totalPages: 2 },
          },
          isPending: false,
          isError: false,
          isFetching: false,
          refetch: vi.fn(),
        }
      : {
          data: [
            {
              _id: "deposit-1",
              amount: 150000,
              depositCode: "HTC-AB12-CD34",
              userId: { name: "Khách thử", email: "user@example.com" },
            },
          ],
          isPending: false,
          isError: false,
        },
}));
vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import IncomingBankTransactionPanel from "../IncomingBankTransactionPanel";

describe("IncomingBankTransactionPanel", () => {
  it("renders masked review data and actual bank amount without provider secrets", () => {
    const html = renderToStaticMarkup(<IncomingBankTransactionPanel />);

    expect({
      hasBank: html.includes("TPBank"),
      hasMaskedAccount: html.includes("******0000"),
      hasActualAmount: html.includes("149.000"),
      hasMismatchReason: html.includes("Sai số tiền"),
      hasApproveAction: html.includes("Duyệt tiền thực nhận"),
      leaksProviderId: html.includes("providerTransactionId"),
      leaksDigest: html.includes("payloadDigest"),
      hasNextPage: html.includes("Trang sau"),
    }).toEqual({
      hasBank: true,
      hasMaskedAccount: true,
      hasActualAmount: true,
      hasMismatchReason: true,
      hasApproveAction: true,
      leaksProviderId: false,
      leaksDigest: false,
      hasNextPage: true,
    });
  });
});
