import { createFileRoute } from "@tanstack/react-router";
import { getRequestId, requestIdHeaders } from "@/lib/requestId";

export const Route = createFileRoute("/api/obj/paypal-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId = getRequestId(request);
        let event: unknown;
        try {
          event = await request.json();
        } catch {
          return Response.json(
            { error: "Invalid JSON" },
            { status: 400, headers: requestIdHeaders(requestId) },
          );
        }

        try {
          const { verifyPayPalWebhookSignature } = await import(
            "@/lib/paypal.server"
          );
          const verified = await verifyPayPalWebhookSignature({
            event,
            headers: request.headers,
          });
          if (!verified) {
            return Response.json(
              { error: "Invalid PayPal signature" },
              { status: 400, headers: requestIdHeaders(requestId) },
            );
          }

          const { processPayPalWebhookServer } = await import(
            "@/lib/perspectiveSupport.server"
          );
          await processPayPalWebhookServer(event);
          return new Response(null, {
            status: 204,
            headers: requestIdHeaders(requestId),
          });
        } catch (error) {
          console.error("Failed to process PayPal webhook", {
            requestId,
            error: error instanceof Error ? error.message : String(error),
          });
          return Response.json(
            { error: "Failed to process PayPal webhook" },
            { status: 500, headers: requestIdHeaders(requestId) },
          );
        }
      },
    },
  },
});
