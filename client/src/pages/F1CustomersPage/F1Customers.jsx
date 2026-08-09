import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, UserPlus, Users, Menu, X } from "lucide-react";
import {
  createF1Customer,
  deleteF1Customer as deleteF1CustomerApi,
  getF1Customers,
  reviewTestPermission,
} from "../../services/f1Customer.service";
import { toast } from "react-toastify";
import SEO from "../../components/SEO";
import { useDebounce } from "../../hooks/useDebounce";

const F1CustomerList = lazy(
  () => import("../../components/F1/F1CustomerList"),
);
const F1CustomerDetail = lazy(
  () => import("../../components/F1/F1CustomerDetail"),
);
const F1IntakeWizard = lazy(
  () => import("../../components/F1/F1IntakeWizard"),
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

const initialCreateForm = {
  fullName: "",
  age: "",
  gender: "",
  occupation: "",
  phone: "",
  email: "",
  assignedTrainerId: "",
};

const F1Customers = () => {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState("list");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const debouncedSearch = useDebounce(search.trim(), 350);
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
  const invalidateCustomers = () =>
    queryClient.invalidateQueries({ queryKey: ["f1-customers"] });
  const createMutation = useMutation({ mutationFn: createF1Customer });
  const deleteMutation = useMutation({ mutationFn: deleteF1CustomerApi });
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
    } catch (error) {
      alert(error?.response?.data?.message || "Tạo khách hàng thất bại");
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer?._id) return;
    const confirmed = window.confirm(
      `Bạn có chắc muốn yêu cầu xóa dữ liệu của "${selectedCustomer.fullName}" không?\n\nMedia sẽ được xóa khỏi private storage trước, sau đó dữ liệu sức khỏe mới được xóa.`,
    );
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(selectedCustomer._id);
      toast.success("Đã tiếp nhận yêu cầu xóa dữ liệu an toàn");
      setSelectedCustomer(null);
      setViewMode("list");
      await invalidateCustomers();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Xóa khách hàng thất bại");
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
      toast.success(res?.message || "PT review thành công");
      await invalidateCustomers();
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "PT review test permission thất bại",
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
    <SEO title="Quản lý khách hàng F1" noindex />
    <div className="flex min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label={mobileMenuOpen ? "Đóng menu F1" : "Mở menu F1"}
        aria-expanded={mobileMenuOpen}
        aria-controls="f1-navigation"
        className="fixed left-4 top-4 z-50 rounded-full bg-white p-2 shadow-lg md:hidden"
      >
        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar - desktop & mobile overlay */}
      <aside
        id="f1-navigation"
        className={`fixed inset-y-0 left-0 z-40 w-72 transform bg-gradient-to-b from-slate-800 to-slate-900 text-white shadow-2xl transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 p-6">
            <h3 className="text-2xl font-black tracking-tight">HTCOACHING</h3>
            <p className="mt-1 text-xs text-slate-400">
              powered by FitAssess AI
            </p>
          </div>

          <nav className="flex-1 space-y-1 px-4 py-8">
            <button
              onClick={() => {
                setViewMode("list");
                setMobileMenuOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                viewMode === "list"
                  ? "bg-amber-500/20 text-amber-300 shadow-inner"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Users size={20} />
              <span>Khách hàng F1</span>
            </button>

            <button
              onClick={handleOpenCreate}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                viewMode === "create"
                  ? "bg-amber-500/20 text-amber-300 shadow-inner"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <UserPlus size={20} />
              <span>Thêm khách hàng F1</span>
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
      <main className="flex-1 overflow-x-auto p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <Suspense
            fallback={
              <div role="status" className="p-6 text-slate-600">
                Đang tải màn hình F1...
              </div>
            }
          >
          {viewMode === "list" && (
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

          {viewMode === "create" && (
            <F1CreateCustomerForm
              createForm={createForm}
              setCreateForm={setCreateForm}
              submittingCreate={createMutation.isPending}
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
          </Suspense>
        </div>
      </main>
    </div>
    </>
  );
};

export default F1Customers;
