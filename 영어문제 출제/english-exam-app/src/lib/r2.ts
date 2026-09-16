import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 (S3 호환). 자격증명은 env로 주입.
let client: S3Client | null = null;

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
  );
}

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

// 업로드용 presigned PUT URL (교사가 브라우저에서 R2로 직접 업로드)
export async function presignPut(
  key: string,
  contentType: string,
  expiresSec = 600
): Promise<string> {
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: expiresSec }
  );
}

// 재생용 presigned GET URL (만료). 학생 시청 시마다 발급.
export async function presignGet(key: string, expiresSec = 3600): Promise<string> {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }),
    { expiresIn: expiresSec }
  );
}
