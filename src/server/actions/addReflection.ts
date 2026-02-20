import { z } from "zod/v4";
import { sql } from "@/lib/db";
import {
  getReflectionWriteCookieName,
  verifyReflectionWriteToken,
} from "@/lib/reflectionAccess";

type CookieStore = {
  get: (name: string) => { value: string } | undefined;
  delete: (name: string) => void;
};

export const addReflection = async ({
  perspectiveId,
  reflectionId,
  text,
  elKey,
  cookieStore,
}: {
  perspectiveId: string;
  reflectionId?: string;
  text: string;
  elKey?: string;
  cookieStore?: CookieStore;
}) => {
  try {
    const schema = z.object({
      perspectiveId: z.uuid(),
      reflectionId: z.uuid().nullish(),
      text: z.string().min(1).max(5000),
      elKey: z.string().optional(),
    });

    const data = schema.parse({ perspectiveId, reflectionId, text, elKey });
    const isElevated = data.elKey && data.elKey === process.env.EL_KEY;
    const parentId = data.reflectionId ?? null;

    type ReflectionRow = {
      id: string;
      perspective_id: string;
      reflection_id: string | null;
      text: string;
      updated_at: string;
      created_at: string;
    };
    let result: ReflectionRow[] = [];
    if (isElevated) {
      result = await sql`
        INSERT INTO reflections (perspective_id, reflection_id, text)
        VALUES (${data.perspectiveId}, ${parentId}, ${data.text})
        RETURNING id, perspective_id, reflection_id, text, updated_at, created_at;
      `;
    } else {
      if (!cookieStore) {
        throw new Error("cookie store required");
      }
      const token = cookieStore.get(
        getReflectionWriteCookieName(data.perspectiveId),
      )?.value;
      const chargeId = verifyReflectionWriteToken(token, data.perspectiveId);
      if (!chargeId) {
        throw new Error("write token not valid");
      }
      result = await sql`
        WITH consumed_charge AS (
          UPDATE collected c
          SET stripe_charge_id = gen_random_uuid()::text
          FROM perspectives p
          WHERE p.id = ${data.perspectiveId}
            AND p.collection_id = c.collection_id
            AND c.stripe_charge_id = ${chargeId}
            AND c.status = 'succeeded'
          RETURNING c.id
        )
        INSERT INTO reflections (perspective_id, reflection_id, text)
        SELECT ${data.perspectiveId}, ${parentId}, ${data.text}
        WHERE EXISTS (SELECT 1 FROM consumed_charge)
        RETURNING id, perspective_id, reflection_id, text, updated_at, created_at;
      `;
    }

    if (result.length === 0) {
      throw new Error(
        isElevated ? "reflection insertion failed" : "charge not valid",
      );
    }
    if (!isElevated) {
      try {
        cookieStore?.delete(getReflectionWriteCookieName(data.perspectiveId));
      } catch {}
    }
    return result[0];
  } catch (error) {
    console.error("Failed to add reflection", error);
  }
};
