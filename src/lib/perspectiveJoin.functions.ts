import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const loadPerspectiveJoin = createServerFn({ method: "GET" })
  .validator((value: { perspectiveId?: string }) => ({
    perspectiveId: value.perspectiveId?.trim() ?? "",
  }))
  .handler(async ({ data, context }) => {
    const { loadPerspectiveJoinServer } =
      await import("@/lib/perspectiveJoin.server");
    return loadPerspectiveJoinServer({
      perspectiveId: data.perspectiveId,
      request:
        (context as { request?: Request } | undefined)?.request ?? getRequest(),
    });
  });
