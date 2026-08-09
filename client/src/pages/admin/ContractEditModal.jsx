import { useState } from "react";
import { toast } from "react-toastify";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  PenLine,
  Plus,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";

import SignatureCanvas from "../../components/SignatureCanvas";
import {
  getContractById,
  sendContractToClient,
  updateContract,
} from "../../services/contract.service";

const inputCls = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20";
const errCls = "text-[11px] text-red-500 mt-0.5";
const labelCls = "block text-xs font-medium text-slate-500 mb-1";
const TABS = [
  { key: "info", label: "Thông tin" },
  { key: "terms", label: "Nội quy" },
  { key: "signature", label: "Chữ ký Bên A" },
  { key: "preview", label: "Xem trước" },
];

// Format số tiền: chỉ dùng khi blur (hiển thị)
const fmtMoney = (raw) => {
  if (!raw && raw !== 0) return "";
  const n = String(raw).replace(/\D/g, "");
  return n ? Number(n).toLocaleString("vi-VN") : "";
};
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const isValidPhone = (p) => /^0[35789]\d{8}$/.test(p);

const ContractEditModal = ({ contract, onClose }) => {
  const queryClient = useQueryClient();
  const { data: detailData, isLoading: isLoadingContractDetail } = useQuery({
    queryKey: ["contract", contract._id],
    queryFn: () => getContractById(contract._id),
  });
  const [activeTab, setActiveTab] = useState("info");
  const [showConfirmSend, setShowConfirmSend] = useState(false);
  const [errors, setErrors] = useState({});
  const [trainerSignature, setTrainerSignature] = useState(
    contract.trainerSignature ?? null,
  );
  const effectiveTrainerSignature =
    trainerSignature ?? detailData?.data?.data?.trainerSignature ?? "";

  // Track focus state cho money fields để hiển thị raw khi đang nhập, format khi blur
  const [moneyFocus, setMoneyFocus] = useState({ pricePerSession: false, totalAmount: false });

  const [form, setForm] = useState(() => ({
    trainerName: contract.trainerInfo?.name || "",
    trainerBirthYear: contract.trainerInfo?.birthYear || "",
    trainerAddress: contract.trainerInfo?.address || "",
    trainerPhone: contract.trainerInfo?.phone || "",
    trainerEmail: contract.trainerInfo?.email || "",
    clientName: contract.clientInfo?.name || "",
    clientPhone: contract.clientInfo?.phone || "",
    clientEmail: contract.clientInfo?.email || "",
    sessions: contract.packageDetails?.sessions ? String(contract.packageDetails.sessions) : "",
    pricePerSession: contract.packageDetails?.pricePerSession ? String(contract.packageDetails.pricePerSession) : "",
    totalAmount: contract.packageDetails?.totalAmount ? String(contract.packageDetails.totalAmount) : "",
    startDate: contract.packageDetails?.startDate ? new Date(contract.packageDetails.startDate).toISOString().split("T")[0] : "",
    endDate: contract.packageDetails?.endDate ? new Date(contract.packageDetails.endDate).toISOString().split("T")[0] : "",
  }));
  const [sections, setSections] = useState(
    () => contract.customSections?.map((section) => ({
      ...section,
      items: [...(section.items || [])],
    })) || [],
  );

  const validate = () => {
    const e = {};
    const fieldLabels = {
      trainerName: "Họ tên HLV", trainerBirthYear: "Năm sinh HLV", trainerAddress: "Địa chỉ HLV",
      trainerPhone: "SĐT HLV", trainerEmail: "Email HLV",
      clientName: "Họ tên khách hàng", clientPhone: "SĐT khách hàng", clientEmail: "Email khách hàng",
      sessions: "Số buổi", pricePerSession: "Giá/buổi", totalAmount: "Tổng tiền",
      startDate: "Ngày bắt đầu", endDate: "Ngày kết thúc",
    };

    // Tất cả trường đều bắt buộc
    if (!form.trainerName.trim()) e.trainerName = "Bắt buộc";
    if (!form.trainerBirthYear.trim()) e.trainerBirthYear = "Bắt buộc";
    if (!form.trainerAddress.trim()) e.trainerAddress = "Bắt buộc";
    if (!form.trainerPhone.trim()) e.trainerPhone = "Bắt buộc";
    else if (!isValidPhone(form.trainerPhone)) e.trainerPhone = "SĐT không hợp lệ";
    if (!form.trainerEmail.trim()) e.trainerEmail = "Bắt buộc";
    else if (!isValidEmail(form.trainerEmail)) e.trainerEmail = "Email không hợp lệ";
    if (!form.clientName.trim()) e.clientName = "Bắt buộc";
    if (!form.clientPhone.trim()) e.clientPhone = "Bắt buộc";
    else if (!isValidPhone(form.clientPhone)) e.clientPhone = "SĐT không hợp lệ";
    if (!form.clientEmail.trim()) e.clientEmail = "Bắt buộc";
    else if (!isValidEmail(form.clientEmail)) e.clientEmail = "Email không hợp lệ";
    if (!form.sessions || Number(form.sessions) <= 0) e.sessions = "Phải > 0";
    if (!Number(form.pricePerSession)) e.pricePerSession = "Phải > 0";
    if (!Number(form.totalAmount)) e.totalAmount = "Phải > 0";
    if (!form.startDate) e.startDate = "Bắt buộc";
    if (!form.endDate) e.endDate = "Bắt buộc";

    setErrors(e);
    if (Object.keys(e).length > 0) {
      // Toast thông báo cụ thể trường nào bị thiếu/sai
      const missing = Object.keys(e).filter(k => e[k] === "Bắt buộc" || e[k] === "Phải > 0");
      const invalid = Object.keys(e).filter(k => e[k] !== "Bắt buộc" && e[k] !== "Phải > 0");

      if (invalid.length > 0) {
        const names = invalid.map(k => fieldLabels[k]).join(", ");
        toast.warn(`Không hợp lệ: ${names}`);
      } else {
        const names = missing.map(k => fieldLabels[k]).join(", ");
        toast.warn(`Vui lòng điền: ${names}`);
      }
      return false;
    }
    return true;
  };

  const buildPayload = () => ({
    trainerInfo: { name: form.trainerName, birthYear: form.trainerBirthYear, address: form.trainerAddress, phone: form.trainerPhone, email: form.trainerEmail },
    clientInfo: { name: form.clientName, phone: form.clientPhone, email: form.clientEmail },
    packageDetails: { sessions: Number(form.sessions), pricePerSession: Number(form.pricePerSession), totalAmount: Number(form.totalAmount), startDate: form.startDate || null, endDate: form.endDate || null },
    customSections: sections,
    trainerSignature: effectiveTrainerSignature,
  });

  const updateMut = useMutation({
    mutationFn: (data) => updateContract(contract._id, data),
    onSuccess: () => {
      toast.success("Đã lưu hợp đồng");
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract", contract._id] });
    },
    onError: (e) => toast.error(e.response?.data?.message || "Lỗi lưu"),
  });

  const sendMut = useMutation({
    mutationFn: (id) => sendContractToClient(id),
    onSuccess: () => {
      toast.success("Đã gửi hợp đồng cho khách hàng 📧");
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract", contract._id] });
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || "Lỗi gửi"),
  });

  const handleSave = () => {
    if (!validate()) return;
    updateMut.mutate(buildPayload());
  };

  const handleSendClick = () => {
    if (isLoadingContractDetail) {
      return toast.info("Đang tải dữ liệu hợp đồng, vui lòng chờ một chút");
    }
    if (!validate()) return;
    if (sections.length === 0) return toast.warn("Vui lòng thêm nội quy trước khi gửi");
    if (!effectiveTrainerSignature) {
      setActiveTab("signature");
      return toast.warn("Bên A cần ký tên trước khi phát hành hợp đồng");
    }
    setShowConfirmSend(true);
  };

  const handleConfirmSend = () => {
    setShowConfirmSend(false);
    updateMut.mutate(buildPayload(), { onSuccess: () => sendMut.mutate(contract._id) });
  };

  // Handlers
  const handlePhoneChange = (field) => (e) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 10);
    setForm({ ...form, [field]: v });
  };
  // Money input: lưu raw number, chỉ format khi blur
  const handleMoneyChange = (field) => (e) => {
    const raw = e.target.value.replace(/\D/g, "");
    setForm({ ...form, [field]: raw });
  };
  const handleMoneyFocus = (field) => () => setMoneyFocus(prev => ({ ...prev, [field]: true }));
  const handleMoneyBlur = (field) => () => setMoneyFocus(prev => ({ ...prev, [field]: false }));
  const getMoneyValue = (field) => moneyFocus[field] ? form[field] : fmtMoney(form[field]);
  const handleSessionsChange = (e) => {
    const v = e.target.value.replace(/\D/g, "");
    setForm({ ...form, sessions: v });
  };

  // Section helpers
  const addSection = () => setSections([...sections, { title: "", content: "", items: [] }]);
  const removeSection = (i) => setSections(sections.filter((_, idx) => idx !== i));
  const updateSection = (i, field, val) => { const s = [...sections]; s[i] = { ...s[i], [field]: val }; setSections(s); };
  const addItem = (i) => { const s = [...sections]; s[i].items = [...s[i].items, ""]; setSections(s); };
  const removeItem = (si, ii) => { const s = [...sections]; s[si].items = s[si].items.filter((_, idx) => idx !== ii); setSections(s); };
  const updateItem = (si, ii, val) => { const s = [...sections]; s[si].items[ii] = val; setSections(s); };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("vi-VN") : "...";
  const fmtCur = (n) => { const v = Number(n); return v ? v.toLocaleString("vi-VN") + " VNĐ" : "..."; };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="contract-editor-title" className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-zinc-200 border-t-4 border-t-emerald-700 bg-white shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 id="contract-editor-title" className="text-lg font-bold text-zinc-800">Soạn Hợp Đồng</h2>
          <button type="button" onClick={onClose} aria-label="Đóng cửa sổ soạn hợp đồng" className="min-h-11 min-w-11 rounded-lg p-2 hover:bg-zinc-100"><XCircle className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="flex overflow-x-auto border-b border-zinc-100 px-4">
          {TABS.map(t => (
            <button type="button" key={t.key} onClick={() => setActiveTab(t.key)}
              className={`min-h-11 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${activeTab === t.key ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {activeTab === "info" && (<>
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3">BÊN A — HLV</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className={labelCls}>Họ và tên *</label><input aria-label="Họ và tên HLV" className={inputCls} value={form.trainerName} onChange={e => setForm({ ...form, trainerName: e.target.value })} />{errors.trainerName && <p className={errCls}>{errors.trainerName}</p>}</div>
                <div><label className={labelCls}>Năm sinh *</label><input aria-label="Năm sinh HLV" className={inputCls} placeholder="VD: 1999" value={form.trainerBirthYear} onChange={e => setForm({ ...form, trainerBirthYear: e.target.value.replace(/\D/g, "").slice(0, 4) })} />{errors.trainerBirthYear && <p className={errCls}>{errors.trainerBirthYear}</p>}</div>
                <div className="sm:col-span-2"><label className={labelCls}>Địa chỉ *</label><input aria-label="Địa chỉ HLV" className={inputCls} value={form.trainerAddress} onChange={e => setForm({ ...form, trainerAddress: e.target.value })} />{errors.trainerAddress && <p className={errCls}>{errors.trainerAddress}</p>}</div>
                <div><label className={labelCls}>SĐT *</label><input aria-label="Số điện thoại HLV" className={inputCls} inputMode="numeric" value={form.trainerPhone} onChange={handlePhoneChange("trainerPhone")} />{errors.trainerPhone && <p className={errCls}>{errors.trainerPhone}</p>}</div>
                <div><label className={labelCls}>Email *</label><input aria-label="Email HLV" className={inputCls} type="email" value={form.trainerEmail} onChange={e => setForm({ ...form, trainerEmail: e.target.value })} />{errors.trainerEmail && <p className={errCls}>{errors.trainerEmail}</p>}</div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3">BÊN B — KHÁCH HÀNG</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><label className={labelCls}>Họ và tên *</label><input aria-label="Họ và tên khách hàng" className={inputCls} value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} />{errors.clientName && <p className={errCls}>{errors.clientName}</p>}</div>
                <div><label className={labelCls}>SĐT *</label><input aria-label="Số điện thoại khách hàng" className={inputCls} inputMode="numeric" value={form.clientPhone} onChange={handlePhoneChange("clientPhone")} />{errors.clientPhone && <p className={errCls}>{errors.clientPhone}</p>}</div>
                <div><label className={labelCls}>Email *</label><input aria-label="Email khách hàng" className={inputCls} type="email" value={form.clientEmail} onChange={e => setForm({ ...form, clientEmail: e.target.value })} />{errors.clientEmail && <p className={errCls}>{errors.clientEmail}</p>}</div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3">GÓI DỊCH VỤ</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div><label className={labelCls}>Số buổi *</label><input aria-label="Số buổi tập" className={inputCls} inputMode="numeric" value={form.sessions} onChange={handleSessionsChange} />{errors.sessions && <p className={errCls}>{errors.sessions}</p>}</div>
                <div><label className={labelCls}>Giá/buổi (VNĐ) *</label><input aria-label="Giá mỗi buổi" className={inputCls} inputMode="numeric" value={getMoneyValue("pricePerSession")} onChange={handleMoneyChange("pricePerSession")} onFocus={handleMoneyFocus("pricePerSession")} onBlur={handleMoneyBlur("pricePerSession")} placeholder="VD: 300000" />{errors.pricePerSession && <p className={errCls}>{errors.pricePerSession}</p>}</div>
                <div><label className={labelCls}>Tổng tiền (VNĐ) *</label><input aria-label="Tổng tiền" className={inputCls} inputMode="numeric" value={getMoneyValue("totalAmount")} onChange={handleMoneyChange("totalAmount")} onFocus={handleMoneyFocus("totalAmount")} onBlur={handleMoneyBlur("totalAmount")} placeholder="VD: 1500000" />{errors.totalAmount && <p className={errCls}>{errors.totalAmount}</p>}</div>
                <div><label className={labelCls}>Bắt đầu *</label><input aria-label="Ngày bắt đầu" type="date" className={inputCls} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />{errors.startDate && <p className={errCls}>{errors.startDate}</p>}</div>
                <div><label className={labelCls}>Kết thúc *</label><input aria-label="Ngày kết thúc" type="date" className={inputCls} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />{errors.endDate && <p className={errCls}>{errors.endDate}</p>}</div>
              </div>
            </div>
          </>)}

          {activeTab === "terms" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700">Nội quy & Chính sách</h3>
                <button type="button" onClick={addSection} className="flex min-h-11 items-center gap-1 rounded-lg bg-zinc-100 px-3 py-2 text-xs transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-emerald-700"><Plus className="w-3 h-3" /> Thêm mục</button>
              </div>
              {/* VĐ4: Note */}
              <p className="text-xs text-slate-400 italic">Hệ thống hiện đang đề xuất trước cho bạn, có thể chỉnh sửa theo ý kiến cá nhân.</p>
              {sections.map((sec, si) => (
                <div key={si} className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <input aria-label={`Tiêu đề mục ${si + 1}`} className={`${inputCls} font-semibold`} placeholder="Tiêu đề mục" value={sec.title} onChange={e => updateSection(si, "title", e.target.value)} />
                    <button type="button" onClick={() => removeSection(si)} aria-label={`Xóa mục ${si + 1}`} className="min-h-11 min-w-11 shrink-0 rounded-lg p-2 text-red-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div><label className={labelCls}>Nội dung (tuỳ chọn)</label><textarea aria-label={`Nội dung mục ${si + 1}`} className={`${inputCls} resize-none`} rows={2} value={sec.content || ""} onChange={e => updateSection(si, "content", e.target.value)} /></div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between"><label className={labelCls}>Các điều khoản</label><button type="button" onClick={() => addItem(si)} className="min-h-11 rounded-lg px-2 text-xs text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-emerald-700">+ Thêm</button></div>
                    {sec.items?.map((item, ii) => (
                      <div key={ii} className="flex flex-col gap-2 sm:flex-row">
                        <span className="text-xs text-slate-400 pt-2.5 shrink-0">{ii + 1}.</span>
                        <input aria-label={`Điều khoản ${ii + 1} của mục ${si + 1}`} className={inputCls} value={item} onChange={e => updateItem(si, ii, e.target.value)} />
                        <button type="button" onClick={() => removeItem(si, ii)} aria-label={`Xóa điều khoản ${ii + 1}`} className="min-h-11 min-w-11 shrink-0 rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {sections.length === 0 && <p className="text-center text-sm text-slate-400 py-8">Chưa có nội quy. Bấm "Thêm mục" để bắt đầu.</p>}
            </div>
          )}


          {activeTab === "signature" && (
            <section className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <PenLine className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                  <div>
                    <h3 className="font-semibold text-emerald-950">
                      Chữ ký xác nhận của Bên A
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-emerald-900">
                      Chữ ký này sẽ xuất hiện trên hợp đồng gửi cho khách hàng và bản PDF hoàn tất.
                    </p>
                  </div>
                </div>
              </div>

              {effectiveTrainerSignature && (
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                  <p className="mb-2 text-xs font-medium text-zinc-500">
                    Chữ ký hiện tại
                  </p>
                  <img
                    src={effectiveTrainerSignature}
                    alt="Chữ ký hiện tại của Bên A"
                    className="h-24 w-full object-contain"
                  />
                </div>
              )}

              <div>
                <p className="mb-2 text-sm font-semibold text-zinc-800">
                  {effectiveTrainerSignature ? "Vẽ lại chữ ký" : "Vẽ chữ ký"}
                </p>
                <SignatureCanvas onSignatureChange={setTrainerSignature} />
              </div>
            </section>
          )}

          {activeTab === "preview" && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-white px-6 py-5 text-center border-b border-slate-200">
                <p className="text-[10px] tracking-[0.2em] text-slate-400 mb-1">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                <p className="text-[10px] text-slate-300 mb-3">Độc lập – Tự do – Hạnh phúc</p>
                <h2 className="text-sm font-bold text-black uppercase">Hợp Đồng Dịch Vụ Huấn Luyện Cá Nhân</h2>
              </div>
              <div className="px-6 py-4 space-y-4 text-xs">
                <div><p className="font-bold text-black text-[11px] mb-1">BÊN A:</p><div className="pl-3 text-slate-600 space-y-0.5"><p>● Họ tên: <strong className="text-black">{form.trainerName || "..."}</strong></p><p>● Năm sinh: {form.trainerBirthYear || "..."} · Địa chỉ: {form.trainerAddress || "..."}</p><p>● SĐT: {form.trainerPhone || "..."} · Email: {form.trainerEmail || "..."}</p></div></div>
                <div><p className="font-bold text-black text-[11px] mb-1">BÊN B:</p><div className="pl-3 text-slate-600 space-y-0.5"><p>● Họ tên: <strong className="text-black">{form.clientName || "..."}</strong></p><p>● SĐT: {form.clientPhone || "..."} · Email: {form.clientEmail || "..."}</p></div></div>
                <div className="border border-slate-100 rounded-lg overflow-hidden">
                  <table className="w-full text-[11px]"><thead><tr className="bg-slate-50"><th className="text-left px-3 py-1.5">Buổi</th><th className="text-left px-3 py-1.5">Giá/buổi</th><th className="text-right px-3 py-1.5">Tổng</th></tr></thead>
                    <tbody><tr><td className="px-3 py-1.5 font-semibold">{form.sessions}</td><td className="px-3 py-1.5">{fmtCur(form.pricePerSession)}</td><td className="px-3 py-1.5 text-right font-bold">{fmtCur(form.totalAmount)}</td></tr></tbody></table>
                </div>
                <p className="text-slate-500">Từ {form.startDate ? fmtDate(form.startDate) : "..."} đến {form.endDate ? fmtDate(form.endDate) : "..."}</p>
                {sections.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <p className="font-bold text-black text-[11px]">CHÍNH SÁCH VÀ NỘI QUY</p>
                    {sections.map((s, i) => (<div key={i}><p className="font-semibold text-black">{s.title}</p>{s.content && <p className="pl-3 text-slate-600">{s.content}</p>}{s.items?.map((it, j) => <p key={j} className="pl-3 text-slate-600">{j + 1}. {it}</p>)}</div>))}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 border-t border-zinc-100 pt-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                    <p className="text-[10px] font-semibold text-emerald-700">CHỮ KÝ BÊN A</p>
                    {effectiveTrainerSignature ? (
                      <img
                        src={effectiveTrainerSignature}
                        alt="Chữ ký Bên A"
                        className="mt-2 h-16 w-full rounded bg-white object-contain"
                      />
                    ) : (
                      <p className="mt-2 text-[10px] text-amber-700">Chưa có chữ ký</p>
                    )}
                    <p className="mt-2 text-[10px] text-zinc-600">{form.trainerName || "Bên A"}</p>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <p className="text-[10px] font-semibold text-zinc-700">CHỮ KÝ BÊN B</p>
                    <div className="mt-2 flex h-16 items-center justify-center rounded border border-dashed border-zinc-300 bg-white text-[10px] text-zinc-400">
                      Khách hàng ký sau khi xem hết hợp đồng
                    </div>
                    <p className="mt-2 text-[10px] text-zinc-600">{form.clientName || "Khách hàng"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={onClose} className="min-h-11 rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-emerald-700">Đóng</button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={handleSave} disabled={updateMut.isPending} className="min-h-11 rounded-lg border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50">Lưu nháp</button>
            <button type="button" onClick={handleSendClick} disabled={isLoadingContractDetail || updateMut.isPending || sendMut.isPending}
              className="flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50">
              <Send className="w-4 h-4" />{sendMut.isPending ? "Đang gửi..." : "Lưu & Gửi"}
            </button>
          </div>
        </div>
      </div>

      {showConfirmSend && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-contract-title" className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
              <h3 id="confirm-contract-title" className="text-lg font-bold text-zinc-800">Xác nhận gửi hợp đồng</h3>
            </div>
            <p className="text-sm text-zinc-600">Sau khi gửi, hợp đồng sẽ <strong className="text-red-600">không thể chỉnh sửa</strong>. Chữ ký Bên A sẽ được khóa cùng nội dung; khách hàng phải xem hết, đồng ý điều khoản và vẽ chữ ký để hoàn tất.</p>
            <p className="text-xs text-slate-400">Vui lòng kiểm tra kỹ thông tin trước khi xác nhận.</p>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowConfirmSend(false)} className="min-h-11 rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-emerald-700">Hủy</button>
              <button type="button" onClick={handleConfirmSend} disabled={sendMut.isPending}
                className="flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50">
                <Send className="w-4 h-4" /> Xác nhận gửi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractEditModal;
