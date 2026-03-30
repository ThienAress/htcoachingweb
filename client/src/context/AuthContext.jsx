/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import api from "../utils/api";
import Cookies from "js-cookie"; // 👈 import thư viện

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
    // Gọi API logout (để backend xóa refreshToken trong DB, nhưng không cần chờ kết quả)
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.error("Logout API error:", err);
    }

    // Xóa cookie thủ công trên domain Netlify
    const domain = window.location.hostname; // "htcoachingweb.netlify.app"
    const cookieNames = ["accessToken", "refreshToken", "csrfToken"];
    cookieNames.forEach((name) => {
      // Thử nhiều cách để chắc chắn xóa được
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${domain}; Secure; SameSite=None`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${domain}; Secure; SameSite=None`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; Secure; SameSite=None`;
    });

    setUser(null);
    window.location.href = "/";
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
