import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const saveKaraokePhrases = createServerFn({ method: "POST" })
  .inputValidator(
    (value: {
      actionToken?: string;
      perspectiveId?: string;
      topicId?: string;
      phrases?: unknown;
    }) => value,
  )
  .handler(async ({ data, context }) => {
    const { saveKaraokePhrasesServer } = await import("@/lib/karaokePhrases.server");
    return saveKaraokePhrasesServer({
      request:
        (context as { request?: Request } | undefined)?.request ?? getRequest(),
      data,
    });
  });
