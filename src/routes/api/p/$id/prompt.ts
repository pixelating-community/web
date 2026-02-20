import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { compilePerspective } from "@/lib/compilePerspective";
import { sql } from "@/lib/db";
import { getQRCodeDataUrl } from "@/lib/qrcode";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";

export const Route = createFileRoute("/api/p/$id/prompt")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
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
          data = schema.parse({ id: params.id });
        } catch {
          return Response.json({ error: "Invalid id" }, { status: 400 });
        }

        const rows = await sql`
      SELECT id, perspective, topic_id, collection_id, rendered_html, audio_src, start_time, end_time
      FROM perspectives
      WHERE id = ${data.id}
      LIMIT 1;
    `;

        if (rows.length === 0) {
          return Response.json({ error: "Not found" }, { status: 404 });
        }

        const link = await getQRCodeDataUrl(`/p/${data.id}`);
        const row = rows[0];
        const renderedHtml = compilePerspective(
          String(row.perspective ?? ""),
        ).renderedHtml;

        return Response.json({
          perspective: {
            ...row,
            rendered_html: renderedHtml,
          },
          link,
          generatedAt: new Date().toISOString(),
        });
      },
    },
  },
});
