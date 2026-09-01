import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import SEO from "../components/SEO";
import { consumeLoginRedirect } from "../utils/loginRedirect";

const LoginSuccess = () => {
  const navigate = useNavigate();
  const { refetch } = useAuth();

  useEffect(() => {
    const updateUser = async () => {
      try {
        const res = await api.get("/user/me");

        if (res.data?.email) {
          await refetch();

          // Admin → luôn redirect về /admin
          const userData = res.data;
          if (userData.role === "admin") {
            navigate("/admin", { replace: true });
            return;
          }

          // User thường → redirect về trang trước đó (nếu có) hoặc trang chủ
          const redirectTo = consumeLoginRedirect();
          navigate(redirectTo, { replace: true });
        } else {
          toast.error("Đăng nhập Google không trả về email");
          navigate("/login", { replace: true });
        }
      } catch (err) {
        toast.error(
          err?.response?.data?.message ||
            err.message ||
            "Đăng nhập Google thất bại",
        );
        navigate("/login", { replace: true });
      }
    };

    updateUser();
  }, [refetch, navigate]);

  return (
    <>
      <SEO title="Đang đăng nhập" noindex />
      <div className="p-4 text-center">Đang đăng nhập...</div>
    </>
  );
};

export default LoginSuccess;
