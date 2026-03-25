import { useEffect, useState } from "react";
import {
  User,
  Package,
  Calendar,
  Dumbbell,
  FileText,
  CheckCircle,
  History,
  ChevronLeft,
  ChevronRight,
  Clock,
  Phone,
  Mail,
  Info,
} from "lucide-react";

// Services
import { getOrders } from "../../services/order.service";
import { getCheckins, createCheckin } from "../../services/checkin.service";
import { getUserFromToken } from "../../utils/auth";

const muscles = [
  "Ngực",
  "Lưng",
  "Chân",
  "Vai",
  "Tay",
  "Bụng",
  "Cardio",
  "Boxing",
];

// Helper: chuyển đổi thời gian sang 24h
const formatTime24h = (timeStr) => {
  if (!timeStr) return "";
  let date = new Date(timeStr);
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
  const match = timeStr.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?$/i,
  );
  if (match) {
    let [_, day, month, year, hour, minute, ampm] = match;
    let h = parseInt(hour, 10);
    if (ampm) {
      if (ampm.toUpperCase() === "PM" && h !== 12) h += 12;
      if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
    }
    const hours = String(h).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minute}`;
  }
  return timeStr;
};

const Checkin = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [orders, setOrders] = useState([]);
  const [checkins, setCheckins] = useState([]);

  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedOrder, setSelectedOrder] = useState("");
  const [selectedOrderData, setSelectedOrderData] = useState(null);

  const [form, setForm] = useState({
    time: "",
    muscle: "",
    note: "",
  });

  // Phân trang cho lịch sử
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const user = getUserFromToken(); // Lấy user từ token

  // LOAD DATA
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const orderRes = await getOrders();
        const checkinRes = await getCheckins();

        setOrders(orderRes.data.data.orders || []);
        setCheckins(checkinRes.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await getOrders();
      setOrders(res.data.data.orders || []);
    } catch (err) {
      console.error("FETCH ORDERS ERROR:", err);
    }
  };

  const fetchCheckins = async () => {
    try {
      const res = await getCheckins();
      console.log("CHECKINS:", res.data);
      setCheckins(res.data.data);
    } catch (err) {
      console.error("FETCH CHECKINS ERROR:", err);
    }
  };

  // UNIQUE CUSTOMER
  // Nếu là admin, chỉ hiển thị khách hàng của các đơn chưa có trainer
  // Nếu là trainer, hiển thị tất cả khách của trainer đó (backend đã filter)
  const filteredOrdersForCustomer =
    user?.role === "admin" ? orders.filter((o) => !o.trainerId) : orders;

  const customers = [
    ...new Map(filteredOrdersForCustomer.map((o) => [o.email, o])).values(),
  ];

  // SELECT ORDER
  const handleSelectOrder = (id) => {
    const order = filteredOrdersForCustomer.find((o) => o._id === id);
    setSelectedOrder(id);
    setSelectedOrderData(order);
  };

  // INPUT
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // SUBMIT
  const handleSubmit = async () => {
    if (!selectedOrder) return alert("Chưa chọn gói");

    try {
      setSubmitting(true);

      await createCheckin({
        ...form,
        time: new Date(form.time).toISOString(),
        orderId: selectedOrder,
      });

      setForm({
        time: "",
        muscle: "",
        note: "",
      });

      await fetchOrders();
      await fetchCheckins();
    } catch (err) {
      alert("Check-in thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  // Phân trang lịch sử check-in
  const totalPages = Math.ceil(checkins.length / itemsPerPage);
  const paginatedCheckins = checkins.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Reset trang khi dữ liệu checkins thay đổi
  useEffect(() => {
    setCurrentPage(1);
  }, [checkins]);

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6 animate-pulse">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-6 bg-gray-300 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>

        {/* Form skeleton */}
        <div className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded md:col-span-2"></div>
          </div>
          <div className="h-10 bg-gray-300 rounded w-32"></div>
        </div>

        {/* Table skeleton */}
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-indigo-600" />
              Check‑in khách hàng
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Xác nhận buổi tập và ghi nhận lịch sử
            </p>
          </div>
          <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            Tổng lượt check‑in: {checkins.length}
          </div>
        </div>

        {/* Form check-in */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Chọn khách */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4" /> Khách hàng
              </label>
              <select
                value={selectedCustomer}
                onChange={(e) => {
                  setSelectedCustomer(e.target.value);
                  setSelectedOrder("");
                  setSelectedOrderData(null);
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Chọn khách hàng</option>
                {customers.map((c) => (
                  <option key={c.email} value={c.email}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Chọn gói */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Package className="w-4 h-4" /> Gói tập
              </label>
              <select
                value={selectedOrder}
                onChange={(e) => handleSelectOrder(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Chọn gói</option>
                {filteredOrdersForCustomer
                  .filter((o) => o.email === selectedCustomer)
                  .map((o) => (
                    <option key={o._id} value={o._id}>
                      {o.package} ({o.sessions} buổi còn lại)
                    </option>
                  ))}
              </select>
            </div>

            {/* Thời gian */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Thời gian
              </label>
              <input
                type="datetime-local"
                name="time"
                value={form.time}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Nhóm cơ */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Dumbbell className="w-4 h-4" /> Nhóm cơ
              </label>
              <select
                name="muscle"
                value={form.muscle}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Chọn nhóm cơ</option>
                {muscles.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Ghi chú (full width) */}
            <div className="md:col-span-2 space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Ghi chú
              </label>
              <input
                name="note"
                value={form.note}
                placeholder="Ghi chú thêm (nếu có)"
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Nút xác nhận */}
          <div className="mt-5 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={`
                relative px-6 py-2.5 rounded-lg font-medium text-white
                bg-gradient-to-r from-indigo-600 to-indigo-700
                hover:from-indigo-700 hover:to-indigo-800
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                transition-all duration-200 ease-in-out
                shadow-md hover:shadow-lg
                disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:from-indigo-600 disabled:hover:to-indigo-700
                flex items-center gap-2
              `}
            >
              {submitting ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Đang xử lý...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Checkin buổi tập
                </>
              )}
            </button>
          </div>
        </div>

        {/* Thông tin chi tiết gói tập (khi đã chọn) */}
        {selectedOrderData && (
          <div className="bg-linear-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Package className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  {selectedOrderData.name}
                  <span className="text-xs font-normal bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                    {selectedOrderData.package}
                  </span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-3">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>{selectedOrderData.phone || "Chưa có"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span>{selectedOrderData.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>
                      Ngày đăng ký:{" "}
                      {new Date(selectedOrderData.createdAt).toLocaleDateString(
                        "vi-VN",
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Info className="w-4 h-4 text-slate-400" />
                    <span>Số buổi còn lại: </span>
                    <span className="font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                      {selectedOrderData.sessions}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bảng lịch sử check-in */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-slate-800">Lịch sử check‑in</h3>
            </div>
            <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-full shadow-sm">
              {checkins.length} lượt
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    STT
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Tên
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Gói tập
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Thời gian
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Nhóm cơ
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Ghi chú
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Còn lại
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedCheckins.map((c, i) => (
                  <tr
                    key={c._id}
                    className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-500">
                      {(currentPage - 1) * itemsPerPage + i + 1}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {c.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.package}</td>
                    <td className="px-4 py-3 text-slate-600 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {formatTime24h(c.time)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Dumbbell className="w-3.5 h-3.5 text-slate-400" />{" "}
                        {c.muscle}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                      {c.note || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex justify-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                        {c.remainingSessions} buổi
                      </span>
                    </td>
                  </tr>
                ))}
                {paginatedCheckins.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      Chưa có lượt check‑in nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Phân trang */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-600">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Checkin;
