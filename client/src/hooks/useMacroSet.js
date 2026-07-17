import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export const useMacroSet = () => {
  const { t } = useTranslation("tdee");
  const [macroSet, setMacroSet] = useState(null);
  const [selectedMacroPlan, setSelectedMacroPlan] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const data = localStorage.getItem("macroSet");
    if (data) {
      try {
        const parsedData = JSON.parse(data);
        if (parsedData && typeof parsedData === 'object' && Object.keys(parsedData).length > 0) {
          Object.keys(parsedData).forEach((plan) => {
            const { protein, carb, fat } = parsedData[plan];
            parsedData[plan].calories = protein * 4 + carb * 4 + fat * 9;
          });
          setMacroSet(parsedData);
          
          const keys = Object.keys(parsedData);
          if (keys.length > 0) {
            setSelectedMacroPlan(keys[0]);
          }
        } else {
          toast.warning(t("warnings.invalid_data"), { toastId: "invalid-tdee" });
          navigate("/tdee-calculator");
        }
      } catch (error) {
        toast.warning(t("warnings.error_data"), { toastId: "error-tdee" });
        navigate("/tdee-calculator");
      }
    } else {
      toast.warning(t("warnings.missing_tdee"), { toastId: "missing-tdee" });
      navigate("/tdee-calculator");
    }
  }, [navigate, t]);

  return { macroSet, selectedMacroPlan, setSelectedMacroPlan };
};
