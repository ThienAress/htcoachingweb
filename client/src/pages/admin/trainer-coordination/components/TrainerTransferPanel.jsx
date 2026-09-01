import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { toast } from "react-toastify";

import { getTrainerAssignmentCandidates } from "../../../../services/trainerAssignment.service";
import {
  executeTrainerTransfer,
  getActiveTrainerAssignments,
  previewTrainerTransfer,
} from "../../../../services/trainerCoordination.service";
import TransferPreview from "./TransferPreview";
import { AssignmentSelectField, TrainerSelectField } from "./TransferSelectFields";
const schema = z.object({
  assignmentKey: z.string().min(1, "Chọn khách hàng và HLV hiện tại"),
  toTrainerId: z.string().min(1, "Chọn HLV mới"),
  reason: z.string().trim().min(10, "Lý do cần ít nhất 10 ký tự").max(500, "Lý do tối đa 500 ký tự"),
});

const keyOf = (assignment) =>
  assignment?.client?._id && assignment?.trainer?._id
    ? `${assignment.client._id}|${assignment.trainer._id}`
    : "";

const getErrorMessage = (error) =>
  error?.response?.data?.message || "Không thể xử lý yêu cầu lúc này";

const TrainerTransferPanel = ({ initialAssignment }) => {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState(null);
  const [transferRequestId, setTransferRequestId] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentSearchDraft, setAssignmentSearchDraft] = useState("");
  const [trainerPage, setTrainerPage] = useState(1);
  const [trainerSearch, setTrainerSearch] = useState("");
  const [trainerSearchDraft, setTrainerSearchDraft] = useState("");
  const [selectedAssignmentCache, setSelectedAssignmentCache] = useState(
    initialAssignment || null,
  );
  const [selectedTrainerCache, setSelectedTrainerCache] = useState(null);
  const assignmentsQuery = useQuery({
    queryKey: [
      "trainer-coordination",
      "active-assignments",
      { page: assignmentPage, search: assignmentSearch },
    ],
    queryFn: () =>
      getActiveTrainerAssignments({
        page: assignmentPage,
        limit: 20,
        search: assignmentSearch,
      }).then(
        (response) => response.data.data,
      ),
    placeholderData: (previous) => previous,
  });
  const trainersQuery = useQuery({
    queryKey: [
      "trainer-assignment-candidates",
      "coordination",
      { page: trainerPage, search: trainerSearch },
    ],
    queryFn: () =>
      getTrainerAssignmentCandidates({
        page: trainerPage,
        limit: 20,
        search: trainerSearch,
      }).then(
        (response) => response.data.data,
      ),
    placeholderData: (previous) => previous,
  });
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { assignmentKey: keyOf(initialAssignment), toTrainerId: "", reason: "" },
  });
  const assignmentKey = watch("assignmentKey");
  const toTrainerId = watch("toTrainerId");
  const reason = watch("reason");

  const assignments = useMemo(() => {
    const list = assignmentsQuery.data?.assignments || [];
    if (
      !selectedAssignmentCache ||
      list.some((item) => keyOf(item) === keyOf(selectedAssignmentCache))
    ) {
      return list;
    }
    return [selectedAssignmentCache, ...list];
  }, [assignmentsQuery.data, selectedAssignmentCache]);
  const selectedAssignment = assignments.find((item) => keyOf(item) === assignmentKey);
  const trainers = useMemo(() => {
    const sourceTrainerId = String(selectedAssignment?.trainer?._id || "");
    const list = (trainersQuery.data?.trainers || []).filter(
      (trainer) => String(trainer._id) !== sourceTrainerId,
    );
    if (
      !selectedTrainerCache ||
      String(selectedTrainerCache._id) === sourceTrainerId ||
      list.some((trainer) =>
        String(trainer._id) === String(selectedTrainerCache._id))
    ) {
      return list;
    }
    return [selectedTrainerCache, ...list];
  }, [selectedAssignment, selectedTrainerCache, trainersQuery.data]);

  useEffect(() => {
    if (!initialAssignment) return;
    setSelectedAssignmentCache(initialAssignment);
    setValue("assignmentKey", keyOf(initialAssignment));
    setPreview(null);
    setTransferRequestId(null);
    setConfirmed(false);
  }, [initialAssignment, setValue]);

  useEffect(() => {
    setPreview(null);
    setTransferRequestId(null);
    setConfirmed(false);
  }, [assignmentKey, toTrainerId, reason]);

  useEffect(() => {
    if (
      toTrainerId &&
      String(toTrainerId) === String(selectedAssignment?.trainer?._id || "")
    ) {
      setValue("toTrainerId", "");
      setSelectedTrainerCache(null);
    }
  }, [selectedAssignment, setValue, toTrainerId]);

  const applyAssignmentSearch = (event) => {
    event.preventDefault();
    setAssignmentPage(1);
    setAssignmentSearch(assignmentSearchDraft.trim());
  };
  const applyTrainerSearch = (event) => {
    event.preventDefault();
    setTrainerPage(1);
    setTrainerSearch(trainerSearchDraft.trim());
  };

  const previewMutation = useMutation({
    mutationFn: (payload) => previewTrainerTransfer(payload).then((response) => response.data.data),
    onMutate: () => {
      setPreview(null);
      setTransferRequestId(null);
      setConfirmed(false);
    },
    onSuccess: (data) => {
      setPreview(data);
      setTransferRequestId(globalThis.crypto.randomUUID());
    },
  });
  const transferMutation = useMutation({
    mutationFn: (payload) => executeTrainerTransfer(payload).then((response) => response.data.data),
    onSuccess: async () => {
      toast.success("Đã chuyển HLV thành công");
      setPreview(null);
      setTransferRequestId(null);
      setConfirmed(false);
      setSelectedAssignmentCache(null);
      setSelectedTrainerCache(null);
      setValue("assignmentKey", "");
      setValue("toTrainerId", "");
      setValue("reason", "");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trainer-coordination"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
      ]);
    },
  });

  const getPayload = (values) => {
    const [clientId, fromTrainerId] = values.assignmentKey.split("|");
    return { clientId, fromTrainerId, toTrainerId: values.toTrainerId, reason: values.reason.trim() };
  };

  const requestPreview = (values) => previewMutation.mutate(getPayload(values));
  const confirmTransfer = () => {
    if (!preview || !confirmed || !transferRequestId) return;
    transferMutation.mutate({
      ...getPayload({ assignmentKey, toTrainerId, reason }),
      previewToken: preview.previewToken,
      requestId: transferRequestId,
    });
  };

  const loading = assignmentsQuery.isLoading || trainersQuery.isLoading;
  const loadError = assignmentsQuery.isError || trainersQuery.isError;
  const { onChange: onAssignmentChange, ...assignmentField } =
    register("assignmentKey");
  const { onChange: onTrainerChange, ...trainerField } =
    register("toTrainerId");

  if (loading) {
    return <div className="h-72 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" aria-label="Đang tải dữ liệu chuyển HLV" />;
  }
  if (loadError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-950">
        <AlertCircle className="size-5" aria-hidden="true" />
        <h2 className="mt-3 font-semibold">Không tải được dữ liệu điều phối</h2>
        <button type="button" onClick={() => { assignmentsQuery.refetch(); trainersQuery.refetch(); }} className="mt-4 min-h-11 rounded-lg bg-rose-700 px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2">Thử lại</button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <form onSubmit={handleSubmit(requestPreview)} className="grid gap-6 p-5 lg:grid-cols-2 lg:p-7">
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Thiết lập chuyển giao</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Xem trước là bắt buộc; dữ liệu chưa thay đổi ở bước này.</p>
          </div>
          <AssignmentSelectField
            searchDraft={assignmentSearchDraft}
            onSearchDraftChange={setAssignmentSearchDraft}
            onSearch={applyAssignmentSearch}
            field={{ ...assignmentField, onChange: onAssignmentChange }}
            onValueChange={(value) =>
              setSelectedAssignmentCache(
                assignments.find((item) => keyOf(item) === value) || null,
              )
            }
            options={assignments}
            errorMessage={errors.assignmentKey?.message}
            page={assignmentPage}
            totalPages={assignmentsQuery.data?.pagination?.totalPages || 1}
            onPrevious={() =>
              setAssignmentPage((value) => Math.max(1, value - 1))
            }
            onNext={() => setAssignmentPage((value) => value + 1)}
          />
          <TrainerSelectField
            searchDraft={trainerSearchDraft}
            onSearchDraftChange={setTrainerSearchDraft}
            onSearch={applyTrainerSearch}
            field={{ ...trainerField, onChange: onTrainerChange }}
            onValueChange={(value) =>
              setSelectedTrainerCache(
                trainers.find((trainer) => String(trainer._id) === value) ||
                  null,
              )
            }
            options={trainers}
            errorMessage={errors.toTrainerId?.message}
            page={trainerPage}
            totalPages={trainersQuery.data?.pagination?.totalPages || 1}
            onPrevious={() =>
              setTrainerPage((value) => Math.max(1, value - 1))
            }
            onNext={() => setTrainerPage((value) => value + 1)}
          />
          <label className="block text-sm font-semibold text-slate-800">
            Lý do chuyển
            <textarea {...register("reason")} rows={4} maxLength={500} placeholder="Ví dụ: HLV hiện tại bàn giao khách hàng trong thời gian nghỉ" className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal text-slate-950 placeholder:text-slate-400 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100" />
            {errors.reason && <span className="mt-1 block text-xs font-normal text-rose-700">{errors.reason.message}</span>}
          </label>
          {previewMutation.isError && <p className="text-sm font-medium text-rose-700" role="alert">{getErrorMessage(previewMutation.error)}</p>}
          <button type="submit" disabled={previewMutation.isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"><ShieldCheck className="size-4" aria-hidden="true" />{previewMutation.isPending ? "Đang xem trước..." : "Xem trước ảnh hưởng"}</button>
        </div>

        <div className="border-t border-slate-200 pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
          <TransferPreview
            preview={preview}
            confirmed={confirmed}
            onConfirmedChange={setConfirmed}
            onConfirm={confirmTransfer}
            isPending={transferMutation.isPending}
            errorMessage={
              transferMutation.isError
                ? getErrorMessage(transferMutation.error)
                : ""
            }
          />
        </div>
      </form>
    </div>
  );
};

export default TrainerTransferPanel;
