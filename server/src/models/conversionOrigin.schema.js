import mongoose from "mongoose";

export const createConversionOriginFields = () => ({
  originBookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    default: null,
    select: false,
  },
  originContactMessageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ContactMessage",
    default: null,
    select: false,
  },
});

export const applyConversionOriginContract = (schema, indexPrefix) => {
  schema.pre("validate", function validateConversionOrigin() {
    if (this.originBookingId && this.originContactMessageId) {
      this.invalidate(
        "conversionOrigin",
        "Chỉ được chọn một nguồn Booking hoặc Contact",
      );
    }
  });

  for (const field of ["originBookingId", "originContactMessageId"]) {
    schema.index(
      { [field]: 1 },
      {
        unique: true,
        partialFilterExpression: { [field]: { $type: "objectId" } },
        name: `${indexPrefix}_${field}`,
      },
    );
  }
};
