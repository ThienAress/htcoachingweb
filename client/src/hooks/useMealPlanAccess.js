import { useState, useEffect, useCallback, useRef } from "react";
import { checkMealPlanAccess } from "../services/mealplanAccess.service";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";

export const useMealPlanAccess = () => {
  const [accessLevel, setAccessLevel] = useState(null); // 'unlimited' | 'trial' | null
  const [isChecking, setIsChecking] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [remainingTime, setRemainingTime] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const activityTimeoutRef = useRef(null);
  const activityListenerRef = useRef(null);

  const checkAccess = useCallback(async () => {
    if (!user) {
      setIsChecking(false);
      return;
    }

    try {
      setIsChecking(true);
      const res = await checkMealPlanAccess();
      const level = res.data.data.access;
      setAccessLevel(level);

      if (level === "trial") {
        handleTrialAccess();
      } else {
        setIsChecking(false);
      }
    } catch (err) {
      console.error("Lỗi kiểm tra quyền truy cập:", err);
      // Nếu lỗi, tạm thời block để an toàn
      setIsBlocked(true);
      setIsChecking(false);
    }
  }, [user]);

  const handleTrialAccess = () => {
    const now = new Date().getTime();
    const firstAccessStr = localStorage.getItem("mealplan_first_access");
    const sessionActive = sessionStorage.getItem("mealplan_session_active");
    
    // Nếu đây không phải lần đầu và session không active => Reload/F5 (mất session)
    if (firstAccessStr && !sessionActive) {
      const firstAccessTime = parseInt(firstAccessStr, 10);
      const timePassed = now - firstAccessTime;
      const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 giờ
      
      if (timePassed < cooldownPeriod) {
        // Chưa qua 24h, block và redirect
        toast.error("Phiên sử dụng đã kết thúc do tải lại trang. Vui lòng quay lại sau 24 giờ.");
        setIsBlocked(true);
        navigate("/");
        return;
      } else {
        // Đã qua 24h, reset lại chu kỳ
        startNewTrialSession(now);
      }
    } else if (!firstAccessStr) {
      // Lần đầu tiên truy cập
      startNewTrialSession(now);
    } else {
      // Session đang active, nhưng cần kiểm tra xem đã quá 24h chưa (trường hợp treo máy)
      const firstAccessTime = parseInt(firstAccessStr, 10);
      const timePassed = now - firstAccessTime;
      const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 giờ
      if (timePassed >= cooldownPeriod) {
        startNewTrialSession(now);
      } else {
        // Vẫn trong 24h và session đang active
        setupActivityListeners();
        updateLastActivity();
      }
    }
    
    setIsChecking(false);
  };

  const startNewTrialSession = (now) => {
    localStorage.setItem("mealplan_first_access", now.toString());
    sessionStorage.setItem("mealplan_session_active", "true");
    updateLastActivity();
    setupActivityListeners();
  };

  const updateLastActivity = () => {
    localStorage.setItem("mealplan_last_activity", new Date().getTime().toString());
  };

  const setupActivityListeners = () => {
    // Xóa listener cũ nếu có
    cleanupListeners();

    const checkIdle = () => {
      const lastActivityStr = localStorage.getItem("mealplan_last_activity");
      if (lastActivityStr) {
        const lastActivity = parseInt(lastActivityStr, 10);
        const now = new Date().getTime();
        const idleTime = now - lastActivity;
        
        // 1 giờ = 60 * 60 * 1000
        if (idleTime > 60 * 60 * 1000) {
          toast.warning("Hết thời gian truy cập (1 giờ không tương tác).");
          sessionStorage.removeItem("mealplan_session_active");
          navigate("/");
        }
      }
    };

    // Kiểm tra idle mỗi phút
    activityTimeoutRef.current = setInterval(checkIdle, 60000);

    // Lắng nghe tương tác để cập nhật last_activity
    const handleActivity = () => {
      updateLastActivity();
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("scroll", handleActivity);

    activityListenerRef.current = handleActivity;
  };

  const cleanupListeners = useCallback(() => {
    if (activityTimeoutRef.current) {
      clearInterval(activityTimeoutRef.current);
    }
    if (activityListenerRef.current) {
      window.removeEventListener("mousemove", activityListenerRef.current);
      window.removeEventListener("keydown", activityListenerRef.current);
      window.removeEventListener("click", activityListenerRef.current);
      window.removeEventListener("scroll", activityListenerRef.current);
    }
  }, []);

  useEffect(() => {
    checkAccess();
    return cleanupListeners;
  }, [checkAccess, cleanupListeners]);

  // Cập nhật remaining time nếu bị block
  useEffect(() => {
    if (isBlocked) {
      const updateTimer = () => {
        const firstAccessStr = localStorage.getItem("mealplan_first_access");
        if (firstAccessStr) {
          const firstAccessTime = parseInt(firstAccessStr, 10);
          const now = new Date().getTime();
          const cooldownPeriod = 24 * 60 * 60 * 1000;
          const remaining = (firstAccessTime + cooldownPeriod) - now;

          if (remaining <= 0) {
            setIsBlocked(false);
            setRemainingTime("");
            return;
          }

          const hours = Math.floor(remaining / (1000 * 60 * 60));
          const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
          setRemainingTime(`${hours} giờ ${minutes} phút`);
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 60000); // Cập nhật mỗi phút
      return () => clearInterval(interval);
    }
  }, [isBlocked]);

  return { accessLevel, isChecking, isBlocked, remainingTime };
};
