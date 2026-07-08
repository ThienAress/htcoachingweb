import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Plus, Edit, Trash2, X, BrainCircuit, FileWarning, Search, HelpCircle } from "lucide-react";
import { getF1AiRules, createF1AiRule, updateF1AiRule, deleteF1AiRule } from "../../services/f1AiRule.service";

const F1AiRuleManagement = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    category: "general_advice",
    description: "",
    priority: 0,
    isActive: true,
    recommendationContent: "",
    conditionsJson: "[]"
  });

  const { data: response, isLoading } = useQuery({
    queryKey: ["f1AiRules"],
    queryFn: getF1AiRules,
  });

  const rules = response?.data?.data || response?.data || [];
  const filteredRules = rules.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || 
    r.code.toLowerCase().includes(search.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: createF1AiRule,
    onSuccess: () => {
      toast.success("Thêm rule thành công");
      resetModal();
      queryClient.invalidateQueries(["f1AiRules"]);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi khi thêm rule"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateF1AiRule(id, data),
    onSuccess: () => {
      toast.success("Cập nhật thành công");
      resetModal();
      queryClient.invalidateQueries(["f1AiRules"]);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi cập nhật"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteF1AiRule,
    onSuccess: () => {
      toast.success("Xóa thành công");
      queryClient.invalidateQueries(["f1AiRules"]);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi xóa"),
  });

  const resetModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({
      code: "",
      name: "",
      category: "general_advice",
      description: "",
      priority: 0,
      isActive: true,
      recommendationContent: "",
      conditionsJson: "[]"
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let conditions = [];
    try {
      conditions = JSON.parse(formData.conditionsJson);
      if (!Array.isArray(conditions)) throw new Error("Phải là một mảng (Array)");
    } catch (err) {
      toast.error("JSON conditions không hợp lệ: " + err.message);
      return;
    }

    const payload = {
      code: formData.code,
      name: formData.name,
      category: formData.category,
      description: formData.description,
      priority: Number(formData.priority),
      isActive: formData.isActive,
      conditions,
      recommendation: {
        content: formData.recommendationContent
      }
    };

    if (editingId) updateMutation.mutate({ id: editingId, data: payload });
    else createMutation.mutate(payload);
  };

  const handleEdit = (rule) => {
    setFormData({
      code: rule.code,
      name: rule.name,
      category: rule.category,
      description: rule.description || "",
      priority: rule.priority || 0,
      isActive: rule.isActive !== false,
      recommendationContent: rule.recommendation?.content || "",
      conditionsJson: JSON.stringify(rule.conditions || [], null, 2)
    });
    setEditingId(rule._id);
    setShowModal(true);
  };

  const handleDelete = (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa rule này? Các report tương lai sẽ không có lời khuyên này nữa."))
      deleteMutation.mutate(id);
  };

  const categories = [
    "hold_test", "general_advice", "special_care", "cardio", "resistance", "flexibility", "nutrition", "other"
  ];

  return (
    <phantom-ui loading={isLoading || undefined}>
    <div className="min-h-screen bg-gray-50/40 p-4 md:p-6">
      <ToastContainer position="top-right" autoClose={3000} theme="light" />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-fluid-2xl font-bold text-gray-800 flex items-center gap-2 uppercase">
            <BrainCircuit className="w-7 h-7 text-indigo-600" />
            AI Rule Engine (F1)
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Quản lý các bộ quy tắc (rules) tự động sinh giáo án cho khách hàng NASM
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all active:scale-95"
        >
          <Plus size={18} /> Thêm Rule mới
        </button>
      </div>

      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Tìm kiếm rule..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700">Mã (Code)</th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700">Tên Rule</th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700">Category</th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700">Priority</th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700">Trạng thái</th>
                <th className="px-5 py-4 text-center text-sm font-semibold text-gray-700 w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRules.map((rule) => (
                <tr key={rule._id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3 text-sm font-bold text-gray-800">{rule.code}</td>
                  <td className="px-5 py-3 text-sm text-gray-600 font-medium">{rule.name}</td>
                  <td className="px-5 py-3 text-sm">
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                      {rule.category}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm font-mono text-gray-600">{rule.priority}</td>
                  <td className="px-5 py-3 text-sm">
                    {rule.isActive ? (
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Active</span>
                    ) : (
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">Inactive</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => handleEdit(rule)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="Sửa">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => handleDelete(rule._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition" title="Xóa">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRules.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                    <FileWarning className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    Không tìm thấy rules nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={resetModal}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 uppercase">
                {editingId ? <><Edit size={20} className="text-indigo-600"/> Sửa Rule</> : <><Plus size={20} className="text-indigo-600"/> Thêm Rule Mới</>}
              </h2>
              <button onClick={resetModal} className="p-1 rounded-full hover:bg-gray-100 transition"><X size={20} className="text-gray-500" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mã Rule (Code) *</label>
                  <input type="text" required placeholder="Ví dụ: RULE_SLEEP_LOW" className="w-full p-2.5 border border-gray-300 rounded-xl" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} disabled={!!editingId} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị *</label>
                  <input type="text" required placeholder="Tên để admin dễ hiểu" className="w-full p-2.5 border border-gray-300 rounded-xl" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select className="w-full p-2.5 border border-gray-300 rounded-xl" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Độ ưu tiên (Priority)</label>
                  <input type="number" className="w-full p-2.5 border border-gray-300 rounded-xl" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                    <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} />
                    Đang hoạt động (Active)
                  </label>
                </div>
              </div>

              <div>
                <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-1">
                  Điều kiện kích hoạt (JSON Array) *
                  <div className="group relative">
                    <HelpCircle size={16} className="text-indigo-400" />
                    <div className="absolute right-0 bottom-full mb-2 w-72 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition z-10 pointer-events-none">
                      Ví dụ:<br/>
                      [<br/>
                      &nbsp;&nbsp;{'{'}"field": "flags.lifestyleFlags", "operator": "INCLUDES", "value": "sleep_low"{'}'},<br/>
                      &nbsp;&nbsp;{'{'}"field": "phase", "operator": "NOT_EQUals", "value": "pending_review"{'}'}<br/>
                      ]
                    </div>
                  </div>
                </label>
                <textarea rows={6} required className="w-full p-3 font-mono text-sm border border-gray-300 rounded-xl bg-gray-50" value={formData.conditionsJson} onChange={e => setFormData({...formData, conditionsJson: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung Lời khuyên (Recommendation) *</label>
                <textarea rows={4} required placeholder="Nội dung sẽ hiện trong báo cáo..." className="w-full p-2.5 border border-gray-300 rounded-xl" value={formData.recommendationContent} onChange={e => setFormData({...formData, recommendationContent: e.target.value})} />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={resetModal} className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition">Hủy</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition flex items-center gap-2">
                  {editingId ? "Cập nhật" : "Lưu Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </phantom-ui>
  );
};

export default F1AiRuleManagement;
