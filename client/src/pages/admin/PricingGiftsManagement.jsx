import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, RotateCcw, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { invalidateByKey } from "../../queries/invalidation";
import { adminQueryKeys } from "../../queries/queryKeys";
import {
  getSiteSettings,
  resetPricingGifts,
  savePricingGifts,
} from "../../services/siteSetting.service";
import {
  MAX_PRICING_GIFTS,
  MAX_PRICING_GIFT_LENGTH,
  PRICING_GIFT_PLANS,
  giftsFromText,
  giftsToText,
  resolvePricingGifts,
  validateGifts,
} from "../../utils/pricingGifts";

// Quà mặc định (khi admin chưa lưu) lấy từ bản dịch tiếng Việt, giống những gì trang chủ đang hiện.
const useDefaultGifts = () => {
  const { i18n } = useTranslation("home");
  const tVi = i18n.getFixedT("vi", "home");
  const shaker = tVi("pricing.gifts.shaker");
  const biscotti = tVi("pricing.gifts.biscotti");
  const backpack = tVi("pricing.gifts.backpack");
  return {
    "1-1-basic": [shaker],
    "1-1-advanced": [shaker, biscotti],
    "1-1-vip": [backpack, shaker, biscotti],
  };
};

const GiftEditor = ({ item, saved, defaults, onSave, onReset, busy }) => {
  const isCustom = Array.isArray(saved);
  const serverText = giftsToText(resolvePricingGifts({ [item.key]: saved }, item.key, defaults));
  const [text, setText] = useState(serverText);
  const [syncedText, setSyncedText] = useState(serverText);
  const [error, setError] = useState("");

  // Dữ liệu từ máy chủ đổi (sau khi lưu hoặc khôi phục) thì nạp lại ô nhập.
  if (serverText !== syncedText) {
    setSyncedText(serverText);
    setText(serverText);
    setError("");
  }

  const gifts = giftsFromText(text);
  const dirty = giftsToText(gifts) !== serverText;
  const fieldId = `gifts-${item.key}`;

  const handleSave = () => {
    const message = validateGifts(gifts);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    onSave(item.key, gifts);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-800">
          {item.tab} · {item.plan}
        </h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isCustom ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {isCustom ? "Đã chỉnh" : "Đang dùng mặc định"}
        </span>
      </div>

      <label htmlFor={fieldId} className="mt-3 block text-sm font-medium text-slate-700">
        Danh sách quà tặng
      </label>
      <textarea
        id={fieldId}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setError("");
        }}
        rows={Math.min(8, Math.max(3, gifts.length + 1))}
        aria-invalid={Boolean(error)}
        aria-describedby={`${fieldId}-help`}
        placeholder="Ví dụ: Shaker bình lắc cao cấp 600ml"
        className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus-visible:border-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200"
      />
      <p id={`${fieldId}-help`} className="mt-1 text-xs text-slate-500">
        Mỗi dòng là một quà tặng (tối đa {MAX_PRICING_GIFTS} quà, mỗi quà tối đa {MAX_PRICING_GIFT_LENGTH} ký tự). Để trống
        nếu gói này không có quà.
      </p>
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
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={16} aria-hidden="true" />
          Lưu
        </button>
        {isCustom && (
          <button
            type="button"
            onClick={() => onReset(item.key)}
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw size={16} aria-hidden="true" />
            Khôi phục mặc định
          </button>
        )}
      </div>
    </section>
  );
};

const PricingGiftsManagement = () => {
  const queryClient = useQueryClient();
  const defaults = useDefaultGifts();

  const { data: settingsResponse, isLoading, isError, refetch } = useQuery({
    queryKey: adminQueryKeys.siteSettings.all(),
    queryFn: async () => {
      const res = await getSiteSettings();
      return res.data;
    },
  });

  const refresh = () => invalidateByKey(queryClient, adminQueryKeys.siteSettings.all());

  const saveMutation = useMutation({
    mutationFn: ({ key, gifts }) => savePricingGifts(key, gifts),
    onSuccess: () => {
      toast.success("Đã lưu quà tặng. Bảng giá trên trang chủ sẽ cập nhật ngay.");
      refresh();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Không thể lưu quà tặng. Vui lòng thử lại.");
    },
  });

  const resetMutation = useMutation({
    mutationFn: (key) => resetPricingGifts(key),
    onSuccess: () => {
      toast.success("Đã khôi phục quà tặng mặc định.");
      refresh();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Không thể khôi phục. Vui lòng thử lại.");
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Đang tải dữ liệu...</div>;
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
        <p className="font-semibold text-red-700">Không thể tải cấu hình quà tặng.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-5 min-h-11 rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Thử lại
        </button>
      </div>
    );
  }

  const overrides = settingsResponse?.data?.pricingGifts || {};
  const busy = saveMutation.isPending || resetMutation.isPending;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <Gift aria-hidden="true" className="h-6 w-6 text-primary" />
          Quà tặng gói tập
        </h1>
        <p className="mt-1 text-slate-500">
          Nội dung quà tặng hiện trong từng thẻ gói ở bảng giá trang chủ. Lưu xong là trang chủ cập nhật.
        </p>
      </div>

      {PRICING_GIFT_PLANS.map((item) => (
        <GiftEditor
          key={item.key}
          item={item}
          saved={overrides[item.key]}
          defaults={defaults[item.key] || []}
          busy={busy}
          onSave={(key, gifts) => saveMutation.mutate({ key, gifts })}
          onReset={(key) => resetMutation.mutate(key)}
        />
      ))}
    </div>
  );
};

export default PricingGiftsManagement;
