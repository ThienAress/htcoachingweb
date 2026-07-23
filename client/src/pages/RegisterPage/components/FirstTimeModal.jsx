import { Tag } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";

function FirstTimeModal({ discountCode, onConfirm, onCancel }) {
  const { t } = useTranslation("auth");

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60">
      <div className="bg-white rounded-2xl max-w-md w-full mx-4 p-6 shadow-2xl animate-fade-in">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Tag className="text-green-600" size={24} />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            {t("modal.title")}
          </h3>
          <p className="text-gray-600 mb-4">
            <Trans t={t} i18nKey="modal.desc">
              Mỗi tài khoản chỉ được nhận{" "}
              <strong className="text-green-600">mã giảm giá 15%</strong> cho{" "}
              <strong>lần đăng ký đầu tiên</strong>.<br />
              Bạn có muốn sử dụng ưu đãi này cho đơn hàng hiện tại?
            </Trans>
          </p>
          {discountCode && (
            <p className="text-sm text-gray-500 mb-4">
              <Trans t={t} i18nKey="modal.your_code" values={{ code: discountCode }}>
                Mã của bạn: <strong className="text-green-700 font-mono">{discountCode}</strong>
              </Trans>
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={onConfirm}
              className="flex-1 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition"
            >
              {t("modal.confirm")}
            </button>
            <button
              onClick={onCancel}
              className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              {t("modal.cancel")}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            {t("modal.note")}
          </p>
        </div>
      </div>
    </div>
  );
}

export default FirstTimeModal;
