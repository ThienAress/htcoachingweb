import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const LoginSuccess = () => {
  const navigate = useNavigate();
  const { refetch } = useAuth();

  useEffect(() => {
    const updateUser = async () => {
      await refetch(); // gọi lại API /user/me
      navigate("/", { replace: true });
    };
    updateUser();
  }, [refetch, navigate]);

  return <div className="p-4 text-center">Đang đăng nhập...</div>;
};

export default LoginSuccess;
