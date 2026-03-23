import api from "../utils/api";

export const getCurrentUser = async () => {
  const res = await api.get("/user/me");
  return res.data;
};
