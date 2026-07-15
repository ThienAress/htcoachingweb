import {
  ShoppingBag,
  Search,
  X,
} from "lucide-react";
import { getStatusBadge } from "./StatusBadges";

function OrdersTab({ filteredOrders, orderFilter, setOrderFilter, orderSearch, setOrderSearch }) {
  return (
    <div className="animate-tab-fade bg-gray-800/20 backdrop-blur-md rounded-2xl border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">

      {/* Top Header stats */}
      <div className="pb-4 border-b border-white/5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <div>
          <span className="text-xs text-gray-400 font-semibold block uppercase tracking-wider">Đang hiển thị</span>
          <span className="text-2xl font-black text-white block mt-1">
            {filteredOrders.length} đơn hàng
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
        <input
          type="text"
          placeholder="Tìm theo mã đơn hoặc gói tập..."
          value={orderSearch}
          onChange={(e) => setOrderSearch(e.target.value)}
          className="w-full bg-black/50 border border-white/10 rounded-full py-2.5 pl-11 pr-4 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-500 transition-all"
        />
        {orderSearch && (
          <button onClick={() => setOrderSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter Capsule Pills */}
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          onClick={() => setOrderFilter("all")}
          className={`px-4 py-2 rounded-full font-bold transition-all cursor-pointer ${orderFilter === "all"
            ? "bg-slate-700 text-white shadow-md"
            : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
            }`}
        >
          Tất cả
        </button>

        <button
          onClick={() => setOrderFilter("hlv")}
          className={`px-4 py-2 rounded-full font-bold transition-all cursor-pointer ${orderFilter === "hlv"
            ? "bg-slate-700 text-white shadow-md"
            : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
            }`}
        >
          Đơn hàng Huấn luyện viên
        </button>

        <button
          onClick={() => setOrderFilter("pt")}
          className={`px-4 py-2 rounded-full font-bold transition-all cursor-pointer ${orderFilter === "pt"
            ? "bg-slate-700 text-white shadow-md"
            : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
            }`}
        >
          Đơn hàng Khách PT
        </button>
      </div>

      {/* Orders rows list */}
      {filteredOrders.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <ShoppingBag className="mx-auto mb-3 opacity-30 text-gray-400" size={40} />
          <p className="text-sm">Không tìm thấy đơn hàng nào phù hợp.</p>
        </div>
      ) : (
        <div className="divide-y divide-white/5 border-t border-white/5">
          {filteredOrders.map((order) => (
            <div
              key={order._id}
              className="py-5 flex items-center justify-between gap-4 transition-all duration-150 hover:bg-white/5 px-2 rounded-xl"
            >
              {/* Left column */}
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-extrabold text-white text-sm uppercase tracking-wider">
                    #{order._id.substring(order._id.length - 8).toUpperCase()}
                  </span>
                  <span className="text-[9px] font-bold bg-white/5 border border-white/15 px-2.5 py-0.5 rounded text-orange-400 uppercase tracking-wider">
                    {order.typeLabel}
                  </span>
                </div>
                <span className="text-[11px] text-gray-500 block">
                  {order.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "N/A"}
                </span>
                <span className="text-xs text-gray-300 block font-semibold pt-0.5">
                  {order.title}
                </span>
                <span className="text-[11px] text-gray-400 block font-medium">
                  {order.subtitle}
                </span>
              </div>

              {/* Right column: Status */}
              <div className="text-right">
                {getStatusBadge(order.status)}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

export default OrdersTab;
