import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Trash2, Edit3, X, Clock, AlertTriangle, FileText, Dumbbell } from "lucide-react";
import { toast } from "react-toastify";
import SEO from "../../components/SEO";
import Header from "../../sections/Header/Header";
import Footer from "../../sections/Footer/Footer";
import ChatIcons from "../../components/ChatIcons";
import {
  getMyBookings,
  getMyTrainer,
  getBusyTimes,
  createBooking,
  updateBooking,
  cancelBooking,
} from "../../services/trainingBooking.service";

const DAY_KEYS = ["days.mon", "days.tue", "days.wed", "days.thu", "days.fri", "days.sat", "days.sun"];

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

const newRequestId = () => window.crypto.randomUUID();

const ConfirmDialog = ({ title, message, onConfirm, onCancel }) => {
  const { t } = useTranslation("booking");
  return (
    <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 animate-fade-in" onClick={onCancel}>
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl border border-gray-700 animate-zoomIn" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
        <p className="text-sm text-gray-400 mb-5">{message}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onCancel} className="px-5 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm font-medium transition-colors">
            {t("dialog.cancel")}
          </button>
          <button onClick={onConfirm} className="px-5 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 text-sm font-medium transition-colors">
            {t("dialog.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
};

const BookingModal = ({ isOpen, onClose, onSubmit, initialData, isPending, trainer }) => {
  const { t } = useTranslation("booking");
  const [form, setForm] = useState({
    occurrenceDateKey:
      initialData?.occurrenceDateKey || addDays(getVietnamDateKey(), 1),
    startTime: initialData?.startTime || "18:00",
    endTime: initialData?.endTime || "19:00",
    notes: initialData?.notes || "",
  });

  const { data: busyTimes = [] } = useQuery({
    queryKey: ["busy-times", trainer?._id, form.occurrenceDateKey],
    queryFn: () => getBusyTimes(trainer._id, form.occurrenceDateKey).then((res) => res.data.data),
    enabled: !!trainer?._id,
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.endTime !== "00:00" && form.startTime >= form.endTime) {
      return toast.error(t("modal.time_error"));
    }
    onSubmit(form);
  };

  const inputClass = "w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all";

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-700 animate-zoomIn" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            {initialData ? t("modal.edit_title") : t("modal.create_title")}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              <CalendarDays className="w-3.5 h-3.5 inline mr-1" /> Ngày tập
            </label>
            <input
              type="date"
              value={form.occurrenceDateKey}
              min={getVietnamDateKey()}
              max={addDays(getVietnamDateKey(), 56)}
              onChange={(e) => setForm((f) => ({ ...f, occurrenceDateKey: e.target.value }))}
              className={inputClass}
              required
            />
            {trainer?._id && (
              <div className="mt-3 text-xs">
                {busyTimes.length > 0 ? (
                  <div className="text-amber-400 bg-amber-400/10 p-2.5 rounded-lg border border-amber-400/20">
                    <span className="font-semibold block mb-1.5">{t("modal.busy_times")}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {busyTimes.map((b, i) => (
                        <span key={i} className="px-2 py-1 bg-amber-400/20 rounded font-medium">{b.startTime} - {b.endTime}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-green-400 bg-green-400/10 p-2.5 rounded-lg border border-green-400/20">
                    <span className="font-semibold block">{t("modal.free_times")}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <Clock className="w-3.5 h-3.5 inline mr-1" /> {t("modal.start_time")}
              </label>
              <input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <Clock className="w-3.5 h-3.5 inline mr-1" /> {t("modal.end_time")}
              </label>
              <input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} className={inputClass} required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              <Dumbbell className="w-3.5 h-3.5 inline mr-1" /> {t("modal.trainer")}
            </label>
            <input
              type="text"
              value={trainer?.name || t("modal.no_trainer")}
              disabled
              className={`${inputClass} bg-gray-800/50 text-gray-400 cursor-not-allowed`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              <FileText className="w-3.5 h-3.5 inline mr-1" /> {t("modal.notes")}
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder={t("modal.notes_placeholder")}
              className={`${inputClass} resize-none h-24`}
              maxLength={200}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm font-medium transition-colors">
              {t("modal.cancel")}
            </button>
            <button type="submit" disabled={isPending} className="flex-1 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all shadow-lg shadow-primary/30">
              {isPending ? t("modal.processing") : initialData ? t("modal.submit_edit") : t("modal.submit_create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const BookTraining = () => {
  const { t, i18n } = useTranslation("booking");
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [confirmEditAction, setConfirmEditAction] = useState(null);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => getMyBookings().then((res) => res.data.data || []),
  });

  const { data: trainer } = useQuery({
    queryKey: ["my-trainer"],
    queryFn: () => getMyTrainer().then((res) => res.data.data),
  });

  const isEditable = useCallback((schedule) => {
    if (schedule.exerciseType !== "Tự do (Khách đăng ký)") return false;

    const editTimestamp = schedule.lastClientEditAt || schedule.lastClientEdit;
    if (!editTimestamp) return true;
    const now = new Date();
    const lastEdit = new Date(editTimestamp);
    const diffMs = now - lastEdit;
    return diffMs >= 24 * 60 * 60 * 1000;
  }, []);

  const createMut = useMutation({
    mutationFn: (data) => createBooking(data),
    onSuccess: () => {
      toast.success(t("page.success_create"));
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      setIsModalOpen(false);
    },
    onError: (err) => {
      if (err.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      }
      toast.error(err.response?.data?.message || t("page.error_create"));
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => updateBooking(id, data),
    onSuccess: () => {
      toast.success(t("page.success_update"));
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      setIsModalOpen(false);
      setEditingSchedule(null);
    },
    onError: (err) => {
      if (err.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      }
      toast.error(err.response?.data?.message || t("page.error_update"));
    },
  });

  const cancelMut = useMutation({
    mutationFn: ({ id, data }) => cancelBooking(id, data),
    onSuccess: () => {
      toast.success("Đã hủy lịch tập");
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
    onError: (err) => {
      if (err.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      }
      toast.error(err.response?.data?.message || "Không thể hủy lịch tập");
    },
  });

  const todayKey = useMemo(() => getVietnamDateKey(), []);

  const handleEditClick = (s) => {
    if (s.exerciseType !== "Tự do (Khách đăng ký)") {
      toast.info(t("page.trainer_message"), { autoClose: 4000 });
      return;
    }
    if (!isEditable(s)) {
      toast.error(t("page.edit_limit_error"));
      return;
    }

    setConfirmEditAction({
      title: t("modal.edit_title"),
      message: t("page.confirm_edit_msg"),
      onConfirm: () => {
        setConfirmEditAction(null);
        setEditingSchedule(s);
        setIsModalOpen(true);
      }
    });
  };

  const handleSubmit = (data) => {
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
      setConfirmEditAction({
        title: t("dialog.confirm_register"),
        message: t("page.confirm_register_msg"),
        onConfirm: () => {
          setConfirmEditAction(null);
          createMut.mutate({ ...data, requestId: newRequestId() });
        }
      });
    }
  };

  const handleCancel = (booking) => {
    setConfirmEditAction({
      title: "Hủy lịch tập",
      message: "Lịch sẽ được lưu trong lịch sử và khung giờ sẽ được giải phóng.",
      onConfirm: () => {
        setConfirmEditAction(null);
        cancelMut.mutate({
          id: booking._id,
          data: {
            revision: booking.revision,
            requestId: newRequestId(),
            reason: "Khách hàng hủy lịch",
          },
        });
      },
    });
  };

  return (
    <>
      <SEO title={t("seo.title")} description={t("seo.description")} noindex />
      <Header />

      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white pt-28 pb-8">
        <div className="container-custom max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 bg-primary/20 backdrop-blur-sm rounded-full px-5 py-2 mb-4">
              <Dumbbell className="text-primary w-6 h-6" />
              <span className="font-semibold text-primary tracking-wide">{t("page.tag")}</span>
            </div>
            <h1 className="font-display text-fluid-5xl font-black uppercase tracking-normal">
              {t("page.title_main")} <span className="text-primary">{t("page.title_sub")}</span>
            </h1>
            <p className="text-gray-400 mt-4">
              {t("page.desc")}
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-4 md:p-6 mb-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" />
                {t("page.registered_list")}
              </h2>
              <button onClick={() => {
                if (!trainer) return toast.error(t("page.no_trainer_error"));
                setEditingSchedule(null); setIsModalOpen(true);
              }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all shadow-lg">
                <Plus className="w-4 h-4" /> {t("page.add_new")}
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {isLoading ? (
              <div className="col-span-2 text-center py-10 text-gray-500">{t("page.loading")}</div>
            ) : bookings.length === 0 ? (
              <div className="col-span-2 bg-gray-800/30 rounded-2xl border border-dashed border-gray-700 p-10 text-center">
                <CalendarDays className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 font-medium mb-1">{t("page.no_bookings_title")}</p>
                <p className="text-sm text-gray-500">{t("page.no_bookings_desc")}</p>
              </div>
            ) : (
              bookings.map((booking) => (
                <div key={booking._id} className="bg-gray-800/80 rounded-2xl border border-gray-700 p-5 hover:border-primary/50 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${booking.occurrenceDateKey === todayKey ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300'}`}>
                        {booking.occurrenceDateKey || t(DAY_KEYS[booking.dayOfWeek])}
                      </span>
                      <span className="text-sm text-gray-400">
                        {booking.startTime} - {booking.endTime}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (!isEditable(booking)) return toast.error(t("page.edit_limit_error"));
                          handleEditClick(booking);
                        }}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isEditable(booking)
                            ? "hover:bg-gray-700 text-gray-400 hover:text-white"
                            : "text-gray-600 bg-gray-800 cursor-not-allowed opacity-50"
                        }`}
                        title={isEditable(booking) ? t("page.edit_btn_title") : t("page.edit_limit_title")}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleCancel(booking)}
                        disabled={cancelMut.isPending}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-colors disabled:opacity-50"
                        title="Hủy lịch tập"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {booking.notes && (
                    <div className="mt-3 text-sm text-gray-400 bg-gray-900/50 p-3 rounded-lg border border-gray-700/50">
                      <strong className="text-gray-300">{t("page.notes_label")}</strong> {booking.notes}
                    </div>
                  )}
                  {booking.trainerId && (
                    <div className="mt-3 text-sm text-gray-400 bg-gray-900/50 p-3 rounded-lg border border-gray-700/50 flex flex-col gap-2">
                      <div><strong className="text-gray-300">{t("page.trainer_label")}</strong> {booking.trainerId.name}</div>
                      {booking.exerciseType && (
                        <div><strong className="text-gray-300">{t("page.session_label")}</strong> {booking.exerciseType}</div>
                      )}
                    </div>
                  )}
                  {booking.lastClientEdit && (
                    <div className="mt-3 text-[11px] text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {t("page.last_edit")} {new Date(booking.lastClientEdit).toLocaleString(i18n.language === "vi" ? "vi-VN" : "en-US")}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <ChatIcons />
      <Footer />

      <BookingModal
        key={editingSchedule?._id || "create"}
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingSchedule(null); }}
        onSubmit={handleSubmit}
        initialData={editingSchedule}
        isPending={createMut.isPending || updateMut.isPending || cancelMut.isPending}
        trainer={trainer}
      />

      {confirmEditAction && (
        <ConfirmDialog
          title={confirmEditAction.title}
          message={confirmEditAction.message}
          onConfirm={confirmEditAction.onConfirm}
          onCancel={() => setConfirmEditAction(null)}
        />
      )}
    </>
  );
};

export default BookTraining;
