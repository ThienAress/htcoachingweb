import { useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import {
  DEFAULT_LOGIN_PROMO,
  MAX_LOGIN_PROMO_PERCENT,
  MIN_LOGIN_PROMO_PERCENT,
} from "../../../utils/pricingContent";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

// Ưu đãi giảm giá cho lần đăng ký đầu có tài khoản. Khách xuất trình mã khi liên hệ; hệ thống không tự trừ tiền.
const LoginPromoEditor = ({ promo, busy, onSave, onReset }) => {
  const [enabled, setEnabled] = useState(promo.enabled);
  const [percentText, setPercentText] = useState(String(promo.percent));
  const [synced, setSynced] = useState(`${promo.enabled}-${promo.percent}`);
  const [error, setError] = useState("");

  const serverKey = `${promo.enabled}-${promo.percent}`;
  if (serverKey !== synced) {
    setSynced(serverKey);
    setEnabled(promo.enabled);
    setPercentText(String(promo.percent));
    setError("");
  }

  const percent = Number(percentText);
  const dirty = enabled !== promo.enabled || percentText !== String(promo.percent);
  const isDefault =
    promo.enabled === DEFAULT_LOGIN_PROMO.enabled && promo.percent === DEFAULT_LOGIN_PROMO.percent;

  const handleSave = () => {
    if (
      percentText.trim() === ""
      || !Number.isInteger(percent)
      || percent < MIN_LOGIN_PROMO_PERCENT
      || percent > MAX_LOGIN_PROMO_PERCENT
    ) {
      setError(`Phần trăm giảm phải là số nguyên từ ${MIN_LOGIN_PROMO_PERCENT} đến ${MAX_LOGIN_PROMO_PERCENT}`);
      return;
    }
    setError("");
    onSave({ enabled, percent });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-slate-800">Ưu đãi lần đăng ký đầu</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            promo.enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {promo.enabled ? `Đang bật · giảm ${promo.percent}%` : "Đang tắt"}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Hiện ở hộp thoại đăng nhập khi khách chọn gói, ở trang đăng ký và hộp thoại xác nhận. Khách nhận mã và
        xuất trình khi liên hệ; hệ thống không tự trừ tiền.
      </p>

      <label className="mt-4 flex min-h-11 items-center gap-3 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => {
            setEnabled(event.target.checked);
            setError("");
          }}
          className="h-5 w-5 rounded border-slate-300 text-primary focus-visible:ring-2 focus-visible:ring-orange-300"
        />
        Bật ưu đãi cho khách đăng ký lần đầu
      </label>

      <label htmlFor="login-promo-percent" className="mt-3 block text-sm font-medium text-slate-700">
        Phần trăm giảm
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          id="login-promo-percent"
          type="number"
          inputMode="numeric"
          min={MIN_LOGIN_PROMO_PERCENT}
          max={MAX_LOGIN_PROMO_PERCENT}
          value={percentText}
          onChange={(event) => {
            setPercentText(event.target.value);
            setError("");
          }}
          aria-invalid={Boolean(error)}
          className="w-28 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus-visible:border-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200"
        />
        <span className="text-sm text-slate-600">%</span>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || !dirty}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary-dark focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
        >
          <Save size={16} aria-hidden="true" />
          Lưu
        </button>
        {!isDefault && (
          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Khôi phục mặc định
          </button>
        )}
      </div>
    </section>
  );
};

export default LoginPromoEditor;
