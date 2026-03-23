import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

const AdminRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("token");

      // ❌ Không có token
      if (!token) {
        setIsValid(false);
        setLoading(false);
        return;
      }

      try {
        const user = jwtDecode(token);

        // 🔥 Check token hết hạn
        if (user.exp * 1000 < Date.now()) {
          localStorage.removeItem("token");
          setIsValid(false);
        } else if (user.role !== "admin") {
          // ❌ Không phải admin
          setIsValid(false);
        } else {
          // ✅ Hợp lệ
          setIsValid(true);
        }
      } catch (err) {
        // ❌ Token lỗi
        localStorage.removeItem("token");
        setIsValid(false);
      }

      setLoading(false);
    };

    checkAuth();
  }, []);

  // 🔄 Loading tránh flicker
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Đang kiểm tra quyền truy cập...
      </div>
    );
  }

  // ❌ Không hợp lệ
  if (!isValid) {
    return <Navigate to="/login" />;
  }

  // ✅ OK
  return children;
};

export default AdminRoute;
