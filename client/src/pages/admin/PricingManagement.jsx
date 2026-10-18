import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgePercent } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { invalidateByKey } from "../../queries/invalidation";
import { adminQueryKeys } from "../../queries/queryKeys";
import {
  getSiteSettings,
  resetLoginPromo,
  resetPricingContent,
  resetPricingGifts,
  saveLoginPromo,
  savePricingContent,
  savePricingGifts,
} from "../../services/siteSetting.service";
import { MAX_PRICING_GIFTS, MAX_PRICING_GIFT_LENGTH, PRICING_GIFT_PLANS, validateGifts } from "../../utils/pricingGifts";
import {
  MAX_PRICING_CONTENT_ITEMS,
  MAX_PRICING_CONTENT_LENGTH,
  PRICING_CONTENT_TABS,
  buildDefaultPricingContent,
  resolveLoginPromo,
  validateBenefits,
} from "../../utils/pricingContent";
import ListEditor from "./pricing/ListEditor";
import LoginPromoEditor from "./pricing/LoginPromoEditor";

const SECTIONS = [
  { id: "offers", label: "Ưu đãi" },
  { id: "content", label: "Nội dung các gói" },
];

// Mặc định (khi admin chưa lưu) lấy từ bản dịch tiếng Việt, giống những gì trang chủ đang hiện.
const useDefaults = () => {
  const { i18n } = useTranslation("home");
  const tVi = i18n.getFixedT("vi", "home");
  const shaker = tVi("pricing.gifts.shaker");
  const biscotti = tVi("pricing.gifts.biscotti");
  const backpack = tVi("pricing.gifts.backpack");
  return {
    gifts: {
      "1-1-basic": [shaker],
      "1-1-advanced": [shaker, biscotti],
      "1-1-vip": [backpack, shaker, biscotti],
    },
    content: buildDefaultPricingContent(tVi),
  };
};

const errorMessage = (error, fallback) => error.response?.data?.message || fallback;

// Mỗi thao tác lưu/khôi phục: toast kết quả rồi nạp lại cấu hình trang chủ.
const useSettingsMutation = (mutationFn, success, failure) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      toast.success(success);
      invalidateByKey(queryClient, adminQueryKeys.siteSettings.all());
    },
    onError: (error) => toast.error(errorMessage(error, failure)),
  });
};

const PricingManagement = () => {
  const defaults = useDefaults();
  const [section, setSection] = useState("offers");

  const { data: settingsResponse, isLoading, isError, refetch } = useQuery({
    queryKey: adminQueryKeys.siteSettings.all(),
    queryFn: async () => {
      const res = await getSiteSettings();
      return res.data;
    },
  });

  const saveGifts = useSettingsMutation(({ key, items }) => savePricingGifts(key, items), "Đã lưu quà tặng. Bảng giá trang chủ cập nhật ngay.", "Không thể lưu quà tặng. Vui lòng thử lại.");
  const resetGifts = useSettingsMutation((key) => resetPricingGifts(key), "Đã khôi phục quà tặng mặc định.", "Không thể khôi phục. Vui lòng thử lại.");
  const saveContent = useSettingsMutation(({ key, items }) => savePricingContent(key, items), "Đã lưu quyền lợi. Bảng giá trang chủ cập nhật ngay.", "Không thể lưu quyền lợi. Vui lòng thử lại.");
  const resetContent = useSettingsMutation((key) => resetPricingContent(key), "Đã khôi phục quyền lợi mặc định.", "Không thể khôi phục. Vui lòng thử lại.");
  const savePromo = useSettingsMutation(saveLoginPromo, "Đã lưu ưu đãi. Trang chủ và trang đăng ký cập nhật ngay.", "Không thể lưu ưu đãi. Vui lòng thử lại.");
  const resetPromo = useSettingsMutation(resetLoginPromo, "Đã khôi phục ưu đãi mặc định.", "Không thể khôi phục. Vui lòng thử lại.");

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Đang tải dữ liệu...</div>;
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
        <p className="font-semibold text-red-700">Không thể tải cấu hình bảng giá.</p>
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

  const settings = settingsResponse?.data;
  const giftOverrides = settings?.pricingGifts || {};
  const contentOverrides = settings?.pricingContent || {};
  const busy = [saveGifts, resetGifts, saveContent, resetContent, savePromo, resetPromo].some((m) => m.isPending);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <BadgePercent aria-hidden="true" className="h-6 w-6 text-primary" />
          Bảng giá
        </h1>
        <p className="mt-1 text-slate-500">
          Ưu đãi và nội dung hiện ở phần Bảng giá của trang chủ. Lưu xong là trang chủ cập nhật.
        </p>
      </div>

      <div role="tablist" aria-label="Các phần của bảng giá" className="flex gap-2 border-b border-slate-200">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`pricing-tab-${item.id}`}
            aria-selected={section === item.id}
            aria-controls={`pricing-panel-${item.id}`}
            onClick={() => setSection(item.id)}
            className={`-mb-px min-h-11 border-b-2 px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${
              section === item.id
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === "offers" ? (
        <div role="tabpanel" id="pricing-panel-offers" aria-labelledby="pricing-tab-offers" className="space-y-6">
          <LoginPromoEditor
            promo={resolveLoginPromo(settings)}
            busy={busy}
            onSave={(value) => savePromo.mutate(value)}
            onReset={() => resetPromo.mutate()}
          />
          <h2 className="pt-2 text-lg font-bold text-slate-800">Quà tặng theo gói</h2>
          {PRICING_GIFT_PLANS.map((item) => (
            <ListEditor
              key={item.key}
              id={`gift-${item.key}`}
              title={`${item.tab} · ${item.plan}`}
              label="Danh sách quà tặng"
              help={`Mỗi dòng là một quà tặng (tối đa ${MAX_PRICING_GIFTS} quà, mỗi quà tối đa ${MAX_PRICING_GIFT_LENGTH} ký tự). Để trống nếu gói này không có quà.`}
              placeholder="Ví dụ: Shaker bình lắc cao cấp 600ml"
              saved={giftOverrides[item.key]}
              defaults={defaults.gifts[item.key] || []}
              validate={validateGifts}
              busy={busy}
              onSave={(items) => saveGifts.mutate({ key: item.key, items })}
              onReset={() => resetGifts.mutate(item.key)}
            />
          ))}
        </div>
      ) : (
        <div role="tabpanel" id="pricing-panel-content" aria-labelledby="pricing-tab-content" className="space-y-6">
          <p className="text-sm text-slate-500">
            Quyền lợi chung của từng tab, hiện ở khung &quot;Tất cả gói đều gồm&quot; phía trên các thẻ gói. Số tuần và số
            buổi của từng gói gắn với đơn đăng ký nên chưa chỉnh ở đây.
          </p>
          {PRICING_CONTENT_TABS.flatMap((tab) => [
            { key: `${tab.tab}-customer`, title: `${tab.label} · Quyền lợi khách hàng` },
            { key: `${tab.tab}-system`, title: `${tab.label} · Quyền lợi hệ thống` },
          ]).map((item) => (
            <ListEditor
              key={item.key}
              id={`content-${item.key}`}
              title={item.title}
              label="Danh sách quyền lợi"
              help={`Mỗi dòng là một quyền lợi (tối đa ${MAX_PRICING_CONTENT_ITEMS} dòng, mỗi dòng tối đa ${MAX_PRICING_CONTENT_LENGTH} ký tự).`}
              placeholder="Ví dụ: Giáo án cá nhân hóa"
              saved={contentOverrides[item.key]}
              defaults={defaults.content[item.key] || []}
              validate={validateBenefits}
              busy={busy}
              onSave={(items) => saveContent.mutate({ key: item.key, items })}
              onReset={() => resetContent.mutate(item.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PricingManagement;
