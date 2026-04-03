// ================= IMPORT =================
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import {
  Mail,
  Phone,
  Package,
  Calendar,
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Clock,
  Search,
  User,
  Link2,
  X,
} from "lucide-react";

import {
  getContactMessages,
  updateContactStatus,
  deleteContactMessage,
} from "../../services/contact.service";

// ================= COMPONENT =================
const ContactMessages = () => {
  const queryClient = useQueryClient();

  // ================= STATE =================
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const limit = 10;

  // ================= EFFECT =================
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchName);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchName]);

  // ================= QUERY =================
  const {
    data: messagesData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["contactMessages", currentPage, statusFilter, debouncedSearch],
    queryFn: () =>
      getContactMessages(
        currentPage,
        limit,
        statusFilter,
        debouncedSearch,
      ).then((res) => res.data),
    keepPreviousData: true,
  });

  const messages = messagesData?.data || [];
  const pagination = messagesData?.pagination || {
    total: 0,
    totalPages: 0,
    page: 1,
  };

  // ================= MUTATION =================
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => updateContactStatus(id, status),
    onSuccess: () => {
      toast.success("Cập nhật trạng thái thành công");
      queryClient.invalidateQueries({ queryKey: ["contactMessages"] });
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Cập nhật thất bại"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteContactMessage,
    onSuccess: () => {
      toast.success("Xóa liên hệ thành công");
      queryClient.invalidateQueries({ queryKey: ["contactMessages"] });
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Xóa thất bại"),
  });

  // ================= HANDLER =================
  const handleStatusChange = (id, newStatus) => {
    if (
      !window.confirm(
        `Đánh dấu là "${newStatus === "processed" ? "đã xử lý" : "chờ xử lý"}"?`,
      )
    )
      return;
    updateStatusMutation.mutate({ id, status: newStatus });
  };

  const handleDelete = (id) => {
    if (!window.confirm("Xóa liên hệ này?")) return;
    deleteMutation.mutate(id);
  };

  const handleViewDetail = (msg) => {
    setSelectedMessage(msg);
    setShowDetail(true);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("vi-VN");
  };

  // ================= EARLY RETURN =================
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-red-500">Lỗi tải dữ liệu: {error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
          <Mail className="w-6 h-6 text-red-500" />
          Quản lý liên hệ
        </h1>
        <p className="text-gray-500 mt-1">
          Danh sách các thông tin khách hàng đã gửi từ form liên hệ
        </p>
      </div>

      {/* Filter và Search */}
      <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm theo tên khách hàng..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-red-400 transition"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-400"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ xử lý</option>
            <option value="processed">Đã xử lý</option>
          </select>
          <div className="px-4 py-2 bg-gray-100 rounded-lg text-gray-600">
            Tổng: {pagination.total}
          </div>
        </div>
      </div>

      {/* Card Grid */}
      {messages.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">Không có dữ liệu liên hệ</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {messages.map((msg) => (
              <div
                key={msg._id}
                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden border border-gray-100"
              >
                {/* Header card */}
                <div className="px-4 py-3 border-b bg-gray-50">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <User size={18} className="text-gray-600" />
                      <span className="font-semibold text-gray-800">
                        {msg.name}
                      </span>
                    </div>
                    {msg.status === "pending" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                        <Clock className="w-3 h-3" /> Chờ xử lý
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle className="w-3 h-3" /> Đã xử lý
                      </span>
                    )}
                  </div>
                </div>

                {/* Nội dung card */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail size={16} />
                    <span className="truncate">{msg.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone size={16} />
                    <span>{msg.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Package size={16} />
                    <span className="font-medium">{msg.package}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar size={16} />
                    <span>{formatDateTime(msg.createdAt)}</span>
                  </div>
                </div>

                {/* Hành động */}
                <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
                  <button
                    onClick={() => handleViewDetail(msg)}
                    className="text-gray-600 hover:text-red-500 transition flex items-center gap-1 text-sm"
                  >
                    <Eye size={16} /> Chi tiết
                  </button>
                  <div className="flex gap-2">
                    {msg.status === "pending" && (
                      <button
                        onClick={() => handleStatusChange(msg._id, "processed")}
                        className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition"
                        title="Đánh dấu đã xử lý"
                      >
                        <CheckCircle size={18} />
                      </button>
                    )}
                    {msg.status === "processed" && (
                      <button
                        onClick={() => handleStatusChange(msg._id, "pending")}
                        className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition"
                        title="Chuyển về chờ xử lý"
                      >
                        <XCircle size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(msg._id)}
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
          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <button
                disabled={pagination.page === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition"
              >
                Trước
              </button>
              <span className="text-gray-600">
                Trang {pagination.page} / {pagination.totalPages}
              </span>
              <button
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition"
              >
                Sau
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal chi tiết */}
      {showDetail && selectedMessage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowDetail(false)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Mail className="w-5 h-5 text-red-500" />
                Chi tiết liên hệ
              </h2>
              <button
                onClick={() => setShowDetail(false)}
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
                  <p className="font-medium">{selectedMessage.name}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Số điện thoại
                  </label>
                  <p>{selectedMessage.phone}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Email
                  </label>
                  <p>{selectedMessage.email}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Gói tập quan tâm
                  </label>
                  <p className="font-semibold text-red-600">
                    {selectedMessage.package}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Ngày gửi
                  </label>
                  <p>{formatDateTime(selectedMessage.createdAt)}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Trạng thái
                  </label>
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium ml-2 ${selectedMessage.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}
                  >
                    {selectedMessage.status === "pending"
                      ? "Chờ xử lý"
                      : "Đã xử lý"}
                  </span>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 uppercase">
                    Trang cá nhân (Facebook/Zalo)
                  </label>
                  <a
                    href={selectedMessage.social}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-red-500 hover:underline break-all block"
                  >
                    {selectedMessage.social}
                  </a>
                </div>
              </div>
            </div>
            <div className="border-t px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowDetail(false)}
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

export default ContactMessages;
