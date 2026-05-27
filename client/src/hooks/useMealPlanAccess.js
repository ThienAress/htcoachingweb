import { useState, useEffect, useCallback } from "react";
import { checkMealPlanAccess, recordMealPlanGeneration } from "../services/mealplanAccess.service";
import { useAuth } from "../context/AuthContext";

export const useMealPlanAccess = () => {
  const [accessLevel, setAccessLevel] = useState(null); // 'unlimited' | 'trial' | null
  const [isChecking, setIsChecking] = useState(true);
  const [generationCount, setGenerationCount] = useState(0);
  const [maxGenerations, setMaxGenerations] = useState(3);
  const { user } = useAuth();

  const checkAccess = useCallback(async () => {
    if (!user) {
      setIsChecking(false);
      return;
    }

    try {
      setIsChecking(true);
      const res = await checkMealPlanAccess();
      const { access, generationCount: count, maxGenerations: max } = res.data.data;
      setAccessLevel(access);
      setGenerationCount(count);
      setMaxGenerations(max);
    } catch (err) {
      console.error("Lỗi kiểm tra quyền truy cập:", err);
      setAccessLevel("trial");
    } finally {
      setIsChecking(false);
    }
  }, [user]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  // Kiểm tra còn lượt generate không
  const canGenerate = accessLevel === "unlimited" || generationCount < maxGenerations;

  // Số lượt còn lại
  const remainingGenerations = Math.max(0, maxGenerations - generationCount);

  // Gọi API server để ghi nhận 1 lượt (chỉ cho trial)
  const recordGeneration = useCallback(async () => {
    if (accessLevel === "unlimited") return true;

    try {
      const res = await recordMealPlanGeneration();
      const { generationCount: newCount } = res.data.data;
      setGenerationCount(newCount);
      return true;
    } catch (err) {
      console.error("Lỗi ghi nhận lượt generate:", err);
      // Nếu server trả 403 = hết lượt
      if (err.response?.status === 403) {
        const data = err.response.data?.data;
        if (data) setGenerationCount(data.generationCount);
      }
      return false;
    }
  }, [accessLevel]);

  return {
    accessLevel,
    isChecking,
    canGenerate,
    remainingGenerations,
    generationCount,
    recordGeneration,
    maxGenerations,
  };
};
