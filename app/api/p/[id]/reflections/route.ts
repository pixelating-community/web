import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { sql } from "@/lib/db";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { verifyReflectionAccessToken } from "@/lib/reflectionAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ip = getClientIp(request.headers);
  const rate = rateLimit(`reflections:${ip}:${id}`, 60, 60 * 1000);
  if (!rate.ok) {
    return Response.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  }
  const schema = z.object({ id: z.uuid() });
  let data: { id: string };
  try {
    data = schema.parse({ id });
  } catch {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const token = request.cookies.get(`p_${data.id}`)?.value;
  if (!verifyReflectionAccessToken(token, data.id)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await sql`
    SELECT id, perspective_id, reflection_id, text, updated_at, created_at
    FROM reflections
    WHERE perspective_id = ${data.id}
    ORDER BY created_at ASC;
  `;

  return Response.json(rows, {
    headers: { "Cache-Control": "no-store" },
  });
}
