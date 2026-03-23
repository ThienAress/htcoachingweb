import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

const LoginSuccess = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const token = params.get("token");

    if (token) {
      localStorage.setItem("token", token);

      const user = jwtDecode(token);

      // 👉 phân luồng
      if (user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/"); // 👈 user về home
      }
    } else {
      navigate("/login");
    }
  }, []);

  return <div>Đang đăng nhập...</div>;
};

export default LoginSuccess;
