import BodyAssessment from "../models/BodyAssessment.js";
import BodyAssessmentCommand from "../models/BodyAssessmentCommand.js";
import BodyAssessmentRevision from "../models/BodyAssessmentRevision.js";
import { isMongoIndexContractEquivalent } from "../utils/mongoIndexContract.js";
import { assessmentError } from "./bodyAssessmentValidation.service.js";

const MODELS = [BodyAssessment, BodyAssessmentCommand, BodyAssessmentRevision];

const requiredUniqueIndexes = () =>
  MODELS.flatMap((model) =>
    model.schema
      .indexes()
      .filter(([, options]) => options.unique)
      .map(([keys, options]) => ({
        collection: model.collection,
        keys,
        name: options.name,
        options,
      })),
  );

const isMissingNamespace = (error) =>
  error?.code === 26 || error?.codeName === "NamespaceNotFound";

const listIndexes = async (collection) => {
  try {
    return await collection.listIndexes().toArray();
  } catch (error) {
    if (isMissingNamespace(error)) return [];
    throw error;
  }
};

export const inspectBodyAssessmentWriteIndexes = async () => {
  const reports = [];
  for (const contract of requiredUniqueIndexes()) {
    const indexes = await listIndexes(contract.collection);
    const index = indexes.find((candidate) =>
      isMongoIndexContractEquivalent(candidate, contract),
    );
    reports.push({
      name: contract.name,
      ready: Boolean(index),
    });
  }
  if (reports.length !== 3) {
    throw new Error("Body assessment unique index manifest is incomplete");
  }
  return reports;
};

export const assertBodyAssessmentWriteIndexes = async () => {
  const reports = await inspectBodyAssessmentWriteIndexes();
  if (reports.some(({ ready }) => !ready)) {
    throw assessmentError(
      503,
      "Tính năng lưu kết quả đo đang được chuẩn bị",
      "BODY_ASSESSMENT_INDEXES_NOT_READY",
    );
  }
};
