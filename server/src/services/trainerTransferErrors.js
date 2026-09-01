export class TrainerTransferError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "TrainerTransferError";
    this.status = status;
    this.code = code;
  }
}

export const transferError = (status, code, message) =>
  new TrainerTransferError(status, code, message);
