import api from "../utils/api";

// Tạo yêu cầu nạp tiền (sinh QR)
export const createDeposit = (amount) => api.post("/deposits", { amount });

// Xem chi tiết 1 yêu cầu nạp
export const getDepositById = (id) => api.get(`/deposits/${id}`);

// User xác nhận đã thanh toán
export const confirmDeposit = (id) => api.post(`/deposits/${id}/confirm`);

// Lịch sử nạp tiền
export const getMyDeposits = () => api.get("/deposits");

// Xem số dư ví
export const getMyWallet = () => api.get("/me/wallet");
