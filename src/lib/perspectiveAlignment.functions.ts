import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { savePerspectiveAlignmentServer } from "@/lib/perspectiveAlignment.server";

export const savePerspectiveAlignment = createServerFn({ method: "POST" })
  .inputValidator(
    (value: {
      actionToken?: string;
      audioKey?: string;
      audioUrl?: string;
      clearAudio?: boolean;
      duration?: number;
      perspectiveId?: string;
      timings?: unknown[];
      topicId?: string;
      voiceOffsetSeconds?: number;
    }) => value,
  )
  .handler(async ({ data, context }) =>
    savePerspectiveAlignmentServer({
      request:
        (context as { request?: Request } | undefined)?.request ?? getRequest(),
      data: {
        actionToken: data.actionToken?.trim() ?? "",
        ...(data.audioKey ? { audioKey: data.audioKey.trim() } : {}),
        ...(data.audioUrl ? { audioUrl: data.audioUrl.trim() } : {}),
        ...(data.clearAudio === true ? { clearAudio: true } : {}),
        ...(typeof data.duration === "number" ? { duration: data.duration } : {}),
        ...(typeof data.voiceOffsetSeconds === "number" && data.voiceOffsetSeconds > 0
          ? { voiceOffsetSeconds: data.voiceOffsetSeconds }
          : {}),
        perspectiveId: data.perspectiveId?.trim() ?? "",
        timings: Array.isArray(data.timings) ? data.timings : [],
        topicId: data.topicId?.trim() ?? "",
      },
    }),
  );
