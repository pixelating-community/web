import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { setPerspectiveBoundsServer } from "@/lib/perspectiveBounds.server";

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
  .handler(async ({ data, context }) =>
    setPerspectiveBoundsServer({
      request:
        (context as { request?: Request } | undefined)?.request ?? getRequest(),
      data,
    }),
  );
