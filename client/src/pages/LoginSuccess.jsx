import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const LoginSuccess = () => {
  const navigate = useNavigate();
  const { refetch } = useAuth();

  useEffect(() => {
    const updateUser = async () => {
      try {
        const res = await api.get("/user/me");

        if (res.data?.email) {
          await refetch();
          navigate("/", { replace: true });
        } else {
          alert("Google login fail: /user/me không có email");
          navigate("/login", { replace: true });
        }
      } catch (err) {
        alert(
          "Google login fail: " +
            (err?.response?.data?.message || err.message || "Unknown error"),
        );
        navigate("/login", { replace: true });
      }
    };

    updateUser();
  }, [refetch, navigate]);

  return <div className="p-4 text-center">Đang đăng nhập...</div>;
};

export default LoginSuccess;
