import { useEffect, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Search,
  Plus,
  Edit,
  Trash,
  Check,
  Clock,
  X,
  Package,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  getOrders,
  createOrder,
  updateOrder,
  deleteOrder,
  approveOrder,
} from "../../services/order.service";

const Orders = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    package: "",
    sessions: "",
    gym: "",
    schedule: "",
    note: "",
  });

  // ================= FETCH =================
  const fetchOrders = async () => {
    try {
      setLoading(true);

      const res = await getOrders();
      setOrders(res.data.orders || res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // ================= HANDLE INPUT =================
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({
      ...form,
      [name]: name === "sessions" ? Number(value) : value,
    });
  };

  // ================= CREATE / UPDATE =================
  const handleSubmit = async () => {
    if (!form.name || !form.email) {
      toast.error("Thiếu thông tin");
      return;
    }

    if (!form.sessions || form.sessions <= 0) {
      toast.error("Số buổi không hợp lệ");
      return;
    }

    try {
      if (editingId) {
        await updateOrder(editingId, form);
        toast.success("Cập nhật thành công");
      } else {
        await createOrder(form);
        toast.success("Tạo đơn thành công");
      }

      resetForm();
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error("Lỗi server");
    }
  };

  // ================= RESET =================
  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      phone: "",
      package: "",
      sessions: "",
      gym: "",
      schedule: "",
      note: "",
    });
    setEditingId(null);
    setShowModal(false);
  };

  // ================= APPROVE =================
  const handleApprove = async (id) => {
    try {
      await approveOrder(id);
      toast.success("Đã xác nhận");
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error("Lỗi xác nhận");
    }
  };

  // ================= DELETE =================
  const handleDelete = async (id) => {
    if (!window.confirm("Xóa đơn này?")) return;

    try {
      await deleteOrder(id);
      toast.success("Đã xóa");
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error("Lỗi xóa");
    }
  };

  // ================= EDIT =================
  const handleEdit = (order) => {
    setForm(order);
    setEditingId(order._id);
    setShowModal(true);
  };

  // ================= SEARCH & PAGINATION =================
  const filteredOrders = orders.filter((o) =>
    o.name?.toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Reset trang khi thay đổi search
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse p-4">
        {/* Header */}
        <div className="h-6 bg-gray-300 rounded w-1/4"></div>

        {/* Form */}
        <div className="bg-white p-4 rounded shadow space-y-3">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded w-32"></div>
        </div>

        {/* Table */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 bg-gray-200 rounded"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-600" />
            Quản lý đơn hàng
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý và xử lý đơn hàng của khách hàng
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo đơn mới</span>
        </button>
      </div>

      {/* SEARCH */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          placeholder="Tìm kiếm theo tên khách hàng..."
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          onChange={(e) => setSearch(e.target.value)}
          value={search}
        />
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Họ tên
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Email
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  SĐT
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Gói
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Buổi
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Phòng
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Thời gian
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Trạng thái
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((o) => (
                <tr
                  key={o._id}
                  className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {o.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{o.email}</td>
                  <td className="px-4 py-3 text-slate-600">{o.phone}</td>
                  <td className="px-4 py-3 text-slate-600">{o.package}</td>
                  <td className="px-4 py-3 text-slate-600">{o.sessions}</td>
                  <td className="px-4 py-3 text-slate-600">{o.gym}</td>
                  <td className="px-4 py-3 text-slate-600">{o.schedule}</td>
                  <td className="px-4 py-3">
                    {o.status === "approved" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <Check className="w-3 h-3" /> Đã xác nhận
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                        <Clock className="w-3 h-3" /> Chờ xác nhận
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {o.status === "pending" && (
                        <button
                          onClick={() => handleApprove(o._id)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Xác nhận"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {o.status === "approved" && (
                        <button
                          onClick={() => handleEdit(o)}
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Cập nhật"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(o._id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Xóa"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedOrders.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Không có đơn hàng nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-600">
            Trang {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MODAL giữ nguyên như cũ, chỉ thay icon và giao diện đã có từ trước */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">
                {editingId ? "Cập nhật đơn hàng" : "Tạo đơn hàng mới"}
              </h2>
              <button
                onClick={resetForm}
                className="p-1 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Các input giống như đã có, không thay đổi */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <User className="w-4 h-4" /> Họ tên{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Nhập họ tên"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Mail className="w-4 h-4" /> Email{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="example@email.com"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Số điện thoại
                </label>
                <input
                  type="text"
                  name="phone"
                  placeholder="0901234567"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Package className="w-4 h-4" /> Gói tập
                  </label>
                  <select
                    name="package"
                    value={form.package}
                    onChange={handleChange}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="">Chọn gói</option>
                    <option value="Trail(Trải nghiệm)">
                      Trail(Trải nghiệm)
                    </option>
                    <option value="Cơ Bản(1-1)">Cơ Bản(1-1)</option>
                    <option value="Nâng Cao(1-1)">Nâng Cao(1-1)</option>
                    <option value="Vip(1-1)">Vip(1-1)</option>
                    <option value="Cơ Bản(Online)">Cơ Bản(Online)</option>
                    <option value="Nâng Cao(Online)">Nâng Cao(Online)</option>
                    <option value="Vip(Online)">Vip(Online)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Số buổi
                  </label>
                  <input
                    type="number"
                    name="sessions"
                    value={form.sessions}
                    onChange={handleChange}
                    placeholder="Số buổi"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Phòng tập
                  </label>
                  <select
                    name="gym"
                    value={form.gym}
                    onChange={handleChange}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="">Chọn phòng</option>
                    <option value="Waystation Trương Văn Hải">
                      Waystation Trương Văn Hải{" "}
                    </option>
                    <option value="Waystation Dân chủ">
                      Waystation Dân chủ{" "}
                    </option>
                    <option value="Waystation Hiệp Bình">
                      Waystation Hiệp Bình{" "}
                    </option>
                    <option value="Chung cư Flora Novia">
                      Chung cư Flora Novia{" "}
                    </option>
                    <option value="Waystation Nguyễn Xí">
                      Waystation Nguyễn Xí
                    </option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Thời gian
                  </label>
                  <input
                    name="schedule"
                    value={form.schedule}
                    onChange={handleChange}
                    placeholder="VD: Sáng 8h-10h"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Ghi chú
                </label>
                <textarea
                  name="note"
                  value={form.note}
                  onChange={handleChange}
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={resetForm}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={`${submitting ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {submitting ? "Đang xử lý..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
