import { useState } from "react";
import { toast } from "react-toastify";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { XCircle, Send, Plus, Trash2, AlertTriangle } from "lucide-react";

import { updateContract, sendContractToClient } from "../../services/contract.service";
import SignatureCanvas from "../../components/SignatureCanvas";

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent";
const errCls = "text-[11px] text-red-500 mt-0.5";
const labelCls = "block text-xs font-medium text-slate-500 mb-1";
const TABS = [
  { key: "info", label: "Thông tin" },
  { key: "terms", label: "Nội quy" },
  { key: "sign", label: "Ký tên HLV" },
  { key: "preview", label: "Xem trước" },
];

// Format số tiền: chỉ dùng khi blur (hiển thị)
const fmtMoney = (raw) => {
  if (!raw && raw !== 0) return "";
  const n = String(raw).replace(/\D/g, "");
  return n ? Number(n).toLocaleString("vi-VN") : "";
};
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const isValidPhone = (p) => /^\d{1,10}$/.test(p);

const ContractEditModal = ({ contract, onClose }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("info");
  const [trainerSig, setTrainerSig] = useState(contract.trainerSignature || "");
  const [isDrawingSig, setIsDrawingSig] = useState(!contract.trainerSignature);
  const [showConfirmSend, setShowConfirmSend] = useState(false);
  const [errors, setErrors] = useState({});
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
    trainerSignature: trainerSig,
  });

  const updateMut = useMutation({
    mutationFn: (data) => updateContract(contract._id, data),
    onSuccess: () => { toast.success("Đã lưu hợp đồng"); queryClient.invalidateQueries({ queryKey: ["contracts"] }); },
    onError: (e) => toast.error(e.response?.data?.message || "Lỗi lưu"),
  });

  const sendMut = useMutation({
    mutationFn: (id) => sendContractToClient(id),
    onSuccess: () => { toast.success("Đã gửi hợp đồng cho khách hàng 📧"); queryClient.invalidateQueries({ queryKey: ["contracts"] }); onClose(); },
    onError: (e) => toast.error(e.response?.data?.message || "Lỗi gửi"),
  });

  const handleSave = () => {
    if (!validate()) return;
    updateMut.mutate(buildPayload());
  };

  const handleSendClick = () => {
    if (!validate()) return;
    if (sections.length === 0) return toast.warn("Vui lòng thêm nội quy trước khi gửi");
    if (!trainerSig) return toast.warn("HLV chưa ký tên. Vui lòng ký ở tab 'Ký tên HLV' trước khi gửi");
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Soạn Hợp Đồng</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><XCircle className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="flex border-b border-slate-100 px-4">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? "border-black text-black" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {activeTab === "info" && (<>
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3">BÊN A — HLV</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Họ và tên *</label><input className={inputCls} value={form.trainerName} onChange={e => setForm({ ...form, trainerName: e.target.value })} />{errors.trainerName && <p className={errCls}>{errors.trainerName}</p>}</div>
                <div><label className={labelCls}>Năm sinh *</label><input className={inputCls} placeholder="VD: 1999" value={form.trainerBirthYear} onChange={e => setForm({ ...form, trainerBirthYear: e.target.value.replace(/\D/g, "").slice(0, 4) })} />{errors.trainerBirthYear && <p className={errCls}>{errors.trainerBirthYear}</p>}</div>
                <div className="col-span-2"><label className={labelCls}>Địa chỉ *</label><input className={inputCls} value={form.trainerAddress} onChange={e => setForm({ ...form, trainerAddress: e.target.value })} />{errors.trainerAddress && <p className={errCls}>{errors.trainerAddress}</p>}</div>
                <div><label className={labelCls}>SĐT *</label><input className={inputCls} inputMode="numeric" value={form.trainerPhone} onChange={handlePhoneChange("trainerPhone")} />{errors.trainerPhone && <p className={errCls}>{errors.trainerPhone}</p>}</div>
                <div><label className={labelCls}>Email *</label><input className={inputCls} type="email" value={form.trainerEmail} onChange={e => setForm({ ...form, trainerEmail: e.target.value })} />{errors.trainerEmail && <p className={errCls}>{errors.trainerEmail}</p>}</div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3">BÊN B — KHÁCH HÀNG</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className={labelCls}>Họ và tên *</label><input className={inputCls} value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} />{errors.clientName && <p className={errCls}>{errors.clientName}</p>}</div>
                <div><label className={labelCls}>SĐT *</label><input className={inputCls} inputMode="numeric" value={form.clientPhone} onChange={handlePhoneChange("clientPhone")} />{errors.clientPhone && <p className={errCls}>{errors.clientPhone}</p>}</div>
                <div><label className={labelCls}>Email *</label><input className={inputCls} type="email" value={form.clientEmail} onChange={e => setForm({ ...form, clientEmail: e.target.value })} />{errors.clientEmail && <p className={errCls}>{errors.clientEmail}</p>}</div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3">GÓI DỊCH VỤ</h3>
              <div className="grid grid-cols-3 gap-3">
                <div><label className={labelCls}>Số buổi *</label><input className={inputCls} inputMode="numeric" value={form.sessions} onChange={handleSessionsChange} />{errors.sessions && <p className={errCls}>{errors.sessions}</p>}</div>
                <div><label className={labelCls}>Giá/buổi (VNĐ) *</label><input className={inputCls} inputMode="numeric" value={getMoneyValue("pricePerSession")} onChange={handleMoneyChange("pricePerSession")} onFocus={handleMoneyFocus("pricePerSession")} onBlur={handleMoneyBlur("pricePerSession")} placeholder="VD: 300000" />{errors.pricePerSession && <p className={errCls}>{errors.pricePerSession}</p>}</div>
                <div><label className={labelCls}>Tổng tiền (VNĐ) *</label><input className={inputCls} inputMode="numeric" value={getMoneyValue("totalAmount")} onChange={handleMoneyChange("totalAmount")} onFocus={handleMoneyFocus("totalAmount")} onBlur={handleMoneyBlur("totalAmount")} placeholder="VD: 1500000" />{errors.totalAmount && <p className={errCls}>{errors.totalAmount}</p>}</div>
                <div><label className={labelCls}>Bắt đầu *</label><input type="date" className={inputCls} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />{errors.startDate && <p className={errCls}>{errors.startDate}</p>}</div>
                <div><label className={labelCls}>Kết thúc *</label><input type="date" className={inputCls} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />{errors.endDate && <p className={errCls}>{errors.endDate}</p>}</div>
              </div>
            </div>
          </>)}

          {activeTab === "terms" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700">Nội quy & Chính sách</h3>
                <button onClick={addSection} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"><Plus className="w-3 h-3" /> Thêm mục</button>
              </div>
              {/* VĐ4: Note */}
              <p className="text-xs text-slate-400 italic">Hệ thống hiện đang đề xuất trước cho bạn, có thể chỉnh sửa theo ý kiến cá nhân.</p>
              {sections.map((sec, si) => (
                <div key={si} className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <input className={`${inputCls} font-semibold`} placeholder="Tiêu đề mục" value={sec.title} onChange={e => updateSection(si, "title", e.target.value)} />
                    <button onClick={() => removeSection(si)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div><label className={labelCls}>Nội dung (tuỳ chọn)</label><textarea className={`${inputCls} resize-none`} rows={2} value={sec.content || ""} onChange={e => updateSection(si, "content", e.target.value)} /></div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between"><label className={labelCls}>Các điều khoản</label><button onClick={() => addItem(si)} className="text-xs text-slate-500 hover:text-slate-700">+ Thêm</button></div>
                    {sec.items?.map((item, ii) => (
                      <div key={ii} className="flex gap-2">
                        <span className="text-xs text-slate-400 pt-2.5 shrink-0">{ii + 1}.</span>
                        <input className={inputCls} value={item} onChange={e => updateItem(si, ii, e.target.value)} />
                        <button onClick={() => removeItem(si, ii)} className="p-1.5 text-red-300 hover:text-red-500 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {sections.length === 0 && <p className="text-center text-sm text-slate-400 py-8">Chưa có nội quy. Bấm "Thêm mục" để bắt đầu.</p>}
            </div>
          )}

          {/* VĐ5: Chữ ký HLV — giữ canvas mở, không auto-switch sang image */}
          {activeTab === "sign" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-700">Chữ ký Huấn luyện viên</h3>
              <p className="text-xs text-slate-500">HLV ký tên thoải mái — nhấc tay/chuột vẫn giữ nét. Bấm "Xóa & ký lại" nếu muốn ký lại.</p>
              {isDrawingSig ? (
                <div className="space-y-3">
                  <SignatureCanvas onSignatureChange={setTrainerSig} />
                  <p className="text-sm text-center font-medium text-slate-600">{form.trainerName}</p>
                  {trainerSig && <p className="text-xs text-center text-emerald-600">✓ Đã ký</p>}
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <div className="border border-slate-200 rounded-xl p-6 bg-slate-50 inline-block"><img src={trainerSig} alt="Chữ ký HLV" className="max-h-[100px]" /></div>
                  <p className="text-sm font-medium text-slate-700">{form.trainerName}</p>
                  <button onClick={() => { setTrainerSig(""); setIsDrawingSig(true); }} className="text-xs text-red-500 hover:underline">Xóa & ký lại</button>
                </div>
              )}
            </div>
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
                {trainerSig && (
                  <div className="pt-2 border-t border-slate-100 flex justify-between items-end">
                    <div className="text-center"><p className="text-[10px] text-slate-400 mb-1">Bên A</p><img src={trainerSig} alt="" className="max-h-[40px] mx-auto" /><p className="text-[10px] font-medium mt-1">{form.trainerName}</p></div>
                    <div className="text-center"><p className="text-[10px] text-slate-400 mb-1">Bên B</p><div className="border-b border-dashed border-slate-300 w-24 h-8" /><p className="text-[10px] font-medium mt-1">{form.clientName}</p></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t px-5 py-3 flex justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg">Đóng</button>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={updateMut.isPending} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">Lưu nháp</button>
            <button onClick={handleSendClick} disabled={updateMut.isPending || sendMut.isPending}
              className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
              <Send className="w-4 h-4" />{sendMut.isPending ? "Đang gửi..." : "Lưu & Gửi"}
            </button>
          </div>
        </div>
      </div>

      {showConfirmSend && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
              <h3 className="text-lg font-bold text-slate-800">Xác nhận gửi hợp đồng</h3>
            </div>
            <p className="text-sm text-slate-600">Sau khi gửi, hợp đồng sẽ <strong className="text-red-600">không thể chỉnh sửa</strong> được nữa. Email sẽ được gửi đến khách hàng để ký.</p>
            <p className="text-xs text-slate-400">Vui lòng kiểm tra kỹ thông tin trước khi xác nhận.</p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowConfirmSend(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
              <button onClick={handleConfirmSend} disabled={sendMut.isPending}
                className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
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
