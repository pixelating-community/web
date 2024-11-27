import { S3 } from "@aws-sdk/client-s3";

export const s3Client = new S3({
  forcePathStyle: false,
  endpoint: process.env.BUCKET_URL,
  region: process.env.BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.SPACES_KEY,
    secretAccessKey: process.env.SPACES_SECRET,
  },
});
