import {
  buildR2Key,
  createR2UploadUrl,
  getR2PublicUrl,
  putR2Object,
} from "@/lib/r2";

export const buildObjectKey = buildR2Key;
export const putObject = putR2Object;
export const createObjectUploadUrl = createR2UploadUrl;
export const getObjectPublicUrl = getR2PublicUrl;
