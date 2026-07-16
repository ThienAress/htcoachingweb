import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

export const useMacroSet = () => {
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
          toast.warning("Dữ liệu TDEE không hợp lệ, vui lòng tính lại", { toastId: "invalid-tdee" });
          navigate("/tdee-calculator");
        }
      } catch (error) {
        toast.warning("Dữ liệu TDEE bị lỗi, vui lòng tính lại", { toastId: "error-tdee" });
        navigate("/tdee-calculator");
      }
    } else {
      toast.warning("Vui lòng tính TDEE trước khi sử dụng tính năng này", { toastId: "missing-tdee" });
      navigate("/tdee-calculator");
    }
  }, [navigate]);

  return { macroSet, selectedMacroPlan, setSelectedMacroPlan };
};
