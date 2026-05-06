import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";

const childPerspectiveSchema = z.object({
  parentPerspectiveId: z.uuid(),
  isLocked: z.boolean().optional(),
  token: z.string().min(1).optional(),
});

export const loadChildPerspectives = createServerFn({ method: "GET" })
  .inputValidator(
    (value: {
      parentPerspectiveId?: string;
      isLocked?: boolean;
      token?: string;
    }) => childPerspectiveSchema.parse(value),
  )
  .handler(async ({ data }) => {
    const { getChildPerspectives } = await import("@/lib/getPerspectives.server");
    const results = await getChildPerspectives({
      parentPerspectiveId: data.parentPerspectiveId,
      isLocked: data.isLocked,
      token: data.token,
    });
    return { perspectives: results };
  });
