import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { FileText, CheckCircle, ArrowLeft, Loader2 } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { getContractById, markAsViewed, signContract } from "../services/contract.service";
import SignatureCanvas from "../components/SignatureCanvas";
import SEO from "../components/SEO";

const ContractSign = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [signatureData, setSignatureData] = useState("");
  const [agreed, setAgreed] = useState(false);

  const { data: contractData, isLoading, error } = useQuery({
    queryKey: ["contract", id],
    queryFn: () => getContractById(id),
  });
  const contract = contractData?.data?.data;
  const sections = contract?.customSections || [];

  const viewMutation = useMutation({ mutationFn: () => markAsViewed(id) });

  useEffect(() => {
    if (contract && contract.status === "sent") viewMutation.mutate();
  }, [contract?.status]);

  const signMutation = useMutation({
    mutationFn: () => signContract(id, signatureData),
    onSuccess: () => { toast.success("Ký hợp đồng thành công! 🎉"); navigate("/account"); },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi ký hợp đồng"),
  });

  const handleSign = useCallback(() => {
    if (!agreed) return toast.warn("Vui lòng đọc và đồng ý điều khoản");
    if (!signatureData) return toast.warn("Vui lòng ký tên");
    signMutation.mutate();
  }, [agreed, signatureData, signMutation]);

  const formatDate = (d) => d ? new Date(d).toLocaleDateString("vi-VN") : "...";
  const formatCurrency = (n) => n ? n.toLocaleString("vi-VN") + " VNĐ" : "...";

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="w-8 h-8 animate-spin text-slate-600" /></div>;
  if (error || !contract) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <FileText className="w-12 h-12 text-slate-300 mb-4" />
      <p className="text-slate-500 text-center">Hợp đồng không tồn tại hoặc bạn không có quyền xem.</p>
      <button onClick={() => navigate(-1)} className="mt-4 text-slate-600 hover:underline text-sm">← Quay lại</button>
    </div>
  );

  const isSigned = contract.status === "signed";
  const isExpired = contract.status === "expired";
  const isCancelled = contract.status === "cancelled";
  const canSign = !isSigned && !isExpired && !isCancelled && contract.status !== "draft";

  return (
    <div className="min-h-screen bg-white py-8 px-4 print:py-0">
      <SEO title="Ký Hợp Đồng" noindex={true} />
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors print:hidden">
          <ArrowLeft className="w-4 h-4" /> Quay lại
        </button>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          {/* Header — đen trắng chỉnh chu */}
          <div className="bg-white px-8 py-6 text-center border-b border-slate-200">
            <p className="text-xs tracking-[0.2em] text-slate-500 mb-1">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
            <p className="text-xs text-slate-400 mb-4">Độc lập – Tự do – Hạnh phúc</p>
            <div className="w-16 h-px bg-slate-300 mx-auto mb-4" />
            <h1 className="text-lg font-bold text-black tracking-wide uppercase">Hợp Đồng Dịch Vụ Huấn Luyện Cá Nhân</h1>
          </div>

          <div className="px-8 py-6 space-y-6">
            {/* Bên A */}
            <div className="space-y-2">
              <h3 className="font-bold text-black text-sm uppercase">Bên cung cấp dịch vụ (Bên A):</h3>
              <div className="pl-4 space-y-1 text-sm text-slate-700">
                <p>● Họ và tên: <strong className="text-black">{contract.trainerInfo?.name || "..."}</strong></p>
                <p>● Năm sinh: {contract.trainerInfo?.birthYear || "..."}</p>
                <p>● Địa chỉ: {contract.trainerInfo?.address || "..."}</p>
                <p>● Số điện thoại: {contract.trainerInfo?.phone || "..."}</p>
                <p>● Email: {contract.trainerInfo?.email || "..."}</p>
              </div>
            </div>

            {/* Bên B */}
            <div className="space-y-2">
              <h3 className="font-bold text-black text-sm uppercase">Bên sử dụng dịch vụ (Bên B):</h3>
              <div className="pl-4 space-y-1 text-sm text-slate-700">
                <p>● Họ và tên: <strong className="text-black">{contract.clientInfo?.name || "..."}</strong></p>
                <p>● Số điện thoại: {contract.clientInfo?.phone || "..."}</p>
                <p>● Email: {contract.clientInfo?.email || "..."}</p>
              </div>
            </div>

            {/* Gói DV */}
            <div className="space-y-2">
              <h3 className="font-bold text-black text-sm uppercase">Thông tin gói dịch vụ</h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2.5 px-4 text-slate-600 font-medium">Số buổi</th>
                    <th className="text-left py-2.5 px-4 text-slate-600 font-medium">Giá/buổi</th>
                    <th className="text-right py-2.5 px-4 text-slate-600 font-medium">Tổng</th>
                  </tr></thead>
                  <tbody><tr>
                    <td className="py-2.5 px-4 font-semibold text-black">{contract.packageDetails?.sessions || "..."}</td>
                    <td className="py-2.5 px-4 text-slate-700">{formatCurrency(contract.packageDetails?.pricePerSession)}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-black">{formatCurrency(contract.packageDetails?.totalAmount)}</td>
                  </tr></tbody>
                </table>
              </div>
              <div className="text-sm text-slate-600 space-y-1 pl-4">
                <p>● Ngày bắt đầu: {formatDate(contract.packageDetails?.startDate)}</p>
                <p>● Ngày kết thúc: {formatDate(contract.packageDetails?.endDate)}</p>
              </div>
            </div>

            {/* Nội quy — từ customSections */}
            {sections.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-bold text-black text-sm uppercase">Chính sách và nội quy</h3>
                {sections.map((s, i) => (
                  <div key={i} className="space-y-1.5">
                    <h4 className="font-semibold text-sm text-black">{s.title}</h4>
                    {s.content && <p className="text-sm text-slate-600 pl-4">{s.content}</p>}
                    {s.items?.length > 0 && (
                      <ol className="list-decimal pl-8 space-y-1 text-sm text-slate-600">
                        {s.items.map((item, j) => <li key={j}>{item}</li>)}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            )}

            {(isExpired || isCancelled) && (
              <div className="border border-red-200 rounded-lg p-4 text-center">
                <p className="font-semibold text-red-600">{isExpired ? "Hợp đồng đã hết hạn" : "Hợp đồng đã bị hủy"}</p>
              </div>
            )}

            {/* Signing — 2 cột */}
            {canSign && (
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <h3 className="font-bold text-black text-sm text-center uppercase">Ký tên xác nhận</h3>
                <label className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-black" />
                  <span className="text-sm text-slate-700">Tôi đã đọc, hiểu rõ và <strong>đồng ý</strong> với toàn bộ các điều khoản trong hợp đồng này.</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="text-center space-y-2">
                    <p className="text-sm font-semibold text-black">BÊN A — Huấn luyện viên</p>
                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 min-h-[120px] flex items-center justify-center">
                      {contract.trainerSignature ? <img src={contract.trainerSignature} alt="Chữ ký HLV" className="max-h-[80px]" /> : <p className="text-sm text-slate-400 italic">Đã xác nhận</p>}
                    </div>
                    <p className="text-sm font-medium text-black">{contract.trainerInfo?.name || "..."}</p>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm font-semibold text-black">BÊN B — Khách hàng</p>
                    <SignatureCanvas onSignatureChange={setSignatureData} disabled={!agreed} />
                    <p className="text-sm font-medium text-black">{contract.clientInfo?.name || "..."}</p>
                  </div>
                </div>
                <button onClick={handleSign} disabled={!agreed || !signatureData || signMutation.isPending}
                  className="w-full py-3 bg-black hover:bg-slate-800 text-white font-bold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {signMutation.isPending ? (<><Loader2 className="w-4 h-4 animate-spin" />Đang xử lý...</>) : (<><CheckCircle className="w-5 h-5" />Xác Nhận Ký Hợp Đồng</>)}
                </button>
              </div>
            )}

            {/* Đã ký: 2 cột chữ ký + status */}
            {isSigned && (
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <div className="border border-slate-200 rounded-lg p-3 text-center">
                  <p className="font-semibold text-black text-sm">✓ Hợp đồng đã được ký · {formatDate(contract.signedAt)}</p>
                </div>
                <h3 className="font-bold text-black text-sm text-center uppercase">Chữ ký các bên</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="text-center space-y-2">
                    <p className="text-sm font-semibold text-black">BÊN A — Huấn luyện viên</p>
                    <div className="border border-slate-200 rounded-lg p-4 bg-white min-h-[100px] flex items-center justify-center">
                      {contract.trainerSignature ? <img src={contract.trainerSignature} alt="Chữ ký HLV" className="max-h-[80px]" /> : <p className="text-sm text-slate-500">✓ Đã xác nhận</p>}
                    </div>
                    <p className="text-sm font-medium text-black">{contract.trainerInfo?.name || "..."}</p>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm font-semibold text-black">BÊN B — Khách hàng</p>
                    <div className="border border-slate-200 rounded-lg p-4 bg-white min-h-[100px] flex items-center justify-center">
                      {contract.signatureImage ? <img src={contract.signatureImage} alt="Chữ ký" className="max-h-[80px]" /> : <p className="text-sm text-slate-500">✓ Đã ký</p>}
                    </div>
                    <p className="text-sm font-medium text-black">{contract.clientInfo?.name || "..."}</p>
                  </div>
                </div>
                <button disabled className="w-full py-3 bg-slate-200 text-slate-500 font-bold rounded-lg cursor-not-allowed flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" /> Đã ký hợp đồng
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractSign;
