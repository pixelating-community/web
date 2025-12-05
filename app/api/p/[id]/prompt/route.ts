import { z } from "zod/v4";
import { sql } from "@/lib/db";
import { getQRCodeDataUrl } from "@/lib/qrcode";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ip = getClientIp(request.headers);
  const rate = rateLimit(`prompt:${ip}`, 30, 60 * 1000);
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

  const rows = await sql`
    SELECT id, perspective, topic_id, collection_id
    FROM perspectives
    WHERE id = ${data.id}
    LIMIT 1;
  `;

  if (rows.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const link = await getQRCodeDataUrl(`/p/${data.id}`);

  return Response.json({
    perspective: rows[0],
    link,
    generatedAt: new Date().toISOString(),
  });
}
