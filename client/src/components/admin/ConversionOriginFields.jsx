import { useId } from "react";

const optionLabel = (item) => {
  const createdAt = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString("vi-VN")
    : "Chưa rõ ngày";
  return [item.name || "Không có tên", item.package || "Chưa rõ gói", createdAt]
    .filter(Boolean)
    .join(" · ");
};

export default function ConversionOriginFields({
  originType,
  originId,
  onTypeChange,
  onIdChange,
  bookings,
  contacts,
  isLoading,
  isError,
  onRetry,
  error,
}) {
  const fieldId = useId();
  const typeId = `${fieldId}-type`;
  const recordId = `${fieldId}-record`;
  const hintId = `${fieldId}-hint`;
  const validationId = `${fieldId}-validation`;
  const loadErrorId = `${fieldId}-load-error`;
  const options = originType === "booking" ? bookings : contacts;

  return (
    <fieldset className="border-t border-zinc-200 pt-5">
      <legend className="px-1 text-sm font-semibold text-zinc-900">
        Nguồn chuyển đổi (không bắt buộc)
      </legend>
      <p id={hintId} className="mt-1 text-sm leading-6 text-zinc-600">
        Chỉ chọn khi bạn biết chính xác hồ sơ này đến từ Booking hoặc Contact nào.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={typeId} className="text-sm font-medium text-zinc-700">
            Loại nguồn
          </label>
          <select
            id={typeId}
            value={originType}
            aria-describedby={hintId}
            onChange={(event) => {
              onTypeChange(event.target.value);
              onIdChange("");
            }}
            className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
          >
            <option value="">Không gắn nguồn</option>
            <option value="booking">Booking</option>
            <option value="contact">Contact</option>
          </select>
        </div>
        <div>
          <label htmlFor={recordId} className="text-sm font-medium text-zinc-700">
            Bản ghi nguồn
          </label>
          <select
            id={recordId}
            value={originId}
            aria-invalid={Boolean(error)}
            aria-describedby={
              [hintId, error ? validationId : "", isError ? loadErrorId : ""]
                .filter(Boolean)
                .join(" ")
            }
            onChange={(event) => onIdChange(event.target.value)}
            disabled={!originType || isLoading || isError}
            className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
          >
            <option value="">
              {isLoading
                ? "Đang tải nguồn..."
                : originType
                  ? "Chọn bản ghi chính xác"
                  : "Chọn loại nguồn trước"}
            </option>
            {options.map((item) => (
              <option key={item._id} value={item._id}>
                {optionLabel(item)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {originType && !isLoading && !isError && options.length === 0 && (
        <p className="mt-2 text-sm text-amber-800">
          Không có bản ghi phù hợp trong danh sách gần đây.
        </p>
      )}
      {error && (
        <p id={validationId} className="mt-2 text-sm font-medium text-rose-700" role="alert">
          {error}
        </p>
      )}
      {isError && (
        <div
          id={loadErrorId}
          className="mt-2 flex flex-wrap items-center gap-2 text-sm text-rose-700"
          role="alert"
        >
          <span>Không thể tải nguồn chuyển đổi.</span>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 rounded-lg px-3 py-2 font-semibold underline underline-offset-4 transition hover:text-rose-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
          >
            Thử lại
          </button>
        </div>
      )}
    </fieldset>
  );
}
