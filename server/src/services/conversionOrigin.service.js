import mongoose from "mongoose";

import Booking from "../models/Booking.js";
import ContactMessage from "../models/ContactMessage.js";

const conversionOriginError = (status, code, message) =>
  Object.assign(new Error(message), { status, code });

const present = (value) => value !== undefined && value !== null && value !== "";

const existsWithSession = (Model, id, session) => {
  const query = Model.exists({ _id: id });
  return session ? query.session(session) : query;
};

export const resolveConversionOrigin = async ({
  originBookingId,
  originContactMessageId,
  isAdmin,
  session = null,
}) => {
  const hasBooking = present(originBookingId);
  const hasContact = present(originContactMessageId);
  if (!hasBooking && !hasContact) return {};
  if (!isAdmin) {
    throw conversionOriginError(
      403,
      "CONVERSION_ORIGIN_ADMIN_REQUIRED",
      "Chỉ admin mới có thể gắn nguồn chuyển đổi",
    );
  }
  if (hasBooking && hasContact) {
    throw conversionOriginError(
      400,
      "CONVERSION_ORIGIN_MUTUALLY_EXCLUSIVE",
      "Chỉ được chọn một nguồn Booking hoặc Contact",
    );
  }

  const rawId = hasBooking ? originBookingId : originContactMessageId;
  if (!mongoose.Types.ObjectId.isValid(rawId)) {
    throw conversionOriginError(
      400,
      "CONVERSION_ORIGIN_INVALID_ID",
      "ID nguồn chuyển đổi không hợp lệ",
    );
  }
  const id = new mongoose.Types.ObjectId(rawId);
  const Model = hasBooking ? Booking : ContactMessage;
  if (!(await existsWithSession(Model, id, session))) {
    throw conversionOriginError(
      404,
      "CONVERSION_ORIGIN_NOT_FOUND",
      "Không tìm thấy nguồn chuyển đổi",
    );
  }
  return hasBooking
    ? { originBookingId: id }
    : { originContactMessageId: id };
};

export const assertConversionOriginAvailable = async ({
  Model,
  conversionOrigin,
  session = null,
}) => {
  if (Object.keys(conversionOrigin).length === 0) return;
  const query = Model.exists(conversionOrigin);
  const existing = await (session ? query.session(session) : query);
  if (existing) {
    throw conversionOriginError(
      409,
      "CONVERSION_ORIGIN_ALREADY_LINKED",
      "Nguồn này đã được gắn với một chuyển đổi cùng loại",
    );
  }
};

export const normalizeConversionOriginPersistenceError = (error) => {
  const duplicateOrigin =
    error?.code === 11000 &&
    (error?.keyPattern?.originBookingId ||
      error?.keyPattern?.originContactMessageId ||
      error?.keyValue?.originBookingId ||
      error?.keyValue?.originContactMessageId);
  if (!duplicateOrigin) return error;
  return conversionOriginError(
    409,
    "CONVERSION_ORIGIN_ALREADY_LINKED",
    "Nguồn này đã được gắn với một chuyển đổi cùng loại",
  );
};
