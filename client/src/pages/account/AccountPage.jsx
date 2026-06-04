import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Header from "../../sections/Header/Header";
import Footer from "../../sections/Footer/Footer";
import {
  User,
  ShoppingBag,
  History,
  Phone,
  MapPin,
  Mail,
  Camera,
  Loader2,
  Calendar,
  DollarSign,
  Activity,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertCircle,
  UserCheck,
  Search,
  X
} from "lucide-react";
import {
  updateMyProfile,
  updateMyAvatar,
  getMyOrders,
  getMyTransactions
} from "../../services/user.service";
import { toast } from "react-toastify";

function AccountPage() {
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

  // Tab state (Left sidebar selections matching F8 layout)
  const [activeTab, setActiveTab] = useState("profile"); // profile | orders | history

  // Inline editing state for individual rows
  const [editingField, setEditingField] = useState(null); // 'name' | 'phone' | 'address' | 'avatar' | null

  // F8 Orders Tab states
  const [orderFilter, setOrderFilter] = useState("all"); // all | hlv | pt
  const [orderSearch, setOrderSearch] = useState("");

  // Loading & Action states
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
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
      } catch (err) {
        console.error(err);
        toast.error("Lỗi khi tải dữ liệu tài khoản!");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, navigate]);

  // Handle single field save
  const handleSaveField = async (field) => {
    const value = editValues[field]?.trim();
    if (field === "name" && !value) {
      toast.error("Họ tên không được để trống!");
      return;
    }

    try {
      setUpdating(true);
      const updatedData = {
        name: field === "name" ? value : user.name,
        phone: field === "phone" ? value : user.phone,
        address: field === "address" ? value : user.address
      };

      const response = await updateMyProfile(updatedData);

      if (response.data.success) {
        toast.success("Cập nhật thông tin thành công!");
        await refetch();
        setEditingField(null);
      } else {
        toast.error(response.data.message || "Cập nhật thất bại!");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Lỗi cập nhật thông tin!");
    } finally {
      setUpdating(false);
    }
  };

  // Upload Avatar
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ảnh đại diện không được vượt quá 5MB!");
      return;
    }

    const uploadData = new FormData();
    uploadData.append("avatar", file);

    try {
      setUploading(true);
      const response = await updateMyAvatar(uploadData);

      if (response.data.success) {
        toast.success("Cập nhật ảnh đại diện thành công!");
        await refetch();
        setEditingField(null);
      } else {
        toast.error(response.data.message || "Tải lên ảnh thất bại!");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Lỗi tải lên ảnh!");
    } finally {
      setUploading(false);
    }
  };

  // Process & Filter orders for the F8-style Orders tab
  const filteredOrders = useMemo(() => {
    let combined = [];

    // 1. Tag HLV subscriptions (Mua gói HLV để quản lý học viên)
    const taggedSub = orders.trainerSubscriptions.map(s => ({
      _id: s._id,
      title: `Gói HLV ${s.planTitle}`,
      subtitle: `Chu kỳ: ${s.billingCycle === "month" ? "Tháng" : "Năm"} | Đăng ký để quản lý học viên`,
      typeLabel: "Đơn HLV",
      status: s.status === "active" ? "approved" : "cancelled",
      createdAt: s.createdAt
    }));

    // 2. Tag Khách PT orders (bao gồm cả đơn HLV mà user mua và đơn học viên đăng ký với HLV)
    const taggedHlv = orders.trainerOrders.map(o => ({
      _id: o._id,
      title: `Gói PT: ${o.package || "N/A"}`,
      subtitle: `HLV phụ trách: ${o.trainerId?.name || "Ngẫu nhiên"}`,
      typeLabel: "Đơn Khách PT",
      status: o.status,
      createdAt: o.createdAt
    }));

    const taggedPt = orders.clientOrders.map(o => ({
      _id: o._id,
      title: `Gói PT: ${o.package || "N/A"}`,
      subtitle: `Học viên: ${o.userId?.name || o.name || "Khách hàng"}`,
      typeLabel: "Đơn Khách PT",
      status: o.status,
      createdAt: o.createdAt
    }));

    // Select based on filter pills
    if (orderFilter === "all") {
      combined = [...taggedSub, ...taggedHlv, ...taggedPt];
    } else if (orderFilter === "hlv") {
      combined = taggedSub;
    } else if (orderFilter === "pt") {
      combined = [...taggedHlv, ...taggedPt];
    }

    // Filter by search query (id or title or subtitle)
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      combined = combined.filter(o =>
        o._id?.toLowerCase().includes(q) ||
        o.title?.toLowerCase().includes(q) ||
        o.subtitle?.toLowerCase().includes(q)
      );
    }

    // Sort by newest first
    return combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, orderFilter, orderSearch]);

  if (!user) return null;

  // Render order status badge
  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "approved":
      case "active":
      case "success":
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle size={11} />
            Đã thanh toán
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock size={11} />
            Chờ thanh toán
          </span>
        );
      case "failed":
      case "cancelled":
      case "expired":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle size={11} />
            Hủy bỏ / Hết hạn
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">
            <Clock size={11} />
            {status || "Không rõ"}
          </span>
        );
    }
  };

  // Render transaction type badge
  const getTxTypeBadge = (type) => {
    switch (type) {
      case "deposit":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Nạp tiền
          </span>
        );
      case "purchase":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
            Mua hàng
          </span>
        );
      case "refund":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
            Hoàn tiền
          </span>
        );
      case "adjustment":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Điều chỉnh
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-500/10 text-gray-400 border border-gray-500/20">
            Khác
          </span>
        );
    }
  };

  return (
    <>
      <style>{`
        @keyframes tabFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-tab-fade {
          animation: tabFadeIn 0.15s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
      `}</style>
      <Header />

      {/* Background matches ExercisesPage: bg-gradient-to-br from-gray-900 via-gray-800 to-black */}
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-gray-100 font-sans pt-28 sm:pt-30 lg:pt-30 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

            {/* 1. LEFT SIDEBAR */}
            <div className="lg:col-span-1">
              <div className="mb-6 lg:mb-8">
                <h1 className="text-2xl sm:text-3xl font-black uppercase text-white tracking-wide">
                  Cài đặt tài khoản
                </h1>
                <p className="text-gray-400 text-xs sm:text-sm mt-1 leading-relaxed">
                  Quản lý hồ sơ, bảo mật, đơn hàng và lịch sử giao dịch của bạn.
                </p>
              </div>

              {/* Sidebar Menu matching F8 structure */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-3 mb-2.5">
                    Tài khoản
                  </h3>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setActiveTab("profile");
                        setEditingField(null);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer ${activeTab === "profile"
                        ? "bg-slate-700/60 text-white border-l-4 border-orange-500 shadow-md"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                        }`}
                    >
                      <User size={16} />
                      <span>Thông tin cá nhân</span>
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-3 mb-2.5">
                    Đơn hàng
                  </h3>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setActiveTab("orders");
                        setEditingField(null);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer ${activeTab === "orders"
                        ? "bg-slate-700/60 text-white border-l-4 border-orange-500 shadow-md"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                        }`}
                    >
                      <ShoppingBag size={16} />
                      <span>Đơn hàng của tôi</span>
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-3 mb-2.5">
                    Lịch sử
                  </h3>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setActiveTab("history");
                        setEditingField(null);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer ${activeTab === "history"
                        ? "bg-slate-700/60 text-white border-l-4 border-orange-500 shadow-md"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                        }`}
                    >
                      <History size={16} />
                      <span>Lịch sử thanh toán</span>
                    </button>
                  </div>
                </div>
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

                  {/* TAB 1: PROFILE MANAGEMENT (F8 LIST STYLE) */}
                  {activeTab === "profile" && (
                    <div className="animate-tab-fade">
                      {/* Section Header */}
                      <div className="mb-6 pb-4 border-b border-white/10">
                        <h2 className="text-xl font-bold text-white uppercase">Thông tin cá nhân</h2>
                        <p className="text-gray-400 text-xs sm:text-sm mt-0.5">Quản lý thông tin cá nhân của bạn.</p>
                      </div>

                      {/* Main F8 layout block */}
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-sm font-bold text-gray-300">Thông tin cơ bản</h3>
                          <p className="text-gray-400 text-xs mt-0.5">Quản lý tên hiển thị, email, số điện thoại, địa chỉ và ảnh đại diện của bạn.</p>
                        </div>

                        {/* List style block exactly like F8 with click-to-edit interactions */}
                        <div className="bg-gray-800/20 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl divide-y divide-white/10">

                          {/* Row 1: Name Field */}
                          <div>
                            {editingField === "name" ? (
                              <div className="p-5 sm:p-6 bg-white/5 space-y-4">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Họ và tên</span>
                                  <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-white">
                                    <X size={16} />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={editValues.name}
                                  onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                                  placeholder="Nhập họ tên đầy đủ"
                                  className="w-full bg-black/50 border border-white/20 rounded-xl py-2.5 px-4 text-white text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                                  autoFocus
                                />
                                <div className="flex justify-end gap-2 text-xs pt-1">
                                  <button
                                    onClick={() => setEditingField(null)}
                                    className="px-3.5 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
                                  >
                                    Hủy
                                  </button>
                                  <button
                                    onClick={() => handleSaveField("name")}
                                    disabled={updating}
                                    className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                                  >
                                    {updating && <Loader2 size={12} className="animate-spin" />}
                                    <span>Lưu</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingField("name")}
                                className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-all outline-none"
                              >
                                <div>
                                  <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">Họ và tên</span>
                                  <span className="text-sm font-semibold text-white mt-1.5 block">{user.name || "Chưa cập nhật"}</span>
                                </div>
                                <ChevronRight size={18} className="text-gray-500" />
                              </button>
                            )}
                          </div>

                          {/* Row 2: Email (Readonly) */}
                          <div className="p-5 flex items-center justify-between opacity-80">
                            <div>
                              <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">Địa chỉ email</span>
                              <span className="text-sm font-semibold text-gray-400 mt-1.5 block">{user.email || "N/A"}</span>
                            </div>
                            <span className="text-[10px] font-bold bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-emerald-400 flex items-center gap-1">
                              <CheckCircle size={10} /> Đã xác minh
                            </span>
                          </div>

                          {/* Row 3: Phone Field */}
                          <div>
                            {editingField === "phone" ? (
                              <div className="p-5 sm:p-6 bg-white/5 space-y-4">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Số điện thoại</span>
                                  <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-white">
                                    <X size={16} />
                                  </button>
                                </div>
                                <input
                                  type="tel"
                                  value={editValues.phone}
                                  onChange={(e) => setEditValues({ ...editValues, phone: e.target.value })}
                                  placeholder="Nhập số điện thoại của bạn"
                                  className="w-full bg-black/50 border border-white/20 rounded-xl py-2.5 px-4 text-white text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                                  autoFocus
                                />
                                <div className="flex justify-end gap-2 text-xs pt-1">
                                  <button
                                    onClick={() => setEditingField(null)}
                                    className="px-3.5 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
                                  >
                                    Hủy
                                  </button>
                                  <button
                                    onClick={() => handleSaveField("phone")}
                                    disabled={updating}
                                    className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                                  >
                                    {updating && <Loader2 size={12} className="animate-spin" />}
                                    <span>Lưu</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingField("phone")}
                                className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-all outline-none"
                              >
                                <div>
                                  <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">Số điện thoại</span>
                                  <span className="text-sm font-semibold text-white mt-1.5 block">{user.phone || "Chưa cập nhật"}</span>
                                </div>
                                <ChevronRight size={18} className="text-gray-500" />
                              </button>
                            )}
                          </div>

                          {/* Row 4: Address Field */}
                          <div>
                            {editingField === "address" ? (
                              <div className="p-5 sm:p-6 bg-white/5 space-y-4">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Địa chỉ thường trú</span>
                                  <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-white">
                                    <X size={16} />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={editValues.address}
                                  onChange={(e) => setEditValues({ ...editValues, address: e.target.value })}
                                  placeholder="Nhập địa chỉ nhà chi tiết"
                                  className="w-full bg-black/50 border border-white/20 rounded-xl py-2.5 px-4 text-white text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                                  autoFocus
                                />
                                <div className="flex justify-end gap-2 text-xs pt-1">
                                  <button
                                    onClick={() => setEditingField(null)}
                                    className="px-3.5 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
                                  >
                                    Hủy
                                  </button>
                                  <button
                                    onClick={() => handleSaveField("address")}
                                    disabled={updating}
                                    className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                                  >
                                    {updating && <Loader2 size={12} className="animate-spin" />}
                                    <span>Lưu</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingField("address")}
                                className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-all outline-none"
                              >
                                <div>
                                  <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">Địa chỉ thường trú</span>
                                  <span className="text-sm font-semibold text-white mt-1.5 block">{user.address || "Chưa cập nhật"}</span>
                                </div>
                                <ChevronRight size={18} className="text-gray-500" />
                              </button>
                            )}
                          </div>

                          {/* Row 5: Avatar Field */}
                          <div>
                            {editingField === "avatar" ? (
                              <div className="p-5 sm:p-6 bg-white/5 space-y-4">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Ảnh đại diện</span>
                                  <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-white">
                                    <X size={16} />
                                  </button>
                                </div>
                                <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
                                  <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-orange-500 bg-gray-900 shadow-lg">
                                    {uploading && (
                                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                                        <Loader2 size={24} className="text-orange-500 animate-spin" />
                                      </div>
                                    )}
                                    <img
                                      src={getAvatarUrl(user.avatar)}
                                      alt="avatar"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div className="flex flex-col items-center sm:items-start gap-2.5">
                                    <button
                                      onClick={() => fileInputRef.current?.click()}
                                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                                    >
                                      <Camera size={14} />
                                      <span>Tải ảnh mới từ thiết bị</span>
                                    </button>
                                    <span className="text-[10px] text-gray-500">Chấp nhận JPG, PNG, GIF, WEBP dung lượng tối đa 5MB.</span>
                                    <input
                                      type="file"
                                      ref={fileInputRef}
                                      onChange={handleAvatarChange}
                                      accept="image/*"
                                      className="hidden"
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingField("avatar")}
                                className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-all outline-none"
                              >
                                <div>
                                  <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">Ảnh đại diện</span>
                                  <span className="text-xs text-gray-500 mt-1 block">Hình ảnh chân dung hồ sơ cá nhân.</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <img
                                    src={getAvatarUrl(user.avatar)}
                                    alt="avatar pointer"
                                    className="w-10 h-10 rounded-full object-cover border border-white/20 bg-gray-900"
                                  />
                                  <ChevronRight size={18} className="text-gray-500" />
                                </div>
                              </button>
                            )}
                          </div>

                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: MY ORDERS (F8 LAYOUT CLEAN VERSION WITH ONLY ORDER ID AND PAYMENT STATUS) */}
                  {activeTab === "orders" && (
                    <div className="animate-tab-fade bg-gray-800/20 backdrop-blur-md rounded-2xl border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">

                      {/* Top Header stats matching F8 */}
                      <div className="pb-4 border-b border-white/5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                        <div>
                          <span className="text-xs text-gray-400 font-semibold block uppercase tracking-wider">Đang hiển thị</span>
                          <span className="text-2xl font-black text-white block mt-1">
                            {filteredOrders.length} đơn hàng
                          </span>
                        </div>
                      </div>

                      {/* Search Bar matching F8 style */}
                      <div className="relative max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input
                          type="text"
                          placeholder="Tìm theo mã đơn hoặc gói tập..."
                          value={orderSearch}
                          onChange={(e) => setOrderSearch(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded-full py-2.5 pl-11 pr-4 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-500 transition-all"
                        />
                        {orderSearch && (
                          <button onClick={() => setOrderSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {/* Filter Capsule Pills matching F8 */}
                      <div className="flex flex-wrap gap-2 text-xs">
                        <button
                          onClick={() => setOrderFilter("all")}
                          className={`px-4 py-2 rounded-full font-bold transition-all cursor-pointer ${orderFilter === "all"
                            ? "bg-slate-700 text-white shadow-md"
                            : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                            }`}
                        >
                          Tất cả
                        </button>

                        <button
                          onClick={() => setOrderFilter("hlv")}
                          className={`px-4 py-2 rounded-full font-bold transition-all cursor-pointer ${orderFilter === "hlv"
                            ? "bg-slate-700 text-white shadow-md"
                            : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                            }`}
                        >
                          Đơn hàng Huấn luyện viên
                        </button>

                        <button
                          onClick={() => setOrderFilter("pt")}
                          className={`px-4 py-2 rounded-full font-bold transition-all cursor-pointer ${orderFilter === "pt"
                            ? "bg-slate-700 text-white shadow-md"
                            : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                            }`}
                        >
                          Đơn hàng Khách PT
                        </button>
                      </div>

                      {/* Orders rows list with ONLY Order ID and Payment Status */}
                      {filteredOrders.length === 0 ? (
                        <div className="py-12 text-center text-gray-500">
                          <ShoppingBag className="mx-auto mb-3 opacity-30 text-gray-400" size={40} />
                          <p className="text-sm">Không tìm thấy đơn hàng nào phù hợp.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5 border-t border-white/5">
                          {filteredOrders.map((order) => (
                            <div
                              key={order._id}
                              className="py-5 flex items-center justify-between gap-4 transition-all duration-150 hover:bg-white/5 px-2 rounded-xl"
                            >
                              {/* Left column: Order code, date and description */}
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2.5">
                                  <span className="font-extrabold text-white text-sm uppercase tracking-wider">
                                    #{order._id.substring(order._id.length - 8).toUpperCase()}
                                  </span>
                                  <span className="text-[9px] font-bold bg-white/5 border border-white/15 px-2.5 py-0.5 rounded text-orange-400 uppercase tracking-wider">
                                    {order.typeLabel}
                                  </span>
                                </div>
                                <span className="text-[11px] text-gray-500 block">
                                  {order.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "N/A"}
                                </span>
                                <span className="text-xs text-gray-300 block font-semibold pt-0.5">
                                  {order.title}
                                </span>
                                <span className="text-[11px] text-gray-400 block font-medium">
                                  {order.subtitle}
                                </span>
                              </div>

                              {/* Right column: Status only (as requested, no session columns) */}
                              <div className="text-right">
                                {getStatusBadge(order.status)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  )}

                  {/* TAB 3: WALLET TRANSACTIONS */}
                  {activeTab === "history" && (
                    <div className="animate-tab-fade">
                      <div className="mb-6 pb-4 border-b border-white/10">
                        <h2 className="text-xl font-bold text-white uppercase">Lịch sử thanh toán</h2>
                        <p className="text-gray-400 text-xs sm:text-sm mt-0.5">Theo dõi lịch sử thay đổi số dư ví nạp tiền và các giao dịch thanh toán.</p>
                      </div>

                      {transactions.length === 0 ? (
                        <div className="bg-gray-800/20 backdrop-blur-md rounded-2xl border border-white/5 p-12 text-center text-gray-500 shadow-xl">
                          <History className="mx-auto mb-3 opacity-30 text-gray-400" size={40} />
                          <p className="text-sm">Chưa phát sinh giao dịch ví nào trên tài khoản.</p>
                        </div>
                      ) : (
                        <div className="bg-gray-800/20 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs sm:text-sm text-gray-300">
                              <thead>
                                <tr className="border-b border-white/5 bg-white/5 text-gray-400 uppercase font-bold text-[10px] tracking-wider">
                                  <th className="py-4 px-4">Mã GD</th>
                                  <th className="py-4 px-4">Phân loại</th>
                                  <th className="py-4 px-4 text-center">Số tiền</th>
                                  <th className="py-4 px-4 text-center">Số dư ví</th>
                                  <th className="py-4 px-4">Thời gian</th>
                                  <th className="py-4 px-4 text-right">Trạng thái</th>
                                </tr>
                              </thead>
                              <tbody>
                                {transactions.map((tx) => {
                                  const isPositive = tx.amount > 0;
                                  return (
                                    <tr key={tx._id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                      <td className="py-4 px-4 font-mono text-[10px] text-gray-400 truncate max-w-[90px]" title={tx._id}>
                                        #{tx._id.substring(tx._id.length - 8).toUpperCase()}
                                      </td>
                                      <td className="py-4 px-4">{getTxTypeBadge(tx.type)}</td>
                                      <td className={`py-4 px-4 text-center font-black ${isPositive ? "text-emerald-400" : "text-rose-400"
                                        }`}>
                                        {isPositive ? "+" : ""}
                                        {new Intl.NumberFormat("vi-VN", {
                                          style: "currency",
                                          currency: "VND"
                                        }).format(tx.amount)}
                                      </td>
                                      <td className="py-4 px-4 text-center text-gray-400 font-semibold">
                                        {new Intl.NumberFormat("vi-VN", {
                                          style: "currency",
                                          currency: "VND"
                                        }).format(tx.balanceAfter)}
                                      </td>
                                      <td className="py-4 px-4 text-gray-500 text-[10px] sm:text-xs">
                                        {tx.createdAt ? new Date(tx.createdAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "N/A"}
                                      </td>
                                      <td className="py-4 px-4 text-right">
                                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                          Thành công
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
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
