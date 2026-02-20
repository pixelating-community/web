import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { sql } from "@/lib/db";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import {
  getReflectionWriteCookieName,
  verifyReflectionAccessToken,
  verifyReflectionWriteToken,
} from "@/lib/reflectionAccess";
import { getRequestCookie } from "@/server/lib/requestCookies";

export const Route = createFileRoute("/api/p/$id/reflections")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const ip = getClientIp(request.headers);
        const rate = rateLimit(`reflections:${ip}:${params.id}`, 60, 60 * 1000);
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

        const elKey = request.headers.get("x-el-key");
        const isAdmin = elKey && elKey === process.env.EL_KEY;

        const readToken = getRequestCookie(request, `p_${data.id}`);
        if (!isAdmin && !verifyReflectionAccessToken(readToken, data.id)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const writeToken = getRequestCookie(
          request,
          getReflectionWriteCookieName(data.id),
        );
        const canWrite =
          isAdmin || !!verifyReflectionWriteToken(writeToken, data.id);

        const rows = await sql`
      SELECT id, perspective_id, reflection_id, text, updated_at, created_at
      FROM reflections
      WHERE perspective_id = ${data.id}
      ORDER BY created_at ASC;
    `;

        return Response.json(
          { reflections: rows, canWrite },
          {
            headers: { "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});
