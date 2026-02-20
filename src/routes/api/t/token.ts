import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { getRequestId, requestIdHeaders } from "@/lib/requestId";
import {
  saveTopicTokenServer,
  topicTokenLoginSchema,
} from "@/lib/topicTokenLogin.server";

export const Route = createFileRoute("/api/t/token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId = getRequestId(request);
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          console.warn("[topic-auth] Invalid JSON on /api/t/token", { requestId });
          return Response.json(
            { ok: false, error: "Invalid JSON" },
            { status: 400, headers: requestIdHeaders(requestId) },
          );
        }

        let data: z.infer<typeof topicTokenLoginSchema>;
        try {
          data = topicTokenLoginSchema.parse(payload);
        } catch {
          console.warn("[topic-auth] Invalid input payload on /api/t/token", {
            requestId,
          });
          return Response.json(
            { ok: false, error: "Invalid input" },
            { status: 400, headers: requestIdHeaders(requestId) },
          );
        }

        const result = await saveTopicTokenServer({
          request,
          data,
        });

        if (!result.ok) {
          return Response.json(
            { ok: false, error: result.error },
            { status: result.status, headers: requestIdHeaders(requestId) },
          );
        }

        const headers = new Headers();
        for (const cookieHeader of result.setCookieHeaders) {
          headers.append("Set-Cookie", cookieHeader);
        }

        return Response.json(
          { ok: true },
          { headers: requestIdHeaders(requestId, headers) },
        );
      },
    },
  },
});
