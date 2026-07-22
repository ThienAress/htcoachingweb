import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const loadStoredMacroSet = () => {
  const data = localStorage.getItem("macroSet");
  if (!data) return { data: null, warning: "warnings.missing_tdee" };

  try {
    const parsedData = JSON.parse(data);
    if (!parsedData || typeof parsedData !== "object" || Object.keys(parsedData).length === 0) {
      return { data: null, warning: "warnings.invalid_data" };
    }

    Object.keys(parsedData).forEach((plan) => {
      const { protein, carb, fat } = parsedData[plan];
      parsedData[plan].calories = protein * 4 + carb * 4 + fat * 9;
    });
    return { data: parsedData, warning: null };
  } catch {
    return { data: null, warning: "warnings.error_data" };
  }
};

export const useMacroSet = () => {
  const { t } = useTranslation("tdee");
  const [storedMacroSet] = useState(loadStoredMacroSet);
  const [selectedMacroPlan, setSelectedMacroPlan] = useState(
    () => Object.keys(storedMacroSet.data || {})[0] || null,
  );
  const navigate = useNavigate();

  useEffect(() => {
    if (!storedMacroSet.warning) return;
    toast.warning(t(storedMacroSet.warning), { toastId: storedMacroSet.warning });
    navigate("/tdee-calculator");
  }, [navigate, storedMacroSet, t]);

  return {
    macroSet: storedMacroSet.data,
    selectedMacroPlan,
    setSelectedMacroPlan,
  };
};
