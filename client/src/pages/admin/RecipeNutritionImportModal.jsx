import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, FileJson2, Loader2, Upload, X } from "lucide-react";
import { toast } from "react-toastify";

import { useModalScrollLock } from "../../hooks/useModalScrollLock";
import {
  commitRecipeNutritionImport,
  previewRecipeNutritionImport,
} from "../../services/recipe.service";
import { readRecipeNutritionImportFile } from "./recipeNutritionImport";
import RecipeNutritionImportPreview from "./RecipeNutritionImportPreview";

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Không thể xử lý file JSON";

const RecipeNutritionImportModal = ({ isOpen, onClose, onImported }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useModalScrollLock(isOpen);

  const previewMutation = useMutation({
    mutationFn: async (selectedFile) => {
      await readRecipeNutritionImportFile(selectedFile);
      return previewRecipeNutritionImport(selectedFile);
    },
    onSuccess: (result) => {
      setPreview(result.data);
      setErrorMessage("");
    },
    onError: (error) => {
      setPreview(null);
      setErrorMessage(getErrorMessage(error));
    },
  });

  const commitMutation = useMutation({
    mutationFn: ({ selectedFile, previewToken }) =>
      commitRecipeNutritionImport(selectedFile, previewToken),
    onSuccess: (result) => {
      toast.success(result.message || "Đã nhập dinh dưỡng công thức");
      onImported?.();
      setFile(null);
      setPreview(null);
      setErrorMessage("");
      onCloseRef.current();
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  const isBusy = previewMutation.isPending || commitMutation.isPending;
  const resetAndClose = useCallback(() => {
    if (isBusy) return;
    setFile(null);
    setPreview(null);
    setErrorMessage("");
    onCloseRef.current();
  }, [isBusy]);

  useEffect(() => {
    if (!isOpen) return undefined;
    previousFocusRef.current = document.activeElement;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") resetAndClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, resetAndClose]);

  if (!isOpen) return null;

  const summary = preview?.summary;
  const canCommit = Boolean(
    file && summary?.canImport && preview?.previewToken && !isBusy,
  );
  const handleFileChange = (event) => {
    setFile(event.target.files?.[0] || null);
    setPreview(null);
    setErrorMessage("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-nutrition-import-title"
      onClick={resetAndClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id="recipe-nutrition-import-title"
              className="flex items-center gap-2 text-lg font-bold text-zinc-900 sm:text-xl"
            >
              <FileJson2 className="size-5 shrink-0 text-orange-700" aria-hidden="true" />
              Nhập Giá trị dinh dưỡng
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
              Hệ thống đối chiếu chính xác tên món và toàn bộ nguyên liệu trước khi cập nhật.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={resetAndClose}
            disabled={isBusy}
            aria-label="Đóng cửa sổ nhập dinh dưỡng"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors duration-200 hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700 disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <section aria-labelledby="recipe-nutrition-import-file-label">
            <label
              id="recipe-nutrition-import-file-label"
              htmlFor="recipe-nutrition-json-file"
              className="mb-2 block text-sm font-semibold text-zinc-800"
            >
              File JSON từ chuyên gia
            </label>
            <div className="relative">
              <input
                id="recipe-nutrition-json-file"
                name="recipeNutritionJson"
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                disabled={isBusy}
                aria-describedby="recipe-nutrition-json-help"
                className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-wait"
              />
              <div className="flex min-h-12 items-center gap-3 rounded-xl border border-zinc-300 bg-white p-1.5 pr-3 text-sm transition-[border-color,box-shadow] duration-200 peer-hover:border-orange-500 peer-focus-visible:border-orange-700 peer-focus-visible:ring-2 peer-focus-visible:ring-orange-200 peer-disabled:opacity-60 motion-reduce:transition-none">
                <span className="shrink-0 rounded-lg bg-orange-50 px-3 py-2 font-semibold text-orange-800">
                  Chọn file JSON
                </span>
                <span className="min-w-0 truncate text-zinc-600">
                  {file?.name || "Chưa chọn file"}
                </span>
              </div>
            </div>
            <p id="recipe-nutrition-json-help" className="mt-2 text-xs leading-5 text-zinc-500">
              Chỉ nhận file .json tối đa 8MB theo schemaVersion 1. Xem trước không ghi dữ liệu.
            </p>
          </section>

          {errorMessage && (
            <div
              className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <span className="break-words">{errorMessage}</span>
            </div>
          )}
          {summary && <RecipeNutritionImportPreview preview={preview} />}
        </div>

        <footer className="flex flex-col gap-3 border-t border-zinc-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={resetAndClose}
            disabled={isBusy}
            className="order-3 min-h-11 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors duration-200 hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-700 disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none sm:order-1"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => file && previewMutation.mutate(file)}
            disabled={!file || isBusy}
            className="order-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-orange-700 px-4 py-2 text-sm font-semibold text-orange-800 transition-colors duration-200 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none sm:order-2"
          >
            {previewMutation.isPending ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Upload className="size-4" aria-hidden="true" />
            )}
            {previewMutation.isPending ? "Đang kiểm tra..." : "Xem trước"}
          </button>
          <button
            type="button"
            onClick={() =>
              file &&
              commitMutation.mutate({
                selectedFile: file,
                previewToken: preview?.previewToken,
              })
            }
            disabled={!canCommit}
            className="order-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-700 px-5 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-orange-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none sm:order-3"
          >
            {commitMutation.isPending && (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            )}
            {commitMutation.isPending ? "Đang cập nhật..." : "Xác nhận cập nhật"}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default RecipeNutritionImportModal;
