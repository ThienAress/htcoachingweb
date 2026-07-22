import mongoose from "mongoose";
import { describe, expect, it } from "vitest";

import {
  getReferenceId,
  referencesSameDocument,
} from "../mongooseReference.js";

describe("mongooseReference", () => {
  it("compares raw ObjectIds and populated documents consistently", () => {
    const id = new mongoose.Types.ObjectId();

    expect(getReferenceId({ _id: id })).toBe(id);
    expect(referencesSameDocument(id, id.toString())).toBe(true);
    expect(referencesSameDocument({ _id: id }, id)).toBe(true);
  });

  it("rejects missing and unrelated references", () => {
    expect(referencesSameDocument(null, new mongoose.Types.ObjectId())).toBe(false);
    expect(
      referencesSameDocument(
        { _id: new mongoose.Types.ObjectId() },
        new mongoose.Types.ObjectId(),
      ),
    ).toBe(false);
  });
});
