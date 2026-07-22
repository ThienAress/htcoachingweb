/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Cookies from "js-cookie";
import { useQueryClient } from "@tanstack/react-query";
import api from "../utils/api";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await api.get("/user/me");
      const fetchedUser = res.data;

      if (fetchedUser && fetchedUser.email) {
        setUser(fetchedUser);
      } else {
        setUser(null);
      }
    } catch {
      // Local auth state is cleared even if the server session already expired.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Continue with local logout if the server session is already gone.
    } finally {
      // accessToken / refreshToken là httpOnly -> frontend không nên cố remove
      // Chỉ xóa csrfToken nếu muốn dọn client-side
      Cookies.remove("csrfToken", {
        path: "/",
        secure: true,
        sameSite: "none",
      });

      setUser(null);
      queryClient.clear();
      window.location.href = "/";
    }
  }, [queryClient]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const contextValue = useMemo(
    () => ({ user, loading, logout, refetch: fetchUser }),
    [user, loading, logout, fetchUser],
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
