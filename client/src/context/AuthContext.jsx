/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import api from "../utils/api";
import Cookies from "js-cookie";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await api.get("/user/me");
      const fetchedUser = res.data;
      if (fetchedUser && !fetchedUser.email) {
        console.warn(
          "User fetched but missing email, treating as not logged in",
        );
        setUser(null);
      } else {
        setUser(fetchedUser);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.error("Logout API error:", err);
    } finally {
      // Xóa cookie bằng js-cookie (bây giờ httpOnly=false nên xóa được)
      Cookies.remove("accessToken", {
        path: "/",
        secure: true,
        sameSite: "none",
      });
      Cookies.remove("refreshToken", {
        path: "/",
        secure: true,
        sameSite: "none",
      });
      Cookies.remove("csrfToken", {
        path: "/",
        secure: true,
        sameSite: "none",
      });
      setUser(null);
      window.location.href = "/";
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout, refetch: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};
