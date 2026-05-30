import { useState, useEffect, useRef } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Users,
  Calendar,
  Video,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  MessageSquare,
  Sparkles,
  Info,
  Clock,
  Dumbbell,
  Search,
  User,
  ArrowRight,
  UploadCloud,
  X,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  getTrainerClients,
  getClientTimeline,
  upsertCoachingDay,
  deleteCoachingDay,
  uploadDemoVideo,
} from "../../services/coaching.service";
import api from "../../utils/api";
import SEO from "../../components/SEO";
import Header from "../../sections/Header/Header";
import Footer from "../../sections/Footer/Footer";

// Helper: lấy base URL server (bỏ /api ở cuối) để truy cập static files (/uploads/...)
const getServerBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "";
  return apiUrl.replace(/\/api\/?$/, "");
};

const TrainerCoaching = () => {
  // States
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Giáo án states
  const [timeline, setTimeline] = useState([]);
  const [planTitle, setPlanTitle] = useState("");
  const [planNote, setPlanNote] = useState("");
  const [exercises, setExercises] = useState([]);

  // Database bài tập có sẵn
  const [exerciseDatabase, setExerciseDatabase] = useState([]);

  // Client feedback states
  const [clientFeedbackText, setClientFeedbackText] = useState("");
  const [clientFeedbackVideo, setClientFeedbackVideo] = useState("");
  const [clientStatus, setClientStatus] = useState("pending");
  const [activeReviewExerciseIndex, setActiveReviewExerciseIndex] = useState(0);

  // Loading & UI states
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadingIndex, setUploadingIndex] = useState(null);

  // Ref theo dõi trạng thái IME composition (gõ tiếng Việt)
  const isComposing = useRef(false);

  // 1. Tải danh sách khách hàng & database bài tập
  useEffect(() => {
    fetchClients();
    fetchExerciseDatabase();
  }, []);

  const fetchClients = async () => {
    setIsLoadingClients(true);
    try {
      const res = await getTrainerClients();
      const clientsData = res.data.data || [];
      setClients(clientsData);
      if (clientsData.length > 0) {
        handleSelectClient(clientsData[0]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi lấy danh sách khách hàng");
    } finally {
      setIsLoadingClients(false);
    }
  };

  const fetchExerciseDatabase = async () => {
    try {
      const res = await api.get("/exercises?limit=500");
      setExerciseDatabase(res.data.data || []);
    } catch (err) {
      console.error("Lỗi tải database bài tập:", err);
    }
  };

  // 2. Chọn khách hàng
  const handleSelectClient = async (client) => {
    setSelectedClient(client);
    setIsLoadingTimeline(true);
    try {
      const res = await getClientTimeline(client._id);
      const timelineData = res.data.data || [];
      setTimeline(timelineData);

      // Tự động load giáo án ngày đang chọn nếu có trong DB
      const existingPlan = timelineData.find((p) => p.dateString === selectedDate);
      loadPlanData(existingPlan);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi lấy lịch sử bài tập của khách");
    } finally {
      setIsLoadingTimeline(false);
    }
  };

  // 3. Thay đổi ngày
  const handleDateChange = (dateStr) => {
    setSelectedDate(dateStr);
    const existingPlan = timeline.find((p) => p.dateString === dateStr);
    loadPlanData(existingPlan);
  };

  // Load giáo án
  const loadPlanData = (plan) => {
    setActiveReviewExerciseIndex(0);
    if (plan) {
      setPlanTitle(plan.title || "");
      setPlanNote(plan.note || "");

      // Sanitise old weight values of 'Tạ vừa sức' or empty string to '60s' rest duration
      const sanitizedExercises = (plan.exercises || []).map((ex) => ({
        ...ex,
        weight: (ex.weight === "Tạ vừa sức" || !ex.weight) ? "60s" : ex.weight
      }));

      setExercises(sanitizedExercises);
      setClientFeedbackText(plan.clientFeedbackText || "");
      setClientFeedbackVideo(plan.clientFeedbackVideo || "");
      setClientStatus(plan.clientStatus || "pending");
    } else {
      setPlanTitle("");
      setPlanNote("");
      setExercises([
        { name: "", sets: 4, reps: "10-12", weight: "60s", videoUrl: "", videoUrl2: "", completed: false }
      ]);
      setClientFeedbackText("");
      setClientFeedbackVideo("");
      setClientStatus("pending");
    }
  };

  // 4. Thay đổi dòng bài tập (Dynamic Inputs)
  const handleAddExercise = () => {
    setExercises((prev) => [
      ...prev,
      { name: "", sets: 4, reps: "10-12", weight: "60s", videoUrl: "", videoUrl2: "", completed: false }
    ]);
  };

  const handleRemoveExercise = (index) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const handleExerciseChange = (index, field, value) => {
    setExercises((prev) => {
      const copy = [...prev];
      copy[index][field] = value;

      // Hỗ trợ tự điền link video demo nếu chọn bài có sẵn trong database
      if (field === "name") {
        const found = exerciseDatabase.find(
          (ex) => ex.name.toLowerCase() === value.toLowerCase()
        );
        if (found && found.videoUrl) {
          copy[index].videoUrl = found.videoUrl;
        }

        // Cảnh báo trùng tên bài tập
        if (value.trim()) {
          const isDuplicate = copy.some(
            (ex, i) => i !== index && ex.name.trim().toLowerCase() === value.trim().toLowerCase()
          );
          if (isDuplicate) {
            toast.warn(`Bài tập "${value}" đã có trong danh sách. Vui lòng kiểm tra lại!`, {
              toastId: `dup-${value.trim().toLowerCase()}`,
            });
          }
        }
      }

      return copy;
    });
  };

  // Tải lên video demo bài tập từ thiết bị
  const handleUploadExerciseDemo = async (index, e, videoField = "videoUrl") => {
    const file = e.target.files[0];
    if (!file) return;

    // Giới hạn dung lượng (Max 50MB cho video demo của Coach)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Dung lượng file tối đa là 50MB!");
      return;
    }

    const uploadKey = `${index}-${videoField === "videoUrl" ? "1" : "2"}`;
    setUploadingIndex(uploadKey);
    try {
      const formData = new FormData();
      formData.append("video", file);

      const res = await uploadDemoVideo(formData);
      handleExerciseChange(index, videoField, res.data.url);
      toast.success("Tải lên video demo thành công!");
    } catch (err) {
      console.error(err);
      const serverMsg = err.response?.data?.message;
      toast.error(serverMsg || "Tải lên video thất bại, hãy thử lại");
    } finally {
      setUploadingIndex(null);
    }
  };

  // 5. Lưu giáo án (Upsert)
  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!selectedClient) {
      toast.error("Vui lòng chọn khách hàng trước");
      return;
    }
    if (!planTitle.trim()) {
      toast.error("Vui lòng điền tiêu đề giáo án (ví dụ: Chest Day)");
      return;
    }

    const invalidEx = exercises.some((ex) => !ex.name.trim());
    if (invalidEx) {
      toast.error("Vui lòng điền tên cho tất cả bài tập");
      return;
    }

    setIsSaving(true);
    try {
      const planPayload = {
        dateString: selectedDate,
        title: planTitle.trim(),
        note: planNote.trim(),
        exercises,
      };

      const res = await upsertCoachingDay(selectedClient._id, planPayload);
      toast.success("Đã lưu giáo án luyện tập thành công!");

      const updatedTimeline = [...timeline];
      const idx = updatedTimeline.findIndex((p) => p.dateString === selectedDate);
      if (idx !== -1) {
        updatedTimeline[idx] = res.data.data;
      } else {
        updatedTimeline.push(res.data.data);
        updatedTimeline.sort((a, b) => new Date(b.date) - new Date(a.date));
      }
      setTimeline(updatedTimeline);
      setClientStatus(res.data.data.clientStatus);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Lưu giáo án thất bại");
    } finally {
      setIsSaving(false);
    }
  };

  // 6. Xoá giáo án ngày đang chọn
  const handleDeletePlan = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn xoá giáo án ngày này không?")) return;
    if (!selectedClient) return;

    try {
      await deleteCoachingDay(selectedClient._id, selectedDate);
      toast.success("Đã xoá giáo án thành công");

      const updatedTimeline = timeline.filter((p) => p.dateString !== selectedDate);
      setTimeline(updatedTimeline);
      loadPlanData(null);
    } catch (err) {
      console.error(err);
      toast.error("Xoá giáo án thất bại");
    }
  };

  // 7. Điều hướng ngày trước/sau
  const handlePrevDate = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    handleDateChange(d.toISOString().split("T")[0]);
  };

  const handleNextDate = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    handleDateChange(d.toISOString().split("T")[0]);
  };

  // Helper: Tạo avatar chữ cái đầu giống Google
  const getInitialAvatar = (name) => {
    const colors = [
      "bg-rose-500", "bg-blue-500", "bg-emerald-500", "bg-violet-500",
      "bg-amber-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500",
      "bg-teal-500", "bg-orange-500"
    ];
    const initial = (name || "?").charAt(0).toUpperCase();
    const colorIndex = name ? name.charCodeAt(0) % colors.length : 0;
    return { initial, colorClass: colors[colorIndex] };
  };

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <SEO title="Setup Bài Tập Coach Online - HT Coaching" noindex />
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />
      <Header />

      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white pt-28 pb-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-6">

          {/* Header Tiêu Đề */}
          <div className="text-center mb-10">
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black uppercase text-white tracking-normal">
              SETUP BÀI TẬP <span className="text-primary">COACH ONLINE</span>
            </h1>
            <div className="w-24 h-1 bg-primary mx-auto mt-4 rounded-full"></div>
            <p className="text-gray-400 mt-4 max-w-xl mx-auto text-sm leading-relaxed">
              Thiết lập giáo án cá nhân hóa chi tiết và đánh giá kết quả của học viên
            </p>
          </div>

          {/* BỐ CỤC 2 CỘT TỰ DO: TRÁI CHỌN KHÁCH HÀNG, PHẢI SETUP GIÁO ÁN */}
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 items-start">

            {/* CỘT TRÁI: DANH SÁCH KHÁCH HÀNG */}
            <div className="bg-gradient-to-b from-gray-900/70 to-gray-950/50 backdrop-blur-md rounded-2xl border border-gray-700/40 p-5 space-y-4 shadow-xl">
              <div className="border-b border-gray-700/30 pb-3">
                <h3 className="font-bold text-white uppercase tracking-wider text-sm">
                  Danh sách học viên
                </h3>
              </div>

              {/* Tìm kiếm */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Tìm học viên..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-950/60 border border-gray-700/40 rounded-xl py-2.5 pl-9 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 text-gray-300 placeholder-gray-600 transition-all duration-200"
                />
              </div>

              {/* List */}
              {isLoadingClients ? (
                <div className="space-y-2 py-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 bg-gray-800/40 rounded-xl animate-pulse"></div>
                  ))}
                </div>
              ) : filteredClients.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-6">Không tìm thấy khách hàng nào</p>
              ) : (
                <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
                  {filteredClients.map((client) => {
                    const isSelected = selectedClient?._id === client._id;
                    return (
                      <div
                        key={client._id}
                        onClick={() => handleSelectClient(client)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer ${isSelected
                            ? "bg-primary/15 border-primary/40 shadow-lg shadow-primary/5"
                            : "bg-gray-950/30 border-gray-700/30 hover:bg-gray-900/50 hover:border-gray-600/40"
                          }`}
                      >
                        {(() => {
                          const { initial, colorClass } = getInitialAvatar(client.name);
                          return (
                            <div
                              className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-bold border-2 transition-colors ${colorClass} ${isSelected ? "border-primary/40" : "border-gray-700/40"
                                }`}
                            >
                              {initial}
                            </div>
                          );
                        })()}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            {client.name}
                          </p>
                          <p className="text-[10px] text-gray-500 truncate">
                            {client.package}
                          </p>
                        </div>
                        <ArrowRight className={`w-3.5 h-3.5 shrink-0 transition-all duration-200 ${isSelected ? "translate-x-0.5 text-primary" : "text-gray-600"}`} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CỘT PHẢI: CHI TIẾT SOẠN GIÁO ÁN & PHẢN HỒI */}
            {selectedClient ? (
              <div className="space-y-6">

                {/* Thanh thông tin khách hàng và Chọn Ngày */}
                <div className="bg-gradient-to-r from-gray-900/70 to-gray-950/50 backdrop-blur-md rounded-2xl border border-gray-700/40 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xl">
                  <div>
                    <h2 className="text-base font-bold text-white uppercase tracking-wide">
                      {selectedClient.name}
                    </h2>
                    <span className="text-[10px] bg-primary/15 text-primary border border-primary/25 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider mt-1 inline-block">
                      {selectedClient.package}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handlePrevDate}
                      className="p-2 rounded-xl bg-gray-950/60 border border-gray-700/40 hover:border-primary/40 hover:bg-primary/10 text-gray-400 hover:text-primary transition-all duration-200 cursor-pointer"
                      title="Ngày trước"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="bg-gray-950/60 border border-gray-700/40 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-white transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={handleNextDate}
                      className="p-2 rounded-xl bg-gray-950/60 border border-gray-700/40 hover:border-primary/40 hover:bg-primary/10 text-gray-400 hover:text-primary transition-all duration-200 cursor-pointer"
                      title="Ngày sau"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Form Soạn Giáo Án */}
                <div className="bg-gradient-to-br from-gray-900/70 to-gray-950/50 backdrop-blur-md rounded-2xl border border-gray-700/40 p-6 shadow-xl space-y-6">
                  <div className="flex items-center justify-between border-b border-gray-700/30 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/25 to-primary/5 flex items-center justify-center border border-primary/20">
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="font-bold text-white uppercase tracking-wider text-sm sm:text-base">
                        Thiết lập giáo án: {new Date(selectedDate).toLocaleDateString("vi-VN")}
                      </h3>
                    </div>
                  </div>

                  <form onSubmit={handleSavePlan} className="space-y-6">
                    {/* Tiêu đề + Ghi chú */}
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          Tiêu đề buổi tập <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={planTitle}
                          onCompositionStart={() => (isComposing.current = true)}
                          onCompositionEnd={(e) => {
                            isComposing.current = false;
                            setPlanTitle(e.target.value);
                          }}
                          onChange={(e) => {
                            if (!isComposing.current) setPlanTitle(e.target.value);
                          }}
                          placeholder="Ví dụ: Chest Day - Tập ngực dày và rộng"
                          className="w-full bg-gray-950/80 border border-gray-700/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary/40 text-white placeholder-gray-600 transition-all duration-200"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          Ghi chú / Lời dặn chung của Coach
                        </label>
                        <textarea
                          rows={2}
                          value={planNote}
                          onCompositionStart={() => (isComposing.current = true)}
                          onCompositionEnd={(e) => {
                            isComposing.current = false;
                            setPlanNote(e.target.value);
                          }}
                          onChange={(e) => {
                            if (!isComposing.current) setPlanNote(e.target.value);
                          }}
                          placeholder="Dặn học viên khởi động vai kỹ, nhịp nghỉ 60s giữa hiệp, ăn nhẹ trước tập 1 tiếng..."
                          className="w-full bg-gray-950/80 border border-gray-700/50 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary/40 text-sm text-white placeholder-gray-600 transition-all duration-200 resize-none"
                        ></textarea>
                      </div>
                    </div>

                    {/* Danh sách động bài tập */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                          <Dumbbell className="w-4 h-4 text-primary" />
                          Danh sách bài tập
                          <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-bold">
                            {exercises.length} bài
                          </span>
                        </h4>
                        <button
                          type="button"
                          onClick={handleAddExercise}
                          className="text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40 transition-all duration-200 flex items-center gap-1.5 font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5" /> Thêm bài
                        </button>
                      </div>

                      <div className="space-y-4">
                        {exercises.map((ex, idx) => (
                          <div
                            key={idx}
                            className="relative rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 group/card"
                          >
                            {/* Gradient accent bar */}
                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary via-primary/60 to-transparent rounded-l-2xl"></div>

                            <div className="bg-gradient-to-br from-gray-900/80 to-gray-950/90 border border-gray-700/40 rounded-2xl p-5 pl-6 space-y-4">
                              {/* Exercise Header */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border border-primary/20">
                                    <span className="text-xs font-black text-primary">{idx + 1}</span>
                                  </div>
                                  <span className="text-sm font-bold text-white/90">{ex.name || "Bài tập mới"}</span>
                                </div>
                                {exercises.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveExercise(idx)}
                                    className="text-gray-600 hover:text-red-400 transition-colors duration-200 p-1.5 rounded-lg hover:bg-red-500/10 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>

                              {/* Hàng 1: Tên bài tập */}
                              <div className="space-y-1.5">
                                <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Tên bài tập</label>
                                <input
                                  type="text"
                                  required
                                  list="exercise-database-options"
                                  value={ex.name}
                                  onCompositionStart={() => (isComposing.current = true)}
                                  onCompositionEnd={(e) => {
                                    isComposing.current = false;
                                    handleExerciseChange(idx, "name", e.target.value);
                                  }}
                                  onChange={(e) => {
                                    if (!isComposing.current) handleExerciseChange(idx, "name", e.target.value);
                                  }}
                                  placeholder="Gõ tên bài tập (ví dụ: Bench Press)"
                                  className="w-full bg-gray-950/60 border border-gray-700/40 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-white placeholder-gray-600 transition-all duration-200"
                                />
                              </div>

                              {/* Hàng 2: Sets, Reps, Thời gian nghỉ ngang hàng */}
                              <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                  <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Số hiệp (Sets)</label>
                                  <input
                                    type="number"
                                    value={ex.sets}
                                    onChange={(e) => handleExerciseChange(idx, "sets", Number(e.target.value))}
                                    placeholder="4"
                                    className="w-full bg-gray-950/60 border border-gray-700/40 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-white placeholder-gray-600 transition-all duration-200 text-center"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Số lần (Reps)</label>
                                  <input
                                    type="text"
                                    value={ex.reps}
                                    onChange={(e) => handleExerciseChange(idx, "reps", e.target.value)}
                                    placeholder="10-12"
                                    className="w-full bg-gray-950/60 border border-gray-700/40 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-white placeholder-gray-600 transition-all duration-200 text-center"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Thời gian nghỉ</label>
                                  <input
                                    type="text"
                                    value={ex.weight}
                                    onChange={(e) => handleExerciseChange(idx, "weight", e.target.value)}
                                    placeholder="60s"
                                    className="w-full bg-gray-950/60 border border-gray-700/40 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-white placeholder-gray-600 transition-all duration-200 text-center"
                                  />
                                </div>
                              </div>

                              {/* Hàng 3: Video demo bài tập (2 video) */}
                              <div className="space-y-4">
                                {/* Video 1 */}
                                <div className="space-y-1.5">
                                  <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Video demo 1</label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={ex.videoUrl}
                                      onChange={(e) => handleExerciseChange(idx, "videoUrl", e.target.value)}
                                      placeholder="Dán đường dẫn video hoặc tải lên từ thiết bị..."
                                      className="flex-1 bg-gray-950/60 border border-gray-700/40 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-white placeholder-gray-600 transition-all duration-200 truncate"
                                    />
                                    <label className="shrink-0 p-2.5 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 hover:border-primary/40 cursor-pointer text-primary transition-all duration-200 flex items-center justify-center">
                                      {uploadingIndex === `${idx}-1` ? (
                                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                      ) : (
                                        <UploadCloud className="w-4 h-4" />
                                      )}
                                      <input
                                        type="file"
                                        accept="video/*"
                                        disabled={uploadingIndex === `${idx}-1`}
                                        onChange={(e) => handleUploadExerciseDemo(idx, e, "videoUrl")}
                                        className="hidden"
                                      />
                                    </label>
                                  </div>
                                </div>

                                {/* Video 1 Preview */}
                                {ex.videoUrl && (
                                  <div className="relative">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-[10px] text-gray-400 font-semibold uppercase flex items-center gap-1.5">
                                        <Video className="w-3 h-3 text-primary" /> Xem trước video demo 1
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleExerciseChange(idx, "videoUrl", "")}
                                        className="text-[10px] text-red-400/80 hover:text-red-400 transition flex items-center gap-1 cursor-pointer px-2 py-1 rounded-lg hover:bg-red-500/10"
                                      >
                                        <X className="w-3 h-3" /> Xoá
                                      </button>
                                    </div>
                                    <div className="rounded-xl overflow-hidden border border-gray-700/40 bg-black/40 aspect-video shadow-lg">
                                      {ex.videoUrl.startsWith("/uploads/") ? (
                                        <video
                                          src={`${getServerBaseUrl()}${ex.videoUrl}`}
                                          controls
                                          className="w-full h-full object-contain"
                                          key={ex.videoUrl}
                                        ></video>
                                      ) : (
                                        <iframe
                                          src={(() => {
                                            const url = ex.videoUrl;
                                            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                                            const match = url.match(regExp);
                                            if (match && match[2].length === 11) {
                                              return `https://www.youtube.com/embed/${match[2]}`;
                                            }
                                            return url;
                                          })()}
                                          className="w-full h-full"
                                          title={`Preview: ${ex.name}`}
                                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                          allowFullScreen
                                        ></iframe>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Video 2 */}
                                <div className="space-y-1.5">
                                  <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Video demo 2</label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={ex.videoUrl2 || ""}
                                      onChange={(e) => handleExerciseChange(idx, "videoUrl2", e.target.value)}
                                      placeholder="Dán đường dẫn video thứ 2 hoặc tải lên..."
                                      className="flex-1 bg-gray-950/60 border border-gray-700/40 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-white placeholder-gray-600 transition-all duration-200 truncate"
                                    />
                                    <label className="shrink-0 p-2.5 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 hover:border-primary/40 cursor-pointer text-primary transition-all duration-200 flex items-center justify-center">
                                      {uploadingIndex === `${idx}-2` ? (
                                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                      ) : (
                                        <UploadCloud className="w-4 h-4" />
                                      )}
                                      <input
                                        type="file"
                                        accept="video/*"
                                        disabled={uploadingIndex === `${idx}-2`}
                                        onChange={(e) => handleUploadExerciseDemo(idx, e, "videoUrl2")}
                                        className="hidden"
                                      />
                                    </label>
                                  </div>
                                </div>

                                {/* Video 2 Preview */}
                                {ex.videoUrl2 && (
                                  <div className="relative">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-[10px] text-gray-400 font-semibold uppercase flex items-center gap-1.5">
                                        <Video className="w-3 h-3 text-primary" /> Xem trước video demo 2
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleExerciseChange(idx, "videoUrl2", "")}
                                        className="text-[10px] text-red-400/80 hover:text-red-400 transition flex items-center gap-1 cursor-pointer px-2 py-1 rounded-lg hover:bg-red-500/10"
                                      >
                                        <X className="w-3 h-3" /> Xoá
                                      </button>
                                    </div>
                                    <div className="rounded-xl overflow-hidden border border-gray-700/40 bg-black/40 aspect-video shadow-lg">
                                      {ex.videoUrl2.startsWith("/uploads/") ? (
                                        <video
                                          src={`${getServerBaseUrl()}${ex.videoUrl2}`}
                                          controls
                                          className="w-full h-full object-contain"
                                          key={ex.videoUrl2}
                                        ></video>
                                      ) : (
                                        <iframe
                                          src={(() => {
                                            const url = ex.videoUrl2;
                                            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                                            const match = url.match(regExp);
                                            if (match && match[2].length === 11) {
                                              return `https://www.youtube.com/embed/${match[2]}`;
                                            }
                                            return url;
                                          })()}
                                          className="w-full h-full"
                                          title={`Preview 2: ${ex.name}`}
                                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                          allowFullScreen
                                        ></iframe>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Save & Delete Buttons */}
                    {(() => {
                      const planExists = timeline.some((p) => p.dateString === selectedDate);
                      return (
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700/30">
                          {planExists && (
                            <button
                              type="button"
                              onClick={handleDeletePlan}
                              className="px-5 py-3 rounded-xl font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all duration-300 flex items-center gap-2 cursor-pointer text-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                              Xoá giáo án
                            </button>
                          )}
                          <button
                            type="submit"
                            disabled={isSaving}
                            className="px-8 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-300 shadow-lg shadow-primary/20 flex items-center gap-2 cursor-pointer text-sm disabled:opacity-60"
                          >
                            <Save className="w-4 h-4" />
                            {isSaving
                              ? (planExists ? "Đang cập nhật..." : "Đang gửi giáo án...")
                              : (planExists ? "Cập nhật giáo án" : "Gửi giáo án khách hàng")}
                          </button>
                        </div>
                      );
                    })()}
                  </form>
                </div>

                {/* Kết quả tập luyện & Video Phản Hồi của học viên */}
                <div className="bg-gradient-to-br from-gray-900/70 to-gray-950/50 backdrop-blur-md rounded-2xl border border-gray-700/40 p-6 shadow-xl space-y-5">
                  <div className="flex items-center justify-between border-b border-gray-700/30 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/25 to-primary/5 flex items-center justify-center border border-primary/20">
                        <MessageSquare className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="font-bold text-white uppercase tracking-wider text-sm sm:text-base">
                        Kết quả & Video phản hồi
                      </h3>
                    </div>

                    <span
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${clientStatus === "completed"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                          : "bg-amber-500/15 text-amber-400 border-amber-500/25"
                        }`}
                    >
                      {clientStatus === "completed" ? "Đã hoàn thành" : "Chưa hoàn thành"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Bảng checklist động */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        Tiến độ hoàn thành:
                      </h4>

                      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                        {exercises.map((ex, idx) => {
                          const isActive = activeReviewExerciseIndex === idx;
                          return (
                            <div
                              key={idx}
                              onClick={() => setActiveReviewExerciseIndex(idx)}
                              className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all duration-200 ${isActive
                                  ? "bg-primary/10 border-primary/40 text-white font-semibold"
                                  : ex.completed
                                    ? "bg-emerald-500/5 border-emerald-500/15 text-gray-400 hover:border-emerald-500/30"
                                    : "bg-gray-950/30 border-gray-700/30 text-white font-medium hover:border-gray-600/40"
                                }`}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="truncate">
                                  {idx + 1}. {ex.name || "(Chưa gán)"} ({ex.sets}s × {ex.reps} | {ex.weight || "60s"})
                                </span>
                                {ex.clientFeedbackVideo && (
                                  <Video className="w-3.5 h-3.5 text-primary shrink-0" />
                                )}
                              </div>
                              <span
                                className={`font-bold uppercase text-[10px] tracking-wider shrink-0 ml-2 ${ex.completed ? "text-emerald-400" : "text-gray-600"
                                  }`}
                              >
                                {ex.completed ? "Đã xong" : "Chưa tập"}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="bg-gray-950/40 border border-gray-700/30 p-4 rounded-xl space-y-1.5">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          Cảm nhận bài "{exercises[activeReviewExerciseIndex]?.name || `Bài ${activeReviewExerciseIndex + 1}`}":
                        </span>
                        <p className="text-sm text-gray-300 leading-relaxed">
                          {exercises[activeReviewExerciseIndex]?.clientFeedbackNote || "Học viên chưa ghi cảm nhận cho bài tập này..."}
                        </p>
                      </div>
                    </div>

                    {/* Video động tác học viên */}
                    <div className="space-y-3 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                          <Video className="w-4 h-4 text-primary" />
                          Video phản hồi (Form Review):
                        </h4>

                        {exercises[activeReviewExerciseIndex] && exercises[activeReviewExerciseIndex].clientFeedbackVideo ? (
                          <div className="space-y-2">
                            <p className="text-[10px] text-primary font-bold uppercase tracking-wider">
                              Đang xem: {exercises[activeReviewExerciseIndex].name}
                            </p>
                            <div className="rounded-xl overflow-hidden border border-gray-700/40 bg-black/40 aspect-video shadow-2xl relative">
                              <video
                                src={`${getServerBaseUrl()}${exercises[activeReviewExerciseIndex].clientFeedbackVideo}`}
                                controls
                                className="w-full h-full object-contain"
                                key={exercises[activeReviewExerciseIndex].clientFeedbackVideo}
                              ></video>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                              Bài chọn: {exercises[activeReviewExerciseIndex]?.name || `Bài ${activeReviewExerciseIndex + 1}`}
                            </p>
                            <div className="aspect-video bg-gray-950/40 border border-gray-700/30 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 text-gray-600">
                              <Video className="w-8 h-8 text-gray-700" />
                              <p className="text-xs">Học viên chưa tải video kỹ thuật cho bài này</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="bg-gray-950/40 border border-gray-700/30 rounded-xl p-3.5 text-xs text-gray-500 leading-relaxed flex gap-2.5">
                        <Info className="w-4 h-4 text-primary/70 shrink-0 mt-0.5" />
                        <span>
                          Học viên được yêu cầu tải lên video động tác tập từ 15 đến 20 giây. Coach xem trực quan video này để đánh giá kỹ thuật và kịp thời chỉnh sửa động tác tập hôm sau.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-gray-900/70 to-gray-950/50 backdrop-blur-md rounded-2xl border border-gray-700/40 p-12 text-center shadow-xl">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 mx-auto mb-5">
                  <Dumbbell className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-bold text-white uppercase text-lg">Quản lý bài tập online</h3>
                <p className="text-gray-500 mt-2 text-sm max-w-sm mx-auto">
                  Vui lòng bấm chọn một học viên trong danh sách ở cột bên trái để bắt đầu lập giáo án tập luyện hàng ngày.
                </p>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* HTML Datalist cho Auto-complete bài tập có sẵn */}
      <datalist id="exercise-database-options">
        {exerciseDatabase.map((ex) => (
          <option key={ex._id} value={ex.name} />
        ))}
      </datalist>

      <Footer />
    </>
  );
};

export default TrainerCoaching;
