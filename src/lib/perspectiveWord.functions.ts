import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { perspectiveWordSchema } from "@/lib/perspectiveWord.schema";

export const updatePerspectiveWord = createServerFn({ method: "POST" })
  .validator((value: unknown) => perspectiveWordSchema.parse(value))
  .handler(async ({ data, context }) => {
    const { updatePerspectiveWordServer } =
      await import("@/lib/perspectiveWord.server");
    return updatePerspectiveWordServer({
      data,
      request:
        (context as { request?: Request } | undefined)?.request ?? getRequest(),
    });
  });
