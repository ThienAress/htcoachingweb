import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, Calendar, User, Copy, Trash2, Edit3,
  ChevronLeft, ChevronRight, Flame, FileText, Filter, Eye,
} from "lucide-react";
import { toast } from "react-toastify";
import SEO from "../../components/SEO";
import Header from "../../sections/Header/Header";
import Footer from "../../sections/Footer/Footer";
import ChatIcons from "../../components/ChatIcons";
import { useAuth } from "../../context/AuthContext";
import { getMyClients } from "../../services/trainingSchedule.service";
import {
  getWorkoutPlans,
  getMyWorkoutPlans,
  deleteWorkoutPlan,
  duplicateWorkoutPlan,
} from "../../services/workoutPlan.service";
import PlanModal from "./WorkoutPlanModal";

// ===== STATUS CONFIG =====
const STATUS_MAP = {
  draft: { label: "Nháp", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  published: { label: "Đã gửi", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  completed: { label: "Hoàn thành", color: "bg-green-500/20 text-green-400 border-green-500/30" },
};

const formatDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

// ===== MAIN COMPONENT =====
const WorkoutPlan = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const isTrainerOrAdmin = user?.role === "admin" || user?.role === "trainer";

  const [modalOpen, setModalOpen] = useState(false);
  const [filterClient, setFilterClient] = useState("");
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 12;

  // Fetch clients (chỉ trainer/admin)
  const { data: clients = [] } = useQuery({
    queryKey: ["my-clients"],
    queryFn: () => getMyClients().then((res) => res.data.data || []),
    enabled: isTrainerOrAdmin,
  });

  // Fetch plans — trainer dùng getWorkoutPlans, user dùng getMyWorkoutPlans
  const queryParams = useMemo(() => {
    const p = { page: currentPage, limit };
    if (filterClient) p.clientEmail = filterClient;
    return p;
  }, [currentPage, filterClient]);

  const { data: plansData, isLoading } = useQuery({
    queryKey: isTrainerOrAdmin ? ["workout-plans", queryParams] : ["my-workout-plans"],
    queryFn: isTrainerOrAdmin
      ? () => getWorkoutPlans(queryParams).then((res) => res.data)
      : () => getMyWorkoutPlans().then((res) => ({ data: res.data.data || [], pagination: { total: res.data.data?.length || 0, totalPages: 1 } })),
  });

  const plans = plansData?.data || [];
  const pagination = plansData?.pagination || { total: 0, totalPages: 0 };

  // Filtered by search text (client-side)
  const filteredPlans = useMemo(() => {
    if (!searchText.trim()) return plans;
    const s = searchText.toLowerCase();
    return plans.filter(
      (p) =>
        p.title.toLowerCase().includes(s) ||
        p.clientName.toLowerCase().includes(s)
    );
  }, [plans, searchText]);

  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setModalOpen(true);
    }
  }, [searchParams]);

  // Mutations
  const deleteMut = useMutation({
    mutationFn: deleteWorkoutPlan,
    onSuccess: () => {
      toast.success("Đã xóa giáo án");
      queryClient.invalidateQueries({ queryKey: ["workout-plans"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi xóa"),
  });

  const duplicateMut = useMutation({
    mutationFn: ({ id }) => duplicateWorkoutPlan(id, { planDate: new Date() }),
    onSuccess: () => {
      toast.success("Đã nhân bản giáo án");
      queryClient.invalidateQueries({ queryKey: ["workout-plans"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi nhân bản"),
  });

  const handleDelete = (plan) => {
    if (!window.confirm(`Xóa giáo án "${plan.title}" của ${plan.clientName}?`)) return;
    deleteMut.mutate(plan._id);
  };

  const handleDuplicate = (plan) => {
    duplicateMut.mutate({ id: plan._id });
  };

  const handleCreate = () => {
    setModalOpen(true);
  };

  const handleEdit = (plan) => {
    navigate(`/workout-plans/${plan._id}`);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    if (searchParams.get("create")) {
      searchParams.delete("create");
      searchParams.delete("client");
      searchParams.delete("date");
      setSearchParams(searchParams);
    }
  };

  return (
    <>
      <SEO title="Giáo án tập luyện" description="Tạo và quản lý giáo án tập luyện cho học viên." noindex />
      <Header />

      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white pt-28 pb-8">
        <div className="container-custom">
          {/* ===== HERO ===== */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 bg-primary/20 backdrop-blur-sm rounded-full px-5 py-2 mb-4">
              <Flame className="text-primary w-6 h-6" />
              <span className="font-semibold text-primary tracking-wide">GIÁO ÁN TẬP LUYỆN</span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-normal">
              {isTrainerOrAdmin ? "QUẢN LÝ" : "LỊCH"} <span className="text-primary">GIÁO ÁN</span>
            </h1>
            <div className="w-24 h-1 bg-primary mx-auto mt-4 rounded-full" />
            <p className="text-gray-400 mt-4 max-w-xl mx-auto">
              {isTrainerOrAdmin
                ? "Tạo giáo án chi tiết cho từng buổi tập — quản lý bài tập, đánh giá kết quả"
                : "Xem giáo án tập luyện từ huấn luyện viên của bạn — theo dõi tiến độ và kết quả đánh giá"}
            </p>
          </div>

          {/* ===== TOOLBAR ===== */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-4 md:p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 w-48"
                  />
                </div>

                {/* Filter client — chỉ trainer/admin */}
                {isTrainerOrAdmin && (
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={filterClient}
                      onChange={(e) => { setFilterClient(e.target.value); setCurrentPage(1); }}
                      className="pl-9 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                    >
                      <option value="">Tất cả khách hàng</option>
                      {clients.map((c) => (
                        <option key={c._id} value={c.email}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <span className="text-xs text-gray-500">{pagination.total} giáo án</span>
              </div>

              {isTrainerOrAdmin && (
                <button
                  onClick={handleCreate}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-primary hover:bg-orange-500 text-white text-sm font-medium transition-all shadow-lg shadow-primary/30"
                >
                  <Plus className="w-4 h-4" /> Tạo giáo án
                </button>
              )}
            </div>
          </div>

          {/* ===== PLANS GRID ===== */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-gray-800/50 rounded-2xl border border-gray-700 p-6 animate-pulse">
                  <div className="h-5 w-3/4 bg-white/10 rounded mb-3" />
                  <div className="h-4 w-1/2 bg-white/5 rounded mb-2" />
                  <div className="h-4 w-1/3 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="text-center py-20">
              <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">Chưa có giáo án nào</p>
              <p className="text-gray-500 text-sm mt-1">Nhấn "Tạo giáo án" để bắt đầu</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlans.map((plan) => {
                const st = STATUS_MAP[plan.status] || STATUS_MAP.draft;
                const exerciseCount = plan.sections?.reduce((sum, s) => sum + (s.exercises?.length || 0), 0) || 0;
                return (
                  <div
                    key={plan._id}
                    className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 hover:border-primary/50 hover:-translate-y-1 transition-all cursor-pointer group"
                    onClick={() => handleEdit(plan)}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold truncate group-hover:text-primary transition-colors uppercase">
                          {plan.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-sm text-gray-400 truncate">{plan.clientName}</span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${st.color}`}>
                        {st.label}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> {formatDate(plan.planDate)}
                      </span>
                      <span>{plan.sections?.length || 0} sections</span>
                      <span>{exerciseCount} bài tập</span>
                    </div>

                    {/* Assessment */}
                    {plan.overallAssessment && (
                      <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5 mb-4">
                        ⭐ {plan.overallAssessment}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-700">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(plan); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:bg-gray-700 transition-colors"
                      >
                        {isTrainerOrAdmin ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {isTrainerOrAdmin ? "Sửa" : "Xem"}
                      </button>
                      {isTrainerOrAdmin && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDuplicate(plan); }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:bg-gray-700 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" /> Nhân bản
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(plan); }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ===== PAGINATION ===== */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-8">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-700 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-400">
                Trang {currentPage} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={currentPage === pagination.totalPages}
                className="p-2 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-700 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </main>

      <ChatIcons />
      <Footer />

      {/* Modal */}
      {modalOpen && (
        <PlanModal
          clients={clients}
          initialClientId={searchParams.get("client") || ""}
          initialDate={searchParams.get("date") || ""}
          onClose={handleModalClose}
          onSaved={(newPlanId) => {
            handleModalClose();
            navigate(`/workout-plans/${newPlanId}`);
          }}
        />
      )}
    </>
  );
};

export default WorkoutPlan;
