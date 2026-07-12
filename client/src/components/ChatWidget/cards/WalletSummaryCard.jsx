import { Wallet, ArrowUpRight, ArrowDownRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

const TYPE_CONFIG = {
  deposit: { label: "Nạp tiền", icon: ArrowUpRight, color: "text-emerald-400" },
  purchase: { label: "Thanh toán", icon: ArrowDownRight, color: "text-red-400" },
  refund: { label: "Hoàn tiền", icon: ArrowUpRight, color: "text-blue-400" },
  adjustment: { label: "Điều chỉnh", icon: ArrowUpRight, color: "text-yellow-400" },
};

const formatVnd = (amount) =>
  new Intl.NumberFormat("vi-VN").format(amount) + "đ";

export default function WalletSummaryCard({ data }) {
  if (!data) return null;

  return (
    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-3 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-emerald-400" />
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Ví của tôi</span>
        </div>
        <Link
          to="/wallet"
          className="text-emerald-400 hover:text-emerald-300 shrink-0"
          title="Xem chi tiết"
        >
          <ExternalLink size={14} />
        </Link>
      </div>

      {/* Balance */}
      <div className="bg-black/20 rounded-lg p-3 text-center">
        <p className="text-[11px] text-gray-400 mb-1">Số dư hiện tại</p>
        <p className="text-xl font-bold text-white">{formatVnd(data.balance)}</p>
      </div>

      {/* Transactions */}
      {data.transactions?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-gray-400 font-medium">Giao dịch gần đây</p>
          {data.transactions.map((tx, i) => {
            const config = TYPE_CONFIG[tx.type] || TYPE_CONFIG.adjustment;
            const Icon = config.icon;
            const date = new Date(tx.createdAt).toLocaleDateString("vi-VN");
            const sign = tx.amount >= 0 ? "+" : "";

            return (
              <div key={i} className="flex items-center gap-2 bg-black/10 rounded-lg px-2.5 py-2 text-[12px]">
                <Icon size={12} className={config.color} />
                <span className="text-gray-300 flex-1">{config.label}</span>
                <span className={`font-medium ${tx.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {sign}{formatVnd(tx.amount)}
                </span>
                <span className="text-gray-500 text-[10px]">{date}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
