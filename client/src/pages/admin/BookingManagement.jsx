import { useEffect, useState } from "react";
import {
  getBookings,
  updateBookingStatus,
  deleteBooking,
} from "../../services/booking.service";
import {
  PhoneCall,
  CheckCircle,
  XCircle,
  Trash2,
  Search,
  Eye,
  Package,
  MapPin,
  Calendar,
  Tag,
  Gift,
  Mail,
  Phone,
  User,
  Clock,
} from "lucide-react";

const BookingManagement = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await getBookings(page, 9, filterStatus, search);
      setBookings(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [page, filterStatus, search]);

  const handleStatusUpdate = async (id, status) => {
    if (!window.confirm(`Xác nhận chuyển trạng thái thành "${status}"?`))
      return;
    try {
      await updateBookingStatus(id, status);
      fetchBookings();
    } catch (err) {
      alert("Lỗi cập nhật");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Xóa booking này?")) return;
    try {
      await deleteBooking(id);
      fetchBookings();
    } catch (err) {
      alert("Lỗi xóa");
    }
  };

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    contacted: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
  };
  const statusLabels = {
    pending: "Chờ xử lý",
    contacted: "Đã liên hệ",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
  };

  const openDetail = (booking) => {
    setSelectedBooking(booking);
    setShowDetailModal(true);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("vi-VN");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          Quản lý đặt hàng
        </h1>
        <p className="text-gray-500 mt-1">
          Quản lý các yêu cầu tư vấn từ khách hàng
        </p>
      </div>

      {/* Filter và Search */}
      <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm theo tên, email, số điện thoại..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-red-400 transition"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-400"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ xử lý</option>
            <option value="contacted">Đã liên hệ</option>
            <option value="completed">Hoàn thành</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </div>
      </div>

      {/* Card Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">Không có dữ liệu</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bookings.map((booking) => (
              <div
                key={booking._id}
                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden border border-gray-100"
              >
                {/* Header card với trạng thái */}
                <div
                  className={`px-4 py-3 border-b ${statusColors[booking.status]} bg-opacity-50`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <User size={18} className="text-gray-600" />
                      <span className="font-semibold text-gray-800">
                        {booking.name}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[booking.status]}`}
                    >
                      {statusLabels[booking.status]}
                    </span>
                  </div>
                </div>

                {/* Nội dung card */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone size={16} />
                    <span>{booking.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail size={16} />
                    <span className="truncate">{booking.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Package size={16} />
                    <span className="font-medium">{booking.package}</span>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                      {booking.sessions} buổi
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin size={16} />
                    <span>{booking.gym}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar size={16} />
                    <span className="truncate">{booking.schedule}</span>
                  </div>
                  {/* === THÊM DÒNG THỜI GIAN GỬI === */}
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock size={16} />
                    <span>{formatDateTime(booking.createdAt)}</span>
                  </div>
                  {booking.discountCode && (
                    <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded-lg">
                      <Tag size={16} />
                      <span className="font-mono font-bold">
                        {booking.discountCode}
                      </span>
                    </div>
                  )}
                  {booking.gifts && booking.gifts.length > 0 && (
                    <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded-lg">
                      <Gift size={16} className="mt-0.5" />
                      <span className="line-clamp-2">
                        {booking.gifts.join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Hành động */}
                <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
                  <button
                    onClick={() => openDetail(booking)}
                    className="text-gray-600 hover:text-red-500 transition flex items-center gap-1 text-sm"
                  >
                    <Eye size={16} /> Chi tiết
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        handleStatusUpdate(booking._id, "contacted")
                      }
                      className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition"
                      title="Đã liên hệ"
                    >
                      <PhoneCall size={18} />
                    </button>
                    <button
                      onClick={() =>
                        handleStatusUpdate(booking._id, "completed")
                      }
                      className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition"
                      title="Hoàn thành"
                    >
                      <CheckCircle size={18} />
                    </button>
                    <button
                      onClick={() =>
                        handleStatusUpdate(booking._id, "cancelled")
                      }
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Hủy"
                    >
                      <XCircle size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(booking._id)}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                      title="Xóa"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-center items-center gap-4 mt-8">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition"
            >
              Trước
            </button>
            <span className="text-gray-600">
              Trang {page} / {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition"
            >
              Sau
            </button>
          </div>
        </>
      )}

      {/* Modal chi tiết booking */}
      {showDetailModal && selectedBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">
                Chi tiết đăng ký
              </h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Họ tên
                  </label>
                  <p className="font-medium">{selectedBooking.name}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Số điện thoại
                  </label>
                  <p>{selectedBooking.phone}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Email
                  </label>
                  <p>{selectedBooking.email}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Gói tập
                  </label>
                  <p>{selectedBooking.package}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Số buổi
                  </label>
                  <p>{selectedBooking.sessions}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Phòng tập
                  </label>
                  <p>{selectedBooking.gym}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 uppercase">
                    Lịch tập
                  </label>
                  <p>{selectedBooking.schedule}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 uppercase">
                    Ghi chú
                  </label>
                  <p className="whitespace-pre-wrap">
                    {selectedBooking.note || "Không có"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Mã giảm giá
                  </label>
                  <p>{selectedBooking.discountCode || "—"}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Quà tặng
                  </label>
                  <p>{selectedBooking.gifts?.join(", ") || "—"}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Trạng thái
                  </label>
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs ${statusColors[selectedBooking.status]}`}
                  >
                    {statusLabels[selectedBooking.status]}
                  </span>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Ngày đăng ký
                  </label>
                  <p>{formatDateTime(selectedBooking.createdAt)}</p>
                </div>
              </div>
            </div>
            <div className="border-t px-6 py-4 flex justify-end gap-2">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-gray-200 rounded-lg"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingManagement;
