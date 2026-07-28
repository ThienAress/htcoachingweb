import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../context/AuthContext";
import {
  checkMealPlanAccess,
  recordMealPlanGeneration,
} from "../services/mealplanAccess.service";
import { deriveMealPlanAccess } from "../utils/mealPlanAccess";

export const useMealPlanAccess = () => {
  const [accessLevel, setAccessLevel] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [accessError, setAccessError] = useState(false);
  const [generationCount, setGenerationCount] = useState(0);
  const [maxGenerations, setMaxGenerations] = useState(null);
  const { user } = useAuth();

  const checkAccess = useCallback(async () => {
    if (!user) {
      setAccessLevel(null);
      setGenerationCount(0);
      setMaxGenerations(null);
      setAccessError(false);
      setIsChecking(false);
      return;
    }

    try {
      setIsChecking(true);
      setAccessError(false);
      const response = await checkMealPlanAccess();
      const {
        access,
        generationCount: count,
        maxGenerations: max,
      } = response.data.data;
      setAccessLevel(access);
      setGenerationCount(count);
      setMaxGenerations(max);
    } catch {
      setAccessLevel(null);
      setGenerationCount(0);
      setMaxGenerations(null);
      setAccessError(true);
    } finally {
      setIsChecking(false);
    }
  }, [user]);

  useEffect(() => {
    void checkAccess();
  }, [checkAccess]);

  const { canGenerate, remainingGenerations } = deriveMealPlanAccess({
    accessLevel,
    generationCount,
    maxGenerations,
  });

  const recordGeneration = useCallback(async () => {
    if (accessLevel === "unlimited") return true;
    if (accessLevel !== "trial") return false;

    try {
      const response = await recordMealPlanGeneration();
      setGenerationCount(response.data.data.generationCount);
      return true;
    } catch (error) {
      if (error.response?.status === 403) {
        const data = error.response.data?.data;
        if (data) setGenerationCount(data.generationCount);
      }
      return false;
    }
  }, [accessLevel]);

  return {
    accessLevel,
    isChecking,
    accessError,
    retryAccess: checkAccess,
    canGenerate,
    remainingGenerations,
    generationCount,
    recordGeneration,
    maxGenerations,
  };
};
