import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient, useMutation, useIsMutating } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { bodyAssessmentKey, getBodyAssessment, saveBodyAssessment, publishBodyAssessment } from "../../services/bodyAssessment.service";
import { getVietnamDateKey, getMonthWeekPeriods, getMonthWeekPeriod } from "../../utils/vietnamDate";
import { AssessmentFields } from "./AssessmentFields";
import { assessmentValues, assessmentFormSchema, assessmentActionCheck, missingMassFields, assessmentButtonClass, assessmentInputClass } from "./bodyAssessment";

const Editor = ({ assessment, clientId, week, queryKey, dirtyRef, onAccessLost }) => {
  const queryClient = useQueryClient();
  const [partial, setPartial] = useState(false);
  const [error, setError] = useState("");
  const pendingCommand = useRef(null);
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const form = useForm({ resolver: zodResolver(assessmentFormSchema), defaultValues: assessmentValues(assessment?.draft || assessment?.published) });
  const { isDirty } = form.formState;
  useEffect(() => {
    dirtyRef.current = isDirty;
    return () => { dirtyRef.current = false; };
  }, [dirtyRef, isDirty]);
  const mutation = useMutation({
    mutationKey: queryKey,
    mutationFn: async ({ action, values, confirmPartial = false }) => {
      const { reason, ...draft } = values;
      const intent = JSON.stringify({ action, values, confirmPartial, revision: assessment?.revision || 0 });
      if (pendingCommand.current?.intent !== intent) pendingCommand.current = { intent, requestId: crypto.randomUUID() };
      const common = { expectedRevision: assessment?.revision || 0, requestId: pendingCommand.current.requestId, reason };
      return action === "save" ? saveBodyAssessment(clientId, week, { ...common, draft }) : publishBodyAssessment(clientId, week, { ...common, confirmPartial });
    },
    onSuccess: async (response, { action }) => {
      if (!mounted.current) return;
      pendingCommand.current = null;
      dirtyRef.current = false;
      form.reset(assessmentValues(response.data.data.assessment?.draft || response.data.data.assessment?.published));
      queryClient.setQueryData(queryKey, response.data.data);
      await queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "body-assessments" && query.queryKey[3] !== "edit" });
      toast.success(action === "save" ? "Đã lưu nháp kết quả đo" : "Đã gửi kết quả đo cho học viên");
    },
    onError: (failure) => {
      if (!mounted.current) return;
      if ([401, 403].includes(failure.response?.status)) {
        onAccessLost();
        void queryClient.cancelQueries({ queryKey: queryKey.slice(0, 3) }).then(() => queryClient.removeQueries({ queryKey: queryKey.slice(0, 3) }));
      }
      setError(failure.response?.data?.message || "Chưa thể lưu kết quả. Giữ nguyên dữ liệu và thử lại.");
      toast.error("Chưa thể hoàn tất thao tác kết quả đo");
    },
    onSettled: () => { running.current = false; },
  });
  const run = (action, confirmPartial = false) => form.handleSubmit((values) => {
    if (running.current || mutation.isPending) return;
    setError("");
    const check = assessmentActionCheck({ action, assessment, values, dirty: form.formState.isDirty, confirmPartial });
    if (check.error) {
      if (check.field) { form.setError(check.field, { message: check.error }); form.setFocus(check.field); }
      else setError(check.error);
      return;
    }
    if (check.partial) { setPartial(true); return; }
    setPartial(false);
    running.current = true;
    mutation.mutate({ action, values, confirmPartial });
  })();
  const busy = mutation.isPending;
  const reload = async () => {
    if (form.formState.isDirty && !window.confirm("Tải lại sẽ bỏ các thay đổi chưa lưu. Tiếp tục?")) return;
    await queryClient.invalidateQueries({ queryKey });
    const latest = queryClient.getQueryData(queryKey)?.assessment;
    if (mounted.current && latest) {
      form.reset(assessmentValues(latest.draft || latest.published));
      setError("");
      setPartial(false);
    }
  };
  return <form noValidate onSubmit={(event) => { event.preventDefault(); void run("save"); }} className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm text-slate-300">Ngày đo thực tế<input type="date" max={getVietnamDateKey()} {...form.register("measuredDateKey")} aria-invalid={Boolean(form.formState.errors.measuredDateKey)} disabled={busy} className={assessmentInputClass} />{form.formState.errors.measuredDateKey && <span role="alert" className="text-red-300">{form.formState.errors.measuredDateKey.message}</span>}</label>
      <label className="text-sm text-slate-300">Thiết bị hoặc nguồn đo<input {...form.register("deviceLabel")} maxLength={120} disabled={busy} className={assessmentInputClass} placeholder="Ví dụ: tên máy trên phiếu" /></label>
      <label className="text-sm text-slate-300">Mức tham chiếu trên phiếu<select {...form.register("referenceBasis")} disabled={busy} className={assessmentInputClass}>
        <option value="unspecified">Chưa xác định</option><option value="ideal_weight">Theo cân nặng tham chiếu</option><option value="current_weight">Theo cân nặng hiện tại</option>
      </select></label>
    </div>
    <AssessmentFields register={form.register} setFocus={form.setFocus} errors={form.formState.errors} disabled={busy} />
    <label className="block text-sm text-slate-300">Ghi chú cho học viên<textarea {...form.register("note")} maxLength={2000} disabled={busy} className={assessmentInputClass} rows={2} /></label>
    {assessment?.published && <label className="block text-sm text-slate-300">Lý do cập nhật<textarea {...form.register("reason")} maxLength={500} disabled={busy} className={assessmentInputClass} rows={2} />{form.formState.errors.reason && <span className="text-red-300">Nhập lý do cập nhật</span>}</label>}
    {error && <div role="alert" className="text-sm text-red-300"><p>{error}</p><button type="button" disabled={busy} className={assessmentButtonClass} onClick={() => void reload()}>Tải bản mới</button></div>}
    {partial && <div role="alert" className="rounded-lg border border-amber-700 p-4 text-sm text-amber-200"><p>Còn thiếu số đo: {missingMassFields(form.getValues()).join(", ")}. Học viên sẽ thấy các mục thiếu là chưa có dữ liệu.</p><div className="mt-3 flex gap-2"><button type="button" disabled={busy} className={assessmentButtonClass} onClick={() => void run("publish", true)}>Vẫn gửi</button><button type="button" disabled={busy} className={assessmentButtonClass} onClick={() => setPartial(false)}>Quay lại nhập</button></div></div>}
    <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy} className={assessmentButtonClass}>{busy ? "Đang xử lý…" : "Lưu nháp"}</button><button type="button" disabled={busy || !assessment?.draft || form.formState.isDirty} onClick={() => void run("publish")} className={`${assessmentButtonClass} bg-cyan-700 hover:bg-cyan-600`}>Gửi cho học viên</button></div>
    {assessment?.published && <p className="text-xs text-slate-400">Học viên đang xem kết quả ngày {assessment.published.measuredDateKey}. Thay đổi nháp chỉ hiển thị sau khi gửi lại.</p>}
  </form>;
};

export const TrainerBodyAssessment = ({ clientId, dateKey }) => {
  const { user } = useAuth();
  const [month, setMonth] = useState((dateKey || getVietnamDateKey()).slice(0, 7));
  const [selectedWeek, setSelectedWeek] = useState(() => getMonthWeekPeriod(dateKey || getVietnamDateKey())?.startDateKey || "");
  const [accessLost, setAccessLost] = useState(false);
  const queryClient = useQueryClient();
  const dirtyRef = useRef(false);
  const periods = getMonthWeekPeriods(`${month}-01`).filter((period) => period.rangeStartDateKey <= getVietnamDateKey());
  const week = periods.some((period) => period.startDateKey === selectedWeek) ? selectedWeek : (periods.find((period) => period.startDateKey === getMonthWeekPeriod(dateKey || getVietnamDateKey())?.startDateKey) || periods.at(-1))?.startDateKey;
  const queryKey = bodyAssessmentKey(user?._id, clientId, "edit", week);
  const busy = useIsMutating({ mutationKey: bodyAssessmentKey(user?._id, clientId) }) > 0;
  const query = useQuery({ queryKey, queryFn: async ({ signal }) => {
    try { return (await getBodyAssessment(clientId, week, signal)).data.data; }
    catch (failure) {
      if ([401, 403].includes(failure.response?.status)) setAccessLost(true);
      throw failure;
    }
  }, enabled: Boolean(user?._id && clientId && week && !accessLost), gcTime: 0, staleTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false, retry: false });
  const forbidden = [401, 403].includes(query.error?.response?.status);
  useEffect(() => {
    if (!forbidden) return;
    const filters = { queryKey: bodyAssessmentKey(user?._id, clientId) };
    void queryClient.cancelQueries(filters).then(() => queryClient.removeQueries(filters));
  }, [forbidden, queryClient, user?._id, clientId]);
  const change = (action) => { if (!busy && (!dirtyRef.current || window.confirm("Đổi kỳ sẽ bỏ dữ liệu chưa lưu. Tiếp tục?"))) { dirtyRef.current = false; action(); } };
  return <section className="rounded-2xl border border-slate-700 bg-slate-950 p-4 sm:p-6" aria-labelledby="assessment-editor-title">
    <h3 id="assessment-editor-title" className="text-xl font-bold text-slate-100">Kết quả đo thành phần cơ thể</h3>
    <p className="mt-2 text-sm text-slate-400">Ghi kết quả từ phiếu đo và gửi cho học viên.</p>
    <div className="my-5 grid gap-3 sm:grid-cols-2"><label className="text-sm text-slate-300">Tháng theo dõi<input type="month" value={month} disabled={busy || accessLost || forbidden} max={getVietnamDateKey().slice(0, 7)} onChange={(event) => { if (event.target.value) change(() => setMonth(event.target.value)); }} className={assessmentInputClass} /></label><label className="text-sm text-slate-300">Kỳ theo dõi<select value={week || ""} disabled={busy || accessLost || forbidden} onChange={(event) => change(() => setSelectedWeek(event.target.value))} className={assessmentInputClass}>{periods.map((period) => <option key={period.startDateKey} value={period.startDateKey}>{period.rangeStartDateKey} – {period.endDateKey}</option>)}</select></label></div>
    {accessLost || forbidden ? <p role="alert" className="text-sm text-red-300">Bạn không còn quyền xem kết quả đo của học viên này.</p> : query.isError ? <div role="alert" className="text-sm text-red-300"><p>{query.error.response?.data?.message || "Không thể tải kết quả đo."}</p><button type="button" onClick={() => void query.refetch()} className={assessmentButtonClass}>Thử lại</button></div> : query.isLoading ? <p role="status" className="text-slate-300">Đang tải kết quả đo…</p> : week && <Editor key={`${user?._id}:${clientId}:${week}:${query.data?.assessment?.revision || 0}`} assessment={query.data?.assessment} clientId={clientId} week={week} queryKey={queryKey} dirtyRef={dirtyRef} onAccessLost={() => setAccessLost(true)} />}
  </section>;
};
