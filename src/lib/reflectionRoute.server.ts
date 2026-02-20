import "@tanstack/react-start/server-only";
import { z } from "zod/v4";
import { sql } from "@/lib/db.server";
import {
  getReflectionWriteCookieName,
  verifyReflectionAccessToken,
  verifyReflectionWriteToken,
} from "@/lib/reflectionAccess";
import { addReflection } from "@/lib/addReflection.server";
import { editReflection } from "@/lib/editReflection.server";
import { getRequestCookie } from "@/server/lib/requestCookies";
import type { ReflectionData } from "@/types/reflections";

const requestCookieStore = (request: Request) => ({
  get: (name: string) => {
    const value = getRequestCookie(request, name);
    return value === undefined ? undefined : { value };
  },
  delete: (_name: string) => {},
});

const resolveReflectionAdmin = (elKey?: string) =>
  typeof elKey === "string" && elKey.length > 0 && elKey === process.env.EL_KEY;

export const reflectionListSchema = z.object({
  perspectiveId: z.uuid(),
  elKey: z.string().optional(),
});

export const createReflectionSchema = z.object({
  perspectiveId: z.uuid(),
  reflectionId: z.uuid().optional(),
  text: z.string().min(1).max(5000),
  elKey: z.string().optional(),
});

export const updateReflectionSchema = z.object({
  id: z.uuid(),
  text: z.string().min(1).max(5000),
});

type ReflectionRouteResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

export const loadPerspectiveReflectionsServer = async ({
  request,
  data,
}: {
  request: Request;
  data: z.infer<typeof reflectionListSchema>;
}): Promise<
  ReflectionRouteResult<{
    reflections: ReflectionData[];
    canWrite: boolean;
  }>
> => {
  const isAdmin = resolveReflectionAdmin(data.elKey);
  const readToken = getRequestCookie(request, `p_${data.perspectiveId}`);

  if (!isAdmin && !verifyReflectionAccessToken(readToken, data.perspectiveId)) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }

  const writeToken = getRequestCookie(
    request,
    getReflectionWriteCookieName(data.perspectiveId),
  );
  const canWrite =
    isAdmin || verifyReflectionWriteToken(writeToken, data.perspectiveId);

  const reflections = await sql<ReflectionData>`
    SELECT id, perspective_id, reflection_id, text, updated_at, created_at
    FROM reflections
    WHERE perspective_id = ${data.perspectiveId}
    ORDER BY created_at ASC;
  `;

  return {
    ok: true,
    data: {
      reflections,
      canWrite,
    },
  };
};

export const createPerspectiveReflectionServer = async ({
  request,
  data,
}: {
  request: Request;
  data: z.infer<typeof createReflectionSchema>;
}): Promise<ReflectionRouteResult<ReflectionData>> => {
  const result = await addReflection({
    perspectiveId: data.perspectiveId,
    reflectionId: data.reflectionId,
    text: data.text,
    elKey: data.elKey,
    cookieStore: requestCookieStore(request),
  });

  if (!result) {
    return { ok: false, error: "Unable to write reflection", status: 401 };
  }

  return {
    ok: true,
    data: result as ReflectionData,
  };
};

export const updatePerspectiveReflectionServer = async ({
  request,
  data,
}: {
  request: Request;
  data: z.infer<typeof updateReflectionSchema>;
}): Promise<ReflectionRouteResult<ReflectionData>> => {
  const result = await editReflection({
    id: data.id,
    text: data.text,
    cookieStore: requestCookieStore(request),
  });

  if (!result) {
    return { ok: false, error: "Unable to edit reflection", status: 401 };
  }

  return {
    ok: true,
    data: result as ReflectionData,
  };
};
