import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { getMyWallet, createDeposit, getMyDeposits, confirmDeposit } from "../../services/wallet.service";
import { Wallet, Plus, Clock, CheckCircle, XCircle, AlertTriangle, Copy, ArrowLeft } from "lucide-react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import SEO from "../../components/SEO";

// ===== Format tiền VND =====
const formatVND = (amount) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

// ===== Badge trạng thái =====
const StatusBadge = ({ status }) => {
  const map = {
    pending: { label: "Đang chờ", color: "text-yellow-400 bg-yellow-400/10", icon: Clock },
    success: { label: "Thành công", color: "text-green-400 bg-green-400/10", icon: CheckCircle },
    expired: { label: "Hết hạn", color: "text-gray-400 bg-gray-400/10", icon: XCircle },
    rejected: { label: "Từ chối", color: "text-red-400 bg-red-400/10", icon: XCircle },
    needs_review: { label: "Đang chờ duyệt", color: "text-orange-400 bg-orange-400/10", icon: Clock },
  };
  const info = map[status] || map.pending;
  const Icon = info.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${info.color}`}>
      <Icon className="w-3 h-3" /> {info.label}
    </span>
  );
};

// ===== Countdown Timer =====
const Countdown = ({ expiresAt, onExpired }) => {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const calc = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff === 0 && onExpired) onExpired();
    };
    calc();
    const timer = setInterval(calc, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpired]);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  if (timeLeft <= 0) return <span className="text-red-400 font-semibold">Đã hết hạn</span>;

  return (
    <span className={`font-mono font-bold text-lg ${timeLeft < 60 ? "text-red-400 animate-pulse" : "text-green-400"}`}>
      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </span>
  );
};

// ===== TRANG VÍ CỦA TÔI =====
const MyWallet = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [balance, setBalance] = useState(0);
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal nạp tiền
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Màn hình QR
  const [activeDeposit, setActiveDeposit] = useState(null);

  // Fetch dữ liệu
  // Kiểm tra có giao dịch đang chờ duyệt hoặc đang pending
  const hasNeedsReview = deposits.some((d) => d.status === "needs_review");
  const hasPendingDeposit = deposits.some((d) => d.status === "pending");

  const fetchData = useCallback(async () => {
    try {
      const [walletRes, depositsRes] = await Promise.all([getMyWallet(), getMyDeposits()]);
      setBalance(walletRes.data.data.balance);
      setDeposits(depositsRes.data.data);
    } catch (err) {
      console.error("Fetch wallet error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Tự mở lại QR nếu có deposit đang pending
  useEffect(() => {
    if (!activeDeposit && deposits.length > 0) {
      const pendingDeposit = deposits.find((d) => d.status === "pending");
      if (pendingDeposit) {
        setActiveDeposit({
          depositRequestId: pendingDeposit._id,
          amount: pendingDeposit.amount,
          depositCode: pendingDeposit.depositCode,
          qrPayload: pendingDeposit.qrPayload,
          expiresAt: pendingDeposit.expiresAt,
          status: pendingDeposit.status,
        });
      }
    }
  }, [deposits]);

  // Tạo yêu cầu nạp tiền
  const handleCreateDeposit = async () => {
    const amount = parseInt(depositAmount);
    if (!amount || amount < 5000) {
      toast.error("Số tiền tối thiểu là 5.000đ");
      return;
    }
    if (amount > 100000000) {
      toast.error("Số tiền tối đa là 100.000.000đ");
      return;
    }

    setDepositLoading(true);
    try {
      const res = await createDeposit(amount);
      const data = res.data.data;
      setActiveDeposit(data);
      setShowDeposit(false);
      setDepositAmount("");
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi tạo yêu cầu nạp tiền");
    } finally {
      setDepositLoading(false);
    }
  };

  // Xác nhận đã thanh toán
  const handleConfirmDeposit = async () => {
    if (!activeDeposit) return;
    setConfirmLoading(true);
    try {
      await confirmDeposit(activeDeposit.depositRequestId);
      setActiveDeposit((prev) => ({ ...prev, status: "needs_review" }));
      toast.success("Đã ghi nhận thanh toán!");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi xác nhận thanh toán");
    } finally {
      setConfirmLoading(false);
    }
  };

  // Copy mã nạp tiền
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Đã sao chép!");
  };

  // Số tiền nhanh
  const quickAmounts = [5000, 10000, 50000, 100000, 200000, 500000];

  return (
    <phantom-ui loading={loading || undefined}>
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <SEO title="Ví của tôi" noindex />

      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a1a1a] to-[#2a2a2a] border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2 uppercase">
                <Wallet className="w-7 h-7 text-primary" /> Ví của tôi
              </h1>
              <p className="text-gray-400 text-sm mt-1">Xin chào, {user?.name || user?.email}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Số dư hiện tại</p>
              <p className="text-3xl font-bold text-primary">{formatVND(balance)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Nút Nạp tiền */}
        {hasNeedsReview || hasPendingDeposit ? (
          <div className="w-full py-4 bg-[#222] border border-orange-500/30 text-orange-400 font-semibold text-center rounded-xl space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Clock className="w-5 h-5" />
              <span>{hasNeedsReview ? "Đang có giao dịch chờ admin duyệt" : "Bạn đang có giao dịch chưa hoàn tất"}</span>
            </div>
            <p className="text-xs text-gray-500">
              {hasNeedsReview
                ? "Bạn cần đợi giao dịch hiện tại được duyệt trước khi tạo yêu cầu nạp tiền mới."
                : "Vui lòng hoàn tất hoặc chờ hết hạn giao dịch hiện tại trước khi tạo yêu cầu mới."
              }
            </p>
          </div>
        ) : (
          <button
            onClick={() => setShowDeposit(true)}
            className="w-full py-4 bg-gradient-to-r from-primary to-orange-500 text-white font-bold text-lg rounded-xl hover:shadow-lg hover:shadow-orange-500/30 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" /> Nạp tiền vào ví
          </button>
        )}

        {/* ===== MÀN HÌNH QR (khi đã tạo yêu cầu nạp) ===== */}
        {activeDeposit && activeDeposit.status === "pending" && (
          <div className="bg-[#222] border border-gray-700 rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Thông tin chuyển khoản</h3>
              <Countdown
                expiresAt={activeDeposit.expiresAt}
                onExpired={() => {
                  setActiveDeposit(null);
                  fetchData();
                }}
              />
            </div>

            {(() => {
              const qr = JSON.parse(activeDeposit.qrPayload || "{}");
              return (
                <div className="space-y-4">
                  {/* QR Image (VietQR API) */}
                  <div className="flex justify-center">
                    <div className="bg-white rounded-xl p-3">
                      <img
                        src={`https://img.vietqr.io/image/${qr.bankCode || "TPB"}-${qr.accountNumber}-compact.png?amount=${qr.amount}&addInfo=${encodeURIComponent(qr.content)}&accountName=${encodeURIComponent(qr.accountHolder)}`}
                        alt="QR Chuyển khoản"
                        className="w-56 h-56 object-contain"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    </div>
                  </div>

                  {/* Thông tin chi tiết */}
                  <div className="bg-[#1a1a1a] rounded-lg p-4 space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Ngân hàng</span>
                      <span className="font-semibold">{qr.bankName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Số tài khoản</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{qr.accountNumber}</span>
                        <button onClick={() => handleCopy(qr.accountNumber)} className="text-primary hover:text-orange-400">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Chủ tài khoản</span>
                      <span className="font-semibold">{qr.accountHolder}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Số tiền</span>
                      <span className="font-bold text-primary text-base">{formatVND(qr.amount)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-gray-700 pt-3">
                      <span className="text-gray-400">Nội dung CK</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-yellow-400 tracking-wider">{qr.content}</span>
                        <button onClick={() => handleCopy(qr.content)} className="text-primary hover:text-orange-400">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-yellow-400 text-xs text-center">
                    ⚠️ Vui lòng chuyển khoản <strong>đúng số tiền</strong> và <strong>đúng nội dung</strong> để hệ thống xác nhận nhanh nhất.
                  </div>

                  <button
                    onClick={handleConfirmDeposit}
                    disabled={confirmLoading}
                    className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-green-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    {confirmLoading ? "Đang xử lý..." : "Tôi đã thanh toán"}
                  </button>

                  <button
                    onClick={() => {
                      setActiveDeposit(null);
                      fetchData();
                    }}
                    className="w-full py-2 border border-gray-600 rounded-lg text-gray-400 hover:text-white hover:border-gray-400 transition text-sm"
                  >
                    Đóng
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {/* ===== MÀN HÌNH XÁC NHẬN ĐÃ THANH TOÁN (needs_review) ===== */}
        {activeDeposit && activeDeposit.status === "needs_review" && (
          <div className="bg-[#222] border border-green-500/30 rounded-xl p-8 space-y-4 text-center">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-green-400">Thanh toán đã được ghi nhận</h3>
            <p className="text-gray-400 text-sm">
              Hệ thống đã ghi nhận thanh toán của bạn.<br />
              Vui lòng chờ admin xác nhận để cộng tiền vào ví.
            </p>
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-green-300 text-xs">
              ⏳ Thời gian xác nhận thường từ 5 - 30 phút trong giờ hành chính.
            </div>
            <button
              onClick={() => {
                setActiveDeposit(null);
                fetchData();
              }}
              className="w-full py-2 border border-gray-600 rounded-lg text-gray-400 hover:text-white hover:border-gray-400 transition text-sm"
            >
              Đóng
            </button>
          </div>
        )}

        {/* ===== LỊCH SỬ NẠP TIỀN ===== */}
        <div>
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" /> Lịch sử nạp tiền
          </h3>
          {deposits.length === 0 ? (
            <div className="text-center text-gray-500 py-10 bg-[#222] rounded-xl border border-gray-800">
              Chưa có giao dịch nào
            </div>
          ) : (
            <div className="space-y-3">
              {deposits.map((d) => (
                <div
                  key={d._id}
                  className="flex items-center justify-between bg-[#222] border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition cursor-pointer"
                  onClick={() => {
                    if (d.status === "pending") {
                      setActiveDeposit({
                        depositRequestId: d._id,
                        amount: d.amount,
                        depositCode: d.depositCode,
                        qrPayload: d.qrPayload,
                        expiresAt: d.expiresAt,
                        status: d.status,
                      });
                    }
                  }}
                >
                  <div>
                    <p className="font-semibold text-white">{formatVND(d.amount)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(d.createdAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                      {d.depositCode && <span className="ml-2 text-gray-600">• {d.depositCode}</span>}
                    </p>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== MODAL NẠP TIỀN ===== */}
      {showDeposit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e1e1e] border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-5 relative">
            <button
              onClick={() => setShowDeposit(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <h3 className="text-xl font-bold text-white">Nạp tiền vào ví</h3>

            {/* Input số tiền */}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Nhập số tiền (VND)</label>
              <input
                type="number"
                min={5000}
                max={100000000}
                value={depositAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || parseInt(val) <= 100000000) {
                    setDepositAmount(val);
                  }
                }}
                placeholder="Ví dụ: 500000"
                className="w-full bg-[#2a2a2a] border border-gray-600 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-primary transition"
              />
              {depositAmount && parseInt(depositAmount) >= 5000 && (
                <p className="text-primary text-sm mt-1 font-semibold">{formatVND(parseInt(depositAmount))}</p>
              )}
            </div>

            {/* Số tiền nhanh */}
            <div className="flex flex-wrap gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setDepositAmount(String(amt))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                    parseInt(depositAmount) === amt
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
                  }`}
                >
                  {amt >= 1000000 ? `${amt / 1000000}tr` : `${amt / 1000}k`}
                </button>
              ))}
            </div>

            {/* Nút xác nhận */}
            <button
              onClick={handleCreateDeposit}
              disabled={depositLoading || !depositAmount || parseInt(depositAmount) < 5000}
              className="w-full py-3 bg-gradient-to-r from-primary to-orange-500 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-orange-500/30 transition-all"
            >
              {depositLoading ? "Đang xử lý..." : "Tạo mã nạp tiền"}
            </button>

            <p className="text-xs text-gray-500 text-center">
              Mã QR sẽ có hiệu lực trong 15 phút. Vui lòng chuyển khoản đúng số tiền và nội dung.
            </p>
          </div>
        </div>
      )}
    </div>
    </phantom-ui>
  );
};

export default MyWallet;
