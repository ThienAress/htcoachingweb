import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";
import Header from "../../sections/Header/Header";
import Footer from "../../sections/Footer/Footer";
import {
  User,
  ShoppingBag,
  History,
  Loader2,
  FileText,
} from "lucide-react";
import {
  updateMyProfile,
  updateMyAvatar,
  getMyOrders,
  getMyTransactions
} from "../../services/user.service";
import { toast } from "react-toastify";
import SEO from "../../components/SEO";
import { getMyContracts } from "../../services/contract.service";

import ProfileTab from "./components/ProfileTab";
import OrdersTab from "./components/OrdersTab";
import HistoryTab from "./components/HistoryTab";
import ContractsTab from "./components/ContractsTab";

function AccountPage() {
  const { t } = useTranslation("account");
  const navigate = useNavigate();
  const { user, refetch } = useAuth();

  const getAvatarUrl = useCallback((avatar) => {
    if (!avatar) return "https://i.pravatar.cc/100";
    if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
      return avatar;
    }
    const serverUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace("/api", "")
      : "http://localhost:5000";
    return `${serverUrl}${avatar}`;
  }, []);

  // Tab state
  const [activeTab, setActiveTab] = useState("profile");

  // Inline editing state
  const [editingField, setEditingField] = useState(null);

  // Orders Tab states
  const [orderFilter, setOrderFilter] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");

  // Loading & Action states
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Optimistic UI: preview ảnh local trước khi upload xong
  const [optimisticAvatar, setOptimisticAvatar] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Form input states
  const [editValues, setEditValues] = useState({
    name: "",
    phone: "",
    address: ""
  });

  // Backend data states
  const [orders, setOrders] = useState({
    trainerSubscriptions: [],
    trainerOrders: [],
    clientOrders: []
  });
  const [transactions, setTransactions] = useState([]);
  const [myContracts, setMyContracts] = useState([]);

  // File input ref
  const fileInputRef = useRef(null);

  // Authenticate & Fetch data on mount
  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    setEditValues({
      name: user.name || "",
      phone: user.phone || "",
      address: user.address || ""
    });

    const fetchData = async () => {
      try {
        setLoading(true);
        const [ordersRes, txRes] = await Promise.all([
          getMyOrders(),
          getMyTransactions()
        ]);

        setOrders({
          trainerSubscriptions: ordersRes.trainerSubscriptions || [],
          trainerOrders: ordersRes.trainerOrders || [],
          clientOrders: ordersRes.clientOrders || []
        });
        setTransactions(txRes.transactions || []);

        try {
          const contractRes = await getMyContracts();
          setMyContracts(contractRes.data?.data || []);
        } catch {}
      } catch {
        toast.error(t("profile.errors.fetch_failed"));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, navigate]);

  // Handle single field save — Optimistic UI
  const handleSaveField = async (field) => {
    const value = editValues[field]?.trim();
    if (field === "name" && !value) {
      toast.error(t("profile.errors.name_empty"));
      return;
    }

    // Optimistic: đóng panel edit ngay, giữ backup để rollback
    const previousValue = editValues[field];
    setEditingField(null);

    try {
      setUpdating(true);
      const updatedData = {
        name: field === "name" ? value : user.name,
        phone: field === "phone" ? value : user.phone,
        address: field === "address" ? value : user.address
      };

      const response = await updateMyProfile(updatedData);

      if (response.data.success) {
        toast.success(t("profile.errors.update_success"));
        await refetch();
      } else {
        // Rollback
        setEditValues((prev) => ({ ...prev, [field]: previousValue || "" }));
        toast.error(response.data.message || t("profile.errors.update_failed"));
      }
    } catch (err) {
      // Rollback
      setEditValues((prev) => ({ ...prev, [field]: previousValue || "" }));
      toast.error(err.response?.data?.message || t("profile.errors.update_failed"));
    } finally {
      setUpdating(false);
    }
  };

  // Upload Avatar — Optimistic UI: hiện preview local ngay lập tức
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("profile.errors.avatar_limit"));
      return;
    }

    // Optimistic: hiện preview ảnh local ngay
    const previewUrl = URL.createObjectURL(file);
    setOptimisticAvatar(previewUrl);

    const uploadData = new FormData();
    uploadData.append("avatar", file);

    try {
      setUploading(true);
      const response = await updateMyAvatar(uploadData);

      if (response.data.success) {
        toast.success(t("profile.errors.upload_success"));
        await refetch();
        setEditingField(null);
      } else {
        toast.error(response.data.message || t("profile.errors.upload_failed"));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || t("profile.errors.upload_failed"));
    } finally {
      setUploading(false);
      // Cleanup preview URL sau khi refetch xong (ảnh thật đã có)
      URL.revokeObjectURL(previewUrl);
      setOptimisticAvatar(null);
    }
  };

  // Process & Filter orders
  const filteredOrders = useMemo(() => {
    let combined = [];

    const taggedSub = orders.trainerSubscriptions.map(s => ({
      _id: s._id,
      title: t("orders.plan_hlv", { name: s.planTitle }),
      subtitle: t("orders.cycle_desc", { cycle: s.billingCycle === "month" ? t("orders.cycle_month") : t("orders.cycle_year") }),
      typeLabel: t("orders.type_sub"),
      status: s.status === "active" ? "approved" : "cancelled",
      createdAt: s.createdAt
    }));

    const taggedHlv = orders.trainerOrders.map(o => ({
      _id: o._id,
      title: t("orders.plan_pt", { name: o.package || "N/A" }),
      subtitle: t("orders.trainer_assigned", { name: o.trainerId?.name || t("orders.trainer_random") }),
      typeLabel: t("orders.type_pt"),
      status: o.status,
      createdAt: o.createdAt
    }));

    const taggedPt = orders.clientOrders.map(o => ({
      _id: o._id,
      title: t("orders.plan_pt", { name: o.package || "N/A" }),
      subtitle: t("orders.client_name", { name: o.userId?.name || o.name || t("orders.client_default") }),
      typeLabel: t("orders.type_pt"),
      status: o.status,
      createdAt: o.createdAt
    }));

    if (orderFilter === "all") {
      combined = [...taggedSub, ...taggedHlv, ...taggedPt];
    } else if (orderFilter === "hlv") {
      combined = taggedSub;
    } else if (orderFilter === "pt") {
      combined = [...taggedHlv, ...taggedPt];
    }

    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      combined = combined.filter(o =>
        o._id?.toLowerCase().includes(q) ||
        o.title?.toLowerCase().includes(q) ||
        o.subtitle?.toLowerCase().includes(q)
      );
    }

    return combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, orderFilter, orderSearch]);

  if (!user) return null;

  // Sidebar menu items
  const menuItems = [
    { key: "profile", label: t("sidebar.profile"), icon: User, group: t("profile.title") },
    { key: "orders", label: t("sidebar.orders"), icon: ShoppingBag, group: t("orders.title") },
    { key: "history", label: t("sidebar.history"), icon: History, group: t("history.title") },
    { key: "contracts", label: t("sidebar.contracts"), icon: FileText, group: t("contracts.title") },
  ];

  return (
    <>
      <SEO title={t("sidebar.title")} noindex />
      <Header />

      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-gray-100 font-sans pt-28 sm:pt-30 lg:pt-30 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

            {/* 1. LEFT SIDEBAR */}
            <div className="lg:col-span-1">
              <div className="mb-6 lg:mb-8">
                <h1 className="text-fluid-2xl font-black uppercase text-white tracking-wide">
                  {t("sidebar.title")}
                </h1>
                <p className="text-gray-400 text-fluid-xs mt-1 leading-relaxed">
                  {t("sidebar.desc")}
                </p>
              </div>

              <div className="space-y-6">
                {menuItems.map((item) => (
                  <div key={item.key}>
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-3 mb-2.5">
                      {item.group}
                    </h3>
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setActiveTab(item.key);
                          setEditingField(null);
                        }}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer ${activeTab === item.key
                          ? "bg-slate-700/60 text-white border-l-4 border-orange-500 shadow-md"
                          : "text-gray-400 hover:text-white hover:bg-white/5"
                          }`}
                      >
                        <item.icon size={16} />
                        <span>{item.label}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. RIGHT CONTENT AREA */}
            <div className="lg:col-span-3">
              {loading ? (
                <div className="bg-gray-800/40 backdrop-blur-md border border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center min-h-[400px]">
                  <Loader2 size={36} className="text-orange-500 animate-spin mb-4" />
                  <p className="text-gray-400 text-sm">Đang tải dữ liệu cài đặt...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {activeTab === "profile" && (
                    <ProfileTab
                      user={user}
                      editingField={editingField}
                      setEditingField={setEditingField}
                      editValues={editValues}
                      setEditValues={setEditValues}
                      updating={updating}
                      uploading={uploading}
                      optimisticAvatar={optimisticAvatar}
                      handleSaveField={handleSaveField}
                      handleAvatarChange={handleAvatarChange}
                      getAvatarUrl={getAvatarUrl}
                      fileInputRef={fileInputRef}
                    />
                  )}

                  {activeTab === "orders" && (
                    <OrdersTab
                      filteredOrders={filteredOrders}
                      orderFilter={orderFilter}
                      setOrderFilter={setOrderFilter}
                      orderSearch={orderSearch}
                      setOrderSearch={setOrderSearch}
                    />
                  )}

                  {activeTab === "history" && (
                    <HistoryTab transactions={transactions} />
                  )}

                  {activeTab === "contracts" && (
                    <ContractsTab myContracts={myContracts} />
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}

export default AccountPage;
