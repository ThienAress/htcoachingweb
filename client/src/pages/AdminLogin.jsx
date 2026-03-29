import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Mail, Lock, LogIn } from "lucide-react";
import api from "../utils/api";

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});

const AdminLogin = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      console.log("🔑 [Login] Attempting admin login...");
      const res = await api.post("/auth/admin/login", data);
      console.log("✅ [Login] Login success:", res.data);
      toast.success("Đăng nhập thành công!");
      navigate("/admin", { replace: true });
    } catch (err) {
      console.error(
        "❌ [Login] Login error:",
        err.response?.data || err.message,
      );
      toast.error(err?.response?.data?.message || "Đăng nhập thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} />
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

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="relative">
              <Mail
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="email"
                placeholder="Email"
                {...register("email")}
                className="w-full pl-10 pr-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="password"
                placeholder="Password"
                {...register("password")}
                className="w-full pl-10 pr-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition disabled:opacity-50"
            >
              {isLoading ? (
                "Đang xử lý..."
              ) : (
                <>
                  <LogIn size={18} /> Đăng nhập Admin
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-gray-400 text-sm">
            <p>Chỉ dành cho quản trị viên</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminLogin;
