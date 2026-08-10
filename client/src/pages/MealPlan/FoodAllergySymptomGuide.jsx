import { CircleAlert, HeartPulse } from "lucide-react";

const SYMPTOMS = [
  "Nổi mề đay, mẩn đỏ hoặc ngứa",
  "Ngứa hoặc ran trong miệng",
  "Sưng môi, mặt hoặc lưỡi",
  "Đau bụng hoặc co thắt bụng",
  "Buồn nôn hoặc nôn",
  "Tiêu chảy",
  "Ho hoặc thở khò khè",
  "Nghẹn họng, khàn tiếng hoặc sưng họng",
  "Chóng mặt hoặc choáng váng",
  "Khó thở hoặc ngất",
];

const sourceClass =
  "rounded text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function FoodAllergySymptomGuide() {
  return (
    <section
      className="mt-5 border-t border-white/10 pt-5"
      aria-labelledby="food-allergy-symptoms-title"
    >
      <div className="flex items-start gap-3">
        <HeartPulse
          className="mt-0.5 size-5 shrink-0 text-rose-300"
          aria-hidden="true"
        />
        <div>
          <h3
            id="food-allergy-symptoms-title"
            className="text-base font-bold text-white"
          >
            Dấu hiệu thường gặp sau khi ăn
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-300">
            Phản ứng nghi ngờ có thể xuất hiện trong vài phút đến vài giờ. Các
            dấu hiệu dưới đây giúp bạn nhớ lại phản ứng, nhưng không đủ để tự
            chẩn đoán thực phẩm gây dị ứng.
          </p>
        </div>
      </div>

      <ul className="mt-3 grid gap-x-6 gap-y-2 text-sm leading-6 text-gray-200 sm:grid-cols-2">
        {SYMPTOMS.map((symptom) => (
          <li key={symptom} className="flex items-start gap-2">
            <span
              className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
              aria-hidden="true"
            />
            <span>{symptom}</span>
          </li>
        ))}
      </ul>

      <div
        className="mt-4 flex items-start gap-3 rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm leading-6 text-red-100"
        role="alert"
      >
        <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p>
          Nếu khó thở, nghẹn hoặc sưng họng, choáng váng hay ngất sau khi ăn:
          ngừng ăn và gọi cấp cứu 115 hoặc đến cơ sở y tế ngay.
        </p>
      </div>

      <p className="mt-3 text-xs leading-5 text-gray-400">
        Tham khảo: {" "}
        <a
          href="https://www.fda.gov/food/buy-store-serve-safe-food/food-allergies-what-you-need-know"
          target="_blank"
          rel="noreferrer"
          className={sourceClass}
        >
          FDA — triệu chứng dị ứng thực phẩm
        </a>
        {" · "}
        <a
          href="https://bachmai.gov.vn/bai-viet/dac-san-mua-he-dung-de-cuoc-vui-%E2%80%9Cdut-ganh%E2%80%9D-vi-di-ung-thuc-pham?id=fece6ef8-d50c-4264-b1e5-33c37ded360b"
          target="_blank"
          rel="noreferrer"
          className={sourceClass}
        >
          Bệnh viện Bạch Mai
        </a>
        {" · "}
        <a
          href="https://vncdc.gov.vn/cach-du-phong-va-xu-tri-khi-bi-di-ung-thuc-an-nd14930.html"
          target="_blank"
          rel="noreferrer"
          className={sourceClass}
        >
          Cục Phòng bệnh Việt Nam
        </a>
        {" · "}
        <a
          href="https://moh.gov.vn/hoat-dong-cua-dia-phuong/-/asset_publisher/gHbla8vOQDuS/content/cap-cuu-ngoai-vien-co-the-cuu-song-ca-mang-nguoi"
          target="_blank"
          rel="noreferrer"
          className={sourceClass}
        >
          Bộ Y tế — cấp cứu 115
        </a>
        .
      </p>
    </section>
  );
}
