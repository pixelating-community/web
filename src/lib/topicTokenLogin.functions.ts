import { createServerFn } from "@tanstack/react-start";
import { getRequest, getResponseHeaders } from "@tanstack/react-start/server";
import { z } from "zod/v4";
import {
  saveTopicTokenServer,
  topicTokenLoginSchema,
} from "./topicTokenLogin.server";

const topicTokenLoginRedirectSchema = topicTokenLoginSchema.extend({
  nextPath: z.string().min(1),
});

export const saveTopicTokenAndRedirect = createServerFn({ method: "POST" })
  .inputValidator((value: z.input<typeof topicTokenLoginRedirectSchema>) =>
    topicTokenLoginRedirectSchema.parse(value),
  )
  .handler(async ({ data, context }) => {
    const request =
      (context as { request?: Request } | undefined)?.request ?? getRequest();
    const result = await saveTopicTokenServer({
      request,
      data,
    });

    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }

    const headers = getResponseHeaders();
    for (const cookieHeader of result.setCookieHeaders) {
      headers.append("Set-Cookie", cookieHeader);
    }

    return { ok: true as const, nextPath: data.nextPath };
  });
