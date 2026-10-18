import { createServerFn } from "@tanstack/react-start";
import { appendResponseHeader, getRequest } from "@tanstack/react-start/server";
import { z } from "zod/v4";
import { topicTokenLoginSchema } from "@/lib/topicTokenLogin.schema";

const topicTokenLoginRedirectSchema = topicTokenLoginSchema.extend({
  nextPath: z.string().min(1),
});

export const saveTopicTokenAndRedirect = createServerFn({ method: "POST" })
  .validator((value: z.input<typeof topicTokenLoginRedirectSchema>) =>
    topicTokenLoginRedirectSchema.parse(value),
  )
  .handler(async ({ data, context }) => {
    const request =
      (context as { request?: Request } | undefined)?.request ?? getRequest();
    const { saveTopicTokenServer } = await import(
      "@/lib/topicTokenLogin.server"
    );
    const result = await saveTopicTokenServer({
      request,
      data,
    });

    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }

    for (const cookieHeader of result.setCookieHeaders) {
      appendResponseHeader("Set-Cookie", cookieHeader);
    }

    return { ok: true as const, nextPath: data.nextPath };
  });
