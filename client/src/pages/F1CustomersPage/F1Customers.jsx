import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Home, UserPlus, Users, Menu, X } from "lucide-react";
import {
  createF1Customer,
  deleteF1Customer as deleteF1CustomerApi,
  getF1Customers,
  reviewTestPermission,
} from "../../services/f1Customer.service";
import { toast } from "react-toastify";

import F1CustomerList from "../../components/F1/F1CustomerList";
import F1CustomerDetail from "../../components/F1/F1CustomerDetail";
import F1IntakeWizard from "../../components/F1/F1IntakeWizard";
import F1CreateCustomerForm from "../../components/F1/F1CreateCustomerForm";
import F1AssessmentPanel from "../../components/F1/F1AssessmentPanel";
import F1AiReportPanel from "../../components/F1/F1AiReportPanel";
import F1ResultPredictionPanel from "../../components/F1/F1ResultPredictionPanel";

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
  const [viewMode, setViewMode] = useState("list");
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState(false);

  const [search, setSearch] = useState("");
  const [createForm, setCreateForm] = useState(initialCreateForm);

  const [reviewingTestPermission, setReviewingTestPermission] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return customers;
    return customers.filter((item) => {
      return (
        item.fullName?.toLowerCase().includes(keyword) ||
        item.phone?.toLowerCase().includes(keyword) ||
        item.email?.toLowerCase().includes(keyword) ||
        item.code?.toLowerCase().includes(keyword)
      );
    });
  }, [customers, search]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await getF1Customers();
      setCustomers(Array.isArray(res.data) ? res.data : res.data?.items || []);
    } catch (error) {
      console.error("GET F1 CUSTOMERS ERROR:", error);
    } finally {
      setLoading(false);
    }
  };

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
      setSubmittingCreate(true);
      const payload = {
        ...createForm,
        age: Number(createForm.age) || 0,
      };
      const res = await createF1Customer(payload);
      const createdCustomer = res.data;
      setSelectedCustomer(createdCustomer);
      setViewMode("intake");
      await fetchCustomers();
    } catch (error) {
      console.error("CREATE F1 CUSTOMER ERROR:", error);
      alert(error?.response?.data?.message || "Tạo khách hàng thất bại");
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer?._id) return;
    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa khách hàng "${selectedCustomer.fullName}" không?\n\nDữ liệu intake, media, đánh giá thể chất, AI report và dự đoán kết quả liên quan sẽ bị xóa.`,
    );
    if (!confirmed) return;
    try {
      setDeletingCustomer(true);
      await deleteF1CustomerApi(selectedCustomer._id);
      toast.success("Xóa khách hàng thành công");
      setSelectedCustomer(null);
      setViewMode("list");
      await fetchCustomers();
    } catch (error) {
      console.error("DELETE F1 CUSTOMER ERROR:", error);
      toast.error(error?.response?.data?.message || "Xóa khách hàng thất bại");
    } finally {
      setDeletingCustomer(false);
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
    await fetchCustomers();
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
    await fetchCustomers();
  };

  const handleAiReportGenerated = async (result) => {
    setSelectedCustomer((prev) => ({
      ...prev,
      status: "ai_report_generated",
      lastAiReportId: result?._id || result?.data?._id || prev?.lastAiReportId,
    }));
    await fetchCustomers();
  };

  const handleReviewTestPermission = async (payload) => {
    if (!selectedCustomer?._id) return;
    try {
      setReviewingTestPermission(true);
      const res = await reviewTestPermission(selectedCustomer._id, payload);
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
      await fetchCustomers();
    } catch (error) {
      console.error("REVIEW TEST PERMISSION ERROR:", error);
      toast.error(
        error?.response?.data?.message || "PT review test permission thất bại",
      );
    } finally {
      setReviewingTestPermission(false);
    }
  };

  const handleResultPredictionGenerated = async (result) => {
    setSelectedCustomer((prev) => ({
      ...prev,
      lastResultPredictionId:
        result?._id || result?.data?._id || prev?.lastResultPredictionId,
    }));
    await fetchCustomers();
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="fixed left-4 top-4 z-50 rounded-full bg-white p-2 shadow-lg md:hidden"
      >
        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar - desktop & mobile overlay */}
      <aside
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
          {viewMode === "list" && (
            <F1CustomerList
              loading={loading}
              search={search}
              setSearch={setSearch}
              customers={filteredCustomers}
              onOpenCreate={handleOpenCreate}
              onSelectCustomer={handleSelectCustomer}
            />
          )}

          {viewMode === "create" && (
            <F1CreateCustomerForm
              createForm={createForm}
              setCreateForm={setCreateForm}
              submittingCreate={submittingCreate}
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
              deleting={deletingCustomer}
              reviewingTestPermission={reviewingTestPermission}
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
            />
          )}

          {viewMode === "result_prediction" && selectedCustomer && (
            <F1ResultPredictionPanel
              customer={selectedCustomer}
              onBack={() => setViewMode("detail")}
              onGenerated={handleResultPredictionGenerated}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default F1Customers;
