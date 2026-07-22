import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "react-toastify";
import { createWorkoutPlan } from "../../services/workoutPlan.service";

const DEFAULT_SECTIONS = [
  { name: "WARM UP", icon: "🔥", sortOrder: 0, exercises: [] },
  { name: "STRENGTH PREPARATION", icon: "🏋️", sortOrder: 1, exercises: [] },
  { name: "ISOLATION TRAINING", icon: "🍑", sortOrder: 2, exercises: [] },
  { name: "COOLDOWN / STRETCHING", icon: "🧘", sortOrder: 3, exercises: [] },
];

const inputClass = "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors";

const SectionBlock = ({ section, onUpdate, onRemove }) => {
  const updateField = (field, val) => onUpdate({ ...section, [field]: val });
  return (
    <div className="flex items-center gap-2 p-2 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-colors">
      <GripVertical className="w-4 h-4 text-gray-500" />
      
      {/* Icon Selector Button */}
      <div className="relative group">
        <button type="button" className="text-xl px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 border border-gray-600 transition-colors">
          {section.icon || "📋"}
        </button>
        {/* Simple dropdown for icon on hover */}
        <div className="absolute top-full left-0 mt-1 hidden group-hover:flex bg-gray-800 border border-gray-700 p-1 rounded shadow-xl z-10 gap-1 w-[180px] flex-wrap">
          {["🔥", "🏋️", "🍑", "🧘", "💪", "⚡", "🎯", "📋"].map(ic => (
            <button key={ic} type="button" onClick={() => updateField("icon", ic)} className="text-lg p-1 hover:bg-gray-700 rounded transition-colors grayscale hover:grayscale-0">
              {ic}
            </button>
          ))}
        </div>
      </div>

      <input
        type="text"
        value={section.name}
        onChange={(e) => updateField("name", e.target.value)}
        placeholder="Tên Section (vd: WARM UP)"
        className="flex-1 bg-transparent text-white font-semibold text-sm focus:outline-none focus:border-b border-primary px-1"
      />
      <button type="button" onClick={onRemove} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors ml-auto">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

const PlanModal = ({ clients, initialClientId, initialDate, onClose, onSaved }) => {
  const [form, setForm] = useState(() => {
    const initialClient = clients.find((client) => client._id === initialClientId);
    return {
      title: "",
      planDate: initialDate || new Date().toISOString().split("T")[0],
      clientId: initialClientId || "",
      clientName: initialClient?.name || "",
      clientEmail: initialClient?.email || "",
      trainerNote: "",
    };
  });

  const [sections, setSections] = useState([...DEFAULT_SECTIONS]);

  const handleClientChange = (clientId) => {
    const c = clients.find((x) => x._id === clientId);
    setForm((f) => ({
      ...f,
      clientId,
      clientName: c ? c.name : "",
      clientEmail: c ? c.email : "",
    }));
  };

  const addSection = () => {
    setSections([...sections, { name: "", icon: "📋", sortOrder: sections.length, exercises: [] }]);
  };

  const removeSection = (idx) => {
    if (sections.length <= 1) return toast.info("Cần ít nhất 1 section");
    setSections(sections.filter((_, i) => i !== idx));
  };

  const updateSection = (idx, updated) => {
    const copy = [...sections];
    copy[idx] = updated;
    setSections(copy);
  };

  const createMut = useMutation({
    mutationFn: (data) => createWorkoutPlan(data),
    onSuccess: (res) => { 
      toast.success("Tạo giáo án thành công!"); 
      onSaved(res.data.data._id); // Pass new ID back to navigate
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi tạo giáo án"),
  });

  const handleSave = () => {
    if (!form.title.trim()) return toast.error("Vui lòng nhập tiêu đề");
    if (!form.clientId) return toast.error("Vui lòng chọn khách hàng");
    if (!form.planDate) return toast.error("Vui lòng chọn ngày tập");

    const validSections = sections.filter(s => s.name.trim()).map((s, i) => ({
      ...s,
      sortOrder: i,
    }));

    if (validSections.length === 0) return toast.error("Cần ít nhất 1 section có tên");

    const payload = {
      ...form,
      status: "draft",
      sections: validSections,
    };

    createMut.mutate(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-800 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-primary">✦</span> Tạo giáo án mới
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Tiêu đề *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="VD: LEG DAY, UPPER BODY..."
                className={inputClass}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Khách hàng *</label>
              <select
                value={form.clientId}
                onChange={(e) => handleClientChange(e.target.value)}
                className={inputClass}
              >
                <option value="">-- Chọn khách hàng --</option>
                {clients.map((c) => (
                  <option key={c._id} value={c._id}>{c.name} ({c.email})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Ngày tập *</label>
              <input
                type="date"
                value={form.planDate}
                onChange={(e) => setForm((f) => ({ ...f, planDate: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Ghi chú cho buổi tập</label>
            <textarea
              value={form.trainerNote}
              onChange={(e) => setForm((f) => ({ ...f, trainerNote: e.target.value }))}
              placeholder="Ghi chú chung cho buổi tập..."
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-300">Sections (Cấu trúc buổi tập)</label>
              <button type="button" onClick={addSection} className="flex items-center gap-1 px-3 py-1.5 text-xs text-primary hover:bg-primary/10 rounded-lg transition-colors border border-primary/20">
                <Plus className="w-3.5 h-3.5" /> Thêm Section
              </button>
            </div>
            <div className="space-y-2 bg-gray-950/50 p-3 rounded-xl border border-gray-800">
              {sections.map((section, idx) => (
                <SectionBlock
                  key={idx}
                  section={section}
                  onUpdate={(updated) => updateSection(idx, updated)}
                  onRemove={() => removeSection(idx)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800 bg-gray-900/80 rounded-b-2xl">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white text-sm font-medium transition-colors">
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={createMut.isPending}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-orange-500 text-white text-sm font-medium disabled:opacity-50 shadow-lg shadow-primary/20 transition-all"
          >
            {createMut.isPending ? "Đang tạo..." : "Tạo giáo án"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanModal;
