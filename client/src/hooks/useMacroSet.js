import { useEffect, useState } from "react";
import { toast } from "react-toastify";

export const useMacroSet = () => {
  const [macroSet, setMacroSet] = useState(null);
  const [selectedMacroPlan, setSelectedMacroPlan] = useState(null);

  useEffect(() => {
    const data = localStorage.getItem("macroSet");
    if (data) {
      const parsedData = JSON.parse(data);
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
      toast.warning("Vui lòng tính TDEE trước khi sử dụng tính năng này");
    }
  }, []);

  return { macroSet, selectedMacroPlan, setSelectedMacroPlan };
};
