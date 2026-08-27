import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertCircle,
  FileJson2,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "react-toastify";

import { useModalScrollLock } from "../../hooks/useModalScrollLock";
import {
  commitExerciseInstructionsImport,
  previewExerciseInstructionsImport,
} from "../../services/exercise.service";
import { readExerciseInstructionsImportFile } from "./exerciseInstructionsImport";
import ExerciseInstructionsImportPreview from "./ExerciseInstructionsImportPreview";

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || "Không thể xử lý file JSON";

const ExerciseInstructionsImportModal = ({
  isOpen,
  onClose,
  onImported,
}) => {
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
      await readExerciseInstructionsImportFile(selectedFile);
      return previewExerciseInstructionsImport(selectedFile);
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
      commitExerciseInstructionsImport(selectedFile, previewToken),
    onSuccess: (result) => {
      toast.success(result.message || "Đã nhập hướng dẫn bài tập");
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
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
    setPreview(null);
    setErrorMessage("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exercise-instructions-import-title"
      onClick={resetAndClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id="exercise-instructions-import-title"
              className="flex items-center gap-2 text-lg font-bold text-zinc-900 sm:text-xl"
            >
              <FileJson2 className="size-5 shrink-0 text-emerald-700" aria-hidden="true" />
              Thêm nhiều bước bài tập
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
              Tải file JSON, kiểm tra tên khớp chính xác rồi mới cập nhật hướng dẫn và độ phức tạp kỹ thuật.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={resetAndClose}
            disabled={isBusy}
            aria-label="Đóng cửa sổ nhập hướng dẫn"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-[color,background-color] duration-200 hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <section aria-labelledby="exercise-import-file-label">
            <label
              id="exercise-import-file-label"
              htmlFor="exercise-instructions-json-file"
              className="mb-2 block text-sm font-semibold text-zinc-800"
            >
              File JSON từ chuyên gia
            </label>
            <div className="relative">
              <input
                id="exercise-instructions-json-file"
                name="exerciseInstructionsJson"
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                disabled={isBusy}
                aria-describedby="exercise-instructions-json-help"
                className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-wait"
              />
              <div className="flex min-h-12 items-center gap-3 rounded-xl border border-zinc-300 bg-white p-1.5 pr-3 text-sm transition-[border-color,box-shadow] duration-200 peer-hover:border-emerald-500 peer-focus-visible:border-emerald-700 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-200 peer-disabled:opacity-60 motion-reduce:transition-none">
                <span className="shrink-0 rounded-lg bg-emerald-50 px-3 py-2 font-semibold text-emerald-800">
                  Chọn file JSON
                </span>
                <span className="min-w-0 truncate text-zinc-600">
                  {file?.name || "Chưa chọn file"}
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              <span id="exercise-instructions-json-help">
              Chỉ nhận file .json tối đa 8MB theo schemaVersion 1. Xem trước không ghi dữ liệu.
              </span>
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

          {summary && <ExerciseInstructionsImportPreview preview={preview} />}
        </div>

        <footer className="flex flex-col gap-3 border-t border-zinc-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={resetAndClose}
            disabled={isBusy}
            className="order-3 min-h-11 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition-[background-color,border-color] duration-200 hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-700 disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none sm:order-1"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => file && previewMutation.mutate(file)}
            disabled={!file || isBusy}
            className="order-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition-[background-color,color] duration-200 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none sm:order-2"
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
            className="order-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white transition-[background-color] duration-200 hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none sm:order-3"
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

export default ExerciseInstructionsImportModal;
