import { History } from "lucide-react";
import { getTxTypeBadge } from "./StatusBadges";

function HistoryTab({ transactions }) {
  return (
    <div className="animate-tab-fade">
      <div className="mb-6 pb-4 border-b border-white/10">
        <h2 className="text-xl font-bold text-white uppercase">Lịch sử thanh toán</h2>
        <p className="text-gray-400 text-fluid-xs mt-0.5">Theo dõi lịch sử thay đổi số dư ví nạp tiền và các giao dịch thanh toán.</p>
      </div>

      {transactions.length === 0 ? (
        <div className="bg-gray-800/20 backdrop-blur-md rounded-2xl border border-white/5 p-12 text-center text-gray-500 shadow-xl">
          <History className="mx-auto mb-3 opacity-30 text-gray-400" size={40} />
          <p className="text-sm">Chưa phát sinh giao dịch ví nào trên tài khoản.</p>
        </div>
      ) : (
        <div className="bg-gray-800/20 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-fluid-xs text-gray-300">
              <thead>
                <tr className="border-b border-white/5 bg-white/5 text-gray-400 uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-4 px-4">Mã GD</th>
                  <th className="py-4 px-4">Phân loại</th>
                  <th className="py-4 px-4 text-center">Số tiền</th>
                  <th className="py-4 px-4 text-center">Số dư ví</th>
                  <th className="py-4 px-4">Thời gian</th>
                  <th className="py-4 px-4 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isPositive = tx.amount > 0;
                  const formatted = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
                  return (
                    <tr key={tx._id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 px-4 font-mono text-[10px] text-gray-400 truncate max-w-[90px]" title={tx._id}>
                        #{tx._id.substring(tx._id.length - 8).toUpperCase()}
                      </td>
                      <td className="py-4 px-4">{getTxTypeBadge(tx.type)}</td>
                      <td className={`py-4 px-4 text-center font-black ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                        {isPositive ? "+" : ""}{formatted.format(tx.amount)}
                      </td>
                      <td className="py-4 px-4 text-center text-gray-400 font-semibold">
                        {formatted.format(tx.balanceAfter)}
                      </td>
                      <td className="py-4 px-4 text-gray-500 text-fluid-xs">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "N/A"}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Thành công
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default HistoryTab;
