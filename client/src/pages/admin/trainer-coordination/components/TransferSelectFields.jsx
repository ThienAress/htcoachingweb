import PaginatedSelectField from "./PaginatedSelectField";

const assignmentKey = (assignment) =>
  `${assignment.client?._id || ""}|${assignment.trainer?._id || ""}`;

export const AssignmentSelectField = (props) => (
  <PaginatedSelectField
    {...props}
    label="Khách hàng và HLV hiện tại"
    searchPlaceholder="Tìm khách hoặc HLV"
    searchAriaLabel="Tìm assignment"
    emptyLabel="Chọn assignment đang hoạt động"
    getOptionKey={assignmentKey}
    getOptionValue={assignmentKey}
    getOptionLabel={(item) =>
      `${item.client?.name} — ${item.trainer?.name}`
    }
    pageLabel="assignment"
  />
);

export const TrainerSelectField = (props) => (
  <PaginatedSelectField
    {...props}
    label="HLV mới"
    searchPlaceholder="Tìm tên hoặc email HLV"
    searchAriaLabel="Tìm HLV nhận khách"
    emptyLabel="Chọn HLV nhận khách"
    getOptionKey={(trainer) => trainer._id}
    getOptionValue={(trainer) => trainer._id}
    getOptionLabel={(trainer) => `${trainer.name} — ${trainer.email}`}
    pageLabel="HLV"
  />
);
