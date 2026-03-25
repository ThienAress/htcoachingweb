import { useState } from "react";
import { Mail, Lock, LogIn } from "lucide-react";
import api from "../utils/api";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    console.log("CLICK LOGIN");

    if (!email || !password) {
      alert("Nhập đầy đủ thông tin");
      return;
    }

    try {
      console.log("CALL API...");

      const res = await api.post("/auth/admin/login", {
        email,
        password,
      });

      console.log("LOGIN RES:", res.data);

      if (!res.data.success) {
        throw new Error(res.data.message || "Login failed");
      }

      const token = res.data.data.token;
      const refreshToken = res.data.data.refreshToken;

      localStorage.setItem("token", token);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("token_exp", Date.now() + 15 * 60 * 1000);

      window.location.href = "/admin";
    } catch (err) {
      console.error("LOGIN ERROR FULL:", err);
      console.log("ERROR RESPONSE:", err.response);

      alert(err?.response?.data?.message || err.message || "Login thất bại");
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-full max-w-md border border-white/20">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            Admin Portal
          </h2>
          <p className="text-gray-300 mt-2">
            Đăng nhập để truy cập hệ thống quản lý
          </p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <Mail
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="email"
              placeholder="Email"
              className="w-full pl-10 pr-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="relative">
            <Lock
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full pl-10 pr-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-300 transform hover:scale-[1.02] shadow-lg"
          >
            <LogIn size={18} />
            Đăng nhập Admin
          </button>
        </div>

        <div className="mt-6 text-center text-gray-400 text-sm">
          <p>Chỉ dành cho quản trị viên</p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
