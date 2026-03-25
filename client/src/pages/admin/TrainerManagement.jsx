import { useState, useEffect } from "react";
import { Search, Trash2, UserCog } from "lucide-react";
import { toast } from "react-toastify";
import { getTrainers, deleteTrainer } from "../../services/user.service";

const TrainerManagement = () => {
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchTrainers = async () => {
    try {
      setLoading(true);
      const res = await getTrainers();
      setTrainers(res.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi tải danh sách trainer");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainers();
  }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Xóa trainer "${name}"?`)) return;
    try {
      await deleteTrainer(id);
      toast.success("Xóa trainer thành công");
      fetchTrainers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi xóa");
    }
  };

  const filteredTrainers = trainers.filter(
    (trainer) =>
      trainer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trainer.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4 animate-pulse">
        <div className="h-6 bg-gray-300 rounded w-1/3 md:w-1/4"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 h-full">
      <div className="flex items-center gap-2">
        <UserCog className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />
        <h2 className="text-xl md:text-2xl font-bold text-slate-800">
          Quản lý Trainer
        </h2>
      </div>
      <p className="text-sm text-slate-500">
        Danh sách huấn luyện viên đã tạo.
      </p>

      {/* Thanh tìm kiếm */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm kiếm theo tên hoặc email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm md:text-base"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600 min-w-[140px]">
                  Tên
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600 min-w-[180px]">
                  Email
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTrainers.map((trainer) => (
                <tr
                  key={trainer._id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 md:px-4 py-2 md:py-3 font-medium text-slate-700 break-words">
                    {trainer.name}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600 break-words">
                    {trainer.email}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3">
                    <button
                      onClick={() => handleDelete(trainer._id, trainer.name)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa"
                    >
                      <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTrainers.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 md:px-4 py-6 md:py-8 text-center text-slate-500"
                  >
                    Không tìm thấy trainer nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TrainerManagement;
