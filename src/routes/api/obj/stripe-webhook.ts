import { createFileRoute } from "@tanstack/react-router";
import { getRequestId, requestIdHeaders } from "@/lib/requestId";

export const Route = createFileRoute("/api/obj/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId = getRequestId(request);
        const signature = request.headers.get("stripe-signature");
        if (!signature) {
          return Response.json(
            { error: "Missing Stripe signature" },
            { status: 400, headers: requestIdHeaders(requestId) },
          );
        }

        let event;
        try {
          const payload = await request.text();
          const { constructStripeWebhookEvent } = await import(
            "@/lib/stripe.server"
          );
          event = constructStripeWebhookEvent({ payload, signature });
        } catch (error) {
          console.warn("Rejected Stripe webhook", {
            requestId,
            error: error instanceof Error ? error.message : String(error),
          });
          return Response.json(
            { error: "Invalid Stripe signature" },
            { status: 400, headers: requestIdHeaders(requestId) },
          );
        }

        try {
          const { processStripeWebhookServer } = await import(
            "@/lib/perspectiveSupport.server"
          );
          await processStripeWebhookServer(event);
          return new Response(null, {
            status: 204,
            headers: requestIdHeaders(requestId),
          });
        } catch (error) {
          console.error("Failed to process Stripe webhook", {
            requestId,
            eventId: event.id,
            error: error instanceof Error ? error.message : String(error),
          });
          return Response.json(
            { error: "Failed to process Stripe webhook" },
            { status: 500, headers: requestIdHeaders(requestId) },
          );
        }
      },
    },
  },
});
