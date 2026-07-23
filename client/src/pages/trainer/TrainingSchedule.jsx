import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Plus,
  Trash2,
  Edit3,
  X,
  Clock,
  User,
  Dumbbell,
  AlertTriangle,
  BarChart3,
  FileText,
  Flame,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "react-toastify";
import SEO from "../../components/SEO";
import Header from "../../sections/Header/Header";
import Footer from "../../sections/Footer/Footer";
import ChatIcons from "../../components/ChatIcons";
import {
  getMySchedules,
  getMyClients,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  clearAllSchedules,
} from "../../services/trainingSchedule.service";

// ===== CONSTANTS =====
const DAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
const DAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const HOURS = [];
for (let h = 5; h <= 23; h++) {
  HOURS.push(`${String(h).padStart(2, "0")}:00`);
}

const EXERCISE_TYPES = [
  { label: "Boxing", color: "#ff5500" },
  { label: "Gym", color: "#3b82f6" },
  { label: "Cardio", color: "#10b981" },
  { label: "Yoga", color: "#8b5cf6" },
  { label: "Stretching", color: "#ec4899" },
];

const DEFAULT_COLORS = {
  Boxing: "#ff5500",
  Gym: "#3b82f6",
  Cardio: "#10b981",
  Yoga: "#8b5cf6",
  Stretching: "#ec4899",
};

const getVietnamDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return values.year + "-" + values.month + "-" + values.day;
};

const addDays = (dateKey, days) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return (
    date.getUTCFullYear() +
    "-" +
    String(date.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getUTCDate()).padStart(2, "0")
  );
};

const dayIndexForDate = (dateKey) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return jsDay === 0 ? 6 : jsDay - 1;
};

const nextDateForDay = (dayOfWeek) => {
  const today = getVietnamDateKey();
  const offset = (dayOfWeek - dayIndexForDate(today) + 7) % 7;
  return addDays(today, offset);
};

const newRequestId = () => window.crypto.randomUUID();

const INITIAL_FORM = {
  clientId: "",
  clientName: "",
  dayOfWeek: 0,
  occurrenceDateKey: addDays(getVietnamDateKey(), 1),
  startTime: "08:00",
  endTime: "09:00",
  exerciseType: "Boxing",
  customExerciseType: "",
  notes: "",
  color: "#ff5500",
};

// ===== HELPERS =====
const timeToMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const getCardPosition = (startTime, endTime) => {
  const startMin = timeToMinutes(startTime);
  // endTime "00:00" = midnight = 24*60 = 1440
  const endMin = endTime === "00:00" ? 24 * 60 : timeToMinutes(endTime);
  const gridStartMin = 5 * 60;
  const pxPerHour = 48;
  const top = ((startMin - gridStartMin) / 60) * pxPerHour;
  const height = ((endMin - startMin) / 60) * pxPerHour;
  return { top: Math.max(0, top), height: Math.max(pxPerHour / 2, height) };
};

const hexToRgba = (hex, alpha = 0.15) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// ===== SKELETON =====
const ScheduleSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="flex justify-between items-center">
      <div className="space-y-2">
        <div className="h-7 w-64 bg-white/10 rounded-lg" />
        <div className="h-4 w-48 bg-white/5 rounded" />
      </div>
      <div className="h-10 w-36 bg-white/10 rounded-lg" />
    </div>
    <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-4">
      <div className="grid grid-cols-8 gap-1 mb-2">
        <div />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-9 bg-white/10 rounded animate-pulse" />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="grid grid-cols-8 gap-1 mb-1">
          <div className="h-12 w-12 bg-white/5 rounded animate-pulse" />
          {Array.from({ length: 7 }).map((_, j) => (
            <div key={j} className="h-12 bg-white/5 rounded animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

// ===== CONFIRM DIALOG =====
const ConfirmDialog = ({ title, message, onConfirm, onCancel }) => (
  <div
    className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 animate-fade-in"
    onClick={onCancel}
  >
    <div
      className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl border border-gray-700 animate-zoomIn"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
        <AlertTriangle className="w-6 h-6 text-red-400" />
      </div>
      <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-400 mb-5">{message}</p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={onCancel}
          className="px-5 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm font-medium transition-colors"
        >
          Hủy
        </button>
        <button
          onClick={onConfirm}
          className="px-5 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 text-sm font-medium transition-colors"
        >
          Xác nhận
        </button>
      </div>
    </div>
  </div>
);

// ===== SCHEDULE MODAL =====
const ScheduleModal = ({ isOpen, onClose, onSubmit, onDelete, initialData, isEditing, isPending, defaultFormValues, clients }) => {
  const initialTypeIsCustom =
    initialData &&
    !EXERCISE_TYPES.some((type) => type.label === initialData.exerciseType);
  const [form, setForm] = useState(() =>
    initialData
      ? {
        clientId: initialData.clientId?._id || initialData.clientId || "",
        clientName: initialData.clientId?.name || initialData.clientName || "",
        dayOfWeek: initialData.dayOfWeek ?? 0,
        occurrenceDateKey:
          initialData.occurrenceDateKey || nextDateForDay(initialData.dayOfWeek ?? 0),
        startTime: initialData.startTime || "08:00",
        endTime: initialData.endTime || "09:00",
        exerciseType: initialTypeIsCustom ? "Khác" : initialData.exerciseType || "Boxing",
        customExerciseType: initialTypeIsCustom ? initialData.exerciseType : "",
        notes: initialData.notes || "",
        color: initialData.color || "#ff5500",
      }
      : {
        ...INITIAL_FORM,
        ...(defaultFormValues || {}),
      },
  );
  const [useCustomType, setUseCustomType] = useState(Boolean(initialTypeIsCustom));

  if (!isOpen) return null;

  const handleExerciseChange = (value) => {
    if (value === "Khác") {
      setUseCustomType(true);
      setForm((f) => ({ ...f, exerciseType: "Khác", color: "#14b8a6" }));
    } else {
      setUseCustomType(false);
      setForm((f) => ({
        ...f,
        exerciseType: value,
        customExerciseType: "",
        color: DEFAULT_COLORS[value] || "#ff5500",
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalType = useCustomType ? form.customExerciseType.trim() : form.exerciseType;
    if (!finalType) return toast.error("Vui lòng nhập loại bài tập");
    if (!form.clientId) return toast.error("Vui lòng chọn khách hàng");
    if (form.endTime !== "00:00" && form.startTime >= form.endTime) return toast.error("Giờ bắt đầu phải nhỏ hơn giờ kết thúc");

    onSubmit({
      clientId: form.clientId,
      occurrenceDateKey: form.occurrenceDateKey,
      dayOfWeek: dayIndexForDate(form.occurrenceDateKey),
      startTime: form.startTime,
      endTime: form.endTime,
      exerciseType: finalType,
      notes: form.notes.trim(),
      color: form.color,
    });
  };

  const inputClass =
    "w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all";

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-700 animate-zoomIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase">
            <CalendarDays className="w-5 h-5 text-primary" />
            {isEditing ? "Chỉnh sửa lịch tập" : "Tạo lịch tập mới"}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              <User className="w-3.5 h-3.5 inline mr-1" /> Tên khách hàng *
            </label>
            <select 
              value={form.clientId} 
              onChange={(e) => {
                const c = clients.find(x => x._id === e.target.value);
                setForm((f) => ({ ...f, clientId: e.target.value, clientName: c ? c.name : "" }));
              }} 
              className={inputClass} 
              required
            >
              <option value="">-- Chọn khách hàng --</option>
              {clients.map(c => (
                <option key={c._id} value={c._id}>{c.name} ({c.email})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              <CalendarDays className="w-3.5 h-3.5 inline mr-1" /> Ngày tập *
            </label>
            <input
              type="date"
              value={form.occurrenceDateKey}
              min={getVietnamDateKey()}
              max={addDays(getVietnamDateKey(), 56)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  occurrenceDateKey: e.target.value,
                  dayOfWeek: dayIndexForDate(e.target.value),
                }))
              }
              className={inputClass}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <Clock className="w-3.5 h-3.5 inline mr-1" /> Giờ bắt đầu *
              </label>
              <input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <Clock className="w-3.5 h-3.5 inline mr-1" /> Giờ kết thúc *
              </label>
              <input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} className={inputClass} required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              <Dumbbell className="w-3.5 h-3.5 inline mr-1" /> Loại bài tập *
            </label>
            <select value={useCustomType ? "Khác" : form.exerciseType} onChange={(e) => handleExerciseChange(e.target.value)} className={inputClass}>
              {EXERCISE_TYPES.map((t) => (
                <option key={t.label} value={t.label}>{t.label}</option>
              ))}
              <option value="Khác">Khác (tự nhập)</option>
            </select>
            {useCustomType && (
              <input type="text" value={form.customExerciseType} onChange={(e) => setForm((f) => ({ ...f, customExerciseType: e.target.value }))} placeholder="Nhập loại bài tập..." className={`${inputClass} mt-2`} maxLength={50} required />
            )}
          </div>

          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Màu</label>
              <input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className="w-10 h-10 rounded-lg border-2 border-gray-600 cursor-pointer p-0.5 hover:border-primary transition-colors" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <FileText className="w-3.5 h-3.5 inline mr-1" /> Ghi chú
              </label>
              <input type="text" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="VD: Tập nhẹ, tăng cường chân..." className={inputClass} maxLength={200} />
            </div>
          </div>

          {/* Preview */}
          <div className="p-3 rounded-lg border border-dashed border-gray-600 bg-gray-900/50">
            <p className="text-xs text-gray-500 mb-1">Xem trước:</p>
            <div className="rounded-lg px-3 py-2 border-l-4" style={{ background: hexToRgba(form.color, 0.2), borderLeftColor: form.color, color: form.color }}>
              <p className="text-sm font-semibold">{form.clientName || "Tên khách hàng"}</p>
              <p className="text-xs opacity-80">{form.startTime} - {form.endTime}</p>
              <p className="text-xs opacity-70">{useCustomType ? form.customExerciseType || "Loại bài tập" : form.exerciseType}</p>
            </div>
          </div>

          {/* Delete button (only in edit mode) */}
          {isEditing && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(initialData)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Xóa lịch tập này
            </button>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm font-medium transition-colors">
              Hủy
            </button>
            <button type="submit" disabled={isPending} className="flex-1 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/30">
              {isPending ? "Đang lưu..." : isEditing ? "Cập nhật" : "Tạo lịch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ===== MAIN COMPONENT =====
const TrainingSchedule = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [defaultFormValues, setDefaultFormValues] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const {
    data: schedules = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["training-schedules"],
    queryFn: () => getMySchedules().then((res) => res.data.data || []),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["my-clients"],
    queryFn: () => getMyClients().then(res => res.data.data || []),
  });

  const createMut = useMutation({
    mutationFn: (data) => createSchedule(data),
    onSuccess: () => { toast.success("Đã tạo lịch tập thành công!"); queryClient.invalidateQueries({ queryKey: ["training-schedules"] }); setIsModalOpen(false); },
    onError: (err) => {
      if (err.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ["training-schedules"] });
      }
      toast.error(err.response?.data?.message || "Lỗi khi tạo lịch tập");
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => updateSchedule(id, data),
    onSuccess: () => { toast.success("Đã cập nhật lịch tập!"); queryClient.invalidateQueries({ queryKey: ["training-schedules"] }); setIsModalOpen(false); setEditingSchedule(null); },
    onError: (err) => {
      if (err.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ["training-schedules"] });
      }
      toast.error(err.response?.data?.message || "Lỗi khi cập nhật");
    },
  });

  const deleteMut = useMutation({
    mutationFn: ({ id, data }) => deleteSchedule(id, data),
    onSuccess: () => { toast.success("Đã hủy lịch tập!"); queryClient.invalidateQueries({ queryKey: ["training-schedules"] }); },
    onError: (err) => {
      if (err.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ["training-schedules"] });
      }
      toast.error(err.response?.data?.message || "Lỗi khi hủy");
    },
  });

  const clearMut = useMutation({
    mutationFn: (data) => clearAllSchedules(data),
    onSuccess: (res) => { toast.success(res.data.message || "Đã hủy tất cả!"); queryClient.invalidateQueries({ queryKey: ["training-schedules"] }); setConfirmAction(null); },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi"),
  });

  const today = useMemo(() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; }, []);

  const weekDates = useMemo(() => {
    const todayKey = getVietnamDateKey();
    const monday = addDays(todayKey, -dayIndexForDate(todayKey));
    return Array.from(
      { length: 7 },
      (_, index) => addDays(monday, weekOffset * 7 + index),
    );
  }, [weekOffset]);

  const schedulesByDay = useMemo(() => {
    const g = Array.from({ length: 7 }, () => []);
    schedules.forEach((s) => {
      const index = s.occurrenceDateKey
        ? weekDates.indexOf(s.occurrenceDateKey)
        : weekOffset === 0
          ? s.dayOfWeek
          : -1;
      if (index >= 0 && index <= 6) g[index].push(s);
    });
    return g;
  }, [schedules, weekDates, weekOffset]);

  const stats = useMemo(() => {
    const clientsSet = new Set(schedules.map((s) => s.clientId?._id || s.clientName.toLowerCase()));
    const types = {};
    schedules.forEach((s) => { types[s.exerciseType] = (types[s.exerciseType] || 0) + 1; });
    return { totalSlots: schedules.length, uniqueClients: clientsSet.size, typeCounts: types };
  }, [schedules]);

  const handleCreate = useCallback((dayOfWeek, startTime, occurrenceDateKey) => {
    setEditingSchedule(null);
    if (dayOfWeek !== undefined && startTime !== undefined) {
      const startH = parseInt(startTime.split(":")[0], 10);
      const endTime = startH >= 23 ? "00:00" : `${String(startH + 1).padStart(2, "0")}:00`;
      setDefaultFormValues({
        dayOfWeek,
        occurrenceDateKey: occurrenceDateKey || nextDateForDay(dayOfWeek),
        startTime,
        endTime,
      });
    } else {
      setDefaultFormValues(null);
    }
    setIsModalOpen(true);
  }, []);
  const handleEdit = useCallback((s) => { setEditingSchedule(s); setIsModalOpen(true); }, []);

  const handleDelete = useCallback((s) => {
    setConfirmAction({
      title: "Hủy lịch tập",
      message: `Lịch của "${s.clientId?.name || s.clientName}" sẽ được lưu trong lịch sử.`,
      onConfirm: () => {
        deleteMut.mutate({
          id: s._id,
          data: {
            revision: s.revision,
            requestId: newRequestId(),
            reason: "Huấn luyện viên hủy lịch",
          },
        });
        setConfirmAction(null);
      },
    });
  }, [deleteMut]);

  const handleClearAll = useCallback(() => {
    if (!schedules.length) return toast.info("Không có lịch tập nào để hủy");
    setConfirmAction({
      title: "Hủy tất cả lịch tập",
      message: `Bạn có chắc muốn hủy tất cả ${schedules.length} lịch tập?`,
      onConfirm: () => clearMut.mutate({ requestId: newRequestId() }),
    });
  }, [schedules.length, clearMut]);

  const handleSubmit = useCallback((data) => {
    if (editingSchedule) {
      updateMut.mutate({
        id: editingSchedule._id,
        data: {
          ...data,
          revision: editingSchedule.revision,
          requestId: newRequestId(),
        },
      });
    } else {
      createMut.mutate({ ...data, requestId: newRequestId() });
    }
  }, [editingSchedule, updateMut, createMut]);

  if (isError) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
          <div className="text-center text-white">
            <p className="text-red-400 mb-4">Lỗi tải dữ liệu: {error?.message}</p>
            <button onClick={() => refetch()} className="px-4 py-2 bg-primary text-white rounded-lg">Thử lại</button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <SEO title="Lịch tập khách hàng" description="Quản lý lịch tập hàng tuần cho khách hàng." noindex />
      <Header />

      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white pt-28 pb-8">
        <div className="container-custom">
          {isLoading ? (
            <ScheduleSkeleton />
          ) : (
            <>
              {/* ===== HERO HEADER ===== */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-3 bg-primary/20 backdrop-blur-sm rounded-full px-5 py-2 mb-4">
                  <Flame className="text-primary w-6 h-6" />
                  <span className="font-semibold text-primary tracking-wide">LỊCH TẬP KHÁCH HÀNG</span>
                </div>
                <h1 className="font-display text-fluid-6xl font-black uppercase tracking-normal">
                  QUẢN LÝ <span className="text-primary">LỊCH TẬP</span>
                </h1>
                <div className="w-24 h-1 bg-primary mx-auto mt-4 rounded-full" />
                <p className="text-gray-400 mt-4 max-w-xl mx-auto">
                  Mỗi buổi tập gắn với ngày cụ thể và được lưu lại trong lịch sử
                </p>
              </div>

              {/* ===== ACTION BAR ===== */}
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-4 md:p-6 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/20 text-primary border border-primary/30">
                      {stats.totalSlots} buổi tập
                    </span>
                    {stats.uniqueClients > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {stats.uniqueClients} khách hàng
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center border border-gray-700 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setWeekOffset((value) => Math.max(0, value - 1))}
                        disabled={weekOffset === 0}
                        className="p-2 text-gray-300 hover:bg-gray-700 disabled:opacity-40"
                        title="Tuần trước"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-3 text-xs text-gray-300">
                        {weekDates[0]} - {weekDates[6]}
                      </span>
                      <button
                        type="button"
                        onClick={() => setWeekOffset((value) => Math.min(7, value + 1))}
                        disabled={weekOffset === 7}
                        className="p-2 text-gray-300 hover:bg-gray-700 disabled:opacity-40"
                        title="Tuần sau"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    {schedules.length > 0 && (
                      <button onClick={handleClearAll} className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-medium transition-colors">
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Hủy tất cả</span>
                      </button>
                    )}
                    <button onClick={handleCreate} className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all shadow-lg shadow-primary/30">
                      <Plus className="w-4 h-4" /> Tạo lịch mới
                    </button>
                  </div>
                </div>
              </div>

              {/* ===== MAIN CONTENT (always show grid) ===== */}
              <div className="flex flex-col lg:flex-row gap-5">
                {/* SIDEBAR (lg only, only when has schedules) */}
                {schedules.length > 0 && (
                  <div className="hidden lg:flex flex-col gap-4 w-56 flex-shrink-0">
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-4">
                      <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5 uppercase">
                        <Dumbbell className="w-4 h-4 text-gray-400" /> Danh mục
                      </h4>
                      <div className="space-y-2">
                        {Object.entries(stats.typeCounts).map(([type, count]) => {
                          const color = EXERCISE_TYPES.find((t) => t.label === type)?.color || "#14b8a6";
                          return (
                            <div key={type} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: hexToRgba(color, 0.15) }}>
                              <span className="w-3 h-3 rounded flex-shrink-0" style={{ background: color }} />
                              <span className="text-gray-200 text-sm flex-1 truncate">{type}</span>
                              <span className="text-xs text-gray-400 font-medium">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-4">
                      <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5 uppercase">
                        <BarChart3 className="w-4 h-4 text-gray-400" /> Tổng quan
                      </h4>
                      <div className="space-y-2">
                        <div className="bg-gray-900/50 rounded-xl p-3.5 border border-gray-700 hover:-translate-y-0.5 transition-transform">
                          <p className="text-2xl font-bold text-primary">{stats.totalSlots}</p>
                          <p className="text-xs text-gray-400">Tổng buổi tập</p>
                        </div>
                        <div className="bg-gray-900/50 rounded-xl p-3.5 border border-gray-700 hover:-translate-y-0.5 transition-transform">
                          <p className="text-2xl font-bold text-blue-400">{stats.uniqueClients}</p>
                          <p className="text-xs text-gray-400">Khách hàng</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== WEEKLY GRID (always visible) ===== */}
                <div className="flex-1 bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 overflow-hidden">
                  {/* Desktop Grid */}
                  <div className="hidden md:block overflow-x-auto p-3" style={{ minWidth: 700 }}>
                    <div className="grid" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
                      {/* Day headers */}
                      <div />
                      {DAY_SHORT.map((label, idx) => (
                        <div key={idx} className={`text-center py-2.5 px-1 border-l border-gray-700/50 select-none ${weekOffset === 0 && idx === today ? "text-primary" : "text-gray-400"}`}>
                          <div className="text-[0.65rem] uppercase tracking-wide opacity-60">{label}</div>
                          <div className="text-[0.65rem] opacity-60">{weekDates[idx].slice(5)}</div>
                          <div className="mt-0.5">
                            {weekOffset === 0 && idx === today ? (
                              <span className="inline-flex items-center justify-center px-2 h-7 rounded-full bg-primary text-white text-xs font-bold">
                                {DAY_LABELS[idx]}
                              </span>
                            ) : (
                              <span className="text-sm font-bold">{DAY_LABELS[idx]}</span>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Time rows */}
                      {HOURS.map((hour, rowIdx) => (
                        <div key={hour} style={{ display: "contents" }}>
                          <div className="text-right pr-2 text-[0.7rem] text-gray-500 h-12 flex items-start justify-end">{hour}</div>
                          {Array.from({ length: 7 }).map((_, dayIdx) => (
                            <div
                              key={dayIdx}
                              className="relative border-l border-t border-gray-700/30 h-12 hover:bg-white/[0.02] cursor-pointer"
                              onClick={() => handleCreate(dayIdx, hour, weekDates[dayIdx])}
                            >
                              {rowIdx === 0 &&
                                schedulesByDay[dayIdx].map((s) => {
                                  const { top, height } = getCardPosition(s.startTime, s.endTime);
                                  return (
                                    <div
                                      key={s._id}
                                      className="absolute left-0.5 right-0.5 rounded-lg px-1.5 py-1 cursor-pointer border-l-[3px] overflow-hidden hover:scale-[1.02] hover:shadow-lg hover:z-10 transition-all z-[5]"
                                      style={{
                                        top: `${top}px`,
                                        height: `${height}px`,
                                        background: hexToRgba(s.color, 0.2),
                                        borderLeftColor: s.color,
                                        color: s.color,
                                      }}
                                      onClick={(e) => { e.stopPropagation(); handleEdit(s); }}
                                      title={`${s.clientId?.name || s.clientName}\n${s.startTime} - ${s.endTime}\n${s.exerciseType}${s.notes ? "\n" + s.notes : ""}`}
                                    >
                                      <p className="text-[0.7rem] font-semibold leading-tight truncate">{s.clientId?.name || s.clientName}</p>
                                      {height >= 36 && <p className="text-[0.6rem] opacity-80 mt-0.5">{s.startTime} - {s.endTime}</p>}
                                      {height >= 52 && <p className="text-[0.6rem] opacity-70 truncate">{s.exerciseType}</p>}
                                    </div>
                                  );
                                })}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ===== MOBILE LIST ===== */}
                  <div className="md:hidden p-3 space-y-3">
                    {DAY_LABELS.map((dayLabel, dayIdx) => {
                      const daySchedules = schedulesByDay[dayIdx];
                      return (
                        <div key={dayIdx} className={`rounded-xl border overflow-hidden ${weekOffset === 0 && dayIdx === today ? "ring-2 ring-primary/30 border-primary/30" : "border-gray-700"}`}>
                          <div className={`px-4 py-2.5 text-sm font-semibold flex items-center justify-between border-b ${weekOffset === 0 && dayIdx === today ? "bg-primary/10 text-primary border-primary/20" : "bg-gray-800/80 text-gray-300 border-gray-700"}`}>
                            <span>
                              {dayLabel} · {weekDates[dayIdx].slice(5)}
                              {weekOffset === 0 && dayIdx === today && (
                                <span className="ml-2 text-[0.65rem] bg-primary text-white px-1.5 py-0.5 rounded-full">Hôm nay</span>
                              )}
                            </span>
                            <span className="text-xs text-gray-500">{daySchedules.length} buổi</span>
                          </div>
                          {daySchedules.length === 0 ? (
                            <div className="px-4 py-6 text-center text-xs text-gray-600">Chưa có lịch tập</div>
                          ) : (
                            daySchedules
                              .sort((a, b) => a.startTime.localeCompare(b.startTime))
                              .map((s) => (
                                <div key={s._id} className="px-4 py-3 border-b border-gray-700/50 last:border-b-0 flex gap-3 items-start cursor-pointer hover:bg-white/[0.03] transition-colors" onClick={() => handleEdit(s)}>
                                  <div className="w-1 min-h-[36px] rounded-full flex-shrink-0" style={{ background: s.color }} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <p className="text-sm font-bold text-gray-200 truncate">{s.clientId?.name || s.clientName}</p>
                                      <span className="text-[0.65rem] px-1.5 py-0.5 rounded font-medium border" style={{ color: s.color, borderColor: hexToRgba(s.color, 0.3), backgroundColor: hexToRgba(s.color, 0.1) }}>
                                        {s.exerciseType}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-400">{s.startTime} - {s.endTime}</p>
                                    {s.notes && <p className="text-xs text-gray-500 mt-0.5 truncate">{s.notes}</p>}
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(s); }} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-500 transition-colors" title="Sửa">
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(s); }} className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors" title="Xóa">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <ChatIcons />
      <Footer />

      {/* Modal */}
      {isModalOpen && <ScheduleModal
        key={editingSchedule?._id || JSON.stringify(defaultFormValues)}
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingSchedule(null); setDefaultFormValues(null); }}
        onSubmit={handleSubmit}
        onDelete={(s) => { setIsModalOpen(false); setEditingSchedule(null); handleDelete(s); }}
        initialData={editingSchedule}
        isEditing={!!editingSchedule}
        isPending={createMut.isPending || updateMut.isPending || deleteMut.isPending}
        defaultFormValues={defaultFormValues}
        clients={clients}
      />}

      {/* Confirm */}
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </>
  );
};

export default TrainingSchedule;
