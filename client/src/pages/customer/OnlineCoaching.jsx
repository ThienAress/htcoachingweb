import { useState, useEffect, useRef } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  HelpCircle,
  Play,
  CheckCircle2,
  Calendar,
  MessageSquare,
  UploadCloud,
  ChevronDown,
  ChevronUp,
  FileText,
  User,
  Info,
  Clock,
  Dumbbell,
  ArrowRight,
  Video,
  X,
} from "lucide-react";
import { getMyPlans, getMyPlanDetails, submitFeedback, uploadClientFeedbackVideo } from "../../services/coaching.service";
import SEO from "../../components/SEO";
import Header from "../../sections/Header/Header";


// Helper: lấy base URL server (bỏ /api ở cuối) để truy cập static files (/uploads/...)
const getServerBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "";
  return apiUrl.replace(/\/api\/?$/, "");
};

const OnlineCoaching = () => {
  // States
  const [plans, setPlans] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [openWeeks, setOpenWeeks] = useState({});
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Feedback form states
  const [feedbackText, setFeedbackText] = useState("");
  const [expandedPlans, setExpandedPlans] = useState({});
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Ref debounce auto-save cảm nhận bài tập
  const feedbackSaveTimer = useRef(null);

  // 1. Fetch all plans
  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setIsLoadingPlans(true);
    try {
      const res = await getMyPlans();
      const plansData = res.data.data || [];
      setPlans(plansData);

      // Nhóm theo tuần và tự động mở rộng tuần mới nhất
      if (plansData.length > 0) {
        const grouped = groupPlansByWeek(plansData);
        const keys = Object.keys(grouped);
        if (keys.length > 0) {
          setOpenWeeks({ [keys[0]]: true });
        }

        // Tự động load chi tiết ngày tập đầu tiên (mới nhất)
        loadPlanDetails(plansData[0].dateString);
      } else {
        setIsLoadingPlans(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải danh sách ngày tập");
      setIsLoadingPlans(false);
    }
  };

  // 2. Fetch chi tiết ngày tập
  const loadPlanDetails = async (dateString) => {
    setIsLoadingDetails(true);
    try {
      const res = await getMyPlanDetails(dateString);
      const plan = res.data.data;
      if (plan && plan.exercises) {
        plan.exercises = plan.exercises.map((ex) => ({
          ...ex,
          weight: (ex.weight === "Tạ vừa sức" || !ex.weight) ? "60s" : ex.weight
        }));
      }
      setActivePlan(plan);
      setActiveExerciseIndex(0);
      setFeedbackText(plan.clientFeedbackText || "");
    } catch (err) {
      console.error(err);
      toast.error("Lỗi lấy chi tiết ngày tập");
    } finally {
      setIsLoadingDetails(false);
      setIsLoadingPlans(false);
    }
  };

  // Helper chia nhóm ngày tập theo tuần
  const groupPlansByWeek = (plansList) => {
    const groups = {};
    plansList.forEach((plan) => {
      const date = new Date(plan.date);
      // Tìm ngày thứ hai đầu tuần
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(date.setDate(diff));
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const weekKey = `Tuần từ ${monday.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      })} đến ${sunday.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })}`;

      if (!groups[weekKey]) {
        groups[weekKey] = [];
      }
      groups[weekKey].push(plan);
    });
    return groups;
  };

  const toggleWeek = (weekKey) => {
    setOpenWeeks((prev) => ({ ...prev, [weekKey]: !prev[weekKey] }));
  };

  // Chuẩn hóa link YouTube
  const getYoutubeEmbedUrl = (url) => {
    if (!url) return "";
    let videoId = "";
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      videoId = match[2];
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  };

  // Xác định video nào cần phát (video bài tập hoặc video tổng quan)
  const getActiveVideoUrl = () => {
    if (!activePlan) return "";
    const activeEx = activePlan.exercises[activeExerciseIndex];
    if (activeEx && activeEx.videoUrl) {
      return activeEx.videoUrl;
    }
    return activePlan.videoUrl;
  };

  // Lấy video thứ 2 của bài tập đang chọn (nếu có)
  const getActiveVideoUrl2 = () => {
    if (!activePlan) return "";
    const activeEx = activePlan.exercises[activeExerciseIndex];
    return activeEx?.videoUrl2 || "";
  };

  // Helper render video player
  const renderVideoPlayer = (videoUrl, title = "Coaching Video") => {
    if (!videoUrl) return null;
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-950 shadow-2xl aspect-video relative group">
        {videoUrl.startsWith("/uploads/") ? (
          <video
            src={`${getServerBaseUrl()}${videoUrl}`}
            controls
            className="w-full h-full object-contain"
            key={videoUrl}
          ></video>
        ) : (
          <iframe
            src={getYoutubeEmbedUrl(videoUrl)}
            className="w-full h-full"
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          ></iframe>
        )}
      </div>
    );
  };

  // Click tích hoàn thành bài tập hiện tại
  const handleToggleExerciseCompleted = async (index) => {
    if (!activePlan) return;
    const updatedExercises = [...activePlan.exercises];
    updatedExercises[index].completed = !updatedExercises[index].completed;

    // Cập nhật local state trước để UI mượt
    setActivePlan({ ...activePlan, exercises: updatedExercises });

    try {
      const formData = new FormData();
      formData.append("exercises", JSON.stringify(updatedExercises));
      formData.append("clientFeedbackText", feedbackText);

      const res = await submitFeedback(activePlan.dateString, formData);

      // Update lại danh sách ngày tập để hiển thị checkmark xanh lá
      const updatedPlans = plans.map((p) =>
        p.dateString === activePlan.dateString ? { ...p, clientStatus: res.data.data.clientStatus } : p
      );
      setPlans(updatedPlans);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi cập nhật tiến trình bài tập");
    }
  };

  // Xử lý nộp video phản hồi riêng biệt cho từng bài tập (15-20s)
  const handleUploadFeedbackVideo = async (index, e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1. Kiểm tra dung lượng (Max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast.error("Dung lượng file tối đa là 100MB!");
      return;
    }

    // 2. Trích xuất metadata kiểm tra độ dài video bằng HTML5
    const videoElement = document.createElement("video");
    videoElement.preload = "metadata";
    videoElement.onloadedmetadata = async () => {
      window.URL.revokeObjectURL(videoElement.src);

      // Giới hạn trong khoảng 15s đến 20s (cho sai số nhỏ thành 20.9s)
      if (videoElement.duration > 20.9) {
        toast.error("Video phản hồi tối đa là 20 giây! Vui lòng chọn hoặc cắt ngắn video khác.");
        return;
      }
      if (videoElement.duration < 14.5) {
        toast.warning("Video phản hồi tối thiểu phải từ 15 giây! Hãy quay chi tiết động tác tập của bạn.");
        return;
      }

      setIsUploadingVideo(true);
      try {
        const formData = new FormData();
        formData.append("video", file);

        const uploadRes = await uploadClientFeedbackVideo(formData);
        const videoUrl = uploadRes.data.url;

        // Cập nhật exercises cục bộ
        const updatedExercises = [...activePlan.exercises];
        updatedExercises[index].clientFeedbackVideo = videoUrl;
        updatedExercises[index].completed = true; // Tự động hoàn thành bài tập khi tải video lên thành công

        setActivePlan({ ...activePlan, exercises: updatedExercises });

        // Tự động đồng bộ lưu giáo án lên server tức thời (Autosave)
        const saveFormData = new FormData();
        saveFormData.append("exercises", JSON.stringify(updatedExercises));
        saveFormData.append("clientFeedbackText", feedbackText);

        const res = await submitFeedback(activePlan.dateString, saveFormData);

        // Cập nhật trạng thái ngày tập + exercises trong sidebar
        const updatedPlans = plans.map((p) =>
          p.dateString === activePlan.dateString
            ? { ...p, clientStatus: res.data.data.clientStatus, exercises: updatedExercises }
            : p
        );
        setPlans(updatedPlans);

        toast.success(`Đã lưu video phản hồi bài "${updatedExercises[index].name}"!`);
      } catch (err) {
        console.error(err);
        const serverMsg = err.response?.data?.message;
        toast.error(serverMsg || "Không thể tải lên video phản hồi, vui lòng thử lại");
      } finally {
        setIsUploadingVideo(false);
      }
    };
    videoElement.src = URL.createObjectURL(file);
  };

  // Gỡ bỏ video phản hồi của một bài tập cụ thể
  const handleRemoveExerciseVideo = async (index) => {
    if (!activePlan) return;

    try {
      const updatedExercises = [...activePlan.exercises];
      updatedExercises[index].clientFeedbackVideo = "";
      updatedExercises[index].completed = false; // Bỏ check hoàn thành

      setActivePlan({ ...activePlan, exercises: updatedExercises });

      // Đồng bộ lưu lên server
      const saveFormData = new FormData();
      saveFormData.append("exercises", JSON.stringify(updatedExercises));
      saveFormData.append("clientFeedbackText", feedbackText);

      const res = await submitFeedback(activePlan.dateString, saveFormData);

      const updatedPlans = plans.map((p) =>
        p.dateString === activePlan.dateString
          ? { ...p, clientStatus: res.data.data.clientStatus, exercises: updatedExercises }
          : p
      );
      setPlans(updatedPlans);

      toast.info("Đã gỡ bỏ video phản hồi của bài tập");
    } catch (err) {
      console.error(err);
      toast.error("Không thể gỡ bỏ video phản hồi, vui lòng thử lại");
    }
  };

  // Gửi báo cáo buổi tập hoàn thành chung
  const handleSubmitFeedback = async () => {
    if (!activePlan) return;

    // Kiểm tra xem tất cả bài tập đều đã được học viên upload video kỹ thuật
    const incompleteEx = activePlan.exercises.find((ex) => !ex.clientFeedbackVideo);
    if (incompleteEx) {
      toast.warning(`Bạn phải tải lên video phản hồi cho tất cả các bài tập trước! Bài "${incompleteEx.name}" chưa có video.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("exercises", JSON.stringify(activePlan.exercises));
      formData.append("clientFeedbackText", feedbackText);

      const res = await submitFeedback(activePlan.dateString, formData);
      toast.success("Tuyệt vời! Gửi báo cáo buổi tập thành công đến Coach!");

      const updatedPlans = plans.map((p) =>
        p.dateString === activePlan.dateString ? { ...p, clientStatus: res.data.data.clientStatus } : p
      );
      setPlans(updatedPlans);
      setActivePlan({ ...activePlan, clientStatus: res.data.data.clientStatus });
    } catch (err) {
      console.error(err);
      const serverMsg = err.response?.data?.message;
      toast.error(serverMsg || "Gửi phản hồi thất bại, vui lòng thử lại");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Chuyển đổi và kiểm duyệt thứ tự bài tập tuần tự (Sequential Locking)
  const handleSelectExercise = (newIndex) => {
    if (!activePlan) return;

    // Cho phép học viên quay lại các bài trước tự do
    if (newIndex < activeExerciseIndex) {
      setActiveExerciseIndex(newIndex);
      return;
    }

    // Kiểm tra xem tất cả bài tập phía trước đã được nộp video feedback chưa
    for (let i = 0; i < newIndex; i++) {
      if (!activePlan.exercises[i].clientFeedbackVideo) {
        toast.warning(`Bạn phải hoàn thành và nộp video kỹ thuật bài "${activePlan.exercises[i].name}" trước khi sang bài tiếp theo!`);
        return;
      }
    }

    setActiveExerciseIndex(newIndex);
  };

  // Điều khiển nhảy bài kế tiếp / bài trước
  const handlePrevExercise = () => {
    if (activeExerciseIndex > 0) {
      handleSelectExercise(activeExerciseIndex - 1);
    }
  };

  const handleNextExercise = () => {
    if (!activePlan) return;

    if (activeExerciseIndex < activePlan.exercises.length - 1) {
      handleSelectExercise(activeExerciseIndex + 1);
    } else {
      // Kiểm tra bài tập cuối cùng
      const currentEx = activePlan.exercises[activeExerciseIndex];
      if (!currentEx.clientFeedbackVideo) {
        toast.warning(`Bạn phải hoàn thành và nộp video kỹ thuật bài "${currentEx.name}" trước!`);
        return;
      }
      toast.success("Tuyệt vời! Bạn đã hoàn thành tất cả video kỹ thuật. Hãy nhập cảm nhận chung và nhấn Nộp báo cáo ở dưới.");
    }
  };

  // Format Thứ tiếng Việt
  const getVietnameseDayName = (dateStr) => {
    const date = new Date(dateStr);
    const day = date.getDay();
    const days = [
      "Chủ Nhật",
      "Thứ Hai",
      "Thứ Ba",
      "Thứ Tư",
      "Thứ Năm",
      "Thứ Sáu",
      "Thứ Bảy",
    ];
    return days[day];
  };

  const groupedPlans = groupPlansByWeek(plans);

  return (
    <>
      <SEO title="Giáo Án Luyện Tập Cá Nhân - HT Coaching" noindex />
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />
      <Header />

      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white pt-28 pb-24">
        {isLoadingPlans ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-400">Đang tải giáo án cá nhân...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="max-w-xl mx-auto mt-20 text-center px-4 bg-gray-900/40 border border-gray-800 rounded-2xl p-8 backdrop-blur-sm">
            <Dumbbell className="w-16 h-16 text-primary mx-auto mb-4 animate-pulse" />
            <h2 className="text-2xl font-bold uppercase">Hệ Thống Coach Online</h2>
            <p className="text-gray-400 mt-3 text-sm leading-relaxed">
              Bạn chưa có giáo án tập luyện online được gán. Vui lòng đăng ký gói tập online và liên hệ Huấn luyện viên của bạn để kích hoạt giáo án luyện tập hàng ngày nhé!
            </p>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            {/* Tiêu đề trang */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-3 bg-primary/20 backdrop-blur-sm rounded-full px-5 py-2 mb-4">
                <Dumbbell className="text-primary w-6 h-6" />
                <span className="font-semibold text-primary tracking-wide">
                  HỆ THỐNG COACH ONLINE
                </span>
              </div>
              <h1 className="font-display text-fluid-5xl font-black uppercase text-white tracking-normal">
                GIÁO ÁN <span className="text-primary">LUYỆN TẬP CÁ NHÂN</span>
              </h1>
              <div className="w-24 h-1 bg-primary mx-auto mt-4 rounded-full"></div>
              <p className="text-gray-400 mt-4 max-w-xl mx-auto text-sm leading-relaxed">
                Chương trình tập luyện được thiết kế riêng bởi Coach của bạn
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">

              {/* CỘT TRÁI: TIÊU ĐỀ, VIDEO HƯỚNG DẪN & BÀI TẬP CHI TIẾT */}
              <div className="space-y-6">

                {/* 1. Tiêu đề & Thông tin buổi tập (ĐẦU TIÊN) */}
                {activePlan && (
                  <div className="bg-gray-900/50 backdrop-blur-md rounded-2xl border border-gray-800 p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {getVietnameseDayName(activePlan.dateString)},{" "}
                            {new Date(activePlan.date).toLocaleDateString("vi-VN")}
                          </span>
                        </div>
                        <h2 className="text-2xl font-black uppercase text-white tracking-normal">
                          {activePlan.title}
                        </h2>
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
                          <User className="w-3 h-3 text-primary" />
                          <span>
                            Cập nhật bởi Coach:{" "}
                            <strong className="text-white">
                              {activePlan.trainerId?.name || "Huấn luyện viên"}
                            </strong>
                          </span>
                        </p>
                      </div>

                      {/* Trạng thái tích hoàn thành buổi tập */}
                      <span
                        className={`self-start sm:self-center px-4 py-1.5 rounded-full text-xs font-bold border uppercase tracking-wider ${activePlan.clientStatus === "completed"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                          }`}
                      >
                        {activePlan.clientStatus === "completed" ? "Đã tập xong" : "Chưa hoàn thành"}
                      </span>
                    </div>

                    {/* Lời dặn của Coach */}
                    {activePlan.note && (
                      <div className="bg-gray-800/40 border border-gray-700/80 rounded-xl p-4 flex gap-3">
                        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wide">
                            Ghi chú dặn dò của Coach:
                          </h4>
                          <p className="text-sm text-gray-300 mt-1 leading-relaxed">
                            {activePlan.note}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Khu vực tập luyện bài hiện tại & Video hướng dẫn */}
                {activePlan && activePlan.exercises && activePlan.exercises[activeExerciseIndex] && (
                  <div className="bg-gray-900/50 backdrop-blur-md rounded-2xl border border-gray-800 p-6 space-y-6 shadow-xl">
                    
                    {/* A. Cụm chữ: Tên bài và sets/reps/nghỉ */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-850 pb-3">
                      <div>
                        <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Bài đang tập</span>
                        <h3 className="font-extrabold text-white text-fluid-base uppercase mt-0.5">
                          {activeExerciseIndex + 1}. {activePlan.exercises[activeExerciseIndex].name}
                        </h3>
                      </div>
                      <div className="text-xs text-gray-400 font-medium bg-gray-950/60 border border-gray-850 px-3 py-1.5 rounded-full shrink-0">
                        {activePlan.exercises[activeExerciseIndex].sets} sets × {activePlan.exercises[activeExerciseIndex].reps} reps | Nghỉ: {activePlan.exercises[activeExerciseIndex].weight || "60s"}
                      </div>
                    </div>

                    {/* B. Trình phát Video hướng dẫn (của Coach) nằm ngay dưới cụm chữ */}
                    <div className="space-y-3">
                      <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                        <Play className="w-3.5 h-3.5 text-primary" />
                        Video hướng dẫn thực hiện động tác từ Coach
                      </span>
                      {isLoadingDetails ? (
                        <div className="aspect-video w-full bg-gray-900 rounded-2xl animate-pulse flex items-center justify-center">
                          <p className="text-gray-500">Đang tải video hướng dẫn...</p>
                        </div>
                      ) : getActiveVideoUrl() ? (
                        <div className="space-y-4">
                          {/* Video 1 */}
                          <div>
                            {getActiveVideoUrl2() && (
                              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2 block">Video hướng dẫn 1</span>
                            )}
                            {renderVideoPlayer(getActiveVideoUrl(), activePlan?.title || "Coaching Video")}
                          </div>
                          {/* Video 2 (nếu có) */}
                          {getActiveVideoUrl2() && (
                            <div>
                              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2 block">Video hướng dẫn 2</span>
                              {renderVideoPlayer(getActiveVideoUrl2(), `${activePlan?.title} - Video 2`)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="aspect-video w-full bg-gray-900/60 rounded-2xl border border-gray-800 border-dashed flex flex-col items-center justify-center gap-3 text-gray-500">
                          <Video className="w-12 h-12" />
                          <p className="text-sm">Không có video hướng dẫn cụ thể</p>
                        </div>
                      )}
                    </div>

                    {/* C. Hướng dẫn upload video feedback cho riêng bài này (Bắt buộc) */}
                    <div className="space-y-3 pt-4 border-t border-gray-850">
                      <div className="flex items-center justify-between text-xs text-gray-400 font-semibold uppercase tracking-wide">
                        <span className="flex items-center gap-1.5">
                          <UploadCloud className="w-4 h-4 text-primary" />
                          Video kỹ thuật thực hiện bài tập này (Bắt buộc)
                        </span>
                        <span className="text-[10px] text-gray-500 normal-case font-medium">15s - 20s | Dung lượng &lt; 100MB</span>
                      </div>

                      {activePlan.exercises[activeExerciseIndex].clientFeedbackVideo ? (
                        <div className="space-y-3">
                          <div className="rounded-xl overflow-hidden border border-gray-800 bg-black aspect-video max-w-sm mx-auto shadow-2xl relative">
                            <video
                              src={`${getServerBaseUrl()}${activePlan.exercises[activeExerciseIndex].clientFeedbackVideo}`}
                              controls
                              className="w-full h-full object-contain"
                            ></video>
                            <button
                              type="button"
                              onClick={() => handleRemoveExerciseVideo(activeExerciseIndex)}
                              className="absolute top-3 right-3 bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition duration-200 cursor-pointer"
                              title="Gỡ bỏ video"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-800 hover:border-primary/50 bg-gray-950/20 hover:bg-primary/5 p-8 rounded-xl cursor-pointer transition-all duration-300 group">
                          {isUploadingVideo ? (
                            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                          ) : (
                            <UploadCloud className="w-10 h-10 text-gray-500 group-hover:text-primary transition-colors animate-pulse mb-2" />
                          )}
                          <span className="text-fluid-xs font-semibold text-gray-300 mt-1">
                            {isUploadingVideo ? "Đang tải video lên..." : "Tải lên video thực hiện động tác"}
                          </span>
                          <span className="text-[10px] text-gray-500 mt-1 text-center">
                            Bấm để chọn video quay động tác của bạn (mp4, mov, avi...)
                          </span>
                          <input
                            type="file"
                            accept="video/*"
                            disabled={isUploadingVideo}
                            onChange={(e) => handleUploadFeedbackVideo(activeExerciseIndex, e)}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    {/* D. Cảm nhận riêng cho bài tập này */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-primary" />
                        Cảm nhận bài tập này
                      </label>
                      <textarea
                        rows={2}
                        value={activePlan.exercises[activeExerciseIndex].clientFeedbackNote || ""}
                        onChange={(e) => {
                          const updatedExercises = [...activePlan.exercises];
                          updatedExercises[activeExerciseIndex].clientFeedbackNote = e.target.value;
                          const updatedPlan = { ...activePlan, exercises: updatedExercises };
                          setActivePlan(updatedPlan);

                          // Auto-save debounce 1s
                          if (feedbackSaveTimer.current) clearTimeout(feedbackSaveTimer.current);
                          feedbackSaveTimer.current = setTimeout(async () => {
                            try {
                              const formData = new FormData();
                              formData.append("exercises", JSON.stringify(updatedExercises));
                              formData.append("clientFeedbackText", feedbackText);
                              await submitFeedback(updatedPlan.dateString, formData);
                            } catch (err) {
                              console.error("Auto-save cảm nhận thất bại:", err);
                            }
                          }, 1000);
                        }}
                        placeholder="Bài này bạn tập thấy thế nào? Có khó khăn gì không..."
                        className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm placeholder-gray-600 transition resize-none"
                      ></textarea>
                    </div>
                  </div>
                )}


                {/* Nút Nộp báo cáo & Hoàn thành */}
                {activePlan && (() => {
                  const allVideosUploaded = activePlan.exercises.every((ex) => ex.clientFeedbackVideo);
                  const alreadySubmitted = activePlan.clientStatus === "completed";
                  return (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowConfirmModal(true)}
                        disabled={isSubmitting || !allVideosUploaded || alreadySubmitted}
                        className="px-6 py-2.5 rounded-lg font-bold text-white bg-linear-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-300 shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                      >
                        {alreadySubmitted
                          ? "Đã nộp báo cáo ✓"
                          : isSubmitting
                            ? "Đang gửi báo cáo..."
                            : allVideosUploaded
                              ? "Nộp báo cáo & Hoàn thành"
                              : `Còn ${activePlan.exercises.filter((ex) => !ex.clientFeedbackVideo).length} bài chưa upload video`}
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* CỘT PHẢI: TIMELINE NGÀY TẬP DẠNG PHẲNG */}
              <div className="bg-gray-900/50 backdrop-blur-md rounded-2xl border border-gray-800 p-5 space-y-4">
                <div className="border-b border-gray-800 pb-3">
                  <h3 className="font-bold text-white uppercase tracking-wider text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Lịch sử giáo án
                  </h3>
                </div>

                <div className="space-y-3 max-h-[80vh] overflow-y-auto pr-1">
                  {plans.map((plan) => {
                    const isActive = activePlan?.dateString === plan.dateString;
                    const isCompleted = plan.clientStatus === "completed";
                    const isExpanded = !!expandedPlans[plan.dateString];
                    const dateFormatted = new Date(plan.date).toLocaleDateString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    });

                    return (
                      <div
                        key={plan.dateString}
                        className={`border rounded-xl overflow-hidden transition-all duration-300 bg-gray-950/40 ${isActive ? "border-gray-800" : "border-gray-800 hover:border-gray-700"
                          }`}
                      >
                        {/* Day Card Header */}
                        <div
                          onClick={() => {
                            loadPlanDetails(plan.dateString);
                            setExpandedPlans((prev) => ({
                              ...prev,
                              [plan.dateString]: !prev[plan.dateString],
                            }));
                          }}
                          className={`w-full flex items-center justify-between px-3.5 py-3.5 select-none transition-all duration-300 cursor-pointer ${
                            isActive
                              ? "bg-gray-900/90 border-b border-gray-900"
                              : "hover:bg-gray-900 bg-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2 text-left">
                            {isActive && (
                              <span className="w-1 h-3.5 bg-primary rounded-full shrink-0 block" />
                            )}
                            <span className={`tracking-wide leading-tight ${
                              isActive
                                ? "text-primary font-black text-sm"
                                : "text-gray-200 font-bold text-xs"
                            }`}>
                              {getVietnameseDayName(plan.dateString).toUpperCase()}: {plan.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-gray-500 font-mono">
                              {dateFormatted}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                            )}
                          </div>
                        </div>

                        {/* Day Card Exercises Expansion Preview */}
                        {isExpanded && plan.exercises && (
                          <div className="bg-transparent border-t border-gray-900/40 divide-y divide-gray-900/60 text-xs">
                            {plan.exercises.map((ex, exIdx) => {
                              const isCurrentExActive = isActive && activeExerciseIndex === exIdx;
                              return (
                                <div
                                  key={exIdx}
                                  onClick={(e) => {
                                    e.stopPropagation(); // Ngăn chặn việc đóng mở card ngày tập
                                    if (!isActive) {
                                      loadPlanDetails(plan.dateString);
                                      setActiveExerciseIndex(exIdx);
                                    } else {
                                      handleSelectExercise(exIdx);
                                    }
                                  }}
                                  className={`flex flex-col py-3 px-4 cursor-pointer transition-all duration-200 ${
                                    isCurrentExActive
                                      ? "text-white font-bold"
                                      : "text-gray-400 hover:text-white hover:bg-gray-900/20"
                                  }`}
                                >
                                  <span className="break-words text-[13px] leading-snug">
                                    {exIdx + 1}. {ex.name}
                                  </span>
                                  <div className="flex items-center gap-2.5 mt-1.5 shrink-0">
                                    <span className={`text-[11px] font-mono ${
                                      isCurrentExActive ? "text-gray-400" : "text-gray-500"
                                    }`}>
                                      ({ex.sets}s × {ex.reps}) | {ex.weight || "30s"}
                                    </span>
                                    {ex.clientFeedbackVideo && (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* MODAL XÁC NHẬN NỘP BÁO CÁO */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full mx-4 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">Xác nhận nộp báo cáo</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Bạn có chắc chắn muốn nộp báo cáo buổi tập này cho Coach không? Nếu cần chỉnh sửa thêm, bạn có thể bấm Hủy để quay lại.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-gray-300 bg-gray-800 border border-gray-700 hover:bg-gray-700 transition-all duration-200 cursor-pointer text-sm"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  handleSubmitFeedback();
                }}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary transition-all duration-200 shadow-lg shadow-primary/20 cursor-pointer text-sm disabled:opacity-60"
              >
                {isSubmitting ? "Đang gửi..." : "Xác nhận nộp"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER CONTROL CỐ ĐỊNH Ở ĐÁY MÀN HÌNH */}
      {activePlan && (
        <footer className="fixed bottom-0 left-0 w-full bg-gray-950/95 border-t border-gray-800 py-3.5 px-4 z-40 backdrop-blur-md flex items-center justify-center shadow-2xl">
          {/* Center: Previous / Next Exercise */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevExercise}
              disabled={activeExerciseIndex === 0}
              className="px-4 py-2 text-xs font-bold rounded-full bg-gray-850 hover:bg-gray-800 text-white border border-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
            >
              &lt; BÀI TRƯỚC
            </button>
            <button
              onClick={handleNextExercise}
              disabled={activeExerciseIndex === activePlan.exercises.length - 1}
              className="px-4 py-2 text-xs font-bold rounded-full bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20 transition flex items-center gap-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              BÀI KẾ TIẾP &gt;
            </button>
          </div>

          {/* Right: Active lesson details */}
          <div className="absolute right-4 text-right text-xs shrink-0">
            <span className="text-gray-400 hidden sm:inline">Đang tập: </span>
            <span className="text-primary font-bold">
              Bài {activeExerciseIndex + 1}/{activePlan.exercises.length}:{" "}
            </span>
            <span className="text-white font-semibold">
              {activePlan.exercises[activeExerciseIndex]?.name || "N/A"}
            </span>
          </div>
        </footer>
      )}

    </>
  );
};

export default OnlineCoaching;
