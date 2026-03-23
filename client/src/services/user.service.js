import axios from "axios";

export const getCurrentUser = async () => {
  const token = localStorage.getItem("token");

  const res = await axios.get("http://localhost:5000/api/user/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
};
