import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const setPerspectiveBounds = createServerFn({ method: "POST" })
  .inputValidator(
    (value: {
      actionToken?: string;
      perspectiveId?: string;
      topicId?: string;
      currentPath?: string;
      defaultStartTime?: number | null;
      defaultEndTime?: number | null;
      startTime?: number | null;
      endTime?: number | null;
    }) => value,
  )
  .handler(async ({ data, context }) => {
    const { setPerspectiveBoundsServer } = await import(
      "@/lib/perspectiveBounds.server"
    );
    return setPerspectiveBoundsServer({
      request:
        (context as { request?: Request } | undefined)?.request ?? getRequest(),
      data,
    });
  });
