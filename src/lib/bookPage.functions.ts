import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod/v4";
export const loadBookPage = createServerFn({ method: "GET" })
  .validator((value: unknown) =>
    z
      .object({
        slug: z.string(),
        chapter: z.string().optional(),
        draft: z.string().optional(),
      })
      .parse(value),
  )
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    const { bookPage } = await import("@/lib/bookPage.server");
    return bookPage(data, getRequest());
  });
