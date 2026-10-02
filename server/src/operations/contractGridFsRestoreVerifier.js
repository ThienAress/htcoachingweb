import crypto from "node:crypto";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/iu;
const PDF_SIGNATURE = Buffer.from("%PDF-", "ascii");

const idString = (value) => String(value || "").toLowerCase();
const isObjectId = (value) => OBJECT_ID_PATTERN.test(idString(value));
const asBuffer = (value) => {
  if (Buffer.isBuffer(value)) return value;
  if (value?.buffer && Buffer.isBuffer(value.buffer)) return value.buffer;
  if (value?.buffer instanceof ArrayBuffer) return Buffer.from(value.buffer);
  if (value instanceof Uint8Array) return Buffer.from(value);
  return null;
};

const summarizeFindings = (codes) =>
  [...codes.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, count]) => ({ code, count }));

export const verifyContractGridFsSnapshot = ({
  contracts = [],
  files = [],
  chunks = [],
} = {}) => {
  const findingCounts = new Map();
  const addFinding = (code) =>
    findingCounts.set(code, (findingCounts.get(code) || 0) + 1);
  const fileById = new Map(files.map((file) => [idString(file?._id), file]));
  const chunksByFile = new Map();
  let checkedBytes = 0;

  for (const chunk of chunks) {
    const fileId = idString(chunk?.files_id);
    if (!fileById.has(fileId)) addFinding("GRIDFS_ORPHAN_CHUNK");
    const grouped = chunksByFile.get(fileId) || [];
    grouped.push(chunk);
    chunksByFile.set(fileId, grouped);
  }

  const referencedFiles = new Set();
  for (const contract of contracts) {
    const fileId = idString(contract?.signedPdfFileId);
    if (!isObjectId(contract?.signedPdfFileId)) {
      addFinding("CONTRACT_SIGNED_PDF_ID_INVALID");
      continue;
    }
    if (referencedFiles.has(fileId)) {
      addFinding("GRIDFS_FILE_REFERENCE_REUSED");
    }
    referencedFiles.add(fileId);

    const file = fileById.get(fileId);
    if (!file) {
      addFinding("GRIDFS_FILE_MISSING");
      continue;
    }

    const contentType = String(file.metadata?.contentType || "").toLowerCase();
    const contentTypeMissing = !contentType;
    if (contentType && contentType !== "application/pdf") {
      addFinding("GRIDFS_PDF_CONTENT_TYPE_INVALID");
    }
    const length = Number(file.length);
    const chunkSize = Number(file.chunkSize);
    if (!Number.isSafeInteger(length) || length <= 0) {
      addFinding("GRIDFS_FILE_LENGTH_INVALID");
      continue;
    }
    if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
      addFinding("GRIDFS_CHUNK_SIZE_INVALID");
      continue;
    }
    if (!/^[a-f0-9]{64}$/iu.test(String(contract.fileHash || ""))) {
      addFinding("CONTRACT_SIGNED_PDF_HASH_INVALID");
      continue;
    }

    const fileChunks = [...(chunksByFile.get(fileId) || [])].sort(
      (left, right) => Number(left.n) - Number(right.n),
    );
    const expectedChunkCount = Math.ceil(length / chunkSize);
    if (fileChunks.length !== expectedChunkCount) {
      addFinding("GRIDFS_CHUNK_COUNT_MISMATCH");
      continue;
    }

    const hash = crypto.createHash("sha256");
    let firstBytes = Buffer.alloc(0);
    let totalBytes = 0;
    let chunksValid = true;
    for (const [index, chunk] of fileChunks.entries()) {
      const data = asBuffer(chunk.data);
      if (Number(chunk.n) !== index || !data) {
        addFinding("GRIDFS_CHUNK_SEQUENCE_INVALID");
        chunksValid = false;
        break;
      }
      const expectedBytes =
        index === expectedChunkCount - 1
          ? length - chunkSize * index
          : chunkSize;
      if (data.length !== expectedBytes) {
        addFinding("GRIDFS_CHUNK_LENGTH_MISMATCH");
        chunksValid = false;
        break;
      }
      if (firstBytes.length < PDF_SIGNATURE.length) {
        firstBytes = Buffer.concat([firstBytes, data]).subarray(
          0,
          PDF_SIGNATURE.length,
        );
      }
      hash.update(data);
      totalBytes += data.length;
    }
    if (!chunksValid) continue;
    checkedBytes += totalBytes;
    if (totalBytes !== length) addFinding("GRIDFS_FILE_LENGTH_MISMATCH");
    if (!firstBytes.equals(PDF_SIGNATURE)) {
      addFinding("GRIDFS_PDF_SIGNATURE_INVALID");
    }
    if (contentTypeMissing && firstBytes.equals(PDF_SIGNATURE)) {
      addFinding("GRIDFS_PDF_CONTENT_TYPE_LEGACY_MISSING");
    }
    if (hash.digest("hex") !== String(contract.fileHash).toLowerCase()) {
      addFinding("GRIDFS_PDF_HASH_MISMATCH");
    }
  }

  for (const file of files) {
    if (!referencedFiles.has(idString(file?._id))) {
      addFinding("GRIDFS_ORPHAN_FILE");
    }
  }

  const findings = summarizeFindings(findingCounts);
  return {
    success: findings.length === 0,
    signedContracts: contracts.length,
    referencedFiles: referencedFiles.size,
    files: files.length,
    chunks: chunks.length,
    checkedBytes,
    findings,
  };
};

export const verifyContractGridFsRestore = async (db) => {
  if (!db?.collection) throw new Error("MongoDB database handle is required");
  const [contracts, files, chunks] = await Promise.all([
    db
      .collection("contracts")
      .find({ status: "signed" })
      .project({ signedPdfFileId: 1, fileHash: 1 })
      .toArray(),
    db
      .collection("contracts.files")
      .find({})
      .project({ _id: 1, length: 1, chunkSize: 1, contentType: 1, metadata: 1 })
      .toArray(),
    db
      .collection("contracts.chunks")
      .find({})
      .project({ files_id: 1, n: 1, data: 1 })
      .toArray(),
  ]);
  return verifyContractGridFsSnapshot({ contracts, files, chunks });
};
