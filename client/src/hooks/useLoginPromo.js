import { resolveLoginPromo } from "../utils/pricingContent";
import { useSiteSettings } from "./useSiteSettings";

// Ưu đãi lần đăng ký đầu có tài khoản. Đang tải hoặc chưa cấu hình thì dùng mặc định (bật, 15%).
export const useLoginPromo = () => {
  const { data } = useSiteSettings();
  return resolveLoginPromo(data?.data);
};
