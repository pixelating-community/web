import "@tanstack/react-start/server-only";
import { verifyActionToken } from "@/lib/actionToken.server";
import { sql } from "@/lib/db.server";
import { getRequestId } from "@/lib/requestId";
import { buildTopicKaraokeEditorPath } from "@/lib/topicRoutes";

type SetBoundsArgs = {
  request: Request;
  data: {
    actionToken?: string;
    currentPath?: string;
    defaultStartTime?: number | null;
    defaultEndTime?: number | null;
    perspectiveId?: string;
    topicId?: string;
    startTime?: number | null;
    endTime?: number | null;
  };
};

const URL_BASE = "https://pixelating.local";

const normalizeFiniteTime = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const formatUrlTime = (value: number) =>
  Number(Math.max(0, value).toFixed(6)).toString();

const isSafeSameOriginPath = (value: string | undefined) => {
  const raw = value?.trim() ?? "";
  if (!raw.startsWith("/") || raw.startsWith("//")) return false;
  try {
    const url = new URL(raw, URL_BASE);
    return url.origin === URL_BASE;
  } catch {
    return false;
  }
};

const buildBoundsHref = ({
  currentPath,
  endTime,
  fallbackPath,
  startTime,
}: {
  currentPath?: string;
  endTime: number | null | undefined;
  fallbackPath: string;
  startTime: number | null | undefined;
}) => {
  const safeCurrentPath = isSafeSameOriginPath(currentPath)
    ? currentPath?.trim()
    : "";
  const href = safeCurrentPath || fallbackPath;
  const url = new URL(href, URL_BASE);
  const nextStartTime = normalizeFiniteTime(startTime);
  const nextEndTime = normalizeFiniteTime(endTime);

  if (nextStartTime === null) {
    url.searchParams.delete("s");
  } else {
    url.searchParams.set("s", formatUrlTime(nextStartTime));
  }

  if (nextEndTime === null) {
    url.searchParams.delete("e");
  } else {
    url.searchParams.set("e", formatUrlTime(nextEndTime));
  }

  return `${url.pathname}${url.search}${url.hash}`;
};

export const setPerspectiveBoundsServer = async ({
  request,
  data,
}: SetBoundsArgs) => {
  const requestId = getRequestId(request);

  const actionToken = data.actionToken?.trim() ?? "";
  const perspectiveId = data.perspectiveId?.trim() ?? "";
  const topicId = data.topicId?.trim() ?? "";

  if (!actionToken || !perspectiveId || !topicId) {
    return { ok: false as const, error: "Missing required fields", requestId };
  }

  const verified = verifyActionToken({
    token: actionToken,
    requiredScope: "perspective:align",
    topicId,
  });
  if (!verified) {
    return { ok: false as const, error: "Unauthorized", requestId };
  }

  const rows = await sql<{
    end_time: number | null;
    start_time: number | null;
    topic_id: string;
    topic_name: string;
  }>`
    SELECT p.topic_id, p.start_time, p.end_time, t.name AS topic_name
    FROM perspectives p
    JOIN topics t ON t.id = p.topic_id
    WHERE p.id = ${perspectiveId}
    LIMIT 1;
  `;
  if (rows.length === 0 || rows[0]?.topic_id !== topicId) {
    return { ok: false as const, error: "Not found", requestId };
  }
  const row = rows[0];

  const startTime = data.startTime;
  const endTime = data.endTime;
  const defaultStartTime = normalizeFiniteTime(data.defaultStartTime) ?? 0;
  const defaultEndTime = normalizeFiniteTime(data.defaultEndTime);
  const shouldDefaultStart = endTime !== undefined && row.start_time === null;
  const shouldDefaultEnd = startTime !== undefined && row.end_time === null;
  const nextStartTime = shouldDefaultStart
    ? defaultStartTime
    : startTime !== undefined
      ? startTime
      : row.start_time;
  const nextEndTime = shouldDefaultEnd && defaultEndTime !== null
    ? defaultEndTime
    : endTime !== undefined
      ? endTime
      : row.end_time;

  if (startTime !== undefined || shouldDefaultStart) {
    await sql`UPDATE perspectives SET start_time = ${nextStartTime} WHERE id = ${perspectiveId};`;
  }
  if (endTime !== undefined || (shouldDefaultEnd && defaultEndTime !== null)) {
    await sql`UPDATE perspectives SET end_time = ${nextEndTime} WHERE id = ${perspectiveId};`;
  }

  const href = buildBoundsHref({
    currentPath: data.currentPath,
    endTime: nextEndTime,
    fallbackPath: buildTopicKaraokeEditorPath({
      topicName: row.topic_name,
      perspectiveId,
    }),
    startTime: nextStartTime,
  });

  return {
    ok: true as const,
    href,
    startTime: normalizeFiniteTime(nextStartTime),
    endTime: normalizeFiniteTime(nextEndTime),
  };
};
