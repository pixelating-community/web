import type { NextRequest } from "next/server";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { verifyReflectionAccessToken } from "@/lib/reflectionAccess";
import { addSseConnection, broadcastSse, removeSseConnection } from "@/lib/sse";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ perspectiveId: string }> },
) {
  const { perspectiveId } = await context.params;
  const ip = getClientIp(request.headers);
  const rate = rateLimit(`sse:${ip}:${perspectiveId}`, 6, 60 * 1000);
  if (!rate.ok) {
    return new Response("Too many requests", {
      status: 429,
      headers: rateLimitHeaders(rate),
    });
  }
  const token = request.cookies.get(`p_${perspectiveId}`)?.value;
  if (!verifyReflectionAccessToken(token, perspectiveId)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      addSseConnection(perspectiveId, controller);

      const data = `data: ${JSON.stringify({ type: "connected" })}\n\n`;
      controller.enqueue(new TextEncoder().encode(data));

      const interval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": heartbeat\n\n"));
        } catch {
          clearInterval(interval);
        }
      }, 30000);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        removeSseConnection(perspectiveId, controller);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ perspectiveId: string }> },
) {
  const { perspectiveId } = await context.params;

  const key = process.env.SSE_BROADCAST_KEY;
  if (!key) {
    return new Response("SSE broadcast disabled", { status: 405 });
  }

  const providedKey = request.headers.get("x-sse-key") ?? "";

  if (providedKey !== key) {
    return new Response("Unauthorized", { status: 401 });
  }

  const event = await request.json();
  broadcastSse(perspectiveId, event);

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
