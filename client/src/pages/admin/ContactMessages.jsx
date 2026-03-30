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

  // ================= EARLY RETURN =================
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-300 rounded w-1/3"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-gray-200 rounded"></div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 text-center text-red-500">
        Lỗi tải dữ liệu: {error?.message}
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Mail className="w-6 h-6 text-indigo-600" />
            Quản lý liên hệ
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Danh sách các thông tin khách hàng đã gửi từ form liên hệ
          </p>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên khách hàng..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Tất cả</option>
            <option value="pending">Chờ xử lý</option>
            <option value="processed">Đã xử lý</option>
          </select>
          <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            Tổng: {pagination.total}
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  STT
                </th>
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
                  Ngày gửi
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
              {messages.map((msg, idx) => (
                <tr
                  key={msg._id}
                  className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3 text-slate-500">
                    {(pagination.page - 1) * limit + idx + 1}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {msg.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{msg.email}</td>
                  <td className="px-4 py-3 text-slate-600">{msg.phone}</td>
                  <td className="px-4 py-3 text-slate-600">{msg.package}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(msg.createdAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-4 py-3">
                    {msg.status === "pending" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                        <Clock className="w-3 h-3" /> Chờ xử lý
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle className="w-3 h-3" /> Đã xử lý
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewDetail(msg)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Xem chi tiết"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {msg.status === "pending" && (
                        <button
                          onClick={() =>
                            handleStatusChange(msg._id, "processed")
                          }
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                          title="Đánh dấu đã xử lý"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {msg.status === "processed" && (
                        <button
                          onClick={() => handleStatusChange(msg._id, "pending")}
                          className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg"
                          title="Chuyển về chờ xử lý"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(msg._id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Xóa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {messages.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Không có dữ liệu liên hệ.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {messages.map((msg) => (
          <div
            key={msg._id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-4"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-semibold text-slate-800">{msg.name}</h3>
                <p className="text-sm text-slate-500">{msg.email}</p>
              </div>
              {msg.status === "pending" ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                  Chờ xử lý
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  Đã xử lý
                </span>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-4 h-4 text-slate-400" />
                {msg.phone}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Package className="w-4 h-4 text-slate-400" />
                {msg.package}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400" />
                {new Date(msg.createdAt).toLocaleString("vi-VN")}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => handleViewDetail(msg)}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <Eye className="w-4 h-4" />
              </button>
              {msg.status === "pending" && (
                <button
                  onClick={() => handleStatusChange(msg._id, "processed")}
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
              )}
              {msg.status === "processed" && (
                <button
                  onClick={() => handleStatusChange(msg._id, "pending")}
                  className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => handleDelete(msg._id)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-center py-8 text-slate-500 bg-white rounded-xl shadow-sm border">
            Không có dữ liệu liên hệ.
          </div>
        )}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={pagination.page === 1}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-600">
            Trang {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() =>
              setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))
            }
            disabled={pagination.page === pagination.totalPages}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modal chi tiết */}
      {showDetail && selectedMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Mail className="w-5 h-5 text-indigo-600" />
                Chi tiết liên hệ
              </h2>
              <button
                onClick={() => setShowDetail(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Họ tên</p>
                      <p className="text-base font-medium text-slate-800">
                        {selectedMessage.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <Mail className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Email</p>
                      <p className="text-base text-slate-800">
                        {selectedMessage.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <Phone className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Số điện thoại</p>
                      <p className="text-base text-slate-800">
                        {selectedMessage.phone}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Gói tập quan tâm</p>
                      <p className="text-base font-semibold text-indigo-600">
                        {selectedMessage.package}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Ngày gửi</p>
                      <p className="text-base text-slate-800">
                        {new Date(selectedMessage.createdAt).toLocaleString(
                          "vi-VN",
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      {selectedMessage.status === "pending" ? (
                        <Clock className="w-5 h-5 text-yellow-600" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Trạng thái</p>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          selectedMessage.status === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {selectedMessage.status === "pending" ? (
                          <>
                            <Clock className="w-3 h-3" /> Chờ xử lý
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3 h-3" /> Đã xử lý
                          </>
                        )}
                      </span>
                      {selectedMessage.processedAt && (
                        <p className="text-xs text-slate-500 mt-1">
                          Xử lý lúc:{" "}
                          {new Date(selectedMessage.processedAt).toLocaleString(
                            "vi-VN",
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Link2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 mb-1">
                      Trang cá nhân (Facebook/Zalo)
                    </p>
                    <a
                      href={selectedMessage.social}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:underline break-all"
                    >
                      {selectedMessage.social}
                    </a>
                  </div>
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowDetail(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
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
