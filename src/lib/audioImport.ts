import { z } from "zod/v4";

export const AUDIO_IMPORT_MAX_FILE_SIZE_MB = 100;
export const AUDIO_IMPORT_MAX_FILE_SIZE_BYTES =
  AUDIO_IMPORT_MAX_FILE_SIZE_MB * 1024 * 1024;
export const AUDIO_IMPORT_MAX_FILE_SIZE_LABEL =
  `${AUDIO_IMPORT_MAX_FILE_SIZE_MB} MB`;

export type AudioImportStep =
  | "idle"
  | "preparing"
  | "classifying"
  | "converting"
  | "uploading"
  | "storing_video"
  | "saving"
  | "done"
  | "error";

export const audioImportSchema = z.object({
  actionToken: z.string().min(1),
  topicId: z.uuid(),
  perspectiveId: z.uuid(),
  r2Key: z.string().min(1).optional(),
});
