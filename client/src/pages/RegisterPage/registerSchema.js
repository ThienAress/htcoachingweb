import { z } from "zod";
import { containsProhibitedContent } from "./prohibitedContent";

export const registerSchema = z.object({
  name: z.string().min(8, "Họ và tên phải có ít nhất 8 ký tự"),
  phone: z.string().regex(/^[0-9]{10}$/, "Số điện thoại phải đúng 10 chữ số"),
  email: z
    .string()
    .regex(
      /^[a-zA-Z0-9._%+-]+@gmail\.com$/,
      "Email phải đúng định dạng @gmail.com",
    ),
  note: z
    .string()
    .optional()
    .refine(
      (val) => !val || val.trim().length === 0 || val.trim().length >= 8,
      "Nếu nhập thông tin bổ sung, vui lòng nhập ít nhất 8 ký tự",
    )
    .refine(
      (val) =>
        !val || val.trim().length === 0 || !containsProhibitedContent(val),
      "Thông tin chứa từ ngữ hoặc nội dung không phù hợp!",
    ),
  location: z.string().min(1, "Vui lòng chọn phòng tập"),
  schedules: z
    .array(
      z.object({
        day: z.string().min(1, "Chọn ngày"),
        time: z.string().min(1, "Chọn giờ"),
      }),
    )
    .min(1, "Vui lòng thêm ít nhất 1 thời gian tập luyện"),
});
