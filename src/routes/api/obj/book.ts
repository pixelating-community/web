import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { bookActionSchema } from "@/lib/book.schema";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
const schema = z.union([
  bookActionSchema,
  z.object({ action: z.literal("requestLink"), email: z.email().max(254) }),
  z.object({
    action: z.literal("consumeLink"),
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  }),
  z.object({ action: z.literal("readerLogout") }),
  z.object({ action: z.literal("checkout") }),
  z.object({
    action: z.literal("reconcile"),
    sessionId: z.string().regex(/^cs_[A-Za-z0-9_]{1,125}$/),
  }),
  z.object({
    action: z.literal("proofread"),
    text: z.string().min(1).max(12000),
  }),
]);
export const Route = createFileRoute("/api/obj/book")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const headers = new Headers({ "Cache-Control": "private, no-store" });
        try {
          if (request.headers.get("origin") !== new URL(request.url).origin)
            return Response.json(
              { error: "Invalid request origin" },
              { status: 403, headers },
            );
          const data = schema.parse(await request.json());
          const ip = getClientIp(request.headers);
          const limit = ["login", "requestLink", "consumeLink"].includes(
            data.action,
          )
            ? 5
            : data.action === "proofread"
              ? 10
              : 60;
          if (
            !rateLimit(
              `book:${data.action}:${ip}`,
              limit,
              data.action === "proofread" ? 3600000 : 60000,
            ).ok
          )
            return Response.json(
              { error: "Too many attempts. Please try later." },
              { status: 429, headers },
            );
          const auth = await import("@/lib/bookAuth.server");
          const payments = await import("@/lib/bookPayments.server");
          let result: unknown = {};
          switch (data.action) {
            case "login":
              if (!auth.verifyBookAuthorKey(data.key))
                throw new Error("Invalid author key.");
              headers.append("Set-Cookie", auth.buildBookAuthorCookie());
              break;
            case "logout":
              headers.append("Set-Cookie", auth.buildBookAuthorCookie(true));
              break;
            case "readerLogout":
              headers.append(
                "Set-Cookie",
                await payments.logoutBookReader(request),
              );
              break;
            case "requestLink":
              await payments.requestBookLogin(data.email, request);
              break;
            case "consumeLink":
              headers.append(
                "Set-Cookie",
                await payments.consumeBookLogin(data.token),
              );
              break;
            case "checkout":
              result = { url: await payments.checkoutBook(request) };
              break;
            case "reconcile":
              await payments.fulfillBookSession(data.sessionId, request);
              break;
            case "proofread": {
              auth.requireBookAuthor(request);
              const { proofreadBookText } =
                await import("@/lib/bookProofread.server");
              result = { corrections: await proofreadBookText(data.text) };
              break;
            }
            default: {
              const { mutateBook } = await import("@/lib/book.server");
              result = await mutateBook(data, request);
            }
          }
          return Response.json(
            { ok: true, ...(result as object) },
            { headers },
          );
        } catch (error) {
          return Response.json(
            {
              error:
                error instanceof z.ZodError
                  ? "Invalid input"
                  : error instanceof Error
                    ? error.message
                    : "Request failed",
            },
            { status: 400, headers },
          );
        }
      },
    },
  },
});
