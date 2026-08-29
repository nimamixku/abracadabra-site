// Generalized R2 client for the platform -- same S3-compatible setup
// proven in scripts/upload-tiffs.mjs, but reusable from request handlers
// instead of a one-off migration script, and keyed per-tenant so one
// artist's files live under a prefix the others can never collide with
// or guess their way into.
//
// Needs the same five env vars scripts/upload-tiffs.mjs documents:
// R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME,
// R2_PUBLIC_URL.

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";

let client;
let bucketName;

function getClient() {
  if (!client) {
    const {
      R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY,
      R2_BUCKET_NAME,
    } = process.env;

    for (const [name, val] of Object.entries({
      R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY,
      R2_BUCKET_NAME,
    })) {
      if (!val) throw new Error(`${name} is not set -- see .env.local.example.`);
    }

    bucketName = R2_BUCKET_NAME;
    client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return { client, bucketName };
}

// Every uploaded file lives under tenants/<tenantId>/... -- this is the
// entire isolation guarantee between artists' raw files at the storage
// layer (the DB-level tenant_id checks on products/orders are the other,
// primary guarantee -- see migrations/001_init.sql).
export function buildKey(tenantId, kind, originalName) {
  const ext = (originalName.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const unique = crypto.randomBytes(16).toString("hex");
  return `tenants/${tenantId}/${kind}/${unique}.${ext}`;
}

// A short-lived URL the browser can PUT directly to, so large files
// (multi-hundred-MB TIFFs) never pass through a Vercel function body.
export async function createUploadUrl({ key, contentType, expiresInSeconds = 300 }) {
  const { client, bucketName } = getClient();
  const command = new PutObjectCommand({ Bucket: bucketName, Key: key, ContentType: contentType });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

// Used by the download routes to proxy a file with our own
// Content-Disposition header (see app/api/download/route.js) -- fetching
// through a signed GET URL rather than assuming R2_PUBLIC_URL is directly
// reachable, since gated "full" files should never be public.
export async function getObjectStream({ key }) {
  const { client, bucketName } = getClient();
  const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
  return client.send(command);
}

// Direct (non-presigned) upload, for server-side scripts that already
// have the file in hand -- e.g. scripts/migrate-legacy-products.mjs
// uploading the existing public/previews/*.jpg files on the founder's
// behalf. Browser uploads from the dashboard should keep using
// createUploadUrl above instead, so large files never pass through a
// function body.
export async function putObject({ key, body, contentType }) {
  const { client, bucketName } = getClient();
  const command = new PutObjectCommand({ Bucket: bucketName, Key: key, Body: body, ContentType: contentType });
  await client.send(command);
}
