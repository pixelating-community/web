import { issueActionToken } from "../src/lib/actionToken.server";
import { sql } from "../src/lib/db.server";
import { hashTopicToken } from "../src/lib/topicToken";
import {
  UPLOAD_ACTION_TOKEN_HEADER,
  UPLOAD_SCOPE_HEADER,
  UPLOAD_TOPIC_ID_HEADER,
} from "../src/lib/uploadPolicy";

const baseUrl = (process.env.CONTENT_SMOKE_BASE_URL ?? "http://127.0.0.1:3000")
  .trim()
  .replace(/\/+$/, "");
const suffix = crypto.randomUUID();
const topicName = `content-smoke-${suffix}`;
const initialText = `Content upload smoke ${suffix}`;
const editedText = `Content edit smoke ${suffix}`;
const topicToken = `content-smoke-token-${suffix}`;

const requireEnvironment = (key: string) => {
  const resolved = process.env[key]?.trim();
  if (!resolved) throw new Error(`${key} is required for the content smoke test.`);
  return resolved;
};

const r2Client = new Bun.S3Client({
  accessKeyId: requireEnvironment("R2_ACCESS_KEY_ID"),
  bucket: requireEnvironment("BUCKET_NAME"),
  endpoint: `https://${requireEnvironment("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  region: "auto",
  secretAccessKey: requireEnvironment("R2_SECRET_ACCESS_KEY"),
});

let topicId = "";
let perspectiveId = "";
let objectKey = "";
let flowPassed = false;
let flowError: unknown;
const cleanupFailures: string[] = [];

const expectOk = async (response: Response, stage: string) => {
  if (response.ok) return response;
  const body = await response.text().catch(() => "");
  throw new Error(`${stage} failed (${response.status}): ${body.slice(0, 300)}`);
};

try {
  const storedTopicToken = await hashTopicToken(topicToken);
  const topics = await sql<{ id: string }>`
    INSERT INTO topics (name, token, locked)
    VALUES (${topicName}, ${storedTopicToken}, false)
    RETURNING id;
  `;
  topicId = topics[0]?.id ?? "";
  if (!topicId) throw new Error("Smoke topic was not created.");

  const actionToken = issueActionToken({
    requestId: `content-smoke-${suffix}`,
    scopes: ["perspective:add", "perspective:edit"],
    topicId,
  });
  if (!actionToken) throw new Error("Smoke action token was not issued.");

  const image = Bun.file("public/192x192.png");
  const imageBytes = await image.arrayBuffer();
  const uploadForm = new FormData();
  uploadForm.set(
    "file",
    new File([imageBytes], "content-smoke.png", { type: "image/png" }),
  );
  uploadForm.set("contentTypeHint", "image/png");
  const uploadResponse = await expectOk(
    await fetch(`${baseUrl}/api/obj/upload`, {
      body: uploadForm,
      headers: {
        [UPLOAD_ACTION_TOKEN_HEADER]: actionToken,
        [UPLOAD_SCOPE_HEADER]: "perspective:add",
        [UPLOAD_TOPIC_ID_HEADER]: topicId,
      },
      method: "POST",
    }),
    "upload",
  );
  const upload = (await uploadResponse.json()) as {
    key?: string;
    publicUrl?: string;
  };
  objectKey = upload.key?.trim() ?? "";
  if (!objectKey || !upload.publicUrl) {
    throw new Error("Upload response did not include an object key and URL.");
  }

  await expectOk(
    await fetch(`${baseUrl}/api/p`, {
      body: JSON.stringify({
        hasImageSrc: true,
        imageSrc: upload.publicUrl,
        name: topicName,
        perspective: initialText,
        token: topicToken,
        topicId,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
    "create story",
  );

  const perspectives = await sql<{ id: string; image_src?: string | null }>`
    SELECT id, image_src
    FROM perspectives
    WHERE topic_id = ${topicId} AND perspective = ${initialText}
    LIMIT 1;
  `;
  perspectiveId = perspectives[0]?.id ?? "";
  if (!perspectiveId || !perspectives[0]?.image_src) {
    throw new Error("Created story did not retain its uploaded image.");
  }

  await expectOk(
    await fetch(`${baseUrl}/api/p/${perspectiveId}`, {
      body: JSON.stringify({
        name: topicName,
        perspective: editedText,
        token: topicToken,
      }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    }),
    "edit story",
  );

  const edited = await sql<{ perspective: string }>`
    SELECT perspective
    FROM perspectives
    WHERE id = ${perspectiveId}
    LIMIT 1;
  `;
  if (edited[0]?.perspective !== editedText) {
    throw new Error("Edited story text was not persisted.");
  }

  await expectOk(
    await fetch(`${baseUrl}/api/p/${perspectiveId}`, {
      body: JSON.stringify({ token: topicToken }),
      headers: { "Content-Type": "application/json" },
      method: "DELETE",
    }),
    "delete story",
  );
  perspectiveId = "";

  flowPassed = true;
} catch (error) {
  flowError = error;
} finally {
  if (perspectiveId) {
    await sql`DELETE FROM perspectives WHERE id = ${perspectiveId};`.catch(() => {
      cleanupFailures.push("perspective");
    });
  }
  if (topicId) {
    await sql`DELETE FROM topics WHERE id = ${topicId};`.catch(() => {
      cleanupFailures.push("topic");
    });
  }
  if (objectKey) {
    await r2Client.file(objectKey).delete().catch(() => {
      cleanupFailures.push("object");
    });
  }
  await sql.close?.().catch(() => {
    cleanupFailures.push("database connection");
  });
}

if (cleanupFailures.length > 0) {
  throw new Error(
    `Content smoke cleanup failed for: ${cleanupFailures.join(", ")}.`,
  );
}
if (flowError) throw flowError;
if (flowPassed) {
  console.log(
    "Content smoke passed: upload, create, edit, verify, delete, and cleanup.",
  );
}
