import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, MapPin, Loader2, Database } from "lucide-react";
import { toast } from "react-toastify";
import SEO from "../../components/SEO";
import { getAllGyms, createGym, updateGym, deleteGym, seedGyms } from "../../services/gym.service";

const GymManagement = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGym, setSelectedGym] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: gymsData, isLoading } = useQuery({
    queryKey: ["admin-gyms"],
    queryFn: () => getAllGyms().then((res) => res.data.data),
  });

  const seedMut = useMutation({
    mutationFn: seedGyms,
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ["admin-gyms"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi seed data"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteGym,
    onSuccess: () => {
      toast.success("Xóa phòng tập thành công!");
      queryClient.invalidateQueries({ queryKey: ["admin-gyms"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi khi xóa"),
  });

  const handleDelete = (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa phòng tập này?")) {
      deleteMut.mutate(id);
    }
  };

  const openModal = (gym = null) => {
    setSelectedGym(gym);
    setIsModalOpen(true);
  };

  const filteredGyms = gymsData?.filter((g) =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.district.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="p-4 md:p-8">
      <SEO title="Quản lý Phòng tập" noindex />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Phòng tập</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý danh sách các phòng tập PT có thể dạy</p>
        </div>
        <div className="flex gap-3">
          {gymsData?.length === 0 && (
            <button
              onClick={() => { if (window.confirm("Chắc chắn seed 33 chi nhánh Waystation?")) seedMut.mutate() }}
              disabled={seedMut.isPending}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50"
            >
              <Database size={20} /> Seed Data (Waystation)
            </button>
          )}
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-medium transition"
          >
            <Plus size={20} /> Thêm phòng tập
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm tên phòng tập, quận..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
          </div>
          <div className="text-sm text-slate-500 font-medium">
            Tổng cộng: {filteredGyms?.length} phòng tập
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                <th className="p-4 font-semibold w-16">STT</th>
                <th className="p-4 font-semibold">Phòng tập</th>
                <th className="p-4 font-semibold">Khu vực</th>
                <th className="p-4 font-semibold">Trạng thái</th>
                <th className="p-4 font-semibold text-right w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredGyms?.map((gym, idx) => (
                <tr key={gym._id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                  <td className="p-4 text-slate-500 text-sm">{gym.sortOrder || idx + 1}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {gym.image ? (
                        <img src={gym.image} alt={gym.name} className="w-12 h-12 rounded object-cover border border-slate-200" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                          <MapPin size={20} />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-800">{gym.name}</p>
                        <p className="text-sm text-slate-500 truncate max-w-[250px]">{gym.address}</p>
                        {gym.hasKickfit && <span className="inline-block mt-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded uppercase">KickFit / Boxing</span>}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full">
                      {gym.district}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${gym.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {gym.status === "active" ? "Hoạt động" : "Tạm ngưng"}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openModal(gym)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition">
                        <Pencil size={18} />
                      </button>
                      <button onClick={() => handleDelete(gym._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredGyms?.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500">Không tìm thấy phòng tập nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <GymModal gym={selectedGym} onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
};

const GymModal = ({ gym, onClose }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: gym?.name || "",
    address: gym?.address || "",
    district: gym?.district || "",
    openingHours: gym?.openingHours || "24/7",
    googleMapsUrl: gym?.googleMapsUrl || "",
    note: gym?.note || "",
    hasKickfit: gym?.hasKickfit || false,
    status: gym?.status || "active",
    sortOrder: gym?.sortOrder || 0,
  });
  const [file, setFile] = useState(null);

  const mut = useMutation({
    mutationFn: (data) => gym ? updateGym(gym._id, data) : createGym(data),
    onSuccess: () => {
      toast.success(gym ? "Cập nhật thành công!" : "Tạo phòng tập thành công!");
      queryClient.invalidateQueries({ queryKey: ["admin-gyms"] });
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi xử lý"),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = new FormData();
    Object.keys(formData).forEach(key => data.append(key, formData[key]));
    if (file) data.append("image", file);
    mut.mutate(data);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">{gym ? "Cập nhật Phòng tập" : "Thêm Phòng tập mới"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          <form id="gym-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Tên phòng tập *</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Quận/Huyện *</label>
                <input required type="text" value={formData.district} onChange={e => setFormData({ ...formData, district: e.target.value })} placeholder="VD: Gò Vấp, Quận 9..." className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Địa chỉ chi tiết *</label>
              <input required type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Link Google Maps</label>
                <input type="text" value={formData.googleMapsUrl} onChange={e => setFormData({ ...formData, googleMapsUrl: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Giờ mở cửa</label>
                <input type="text" value={formData.openingHours} onChange={e => setFormData({ ...formData, openingHours: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Ghi chú thêm</label>
              <input type="text" value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} placeholder="VD: Có phòng Private..." className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Ảnh đại diện (Cloudinary)</label>
                <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} className="w-full px-3 py-2 border rounded-lg text-sm" />
                {gym?.image && !file && <p className="text-xs text-green-600 mt-1">Đã có ảnh (chọn file mới để ghi đè)</p>}
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Thứ tự hiển thị</label>
                  <input type="number" value={formData.sortOrder} onChange={e => setFormData({ ...formData, sortOrder: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Trạng thái</label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50">
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Tạm ngưng</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.hasKickfit} onChange={e => setFormData({ ...formData, hasKickfit: e.target.checked })} className="w-5 h-5 text-primary rounded focus:ring-primary/50" />
                <span className="font-semibold text-slate-800">Cơ sở trọng điểm KickFit / Boxing</span>
              </label>
            </div>
          </form>
        </div>
        <div className="p-5 border-t border-slate-200 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-5 py-2 font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition">Hủy</button>
          <button type="submit" form="gym-form" disabled={mut.isPending} className="px-5 py-2 font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition flex items-center gap-2">
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {gym ? "Cập nhật" : "Tạo mới"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GymManagement;
