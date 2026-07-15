import { Link } from "react-router-dom";
import { FileText, Eye, Download } from "lucide-react";
import { toast } from "react-toastify";
import { clientDownloadContract } from "../../../services/contract.service";

function ContractsTab({ myContracts }) {
  const statusMap = {
    draft: { label: "Nháp", cls: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
    sent: { label: "Chờ ký", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    viewed: { label: "Đã xem", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    signed: { label: "Đã ký", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    expired: { label: "Hết hạn", cls: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
    cancelled: { label: "Đã hủy", cls: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  };

  const handleDownload = async (contract) => {
    if (contract.clientDownloadedAt) {
      return toast.info("Bạn đã tải hợp đồng này rồi. Mỗi hợp đồng chỉ được tải 1 lần.");
    }
    try {
      const res = await clientDownloadContract(contract._id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `hop-dong-${contract._id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Đã tải hợp đồng thành công! Lưu ý: Bạn chỉ được tải 1 lần duy nhất.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi tải hợp đồng");
    }
  };

  return (
    <div className="animate-tab-fade">
      <div className="mb-6 pb-4 border-b border-white/10">
        <h2 className="text-xl font-bold text-white uppercase">Hợp đồng của tôi</h2>
        <p className="text-gray-400 text-fluid-xs mt-0.5">Xem và ký hợp đồng huấn luyện cá nhân.</p>
      </div>

      {myContracts.length === 0 ? (
        <div className="bg-gray-800/20 backdrop-blur-md rounded-2xl border border-white/5 p-12 text-center text-gray-500 shadow-xl">
          <FileText className="mx-auto mb-3 opacity-30 text-gray-400" size={40} />
          <p className="text-sm">Bạn chưa có hợp đồng nào.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {myContracts.map((c) => {
            const st = statusMap[c.status] || statusMap.draft;
            return (
              <div
                key={c._id}
                className="bg-gray-800/20 backdrop-blur-md rounded-2xl border border-white/10 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">{c.packageDetails?.packageName || "Hợp đồng HLV"}</p>
                  <p className="text-xs text-gray-400">{c.packageDetails?.sessions || "—"} buổi</p>
                  <p className="text-[11px] text-gray-500">
                    Ngày tạo: {new Date(c.createdAt).toLocaleDateString("vi-VN")}
                    {c.signedAt && ` • Đã ký: ${new Date(c.signedAt).toLocaleDateString("vi-VN")}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${st.cls}`}>
                    {st.label}
                  </span>
                  {["sent", "viewed"].includes(c.status) && (
                    <Link to={`/contracts/${c._id}`} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all">Ký ngay</Link>
                  )}
                  {c.status === "signed" && (
                    <>
                      <Link to={`/contracts/${c._id}`} className="p-2 text-blue-400 hover:bg-white/10 rounded-lg transition-colors" title="Xem hợp đồng">
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDownload(c)}
                        className={`p-2 rounded-lg transition-colors ${c.clientDownloadedAt ? "text-gray-500 cursor-not-allowed" : "text-emerald-400 hover:bg-white/10"}`}
                        title={c.clientDownloadedAt ? "Đã tải" : "Tải PDF"}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ContractsTab;
