// Check Wallet Tool — Query Wallet + WalletTransaction (read-only)

import Wallet from "../../../models/Wallet.js";
import WalletTransaction from "../../../models/WalletTransaction.js";

/**
 * Kiểm tra số dư ví và lịch sử giao dịch gần nhất
 * @param {{ limit?: number }} params
 * @param {{ userId: string }} context
 * @returns {{ text: string, uiCard: object }}
 */
export async function checkWallet(params, context) {
  const { limit = 5 } = params;

  if (!context.userId) {
    return {
      text: "Bạn cần đăng nhập để kiểm tra ví. Hãy đăng nhập tại [trang đăng nhập](/login).",
      uiCard: null,
    };
  }

  const wallet = await Wallet.findOne({ userId: context.userId }).lean();

  if (!wallet) {
    return {
      text: "Bạn chưa có ví trong hệ thống. Ví sẽ được tạo tự động khi bạn thực hiện giao dịch đầu tiên.",
      uiCard: null,
    };
  }

  // Lấy giao dịch gần nhất
  const transactions = await WalletTransaction.find({
    userId: context.userId,
    status: "success",
  })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 10))
    .lean();

  // Format số tiền VND
  const formatVnd = (amount) =>
    new Intl.NumberFormat("vi-VN").format(amount) + "đ";

  // Text cho LLM
  const balanceText = formatVnd(wallet.balance);
  let text = `💰 Số dư ví hiện tại: **${balanceText}**`;

  if (transactions.length > 0) {
    const typeLabels = {
      deposit: "Nạp tiền",
      purchase: "Thanh toán",
      refund: "Hoàn tiền",
      adjustment: "Điều chỉnh",
    };

    text += `\n\n📋 ${transactions.length} giao dịch gần nhất:`;
    transactions.forEach((tx, i) => {
      const sign = tx.amount >= 0 ? "+" : "";
      const date = new Date(tx.createdAt).toLocaleDateString("vi-VN");
      text += `\n${i + 1}. ${typeLabels[tx.type] || tx.type}: ${sign}${formatVnd(tx.amount)} (${date})`;
    });
  } else {
    text += "\n\nChưa có giao dịch nào.";
  }

  text += `\n\nXem chi tiết tại [Ví của tôi](/wallet).`;

  // UI Card data
  const uiCard = {
    cardType: "wallet",
    data: {
      balance: wallet.balance,
      currency: wallet.currency,
      transactions: transactions.map((tx) => ({
        type: tx.type,
        amount: tx.amount,
        balanceAfter: tx.balanceAfter,
        createdAt: tx.createdAt,
      })),
    },
  };

  return { text, uiCard };
}
