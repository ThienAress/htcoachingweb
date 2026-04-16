import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  User,
  Mail,
  Phone,
  Package,
  Calendar,
  MapPin,
  Clock,
  Search,
} from "lucide-react";

import { getOrders } from "../../services/order.service";

const TrainerDashboard = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const {
    data: orders = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["orders"],
    queryFn: () => getOrders().then((res) => res.data.data.orders || []),
  });

  // Lọc khách hàng theo tên
  const filteredOrders = orders.filter((order) =>
    order.name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-8 bg-gray-300 rounded w-1/3"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-red-500">
        Lỗi tải dữ liệu: {error?.message}
        <button
          onClick={() => refetch()}
          className="ml-4 px-3 py-1 bg-blue-500 text-white rounded"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <User className="w-6 h-6 text-primary" />
            KHÁCH HÀNG CỦA BẠN
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Danh sách khách hàng được phân công phụ trách
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Ô tìm kiếm */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên khách hàng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            Tổng số khách: {orders.length}
          </div>
        </div>
      </div>

      {/* Table - Desktop */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr
                  key={order._id}
                  className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {order.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{order.email}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {order.phone || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{order.package}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex justify-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                      {order.sessions} buổi
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {order.gym || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {order.schedule || "—"}
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    {searchTerm
                      ? "Không tìm thấy khách hàng phù hợp."
                      : "Không có khách hàng nào được phân công."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Card View - Mobile & Tablet */}
      <div className="md:hidden space-y-4">
        {filteredOrders.map((order) => (
          <div
            key={order._id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-800">{order.name}</h3>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                {order.sessions} buổi
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="truncate">{order.email}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{order.phone || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Package className="w-4 h-4 text-slate-400" />
                <span>{order.package}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>{order.gym || "—"}</span>
              </div>
              <div className="col-span-2 flex items-center gap-2 text-slate-600">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{order.schedule || "—"}</span>
              </div>
            </div>
          </div>
        ))}
        {filteredOrders.length === 0 && (
          <div className="text-center py-8 text-slate-500 bg-white rounded-xl shadow-sm border">
            {searchTerm
              ? "Không tìm thấy khách hàng phù hợp."
              : "Không có khách hàng nào được phân công."}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainerDashboard;
