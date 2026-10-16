import { useEffect, useRef } from "react";
import { PencilRuler, TrendingUp, X } from "lucide-react";
import { useModalScrollLock } from "../../../hooks/useModalScrollLock";

const Choice = ({ icon: Icon, tone, title, text, points, cta, onClick, disabled, current = false }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="grid gap-2 rounded-2xl border-2 border-slate-200 bg-white p-5 text-left transition-colors hover:border-orange-400 disabled:opacity-60"
  >
    <span className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}>
      <Icon size={22} aria-hidden="true" />
    </span>
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-lg font-extrabold uppercase text-slate-800">{title}</span>
      {current && (
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Đang dùng</span>
      )}
    </span>
    <span className="text-sm text-slate-600">{text}</span>
    <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-500">
      {points.map((point) => (
        <li key={point}>{point}</li>
      ))}
    </ul>
    <span className="mt-1 inline-flex w-fit rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
      {cta}
    </span>
  </button>
);

// Chọn cách dựng giai đoạn: hệ thống đề xuất theo NASM hoặc HLV tự thiết kế.
const F1PredictionModeDialog = ({
  customer,
  stageOrder = 1,
  warning = "",
  busy = false,
  currentMode = null,
  locked = false,
  canRegenerate = false,
  onSystem,
  onTrainer,
  onClose,
}) => {
  const closeRef = useRef(null);
  useModalScrollLock(true);
  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, busy]);

  const isFirst = stageOrder === 1;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose?.();
      }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="f1-mode-title" className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <p className="text-sm text-slate-500">
              {customer?.fullName} · {customer?.code || "--"}
            </p>
            <h2 id="f1-mode-title" className="text-2xl font-extrabold text-slate-800">
              {currentMode ? "Thay đổi dự đoán" : isFirst ? "Tạo dự đoán kết quả" : `Thêm giai đoạn ${stageOrder}`}
            </h2>
            <p className="text-sm text-slate-500">
              {currentMode ? `Chọn cách dựng từ giai đoạn ${stageOrder} trở đi` : `Chọn cách dựng giai đoạn ${stageOrder} cho khách`}
            </p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} disabled={busy} aria-label="Đóng" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-60">
            <X size={18} />
          </button>
        </header>
        <div className="space-y-4 px-6 py-5">
          {warning && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{warning}</p>}
          {currentMode && (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {locked
                ? "Khách hàng này đã thay đổi cách dự đoán một lần nên không thể thay đổi nữa."
                : "Mỗi khách chỉ đổi cách dự đoán được một lần. Các giai đoạn đã tạo giữ nguyên cách dựng cũ."}
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Choice
              icon={TrendingUp}
              tone="bg-orange-50 text-orange-700"
              title="Dự đoán lộ trình tập"
              text={
                isFirst
                  ? "Hệ thống đề xuất giai đoạn theo khung NASM từ kết quả khảo sát, đánh giá thể chất và phân tích tự động."
                  : `HLV nhập kết quả cuối giai đoạn ${stageOrder - 1}, cập nhật mục tiêu rồi hệ thống đề xuất giai đoạn ${stageOrder}.`
              }
              points={["Tự chọn giai đoạn và số tuần", "Bảng dự đoán theo công thức có nguồn tham khảo", "Nhanh, phù hợp đa số khách"]}
              cta={busy ? "Đang tạo..." : currentMode === "system" && !canRegenerate ? "Đang dùng" : "Dùng đề xuất của hệ thống"}
              onClick={onSystem}
              disabled={busy || locked}
              current={currentMode === "system"}
            />
            <Choice
              icon={PencilRuler}
              tone="bg-violet-50 text-violet-700"
              title="Thiết kế lộ trình tập cá nhân"
              text={
                isFirst
                  ? "HLV tự thiết kế giai đoạn 1 cho khách thích nghi nhanh hoặc có nhu cầu riêng."
                  : `HLV nhập kết quả cuối giai đoạn ${stageOrder - 1}, cập nhật mục tiêu rồi tự thiết kế giai đoạn ${stageOrder}.`
              }
              points={["Tự chọn giai đoạn NASM, số tuần, lịch tập", "Tự viết trọng tâm, thay đổi, điều kiện chuyển tiếp", "Hệ thống vẫn tính bảng dự đoán, HLV chỉnh được"]}
              cta={currentMode === "trainer" && !canRegenerate ? "Đang dùng" : "Tự thiết kế"}
              onClick={onTrainer}
              disabled={busy || locked}
              current={currentMode === "trainer"}
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default F1PredictionModeDialog;
