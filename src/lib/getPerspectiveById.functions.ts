import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod/v4";
import { resolveTopicTokenCookieFromRequest } from "@/lib/topicTokenCookies";

const schema = z.object({
  perspectiveId: z.uuid(),
  topicName: z.string().min(1).optional(),
});

export const loadPerspectiveById = createServerFn({ method: "GET" })
  .inputValidator(
    (value: { perspectiveId?: string; topicName?: string }) =>
      schema.parse(value),
  )
  .handler(async ({ data, context }) => {
    const request =
      (context as { request?: Request } | undefined)?.request ?? getRequest();
    const cookie = data.topicName
      ? resolveTopicTokenCookieFromRequest({
          request,
          topicId: "",
          topicName: data.topicName,
        })
      : null;

    const { getPerspectiveById } = await import("@/lib/getPerspectiveById.server");
    const perspective = await getPerspectiveById({
      perspectiveId: data.perspectiveId,
      cookieToken: cookie?.value ?? undefined,
    });

    return { perspective };
  });
