const IncomingBankTransactionPagination = ({
  pagination,
  disabled,
  onPageChange,
}) => {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <nav
      aria-label="Phân trang giao dịch ngân hàng"
      className="flex items-center justify-between gap-3"
    >
      <button
        type="button"
        onClick={() => onPageChange(pagination.page - 1)}
        disabled={disabled || pagination.page <= 1}
        className="min-h-11 rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Trang trước
      </button>
      <span aria-live="polite" className="text-sm font-medium text-gray-600">
        Trang {pagination.page}/{pagination.totalPages} · {pagination.total} giao dịch
      </span>
      <button
        type="button"
        onClick={() => onPageChange(pagination.page + 1)}
        disabled={disabled || pagination.page >= pagination.totalPages}
        className="min-h-11 rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Trang sau
      </button>
    </nav>
  );
};

export default IncomingBankTransactionPagination;
