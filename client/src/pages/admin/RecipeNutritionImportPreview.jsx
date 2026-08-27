import { AlertCircle, CheckCircle2 } from "lucide-react";

const RecipeNutritionImportPreview = ({ preview }) => {
  const summary = preview.summary;

  return (
    <section aria-labelledby="recipe-nutrition-import-preview-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3
            id="recipe-nutrition-import-preview-title"
            className="text-base font-bold text-zinc-900"
          >
            Kết quả xem trước
          </h3>
          <p className="mt-1 text-sm text-zinc-600" aria-live="polite">
            Khớp {summary.matchedItems}/{summary.totalItems} công thức; có{" "}
            {summary.issueItems} mục cần sửa.
          </p>
        </div>
        <span
          className={`inline-flex min-h-8 items-center gap-2 self-start rounded-full px-3 py-1 text-sm font-semibold ${
            summary.canImport
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-900"
          }`}
        >
          {summary.canImport ? (
            <CheckCircle2 className="size-4" aria-hidden="true" />
          ) : (
            <AlertCircle className="size-4" aria-hidden="true" />
          )}
          {summary.canImport ? "Sẵn sàng nhập" : "Cần sửa file"}
        </span>
      </div>

      {preview.issues?.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-950">
            Công thức chưa thể ghép an toàn
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {preview.issues.slice(0, 20).map((issue) => (
              <li key={`${issue.itemIndex}:${issue.code}`} className="break-words">
                <span className="font-semibold">{issue.name}:</span>{" "}
                {issue.message}
              </li>
            ))}
          </ul>
          {preview.issues.length > 20 && (
            <p className="mt-2 text-xs text-amber-800">
              Còn {preview.issues.length - 20} mục khác trong file cần sửa.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-100 text-zinc-700">
            <tr>
              <th className="px-4 py-3 font-semibold">Tên món</th>
              <th className="px-4 py-3 font-semibold">Nguyên liệu</th>
              <th className="px-4 py-3 font-semibold">Chất bổ sung</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {preview.previewItems?.map((item, index) => (
              <tr key={`${item.name}:${index}`}>
                <td className="max-w-md break-words px-4 py-3 font-medium text-zinc-800">
                  {item.name}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                  {item.ingredientCount}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                  {item.additionalCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {summary.totalItems > 20 && (
        <p className="mt-2 text-xs text-zinc-500">
          Đang hiển thị 20 món đầu tiên; toàn bộ {summary.totalItems} món đã được
          hệ thống kiểm tra.
        </p>
      )}
    </section>
  );
};

export default RecipeNutritionImportPreview;
