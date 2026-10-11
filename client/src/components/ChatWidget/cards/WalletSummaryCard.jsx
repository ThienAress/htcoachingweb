import {
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Undo2,
  Wallet,
} from "lucide-react";

import AssistantCard, {
  CardFooter,
  CardList,
  CardSection,
  CardSectionLabel,
  IndexBadge,
} from "./AssistantCard";

const TYPE_CONFIG = {
  deposit: { label: "Nạp tiền", icon: ArrowDownLeft },
  purchase: { label: "Thanh toán", icon: ArrowUpRight },
  refund: { label: "Hoàn tiền", icon: Undo2 },
  adjustment: { label: "Điều chỉnh", icon: Undo2 },
  reversal: { label: "Hoàn tác", icon: Undo2 },
};

const formatVnd = (amount) =>
  `${new Intl.NumberFormat("vi-VN").format(Number(amount) || 0)}đ`;

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Không rõ ngày" : date.toLocaleDateString("vi-VN");
};

export default function WalletSummaryCard({ data }) {
  if (!data) return null;

  return (
    <AssistantCard
      eyebrow="VÍ CỦA TÔI"
      icon={Wallet}
      subtitle="Cập nhật từ dữ liệu giao dịch trong hệ thống"
      title="Số dư khả dụng"
      value={formatVnd(data.balance)}
      valueNote={
        data.transactions?.length
          ? `${data.transactions.length} giao dịch gần nhất`
          : "chưa có giao dịch"
      }
      footer={
        <CardFooter
          action="Mở ví"
          icon={ExternalLink}
          note={`Đơn vị: ${data.currency || "VND"}`}
          to="/wallet"
        />
      }
    >
      {data.transactions?.length > 0 && (
        <CardSection>
          <CardSectionLabel>Giao dịch gần đây</CardSectionLabel>
          <CardList>
            {data.transactions.map((transaction, index) => {
              const config = TYPE_CONFIG[transaction.type] || TYPE_CONFIG.adjustment;
              const Icon = config.icon;
              const amount = Number(transaction.amount) || 0;

              return (
                <li
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  key={`${transaction.createdAt || "transaction"}-${index}`}
                >
                  <IndexBadge>
                    <Icon aria-hidden="true" size={15} strokeWidth={1.8} />
                  </IndexBadge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">
                      {config.label}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                      {formatDate(transaction.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[13px] font-medium tabular-nums ${
                      amount >= 0
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-rose-700 dark:text-rose-300"
                    }`}
                  >
                    {amount >= 0 ? "+" : "−"}
                    {formatVnd(Math.abs(amount))}
                  </span>
                </li>
              );
            })}
          </CardList>
        </CardSection>
      )}
    </AssistantCard>
  );
}
