import {
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";

/**
 * Badge trạng thái đơn hàng (approved, pending, failed, etc.)
 */
export const getStatusBadge = (status) => {
  switch (status?.toLowerCase()) {
    case "approved":
    case "active":
    case "success":
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle size={11} />
          Đã thanh toán
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Clock size={11} />
          Chờ thanh toán
        </span>
      );
    case "failed":
    case "cancelled":
    case "expired":
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <AlertCircle size={11} />
          Hủy bỏ / Hết hạn
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">
          <Clock size={11} />
          {status || "Không rõ"}
        </span>
      );
  }
};

/**
 * Badge phân loại giao dịch (deposit, purchase, refund, etc.)
 */
export const getTxTypeBadge = (type) => {
  switch (type) {
    case "deposit":
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Nạp tiền
        </span>
      );
    case "purchase":
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
          Mua hàng
        </span>
      );
    case "refund":
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
          Hoàn tiền
        </span>
      );
    case "adjustment":
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          Điều chỉnh
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-500/10 text-gray-400 border border-gray-500/20">
          Khác
        </span>
      );
  }
};
