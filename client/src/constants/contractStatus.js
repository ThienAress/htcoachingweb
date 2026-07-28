export const CONTRACT_STATUS_META = Object.freeze({
  draft: { label: "Nháp", color: "bg-slate-100 text-slate-600", icon: "edit" },
  sent: { label: "Đã gửi", color: "bg-blue-100 text-blue-700", icon: "send" },
  viewed: { label: "Đã xem", color: "bg-indigo-100 text-indigo-700", icon: "view" },
  signing: { label: "Đang ký", color: "bg-amber-100 text-amber-700", icon: "pending" },
  signed: { label: "Đã ký", color: "bg-emerald-100 text-emerald-700", icon: "signed" },
  expired: { label: "Hết hạn", color: "bg-slate-100 text-slate-500", icon: "warning" },
  cancelled: { label: "Đã hủy", color: "bg-red-100 text-red-600", icon: "cancelled" },
});
