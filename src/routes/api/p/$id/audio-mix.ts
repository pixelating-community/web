import { createFileRoute } from "@tanstack/react-router";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import {
  enqueueAudioMix,
  getAudioMixJobStatus,
  audioMixSchema,
} from "@/lib/audioMix.server";

export const Route = createFileRoute("/api/p/$id/audio-mix")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const ip = getClientIp(request.headers);
        const rate = rateLimit(`audio-mix:${ip}`, 5, 60 * 1000);
        if (!rate.ok) {
          return Response.json({ error: "Too many requests" }, { status: 429 });
        }

        const body = await request.json().catch(() => null);
        const parsed = audioMixSchema.safeParse({
          ...body,
          perspectiveId: params.id,
        });
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid input", issues: parsed.error.issues },
            { status: 400 },
          );
        }

        const result = await enqueueAudioMix({ data: parsed.data });
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: result.status });
        }

        return Response.json(
          { jobId: result.jobId, status: result.status },
          { status: result.status === "queued" ? 202 : 200 },
        );
      },

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const jobId = url.searchParams.get("jobId");
        if (!jobId) {
          return Response.json({ error: "jobId required" }, { status: 400 });
        }

        const result = await getAudioMixJobStatus({ jobId });
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: result.status });
        }

        return Response.json(result.job);
      },
    },
  },
});
