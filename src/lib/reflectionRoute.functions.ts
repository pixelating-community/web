import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import {
  createPerspectiveReflectionServer,
  createReflectionSchema,
  loadPerspectiveReflectionsServer,
  reflectionListSchema,
  updatePerspectiveReflectionServer,
  updateReflectionSchema,
} from "@/lib/reflectionRoute.server";

export const loadPerspectiveReflections = createServerFn({ method: "GET" })
  .inputValidator((value: { perspectiveId?: string; elKey?: string }) =>
    reflectionListSchema.parse(value),
  )
  .handler(async ({ data, context }) => {
    const request =
      (context as { request?: Request } | undefined)?.request ?? getRequest();
    const ip = getClientIp(request.headers);
    const rate = rateLimit(
      `reflections:${ip}:${data.perspectiveId}`,
      60,
      60 * 1000,
    );
    if (!rate.ok) {
      return { ok: false as const, error: "Too many requests" };
    }

    return await loadPerspectiveReflectionsServer({ request, data });
  });

export const createPerspectiveReflection = createServerFn({ method: "POST" })
  .inputValidator(
    (value: {
      perspectiveId?: string;
      reflectionId?: string;
      text?: string;
      elKey?: string;
    }) => createReflectionSchema.parse(value),
  )
  .handler(async ({ data, context }) => {
    const request =
      (context as { request?: Request } | undefined)?.request ?? getRequest();
    const ip = getClientIp(request.headers);
    const limitKey = data.elKey ? `c:key:${ip}` : `c:${ip}:${data.perspectiveId}`;
    const limit = data.elKey ? 10 : 30;
    const rate = rateLimit(limitKey, limit, 60 * 1000);
    if (!rate.ok) {
      return { ok: false as const, error: "Too many requests" };
    }

    return await createPerspectiveReflectionServer({ request, data });
  });

export const updatePerspectiveReflection = createServerFn({ method: "POST" })
  .inputValidator((value: { id?: string; text?: string }) =>
    updateReflectionSchema.parse(value),
  )
  .handler(async ({ data, context }) => {
    const request =
      (context as { request?: Request } | undefined)?.request ?? getRequest();
    const ip = getClientIp(request.headers);
    const rate = rateLimit(`edit-reflection:${ip}:${data.id}`, 40, 60 * 1000);
    if (!rate.ok) {
      return { ok: false as const, error: "Too many requests" };
    }

    return await updatePerspectiveReflectionServer({ request, data });
  });
