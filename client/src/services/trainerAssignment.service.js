import api from "../utils/api";

export const getTrainerAssignmentCandidates = ({
  page = 1,
  limit = 100,
  search = "",
} = {}) =>
  api.get("/user/trainer-assignment-candidates", {
    params: { page, limit, search },
  });
