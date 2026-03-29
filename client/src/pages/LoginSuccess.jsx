import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const LoginSuccess = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Chuyển hướng về trang chủ, AuthProvider sẽ tự lấy user
    navigate("/", { replace: true });
  }, [navigate]);

  return <div className="p-4 text-center">Đang đăng nhập...</div>;
};

export default LoginSuccess;
