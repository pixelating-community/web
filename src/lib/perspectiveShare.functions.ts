import { createServerFn } from "@tanstack/react-start";
import { getRequest, getResponseHeaders } from "@tanstack/react-start/server";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import {
  generatePerspectiveShareCodeSchema,
  loadPerspectiveShareStatusSchema,
  redeemPerspectiveShareCodeSchema,
} from "@/lib/perspectiveShare.schema";

export const loadPerspectiveShareStatus = createServerFn({ method: "GET" })
  .inputValidator((value: {
    actionToken?: string;
    perspectiveId?: string;
    topicId?: string;
  }) => loadPerspectiveShareStatusSchema.parse(value))
  .handler(async ({ data, context }) => {
    const { loadPerspectiveShareStatusServer } = await import(
      "@/lib/perspectiveShare.server"
    );
    return loadPerspectiveShareStatusServer({
      request:
        (context as { request?: Request } | undefined)?.request ?? getRequest(),
      data,
    });
  });

export const generatePerspectiveShareCodeFn = createServerFn({ method: "POST" })
  .inputValidator((value: {
    actionToken?: string;
    perspectiveId?: string;
    topicId?: string;
  }) => generatePerspectiveShareCodeSchema.parse(value))
  .handler(async ({ data, context }) => {
    const request =
      (context as { request?: Request } | undefined)?.request ?? getRequest();
    const ip = getClientIp(request.headers);
    const rate = rateLimit(`share-generate:${ip}:${data.perspectiveId}`, 10, 60 * 1000);
    if (!rate.ok) {
      return { ok: false as const, error: "Too many requests" };
    }

    const { generatePerspectiveShareCodeServer } = await import(
      "@/lib/perspectiveShare.server"
    );
    return await generatePerspectiveShareCodeServer({
      request,
      data,
    });
  });

export const redeemPerspectiveShareCode = createServerFn({ method: "POST" })
  .inputValidator((value: { code?: string; perspectiveId?: string }) =>
    redeemPerspectiveShareCodeSchema.parse(value),
  )
  .handler(async ({ data, context }) => {
    const request =
      (context as { request?: Request } | undefined)?.request ?? getRequest();
    const ip = getClientIp(request.headers);
    const rate = rateLimit(`share-redeem:${ip}:${data.perspectiveId}`, 20, 60 * 1000);
    if (!rate.ok) {
      return { ok: false as const, error: "Too many requests" };
    }

    const { redeemPerspectiveShareCodeServer } = await import(
      "@/lib/perspectiveShare.server"
    );
    const result = await redeemPerspectiveShareCodeServer({
      request,
      data,
    });

    if (!result.ok) {
      return result;
    }

    const headers = getResponseHeaders();
    for (const cookieHeader of result.setCookieHeaders) {
      headers.append("Set-Cookie", cookieHeader);
    }

    return {
      ok: true as const,
      data: result.data,
    };
  });
