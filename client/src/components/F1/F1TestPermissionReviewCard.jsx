// F1TestPermissionReviewCard.jsx
import { useState } from "react";
import {
  ShieldCheck,
  TriangleAlert,
  ClipboardCheck,
  AlertCircle,
} from "lucide-react";

const decisionMeta = {
  keep_hold: {
    label: "Giữ HOLD",
    className:
      "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 ring-red-200",
    icon: TriangleAlert,
    description:
      "Tiếp tục giữ khách ở trạng thái HOLD TEST. Chưa cho đi tiếp sang assessment.",
  },
  approve_modified_test: {
    label: "Duyệt Modified Test",
    className:
      "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 ring-orange-200",
    icon: ClipboardCheck,
    description:
      "Cho phép khách đi tiếp với modified assessment, ưu tiên các bài an toàn hơn.",
  },
  approve_full_test: {
    label: "Duyệt Full Test",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-emerald-200",
    icon: ShieldCheck,
    description:
      "Cho phép khách đi tiếp với assessment đầy đủ như workflow bình thường.",
  },
};

const F1TestPermissionReviewCard = ({
  customer,
  submitting = false,
  onSubmit,
}) => {
  const [reviewNote, setReviewNote] = useState("");

  if (!customer || customer.testPermission !== "hold_test") return null;

  const handleSubmit = (decision) => {
    onSubmit?.({ decision, reviewNote: reviewNote.trim() });
  };

  return (
    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <AlertCircle size={20} className="text-amber-700" />
        <h3 className="text-base font-extrabold text-amber-800">
          PT review trước khi cho khách đi tiếp
        </h3>
      </div>
      <p className="mt-2 text-sm text-amber-800">
        Khách hiện đang ở trạng thái <strong>HOLD TEST</strong>. PT cần review
        lý do hold trước khi quyết định.
      </p>

      <div className="mt-4 rounded-lg border border-amber-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-800">
          Ghi chú review của PT
        </p>
        <textarea
          rows={4}
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          placeholder="Ví dụ: Đã xem giới hạn từ bác sĩ. Cho phép modified test, tránh squat nặng và bài tăng áp lực cột sống."
          className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {Object.entries(decisionMeta).map(([decision, meta]) => {
          const Icon = meta.icon;
          return (
            <button
              key={decision}
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(decision)}
              className={`rounded-xl border p-4 text-left transition-all hover:shadow-md disabled:opacity-60 ${meta.className}`}
            >
              <div className="flex items-center gap-2">
                <Icon size={18} />
                <p className="font-bold">{meta.label}</p>
              </div>
              <p className="mt-2 text-sm leading-6">{meta.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default F1TestPermissionReviewCard;
