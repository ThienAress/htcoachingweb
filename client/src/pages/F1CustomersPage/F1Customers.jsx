import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Home,
  Trash2,
  Users,
  SidebarClose,
  SidebarOpen,
} from "lucide-react";
import {
  createF1Customer,
  deleteF1Customer as deleteF1CustomerApi,
  getDeletedF1Customers,
  getF1Customers,
  restoreF1Customer,
  reviewTestPermission,
} from "../../services/f1Customer.service";
import { toast } from "react-toastify";
import SEO from "../../components/SEO";
import { useDebounce } from "../../hooks/useDebounce";
import { useConversionOriginOptions } from "../../hooks/useConversionOriginOptions";
import { useAuth } from "../../context/AuthContext";
import MorphStateIcon from "../../components/motion/MorphStateIcon";
import {
  F1_SOFT_DELETE_DAYS,
  getF1Progress,
} from "../../constants/f1CustomerStatus";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";

const F1CustomerList = lazy(
  () => import("../../components/F1/F1CustomerList"),
);
const F1CustomerDetail = lazy(
  () => import("../../components/F1/F1CustomerDetail"),
);
const F1IntakeWizard = lazy(
  () => import("../../components/F1/F1IntakeWizard"),
);
const F1DeletedCustomers = lazy(
  () => import("../../components/F1/F1DeletedCustomers"),
);
const F1CreateCustomerForm = lazy(
  () => import("../../components/F1/F1CreateCustomerForm"),
);
const F1AssessmentPanel = lazy(
  () => import("../../components/F1/F1AssessmentPanel"),
);
const F1AiReportPanel = lazy(
  () => import("../../components/F1/F1AiReportPanel"),
);
const F1ResultPredictionPanel = lazy(
  () => import("../../components/F1/F1ResultPredictionPanel"),
);
const F1CustomerSummaryReport = lazy(
  () => import("../../components/F1/F1CustomerSummaryReport"),
);

const initialCreateForm = {
  fullName: "",
  age: "",
  gender: "",
  occupation: "",
  phone: "",
  email: "",
  assignedTrainerId: "",
  originType: "",
  originId: "",
};

// Nút "tiếp tục" của báo cáo tổng quát theo tiến trình hiện tại của khách.
const getSummaryContinueAction = ({ customer, onAssessment, onReport }) => {
  const { intakeDone, assessmentDone } = getF1Progress(customer?.status);
  if (assessmentDone) {
    return { continueLabel: "Mở phân tích tự động", onContinue: onReport };
  }
  if (intakeDone && customer?.testPermission !== "hold_test") {
    return {
      continueLabel: "Tiếp tục đánh giá thể chất",
      onContinue: onAssessment,
    };
  }
  return {};
};

const F1Customers = () => {
  const { user } = useAuth();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState("list");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [summaryReportOpen, setSummaryReportOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const conversionOrigins = useConversionOriginOptions(
    user?.role === "admin" && viewMode === "create",
  );
  const debouncedSearch = useDebounce(search.trim(), 350);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const updateViewport = () => setIsDesktopViewport(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  const customersQuery = useQuery({
    queryKey: ["f1-customers", { search: debouncedSearch, page, limit: 10 }],
    queryFn: () =>
      getF1Customers({ search: debouncedSearch, page, limit: 10 }),
    placeholderData: (previous) => previous,
  });
  const customers = Array.isArray(customersQuery.data?.data)
    ? customersQuery.data.data
    : [];
  const pagination = customersQuery.data?.pagination || {
    page,
    totalPages: 1,
    total: customers.length,
  };
  const deletedQuery = useQuery({
    queryKey: ["f1-customers-deleted"],
    queryFn: getDeletedF1Customers,
    enabled: viewMode === "deleted",
  });
  const deletedCustomers = Array.isArray(deletedQuery.data?.data)
    ? deletedQuery.data.data
    : [];
  const invalidateCustomers = () =>
    queryClient.invalidateQueries({ queryKey: ["f1-customers"] });
  const createMutation = useMutation({ mutationFn: createF1Customer });
  const deleteMutation = useMutation({ mutationFn: deleteF1CustomerApi });
  const restoreMutation = useMutation({ mutationFn: restoreF1Customer });
  const reviewMutation = useMutation({
    mutationFn: ({ customerId, payload }) =>
      reviewTestPermission(customerId, payload),
  });

  const resetCreateForm = () => {
    setCreateForm(initialCreateForm);
  };

  const handleOpenCreate = () => {
    resetCreateForm();
    setViewMode("create");
    setMobileMenuOpen(false);
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...createForm,
        age: Number(createForm.age) || 0,
      };
      const res = await createMutation.mutateAsync(payload);
      const createdCustomer = res.data;
      setSelectedCustomer(createdCustomer);
      setViewMode("intake");
      await invalidateCustomers();
      toast.success("Đã tạo hồ sơ khách hàng F1");
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.errors?.[0]?.msg ||
          "Tạo khách hàng thất bại",
      );
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer?._id) return;
    const confirmed = await confirm({
      title: "Xóa khách hàng F1?",
      message: `Bạn có chắc muốn xóa khách hàng "${selectedCustomer.fullName}" không?`,
      details: [
        `Bạn có thể khôi phục khách hàng trong vòng ${F1_SOFT_DELETE_DAYS} ngày, sau đó khách hàng sẽ bị xóa vĩnh viễn tự động.`,
        "Khách hàng đã tạo vẫn được tính vào giới hạn của gói, kể cả khi đã xóa.",
      ],
      confirmLabel: "Xóa khách hàng",
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(selectedCustomer._id);
      toast.success(
        `Đã chuyển vào mục Xóa khách hàng. Bạn có thể khôi phục trong ${F1_SOFT_DELETE_DAYS} ngày.`,
      );
      setSelectedCustomer(null);
      setViewMode("list");
      await invalidateCustomers();
      queryClient.invalidateQueries({ queryKey: ["f1-customers-deleted"] });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Xóa khách hàng thất bại");
    }
  };

  const handleRestoreCustomer = async (customer) => {
    const confirmed = await confirm({
      title: "Khôi phục khách hàng F1?",
      message: `Khách hàng "${customer.fullName}" sẽ quay lại danh sách cùng toàn bộ dữ liệu và ảnh cũ.`,
      confirmLabel: "Khôi phục",
    });
    if (!confirmed) return;
    try {
      const res = await restoreMutation.mutateAsync(customer._id);
      toast.success(res?.message || "Đã khôi phục khách hàng");
      await invalidateCustomers();
      await queryClient.invalidateQueries({ queryKey: ["f1-customers-deleted"] });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Khôi phục khách hàng thất bại");
    }
  };

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setViewMode("detail");
    setMobileMenuOpen(false);
  };

  const handleIntakeSubmitted = async (result) => {
    setSelectedCustomer((prev) => ({
      ...prev,
      status: "intake_completed",
      readinessStatus:
        result?.readinessStatus ||
        result?.data?.readinessStatus ||
        prev?.readinessStatus,
      testPermission:
        result?.testPermission ||
        result?.systemFlags?.testPermission ||
        result?.data?.testPermission ||
        result?.data?.systemFlags?.testPermission ||
        prev?.testPermission,
      holdReasons:
        result?.holdReasons ||
        result?.systemFlags?.holdReasons ||
        result?.data?.holdReasons ||
        result?.data?.systemFlags?.holdReasons ||
        [],
      cautionReasons:
        result?.cautionReasons ||
        result?.systemFlags?.cautionReasons ||
        result?.data?.cautionReasons ||
        result?.data?.systemFlags?.cautionReasons ||
        [],
      lastIntakeId: result?._id || result?.data?._id || prev?.lastIntakeId,
    }));
    setViewMode("detail");
    setSummaryReportOpen(true);
    await invalidateCustomers();
  };

  const handleAssessmentSubmitted = async (result) => {
    setSelectedCustomer((prev) => ({
      ...prev,
      status: "assessment_completed",
      lastAssessmentId:
        result?._id || result?.data?._id || prev?.lastAssessmentId,
      overallPhysicalLevel:
        result?.overallPhysicalLevel ||
        result?.data?.overallPhysicalLevel ||
        prev?.overallPhysicalLevel,
    }));
    setViewMode("detail");
    setSummaryReportOpen(true);
    await invalidateCustomers();
  };

  const handleAiReportGenerated = async (result) => {
    setSelectedCustomer((prev) => ({
      ...prev,
      status: "ai_report_generated",
      lastAiReportId: result?._id || result?.data?._id || prev?.lastAiReportId,
    }));
    await invalidateCustomers();
  };

  const handleReviewTestPermission = async (payload) => {
    if (!selectedCustomer?._id) return;
    try {
      const res = await reviewMutation.mutateAsync({
        customerId: selectedCustomer._id,
        payload,
      });
      const updatedCustomer = res?.data?.customer;
      const updatedIntake = res?.data?.intake;
      setSelectedCustomer((prev) => ({
        ...prev,
        readinessStatus:
          updatedCustomer?.readinessStatus || prev?.readinessStatus,
        testPermission:
          updatedIntake?.systemFlags?.testPermission || prev?.testPermission,
        holdReasons:
          updatedIntake?.systemFlags?.holdReasons || prev?.holdReasons || [],
        cautionReasons:
          updatedIntake?.systemFlags?.cautionReasons ||
          prev?.cautionReasons ||
          [],
        lastIntakeId: updatedIntake?._id || prev?.lastIntakeId,
      }));
      toast.success(res?.message || "HLV đã xem xét thành công");
      await invalidateCustomers();
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Xem xét quyền đánh giá thất bại",
      );
    }
  };

  const handleResultPredictionGenerated = async (result) => {
    setSelectedCustomer((prev) => ({
      ...prev,
      lastResultPredictionId:
        result?._id || result?.data?._id || prev?.lastResultPredictionId,
    }));
    await invalidateCustomers();
  };

  return (
    <>
      {confirmDialog}
    <SEO title="Quản lý khách hàng F1" noindex />
    <div className="flex min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      {/* Mobile menu button */}
      <button
        data-testid="f1-mobile-menu-toggle"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label={mobileMenuOpen ? "Đóng menu F1" : "Mở menu F1"}
        aria-expanded={mobileMenuOpen}
        aria-controls="f1-navigation"
        className="fixed left-4 top-4 z-50 rounded-full bg-white p-2 shadow-lg md:hidden"
      >
        <MorphStateIcon state={mobileMenuOpen ? "close" : "menu"} size={20} />
      </button>

      {desktopSidebarCollapsed && (
        <button
          type="button"
          onClick={() => setDesktopSidebarCollapsed(false)}
          aria-label="Mở menu F1"
          aria-expanded="false"
          aria-controls="f1-navigation"
          className="fixed left-4 top-4 z-50 hidden h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 md:inline-flex"
        >
          <SidebarOpen size={20} aria-hidden="true" />
        </button>
      )}

      {/* Sidebar - desktop & mobile overlay */}
      <aside
        id="f1-navigation"
        aria-hidden={isDesktopViewport && desktopSidebarCollapsed}
        inert={isDesktopViewport && desktopSidebarCollapsed}
        className={`fixed inset-y-0 left-0 z-40 w-72 transform bg-gradient-to-b from-slate-800 to-slate-900 text-white shadow-2xl transition-[transform,width] duration-300 ease-in-out md:relative md:translate-x-0 md:overflow-hidden md:duration-200 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        } ${desktopSidebarCollapsed ? "md:w-0" : "md:w-72"}`}
      >
        <div className="flex h-full w-72 flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 p-6">
            <div>
              <h3 className="text-2xl font-black tracking-tight">HTCOACHING</h3>
              <p className="mt-1 text-xs text-slate-400">
                powered by FitAssess AI
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDesktopSidebarCollapsed(true)}
              aria-label="Thu menu F1"
              aria-expanded="true"
              aria-controls="f1-navigation"
              className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 md:inline-flex"
            >
              <SidebarClose size={20} aria-hidden="true" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-4 py-8">
            <button
              onClick={() => {
                setViewMode("list");
                setMobileMenuOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                viewMode === "list" || viewMode === "create"
                  ? "bg-amber-500/20 text-amber-300 shadow-inner"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Users size={20} />
              <span>Khách hàng F1</span>
            </button>

            <button
              data-testid="f1-nav-deleted"
              onClick={() => {
                setViewMode("deleted");
                setMobileMenuOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                viewMode === "deleted"
                  ? "bg-amber-500/20 text-amber-300 shadow-inner"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Trash2 size={20} />
              <span>Xóa khách hàng</span>
            </button>

          </nav>

          <div className="border-t border-white/10 p-4">
            <Link
              to="/"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/20"
            >
              <Home size={18} />
              <span>Trở về trang chủ</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={`flex-1 overflow-x-auto px-4 pb-4 pt-16 transition-[padding] duration-200 md:p-8 ${
          desktopSidebarCollapsed ? "md:pl-20" : ""
        }`}
      >
        <div className="mx-auto max-w-7xl">
          <Suspense
            fallback={
              <div role="status" className="p-6 text-slate-600">
                Đang tải màn hình F1...
              </div>
            }
          >
          {(viewMode === "list" || viewMode === "create") && (
            <F1CustomerList
              loading={customersQuery.isLoading}
              search={search}
              setSearch={(value) => {
                setSearch(value);
                setPage(1);
              }}
              customers={customers}
              pagination={pagination}
              onPageChange={setPage}
              onOpenCreate={handleOpenCreate}
              onSelectCustomer={handleSelectCustomer}
            />
          )}

          {viewMode === "deleted" && (
            <F1DeletedCustomers
              loading={deletedQuery.isLoading}
              error={deletedQuery.isError}
              customers={deletedCustomers}
              restoringId={restoreMutation.isPending ? restoreMutation.variables : ""}
              onRestore={handleRestoreCustomer}
              onRetry={() => deletedQuery.refetch()}
            />
          )}

          {viewMode === "create" && (
            <F1CreateCustomerForm
              createForm={createForm}
              setCreateForm={setCreateForm}
              submittingCreate={createMutation.isPending}
              canSelectOrigin={user?.role === "admin"}
              conversionOrigins={conversionOrigins}
              onBack={() => setViewMode("list")}
              onSubmit={handleCreateCustomer}
            />
          )}

          {viewMode === "detail" && selectedCustomer && (
            <F1CustomerDetail
              customer={selectedCustomer}
              onBack={() => setViewMode("list")}
              onStartIntake={() => setViewMode("intake")}
              onStartAssessment={() => setViewMode("assessment")}
              onOpenAiReport={() => setViewMode("report")}
              onOpenResultPrediction={() => setViewMode("result_prediction")}
              onOpenSummaryReport={() => setSummaryReportOpen(true)}
              onDelete={handleDeleteCustomer}
              deleting={deleteMutation.isPending}
              reviewingTestPermission={reviewMutation.isPending}
              onReviewTestPermission={handleReviewTestPermission}
            />
          )}

          {viewMode === "intake" && selectedCustomer && (
            <F1IntakeWizard
              customer={selectedCustomer}
              onBack={() => setViewMode("detail")}
              onSubmitted={handleIntakeSubmitted}
            />
          )}

          {viewMode === "assessment" && selectedCustomer && (
            <F1AssessmentPanel
              customer={selectedCustomer}
              onBack={() => setViewMode("detail")}
              onSubmitted={handleAssessmentSubmitted}
            />
          )}

          {viewMode === "report" && selectedCustomer && (
            <F1AiReportPanel
              customer={selectedCustomer}
              onBack={() => setViewMode("detail")}
              onGenerated={handleAiReportGenerated}
              onOpenResultPrediction={() => setViewMode("result_prediction")}
            />
          )}

          {viewMode === "result_prediction" && selectedCustomer && (
            <F1ResultPredictionPanel
              customer={selectedCustomer}
              onBack={() => setViewMode("detail")}
              onGenerated={handleResultPredictionGenerated}
            />
          )}
          {summaryReportOpen && selectedCustomer && viewMode === "detail" && (
            <F1CustomerSummaryReport
              customer={selectedCustomer}
              onClose={() => setSummaryReportOpen(false)}
              {...getSummaryContinueAction({
                customer: selectedCustomer,
                onAssessment: () => {
                  setSummaryReportOpen(false);
                  setViewMode("assessment");
                },
                onReport: () => {
                  setSummaryReportOpen(false);
                  setViewMode("report");
                },
              })}
            />
          )}
          </Suspense>
        </div>
      </main>
    </div>
    </>
  );
};

export default F1Customers;
