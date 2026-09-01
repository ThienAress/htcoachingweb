import { useId, useRef, useState } from "react";
import { CheckCircle2, Github, LoaderCircle, RotateCcw, ScanSearch } from "lucide-react";
import { toast } from "react-toastify";

import { formatRadarDate, formatRadarRunDate, getDriftMeta } from "./skillRadarPresentation";
import {
  buildCreatedRadarItem,
  formToCreatePayload,
  getSkillRadarMutationError,
  previewToForm,
  validateGitHubRepoUrl,
  validateSkillRadarSourceForm,
} from "./skillRadarSourceForm.utils";

const inputClassName =
  "mt-1 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors hover:border-zinc-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500";

const Field = ({ id, label, children, hint }) => (
  <label htmlFor={id} className="block min-w-0">
    <span className="text-xs font-semibold text-zinc-700">{label}</span>
    {children}
    {hint ? <span className="mt-1 block text-xs leading-5 text-zinc-500">{hint}</span> : null}
  </label>
);

const ReadOnlyValue = ({ label, children }) => (
  <div>
    <dt className="text-xs font-semibold text-zinc-500">{label}</dt>
    <dd className="mt-1 text-sm font-medium text-zinc-800">{children}</dd>
  </div>
);

export default function SkillRadarSourceForm({ previewMutation, createMutation, onCreated }) {
  const formId = useId();
  const urlInputRef = useRef(null);
  const sourceUrlId = `${formId}-source-url`;
  const sourceTypeId = `${formId}-source-type`;
  const nameId = `${formId}-name`;
  const domainId = `${formId}-domain`;
  const localTargetsId = `${formId}-local-targets`;
  const summaryId = `${formId}-summary`;
  const lifecycleId = `${formId}-lifecycle`;
  const [repoUrl, setRepoUrl] = useState("");
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState(null);
  const [urlError, setUrlError] = useState("");
  const [requestError, setRequestError] = useState(null);
  const [success, setSuccess] = useState("");
  const isBusy = previewMutation.isPending || createMutation.isPending;
  const canSave = form && !validateSkillRadarSourceForm(form);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setRequestError(null);
  };

  const handleAnalyze = (event) => {
    event.preventDefault();
    const validationError = validateGitHubRepoUrl(repoUrl);
    setUrlError(validationError);
    setRequestError(null);
    setSuccess("");
    if (validationError) {
      urlInputRef.current?.focus();
      return;
    }

    previewMutation.mutate(repoUrl.trim(), {
      onSuccess: (data) => {
        setPreview(data);
        setForm(previewToForm(data));
        setRepoUrl(data.repoUrl || data.canonicalUrl || repoUrl.trim());
        toast.success("Đã phân tích nguồn GitHub");
      },
      onError: (error) => {
        const nextError = getSkillRadarMutationError(error, "Không thể phân tích repository lúc này. Vui lòng thử lại.");
        setRequestError(nextError);
        toast.error(nextError.message);
      },
    });
  };

  const handleSave = (event) => {
    event.preventDefault();
    setRequestError(null);
    setSuccess("");
    const formError = validateSkillRadarSourceForm(form);
    if (formError) {
      setRequestError({ message: formError });
      return;
    }
    createMutation.mutate(formToCreatePayload(form, preview), {
      onSuccess: (data) => {
        const saved = buildCreatedRadarItem(data, preview, form);
        onCreated({ item: saved });
        setSuccess(`Đã thêm ${saved.name} vào Radar công nghệ.`);
        setPreview(null);
        setForm(null);
        setRepoUrl("");
        toast.success(`Đã thêm ${saved.name} vào Radar công nghệ`);
      },
      onError: (error) => {
        const nextError = getSkillRadarMutationError(error, "Không thể lưu nguồn lúc này. Vui lòng thử lại.");
        setRequestError(nextError);
        toast.error(nextError.message);
      },
    });
  };

  const reset = () => {
    previewMutation.reset();
    createMutation.reset();
    setPreview(null);
    setForm(null);
    setRepoUrl("");
    setUrlError("");
    setRequestError(null);
    setSuccess("");
  };

  return (
    <section className="rounded-xl border border-zinc-200 bg-white" aria-labelledby={`${formId}-heading`}>
      <div className="border-b border-zinc-200 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
            <Github className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id={`${formId}-heading`} className="font-bold text-zinc-950">Thêm nguồn GitHub</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600">Dán repository để hệ thống đề xuất các cột. Bạn kiểm tra và chỉnh thông tin trước khi lưu; hệ thống không cài hoặc chạy code từ nguồn.</p>
          </div>
        </div>

        <form onSubmit={handleAnalyze} className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-start">
          <label htmlFor={sourceUrlId} className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-zinc-700">GitHub repository URL</span>
            <input
              ref={urlInputRef}
              id={sourceUrlId}
              type="url"
              name="sourceUrl"
              autoComplete="url"
              value={repoUrl}
              onChange={(event) => { setRepoUrl(event.target.value); setUrlError(""); setRequestError(null); setSuccess(""); }}
              placeholder="https://github.com/owner/repository"
              aria-invalid={Boolean(urlError)}
              aria-describedby={urlError ? `${formId}-url-error` : undefined}
              disabled={isBusy}
              className={inputClassName}
            />
            {urlError ? <span id={`${formId}-url-error`} className="mt-1 block text-sm font-medium text-rose-700">{urlError}</span> : null}
          </label>
          <button type="submit" disabled={isBusy || !repoUrl.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 lg:mt-5">
            {previewMutation.isPending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ScanSearch className="size-4" aria-hidden="true" />}
            {previewMutation.isPending ? "Đang phân tích..." : "Phân tích nguồn"}
          </button>
        </form>
      </div>

      {requestError ? (
        <div className="m-4 rounded-lg bg-rose-50 p-4 text-sm text-rose-900 sm:m-5" role="alert" aria-live="assertive">
          <p className="font-semibold">{requestError.message}</p>
          {requestError.retryAt ? <p className="mt-1">Thử lại sau: {formatRadarDate(requestError.retryAt)}</p> : null}
        </div>
      ) : null}

      {success ? (
        <div className="m-4 flex items-start gap-2 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900 sm:m-5" role="status" aria-live="polite">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="font-semibold">{success}</p>
        </div>
      ) : null}

      {form && preview ? (
        <form onSubmit={handleSave} className="p-4 sm:p-5" aria-label="Xác nhận nguồn Radar">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={sourceTypeId} label="Loại nguồn">
                <select id={sourceTypeId} name="sourceType" value={form.sourceType} onChange={updateField("sourceType")} disabled={isBusy} className={inputClassName}>
                  <option value="repository">Repository</option>
                  <option value="skill">Agent Skill</option>
                </select>
              </Field>
              <Field id={nameId} label="Skill / repository">
                <input id={nameId} name="name" value={form.name} onChange={updateField("name")} required maxLength={120} disabled={isBusy} className={inputClassName} />
              </Field>
              <Field id={domainId} label="Lĩnh vực">
                <input id={domainId} name="domain" value={form.domain} onChange={updateField("domain")} required maxLength={80} disabled={isBusy} className={inputClassName} />
              </Field>
              <Field id={localTargetsId} label="Ảnh hưởng local" hint="Phân tách nhiều target bằng dấu phẩy.">
                <input id={localTargetsId} name="localTargets" value={form.localTargets} onChange={updateField("localTargets")} required maxLength={1450} disabled={isBusy} className={inputClassName} />
              </Field>
              <Field id={summaryId} label="Tóm tắt giá trị">
                <textarea id={summaryId} name="summary" value={form.summary} onChange={updateField("summary")} required maxLength={500} rows={4} disabled={isBusy} className={`${inputClassName} resize-y`} />
              </Field>
              <Field id={lifecycleId} label="Lifecycle">
                <select id={lifecycleId} name="lifecycle" value={form.lifecycle} onChange={updateField("lifecycle")} disabled={isBusy} className={inputClassName}>
                  <option value="candidate">Ứng viên</option>
                  <option value="active">Đang theo dõi</option>
                  <option value="watch">Theo dõi chậm</option>
                </select>
              </Field>
            </div>

            <div className="border-t border-zinc-200 pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
              <h3 className="text-sm font-bold text-zinc-950">Metadata tự động</h3>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 xl:grid-cols-1">
                <ReadOnlyValue label="Nguồn chuẩn"><span className="break-all">{preview.repoUrl || preview.canonicalUrl}</span></ReadOnlyValue>
                <ReadOnlyValue label="Cập nhật upstream">{formatRadarDate(preview.lastUpstreamCommitAt)}</ReadOnlyValue>
                <ReadOnlyValue label="Review gần nhất">{formatRadarDate(preview.lastReviewedAt)}</ReadOnlyValue>
                <ReadOnlyValue label="Trạng thái">{getDriftMeta(preview.drift).label}</ReadOnlyValue>
                <ReadOnlyValue label="Lần quét dự kiến">{formatRadarRunDate(preview.nextCheckAt)}</ReadOnlyValue>
              </dl>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={reset} disabled={isBusy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-500 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw className="size-4" aria-hidden="true" />Nhập nguồn khác</button>
            <button type="submit" disabled={isBusy || !canSave} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{createMutation.isPending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}{createMutation.isPending ? "Đang lưu..." : "Xác nhận và lưu"}</button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
