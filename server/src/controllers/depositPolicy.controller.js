import { DEPOSIT_POLICY } from "../constants/depositPolicy.js";

export const getDepositPolicy = (_req, res) =>
  res.status(200).json({ success: true, data: DEPOSIT_POLICY });
