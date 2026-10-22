import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { CardSection, ChoiceField, InputField, StepActions } from "./FormControls";
import { VARIANT_LABELS } from "./constants";
import { hasAnyTestValue, testsDefaults, testsSchema, testsToPayload } from "./formModel";

const variantOptions = (values) => values.map((value) => ({ value, label: VARIANT_LABELS[value] }));

const PUSH_ALL = ["standard", "knee", "incline", "wall"];
const PUSH_MODIFIED = ["knee", "incline", "wall"];
const PLANK_ALL = ["full", "incline"];
const PLANK_MODIFIED = ["incline"];

const TestsStep = ({ draft, modified, onSubmit, onBack, pending }) => {
  const [missingAll, setMissingAll] = useState(false);
  const { control, register, handleSubmit, formState } = useForm({
    resolver: zodResolver(testsSchema),
    defaultValues: testsDefaults(draft),
  });
  const { errors } = formState;
  const err = (name) => errors[name]?.message;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => {
        if (!hasAnyTestValue(values)) {
          setMissingAll(true);
          return;
        }
        setMissingAll(false);
        onSubmit(testsToPayload(values));
      })}
      className="space-y-5"
    >
      <div
        role="note"
        className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100"
      >
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          Khởi động 5-10 phút trước khi làm. Dừng ngay nếu đau tức ngực, chóng mặt hoặc khó thở bất thường.
          {modified && " Do phần sàng lọc có điểm cần thận trọng, bạn chỉ làm các biến thể giảm tải."}
          {" "}Bài nào chưa làm được, bạn có thể bỏ trống.
        </p>
      </div>

      <CardSection
        title="Push-Up"
        description="Đánh giá sức mạnh thân trên. Làm tối đa số lần liên tục với tư thế đúng, không nghỉ giữa chừng. So với bảng chuẩn: nam dùng hít đất chuẩn, nữ dùng hít đất quỳ."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField
            label="Cách hít đất bạn đã làm"
            name="pushVariant"
            control={control}
            options={variantOptions(modified ? PUSH_MODIFIED : PUSH_ALL)}
            error={err("pushVariant")}
          />
          <InputField label="Số lần" name="pushReps" type="number" inputMode="numeric" register={register} error={err("pushReps")} />
        </div>
      </CardSection>

      <CardSection
        title="30-Second Chair Stand"
        description="Đánh giá sức mạnh thân dưới. Ngồi ghế cao khoảng 43 cm, khoanh tay trước ngực, đứng lên ngồi xuống nhiều nhất có thể trong 30 giây. Bảng chuẩn đã công bố chỉ dành cho người từ 60 tuổi; dưới 60 tuổi kết quả được lưu làm mốc so sánh."
      >
        <InputField label="Số lần đứng lên" name="chairReps" type="number" inputMode="numeric" register={register} error={err("chairReps")} />
      </CardSection>

      <CardSection
        title="Plank"
        description="Đánh giá sức bền thân giữa. Chống khuỷu tay, giữ thân thẳng từ vai tới gót. Dừng khi hông võng hoặc không giữ được tư thế."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField
            label="Cách plank bạn đã làm"
            name="plankVariant"
            control={control}
            options={variantOptions(modified ? PLANK_MODIFIED : PLANK_ALL)}
            error={err("plankVariant")}
          />
          <InputField label="Thời gian giữ (giây)" name="plankSeconds" type="number" inputMode="numeric" register={register} error={err("plankSeconds")} />
        </div>
      </CardSection>

      <CardSection
        title="Rockport 1-Mile Walk"
        description="Đánh giá sức bền tim phổi. Đi bộ nhanh 1,6 km trên mặt phẳng, bấm giờ, và đo nhịp tim ngay khi về đích. Hệ thống dùng cân nặng, tuổi và giới tính ở bước trước để ước lượng sức bền."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField label="Thời gian đi bộ (phút)" name="walkMinutes" type="number" inputMode="decimal" register={register} error={err("walkMinutes")} hint="Ví dụ 15,5 phút." />
          <InputField label="Nhịp tim ngay sau khi xong (lần/phút)" name="walkEndHeartRate" type="number" inputMode="numeric" register={register} error={err("walkEndHeartRate")} />
        </div>
      </CardSection>

      {missingAll && (
        <p role="alert" className="text-sm text-red-300">
          Hãy nhập kết quả ít nhất một bài để hệ thống đánh giá.
        </p>
      )}
      <StepActions onBack={onBack} submitLabel="Xem kết quả" pending={pending} />
    </form>
  );
};

export default TestsStep;
