import { useEffect, useState } from "react";
import api from "../utils/api";
import { enrichFoodDatabase } from "../utils/foodCategory";

export const useFoodDatabase = () => {
  const [foodDatabase, setFoodDatabase] = useState([]);
  const [isLoadingFoods, setIsLoadingFoods] = useState(false);

  useEffect(() => {
    const fetchFoods = async () => {
      setIsLoadingFoods(true);
      try {
        const response = await api.get("/foods?all=true");

        if (response.data?.success && Array.isArray(response.data.data)) {
          const enrichedFoods = enrichFoodDatabase(response.data.data);
          setFoodDatabase(enrichedFoods);
        } else {
          setFoodDatabase([]);
        }
      } catch {
        setFoodDatabase([]);
      } finally {
        setIsLoadingFoods(false);
      }
    };
    fetchFoods();
  }, []);

  return { foodDatabase, isLoadingFoods };
};
