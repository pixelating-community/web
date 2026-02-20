import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { loadPerspectiveCommitMetaServer } from "@/lib/perspectiveCommitRoute.server";

export const loadPerspectiveCommitMeta = createServerFn({ method: "GET" })
  .inputValidator((value: { id?: string }) => value)
  .handler(async ({ data, context }) => {
    const id = data.id?.trim() ?? "";
    const request =
      (context as { request?: Request } | undefined)?.request ?? getRequest();
    return await loadPerspectiveCommitMetaServer({ id, request });
  });
