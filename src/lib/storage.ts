import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
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

/**
 * A presigned PUT, so the browser sends the file straight to object storage.
 *
 * Uploading through a Server Action would cap every file at Vercel's 4.5 MB
 * request body limit, which is well under a single lecture slide deck, and
 * would route the bytes through Washington on the way to Helsinki.
 */
export async function signedUploadUrl(key: string, contentType: string, seconds = 600) {
  if (!client) throw new Error("Object storage is not configured");
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), {
    expiresIn: seconds,
  });
}

/** Ask the bucket what actually landed, rather than trusting the browser. */
export async function statObject(key: string) {
  if (!client) throw new Error("Object storage is not configured");
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return {
    size: Number(head.ContentLength ?? 0),
    contentType: head.ContentType ?? "application/octet-stream",
  };
}

/**
 * Browsers refuse a cross-origin PUT unless the bucket says it is allowed, and
 * Hetzner's console has no CORS editor, so the app sets it itself.
 */
export async function allowBrowserUploads(origin: string) {
  if (!client) throw new Error("Object storage is not configured");
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [origin],
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
}
