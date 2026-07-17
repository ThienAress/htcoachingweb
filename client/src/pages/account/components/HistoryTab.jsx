import { History } from "lucide-react";
import { getTxTypeBadge } from "./StatusBadges";
import { useTranslation } from "react-i18next";

function HistoryTab({ transactions }) {
  const { t, i18n } = useTranslation("account");
  return (
    <div className="animate-tab-fade">
      <div className="mb-6 pb-4 border-b border-white/10">
        <h2 className="text-xl font-bold text-white uppercase">{t("history.title")}</h2>
        <p className="text-gray-400 text-fluid-xs mt-0.5">{t("history.desc")}</p>
      </div>

      {transactions.length === 0 ? (
        <div className="bg-gray-800/20 backdrop-blur-md rounded-2xl border border-white/5 p-12 text-center text-gray-500 shadow-xl">
          <History className="mx-auto mb-3 opacity-30 text-gray-400" size={40} />
          <p className="text-sm">{t("history.no_txs")}</p>
        </div>
      ) : (
        <div className="bg-gray-800/20 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-fluid-xs text-gray-300">
              <thead>
                <tr className="border-b border-white/5 bg-white/5 text-gray-400 uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-4 px-4">{t("history.tx_id")}</th>
                  <th className="py-4 px-4">{t("history.type")}</th>
                  <th className="py-4 px-4 text-center">{t("history.amount")}</th>
                  <th className="py-4 px-4 text-center">{t("history.balance")}</th>
                  <th className="py-4 px-4">{t("history.date")}</th>
                  <th className="py-4 px-4 text-right">{t("history.status")}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isPositive = tx.amount > 0;
                  const formatted = new Intl.NumberFormat(i18n.language === "vi" ? "vi-VN" : "en-US", { style: "currency", currency: "VND" });
                  return (
                    <tr key={tx._id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 px-4 font-mono text-[10px] text-gray-400 truncate max-w-[90px]" title={tx._id}>
                        #{tx._id.substring(tx._id.length - 8).toUpperCase()}
                      </td>
                      <td className="py-4 px-4">{getTxTypeBadge(tx.type, t)}</td>
                      <td className={`py-4 px-4 text-center font-black ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                        {isPositive ? "+" : ""}{formatted.format(tx.amount)}
                      </td>
                      <td className="py-4 px-4 text-center text-gray-400 font-semibold">
                        {formatted.format(tx.balanceAfter)}
                      </td>
                      <td className="py-4 px-4 text-gray-500 text-fluid-xs">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleString(i18n.language === "vi" ? "vi-VN" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "N/A"}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {t("status.success")}
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
