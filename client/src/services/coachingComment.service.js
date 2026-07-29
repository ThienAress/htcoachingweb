import api from "../utils/api";

export const listCoachingComments = (targetType, targetId, params) =>
  api.get(
    "/coaching-comments/" +
      encodeURIComponent(targetType) +
      "/" +
      encodeURIComponent(targetId),
    { params },
  );

export const createCoachingComment = (payload) =>
  api.post("/coaching-comments", payload);

export const editCoachingComment = (commentId, payload) =>
  api.patch(
    "/coaching-comments/" + encodeURIComponent(commentId),
    payload,
  );

export const removeCoachingComment = (commentId, payload) =>
  api.delete(
    "/coaching-comments/" + encodeURIComponent(commentId),
    { data: payload },
  );
