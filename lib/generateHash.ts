import crypto from "node:crypto";

export const generateHash = (input: string): string => {
  return crypto.createHash("sha256").update(input).digest("hex");
};
