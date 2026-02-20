import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { saveKaraokePhrasesServer } from "@/lib/karaokePhrases.server";

export const saveKaraokePhrases = createServerFn({ method: "POST" })
  .inputValidator(
    (value: {
      actionToken?: string;
      perspectiveId?: string;
      topicId?: string;
      phrases?: unknown;
    }) => value,
  )
  .handler(async ({ data, context }) =>
    saveKaraokePhrasesServer({
      request:
        (context as { request?: Request } | undefined)?.request ?? getRequest(),
      data,
    }),
  );
