import { useQuery } from "@tanstack/react-query";
import { getSiteSettings } from "../services/siteSetting.service";

// Cùng khóa và dạng dữ liệu với trang chủ (["site-settings"]) nên dùng chung bộ nhớ đệm.
export const useSiteSettings = () =>
  useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const res = await getSiteSettings();
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
