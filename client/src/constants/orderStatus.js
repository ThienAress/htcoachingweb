export const ORDER_STATUS_META = Object.freeze({
  pending: {
    label: "Chờ xác nhận",
    badgeClass: "bg-yellow-100 text-yellow-700",
    headerClass: "bg-[#fef9c2]",
  },
  approved: {
    label: "Đã xác nhận",
    badgeClass: "bg-green-100 text-green-700",
    headerClass: "bg-[#dbfce7]",
  },
  completed: {
    label: "Đã hoàn thành",
    badgeClass: "bg-blue-100 text-blue-700",
    headerClass: "bg-blue-50",
  },
  cancelled: {
    label: "Đã hủy",
    badgeClass: "bg-red-100 text-red-700",
    headerClass: "bg-red-50",
  },
});

export const getOrderStatusMeta = (status) =>
  ORDER_STATUS_META[status] || {
    label: status || "Không xác định",
    badgeClass: "bg-gray-100 text-gray-700",
    headerClass: "bg-gray-50",
  };
