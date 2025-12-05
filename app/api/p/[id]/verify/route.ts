import { cookies } from "next/headers";
import { z } from "zod/v4";
import { sql } from "@/lib/db";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import {
  createReflectionAccessToken,
  createReflectionWriteToken,
  getReflectionWriteCookieName,
} from "@/lib/reflectionAccess";

export const runtime = "nodejs";

const MAX_AGE_SECONDS = 36 * 60 * 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ip = getClientIp(request.headers);
  const rate = rateLimit(`verify:${ip}:${id}`, 10, 10 * 60 * 1000);
  if (!rate.ok) {
    return Response.json(
      { error: "Too many attempts" },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  }
  const schema = z.object({
    id: z.uuid(),
    chargeId: z.string().regex(/^ch_[a-zA-Z0-9]+$/),
  });

  let payload: { chargeId: string };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let data: { id: string; chargeId: string };
  try {
    data = schema.parse({ id, chargeId: payload.chargeId });
  } catch {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const rows = await sql`
    SELECT status
    FROM collected c
    JOIN perspectives p ON p.collection_id = c.collection_id
    WHERE c.stripe_charge_id = ${data.chargeId}
      AND p.id = ${data.id}
    LIMIT 1;
  `;

  if (rows.length === 0 || rows[0].status !== "succeeded") {
    return Response.json({ verified: false }, { status: 401 });
  }

  const token = createReflectionAccessToken(data.id);
  const writeToken = createReflectionWriteToken(data.id, data.chargeId);
  if (!token || !writeToken) {
    return Response.json({ error: "Missing access secret" }, { status: 500 });
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: `p_${data.id}`,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
  cookieStore.set({
    name: getReflectionWriteCookieName(data.id),
    value: writeToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });

  return Response.json({ verified: true });
}
