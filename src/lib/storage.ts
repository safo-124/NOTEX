import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Hetzner Object Storage speaks S3, so does MinIO and everything else.
 * Vercel's filesystem is ephemeral, which is why uploads never touch disk.
 */
const endpoint = process.env.S3_ENDPOINT;
const bucket = process.env.S3_BUCKET ?? "notex";

export const storageConfigured = Boolean(
  endpoint && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY,
);

const client = storageConfigured
  ? new S3Client({
      endpoint,
      region: process.env.S3_REGION ?? "auto",
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
      },
    })
  : null;

export async function putObject(key: string, body: Buffer, contentType: string) {
  if (!client) throw new Error("Object storage is not configured");
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  );
  return key;
}

/** Short-lived link so files stay private in the bucket. */
export async function signedDownloadUrl(key: string, filename: string, seconds = 300) {
  if (!client) throw new Error("Object storage is not configured");
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `inline; filename="${filename.replace(/"/g, "")}"`,
    }),
    { expiresIn: seconds },
  );
}

export async function deleteObject(key: string) {
  if (!client) return;
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
