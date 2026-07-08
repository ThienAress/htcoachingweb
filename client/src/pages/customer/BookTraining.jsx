import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Trash2, Edit3, X, Clock, AlertTriangle, FileText, Dumbbell } from "lucide-react";
import { toast } from "react-toastify";
import SEO from "../../components/SEO";
import Header from "../../sections/Header/Header";
import Footer from "../../sections/Footer/Footer";
import ChatIcons from "../../components/ChatIcons";
import { getMyBookings, getMyTrainer, getBusyTimes, createBooking, updateBooking } from "../../services/trainingBooking.service";
import { deleteSchedule } from "../../services/trainingSchedule.service"; // Dùng chung API xoá lịch nếu cần

const DAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];

const ConfirmDialog = ({ title, message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 animate-fade-in" onClick={onCancel}>
    <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl border border-gray-700 animate-zoomIn" onClick={(e) => e.stopPropagation()}>
      <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
        <AlertTriangle className="w-6 h-6 text-red-400" />
      </div>
      <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-400 mb-5">{message}</p>
      <div className="flex gap-3 justify-center">
        <button onClick={onCancel} className="px-5 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm font-medium transition-colors">
          Hủy
        </button>
        <button onClick={onConfirm} className="px-5 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 text-sm font-medium transition-colors">
          Tiếp tục
        </button>
      </div>
    </div>
  </div>
);

const BookingModal = ({ isOpen, onClose, onSubmit, initialData, isPending, trainer }) => {
  const [form, setForm] = useState({
    dayOfWeek: initialData?.dayOfWeek ?? 0,
    startTime: initialData?.startTime || "18:00",
    endTime: initialData?.endTime || "19:00",
    notes: initialData?.notes || "",
  });

  const { data: busyTimes = [] } = useQuery({
    queryKey: ["busy-times", trainer?._id, form.dayOfWeek],
    queryFn: () => getBusyTimes(trainer._id, form.dayOfWeek).then((res) => res.data.data),
    enabled: !!trainer?._id,
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.endTime !== "00:00" && form.startTime >= form.endTime) {
      return toast.error("Giờ bắt đầu phải nhỏ hơn giờ kết thúc");
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
            {initialData ? "Chỉnh sửa lịch tập" : "Đăng ký giờ tập"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              <CalendarDays className="w-3.5 h-3.5 inline mr-1" /> Ngày trong tuần
            </label>
            <select value={form.dayOfWeek} onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: Number(e.target.value) }))} className={inputClass}>
              {DAY_LABELS.map((label, idx) => (
                <option key={idx} value={idx}>{label}</option>
              ))}
            </select>
            {trainer?._id && (
              <div className="mt-3 text-xs">
                {busyTimes.length > 0 ? (
                  <div className="text-amber-400 bg-amber-400/10 p-2.5 rounded-lg border border-amber-400/20">
                    <span className="font-semibold block mb-1.5">⏳ HLV đã có lịch vào các giờ:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {busyTimes.map((b, i) => (
                        <span key={i} className="px-2 py-1 bg-amber-400/20 rounded font-medium">{b.startTime} - {b.endTime}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-green-400 bg-green-400/10 p-2.5 rounded-lg border border-green-400/20">
                    <span className="font-semibold block">✅ HLV hiện đang trống lịch ngày này</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <Clock className="w-3.5 h-3.5 inline mr-1" /> Giờ bắt đầu
              </label>
              <input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <Clock className="w-3.5 h-3.5 inline mr-1" /> Giờ kết thúc
              </label>
              <input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} className={inputClass} required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              <Dumbbell className="w-3.5 h-3.5 inline mr-1" /> Huấn luyện viên phụ trách
            </label>
            <input 
              type="text" 
              value={trainer?.name || "Chưa có dữ liệu HLV"} 
              disabled 
              className={`${inputClass} bg-gray-800/50 text-gray-400 cursor-not-allowed`} 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              <FileText className="w-3.5 h-3.5 inline mr-1" /> Ghi chú cho HLV
            </label>
            <textarea 
              value={form.notes} 
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} 
              placeholder="VD: Cần tập trung giảm mỡ bụng..." 
              className={`${inputClass} resize-none h-24`} 
              maxLength={200} 
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm font-medium transition-colors">
              Hủy
            </button>
            <button type="submit" disabled={isPending} className="flex-1 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all shadow-lg shadow-primary/30">
              {isPending ? "Đang xử lý..." : initialData ? "Lưu thay đổi" : "Đăng ký"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const BookTraining = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [confirmEditAction, setConfirmEditAction] = useState(null);

  const { data: bookings = [], isLoading, refetch } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => getMyBookings().then((res) => res.data.data || []),
  });

  const { data: trainer } = useQuery({
    queryKey: ["my-trainer"],
    queryFn: () => getMyTrainer().then((res) => res.data.data),
  });

  const isEditable = useCallback((schedule) => {
    if (schedule.exerciseType !== "Tự do (Khách đăng ký)") return false;

    if (!schedule.lastClientEdit) return true;
    const now = new Date();
    const lastEdit = new Date(schedule.lastClientEdit);
    const diffMs = now - lastEdit;
    return diffMs >= 24 * 60 * 60 * 1000;
  }, []);

  const createMut = useMutation({
    mutationFn: (data) => createBooking(data),
    onSuccess: () => { 
      toast.success("Đã đăng ký lịch tập thành công!"); 
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] }); 
      setIsModalOpen(false); 
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi khi đăng ký lịch tập"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => updateBooking(id, data),
    onSuccess: () => { 
      toast.success("Đã cập nhật lịch tập!"); 
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] }); 
      setIsModalOpen(false); 
      setEditingSchedule(null); 
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi khi cập nhật"),
  });

  const today = useMemo(() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; }, []);

  const handleEditClick = (s) => {
    if (s.exerciseType !== "Tự do (Khách đăng ký)") {
      toast.info("Lịch tập này do Huấn luyện viên tạo. Vui lòng liên hệ trực tiếp HLV nếu có thay đổi.", { autoClose: 4000 });
      return;
    }
    if (!isEditable(s)) {
      toast.error("Bạn đã hết lượt sửa hôm nay cho lịch tập này.");
      return;
    }

    setConfirmEditAction({
      title: "Chỉnh sửa lịch tập",
      message: "Lưu ý: Bạn chỉ có thể chỉnh sửa mỗi lịch tập 1 lần trong ngày. Lịch của bạn sẽ không thể xóa được. Bạn có chắc chắn muốn thay đổi ngay bây giờ không?",
      onConfirm: () => {
        setConfirmEditAction(null);
        setEditingSchedule(s);
        setIsModalOpen(true);
      }
    });
  };

  const handleSubmit = (data) => {
    if (editingSchedule) {
      updateMut.mutate({ id: editingSchedule._id, data });
    } else {
      setConfirmEditAction({
        title: "Xác nhận đăng ký",
        message: "Lịch tập của bạn sẽ được gửi trực tiếp đến Huấn Luyện Viên. Lưu ý: Bạn chỉ có thể chỉnh sửa, KHÔNG ĐƯỢC XÓA lịch tập này. Bạn có chắc chắn muốn đăng ký?",
        onConfirm: () => {
          setConfirmEditAction(null);
          createMut.mutate(data);
        }
      });
    }
  };

  return (
    <>
      <SEO title="Đăng ký giờ tập luyện" description="Đăng ký và quản lý giờ tập luyện của bạn." noindex />
      <Header />

      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white pt-28 pb-8">
        <div className="container-custom max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 bg-primary/20 backdrop-blur-sm rounded-full px-5 py-2 mb-4">
              <Dumbbell className="text-primary w-6 h-6" />
              <span className="font-semibold text-primary tracking-wide">ĐĂNG KÝ GIỜ TẬP LUYỆN</span>
            </div>
            <h1 className="font-display text-fluid-5xl font-black uppercase tracking-normal">
              LỊCH TẬP <span className="text-primary">CỦA TÔI</span>
            </h1>
            <p className="text-gray-400 mt-4">
              Chủ động sắp xếp thời gian tập luyện. Lịch sẽ tự động đồng bộ với Huấn Luyện Viên của bạn.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-4 md:p-6 mb-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" />
                Danh sách lịch đã đăng ký
              </h2>
              <button onClick={() => { 
                if (!trainer) return toast.error("Bạn chưa được phân công Huấn Luyện Viên.");
                setEditingSchedule(null); setIsModalOpen(true); 
              }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all shadow-lg">
                <Plus className="w-4 h-4" /> Thêm lịch mới
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {isLoading ? (
              <div className="col-span-2 text-center py-10 text-gray-500">Đang tải dữ liệu...</div>
            ) : bookings.length === 0 ? (
              <div className="col-span-2 bg-gray-800/30 rounded-2xl border border-dashed border-gray-700 p-10 text-center">
                <CalendarDays className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 font-medium mb-1">Bạn chưa đăng ký lịch tập nào</p>
                <p className="text-sm text-gray-500">Hãy nhấn "Thêm lịch mới" để bắt đầu thiết lập thời gian tập luyện.</p>
              </div>
            ) : (
              bookings.map((booking) => (
                <div key={booking._id} className="bg-gray-800/80 rounded-2xl border border-gray-700 p-5 hover:border-primary/50 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${booking.dayOfWeek === today ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300'}`}>
                        {DAY_LABELS[booking.dayOfWeek]}
                      </span>
                      <span className="text-sm text-gray-400">
                        {booking.startTime} - {booking.endTime}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          if (!isEditable(booking)) return toast.error("Bạn đã hết lượt sửa hôm nay cho lịch tập này.");
                          handleEditClick(booking);
                        }} 
                        className={`p-1.5 rounded-lg transition-colors ${
                          isEditable(booking) 
                            ? "hover:bg-gray-700 text-gray-400 hover:text-white" 
                            : "text-gray-600 bg-gray-800 cursor-not-allowed opacity-50"
                        }`} 
                        title={isEditable(booking) ? "Sửa lịch" : "Đã hết lượt sửa hôm nay"}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {booking.notes && (
                    <div className="mt-3 text-sm text-gray-400 bg-gray-900/50 p-3 rounded-lg border border-gray-700/50">
                      <strong className="text-gray-300">Ghi chú:</strong> {booking.notes}
                    </div>
                  )}
                  {booking.trainerId && (
                    <div className="mt-3 text-sm text-gray-400 bg-gray-900/50 p-3 rounded-lg border border-gray-700/50 flex flex-col gap-2">
                      <div><strong className="text-gray-300">HLV Phụ trách:</strong> {booking.trainerId.name}</div>
                      {booking.exerciseType && (
                        <div><strong className="text-gray-300">Buổi tập hôm nay:</strong> {booking.exerciseType}</div>
                      )}
                    </div>
                  )}
                  {booking.lastClientEdit && (
                    <div className="mt-3 text-[11px] text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 
                      Chỉnh sửa lần cuối: {new Date(booking.lastClientEdit).toLocaleString('vi-VN')}
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
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingSchedule(null); }}
        onSubmit={handleSubmit}
        initialData={editingSchedule}
        isPending={createMut.isPending || updateMut.isPending}
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
