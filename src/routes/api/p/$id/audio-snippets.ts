import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import {
  addAudioSnippet,
  addAudioSnippetSchema,
  deleteAudioSnippet,
  listAudioSnippets,
} from "@/lib/audioSnippets.server";
import { verifyActionToken } from "@/lib/actionToken.server";

export const Route = createFileRoute("/api/p/$id/audio-snippets")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const ip = getClientIp(request.headers);
        const rate = rateLimit(`audio-snippet:${ip}`, 30, 60 * 1000);
        if (!rate.ok) {
          return Response.json({ error: "Too many requests" }, { status: 429 });
        }

        const body = await request.json().catch(() => null);
        const parsed = addAudioSnippetSchema.safeParse({
          ...body,
          perspectiveId: params.id,
        });
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid input", issues: parsed.error.issues },
            { status: 400 },
          );
        }

        const result = await addAudioSnippet({ data: parsed.data });
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: result.status });
        }

        return Response.json({ snippetId: result.snippetId }, { status: 201 });
      },

      GET: async ({ params }) => {
        const parsed = z.uuid().safeParse(params.id);
        if (!parsed.success) {
          return Response.json({ error: "Invalid id" }, { status: 400 });
        }

        const result = await listAudioSnippets({ perspectiveId: parsed.data });
        return Response.json(result.snippets);
      },

      DELETE: async ({ request, params }) => {
        const ip = getClientIp(request.headers);
        const rate = rateLimit(`audio-snippet-del:${ip}`, 30, 60 * 1000);
        if (!rate.ok) {
          return Response.json({ error: "Too many requests" }, { status: 429 });
        }

        const url = new URL(request.url);
        const snippetId = url.searchParams.get("snippetId");
        const actionToken = url.searchParams.get("actionToken");
        const topicId = url.searchParams.get("topicId");
        if (!snippetId) {
          return Response.json({ error: "snippetId required" }, { status: 400 });
        }
        if (!actionToken || !topicId) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const verified = verifyActionToken({
          token: actionToken,
          requiredScope: "perspective:align",
          topicId,
        });
        if (!verified) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await deleteAudioSnippet({
          snippetId,
          perspectiveId: params.id,
        });
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: result.status });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
