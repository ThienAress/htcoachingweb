import { incrementMetric } from "../observability/metrics.js";

// Đánh dấu đường dẫn cũ còn giữ làm bí danh: báo cho client biết đường mới (header Deprecation + Link) và đếm số lượt gọi
// (api.deprecated_route_hits) để biết khi nào gỡ được. Không đổi kết quả của request.
export const deprecatedRoute = (successorPath) => (_req, res, next) => {
  incrementMetric("api.deprecated_route_hits");
  res.setHeader("Deprecation", "true");
  res.setHeader("Link", `<${successorPath}>; rel="successor-version"`);
  next();
};
