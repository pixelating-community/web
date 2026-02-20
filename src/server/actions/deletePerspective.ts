import { z } from "zod/v4";
import { sql } from "@/lib/db";
import { revalidatePath } from "@/server/lib/revalidate";

export const deletePerspective = async ({
  perspectiveId,
}: {
  perspectiveId: string;
}) => {
  try {
    const schema = z.object({
      perspectiveId: z.uuid(),
    });
    const data = schema.parse({
      perspectiveId,
    });

    await sql`DELETE FROM perspectives WHERE id=${data.perspectiveId};`;
    revalidatePath("/");
  } catch (e) {
    console.log(e, { message: "Failed to delete perspective" });
  }
};
