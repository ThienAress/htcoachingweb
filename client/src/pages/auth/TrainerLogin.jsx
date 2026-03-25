import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trainerLogin } from "../../services/auth.service";
import { toast } from "react-toastify";

const TrainerLogin = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleLogin = async () => {
    console.log("🔥 CLICK LOGIN", form);
    if (!form.email || !form.password) {
      toast.error("Vui lòng nhập email và mật khẩu");
      return;
    }

    try {
      const res = await trainerLogin(form); // ← res được định nghĩa ở đây
      console.log("✅ Full response:", res); // log để xem cấu trúc

      // Lấy token đúng cấu trúc (kiểm tra log để biết)
      const token = res.data.data.token; // hoặc res.data.data.token
      if (!token) {
        toast.error("Không nhận được token từ server");
        return;
      }

      localStorage.setItem("token", token); // ← lưu token vào đây
      console.log("Token saved:", token);

      const user = res.data.user || res.data.data?.user;
      if (!user || user.role !== "trainer") {
        toast.error("Không phải tài khoản trainer");
        return;
      }

      navigate("/trainer");
    } catch (err) {
      console.error("❌ Login error:", err);
      toast.error(err?.response?.data?.message || "Sai email hoặc mật khẩu");
    }
  };
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="bg-white p-6 rounded shadow w-[350px]">
        <h2 className="text-xl font-bold mb-4">Trainer Login</h2>

        <input
          name="email"
          placeholder="Email"
          onChange={handleChange}
          className="w-full border px-3 py-2 mb-3"
        />

        <input
          name="password"
          type="password"
          placeholder="Password"
          onChange={handleChange}
          className="w-full border px-3 py-2 mb-3"
        />

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            console.log("🔥 BUTTON CLICK");
            handleLogin();
          }}
          className="w-full bg-indigo-600 text-white py-2 rounded"
        >
          Đăng nhập
        </button>
      </div>
    </div>
  );
};

export default TrainerLogin;
