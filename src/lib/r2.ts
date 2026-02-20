import { randomUUID } from "node:crypto";
import path from "node:path";
import { getServerEnv } from "@/lib/env";
import { buildServerAudioUrl } from "@/lib/publicAudioBase";

type BunS3FileLike = {
  presign: (options?: {
    expiresIn?: number;
    method?: "GET" | "HEAD" | "PUT" | "POST" | "DELETE";
    type?: string;
  }) => string;
  write: (
    data: Buffer | Uint8Array | ArrayBuffer,
    options?: { type?: string },
  ) => Promise<unknown>;
};

type BunS3ClientLike = {
  file: (key: string) => BunS3FileLike;
};

type BunRuntimeLike = {
  S3Client?: new (options: {
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    endpoint: string;
    region?: string;
  }) => BunS3ClientLike;
};

const getRequiredEnv = (...keys: string[]) => {
  const value = getServerEnv(...keys);
  if (!value) {
    throw new Error(`Missing ${keys[0]}`);
  }
  return value;
};

const getR2Bucket = () =>
  getRequiredEnv("BUCKET_NAME", "NEXT_PUBLIC_WAV_BUCKET_NAME");

let cachedR2Client: BunS3ClientLike | null = null;

const getBunS3Client = () => {
  const bunRuntime = (globalThis as { Bun?: BunRuntimeLike }).Bun;
  const S3Client = bunRuntime?.S3Client;
  if (!S3Client) {
    throw new Error("Bun runtime with Bun.S3Client is required.");
  }
  return S3Client;
};

const getR2Client = () => {
  if (cachedR2Client) {
    return cachedR2Client;
  }

  const accountId = getRequiredEnv("R2_ACCOUNT_ID");
  const accessKeyId = getRequiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = getRequiredEnv("R2_SECRET_ACCESS_KEY");
  const bucket = getR2Bucket();
  const S3Client = getBunS3Client();

  cachedR2Client = new S3Client({
    bucket,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: "auto",
    accessKeyId,
    secretAccessKey,
  });

  return cachedR2Client;
};

const toUploadContentType = (value?: string) =>
  value && value.trim().length > 0 ? value.trim() : "application/octet-stream";

export const putR2Object = async ({
  key,
  contentType,
  body,
}: {
  key: string;
  contentType: string;
  body: Buffer;
}) => {
  const client = getR2Client();
  const object = client.file(key);
  await object.write(body, {
    type: toUploadContentType(contentType),
  });
};

export const buildR2Key = (filename: string) => {
  const extension = path.extname(filename || "").toLowerCase();
  const safeExtension = extension.length <= 8 ? extension : "";
  return `${randomUUID()}${safeExtension}`;
};

export const getR2PublicUrl = (key: string) => {
  return buildServerAudioUrl(key);
};

export const createR2UploadUrl = async ({
  key,
  contentType,
}: {
  key: string;
  contentType: string;
}) => {
  const client = getR2Client();
  const object = client.file(key);
  return object.presign({
    method: "PUT",
    expiresIn: 60 * 10,
    type: toUploadContentType(contentType),
  });
};
