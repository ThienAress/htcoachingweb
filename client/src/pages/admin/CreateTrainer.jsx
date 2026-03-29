import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { User, Mail, Lock, Sparkles, Shield } from "lucide-react";
import { createTrainer } from "../../services/user.service";

const trainerSchema = z.object({
  name: z.string().min(1, "Họ tên không được để trống"),
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
});

const CreateTrainer = () => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(trainerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = async (data) => {
    try {
      await createTrainer(data);
      toast.success("Tạo trainer thành công");
      reset();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi hệ thống");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-full p-4">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-linear-to-r from-indigo-600 to-indigo-800 px-6 py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Tạo Trainer</h2>
            <p className="text-indigo-100 text-sm mt-1">
              Thêm huấn luyện viên mới vào hệ thống
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="p-6 md:p-8 space-y-6"
          >
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-500" />
                Họ và tên
              </label>
              <input
                {...register("name")}
                placeholder="Nhập họ tên trainer"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-500" />
                Email
              </label>
              <input
                {...register("email")}
                type="email"
                placeholder="trainer@example.com"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-500" />
                Mật khẩu
              </label>
              <input
                {...register("password")}
                type="password"
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-linear-to-r from-indigo-600 to-indigo-700 text-white py-2.5 rounded-lg font-medium hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Đang tạo...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Tạo Trainer
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateTrainer;
