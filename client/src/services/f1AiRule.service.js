import api from "../utils/api";

export const getF1AiRules = () => {
  return api.get("/f1-ai-rules");
};

export const getF1AiRuleById = (id) => {
  return api.get(`/f1-ai-rules/${id}`);
};

export const createF1AiRule = (data) => {
  return api.post("/f1-ai-rules", data);
};

export const updateF1AiRule = (id, data) => {
  return api.put(`/f1-ai-rules/${id}`, data);
};

export const deleteF1AiRule = (id) => {
  return api.delete(`/f1-ai-rules/${id}`);
};
