import "@tanstack/react-start/server-only";
import { z } from "zod/v4";
import { issueActionToken } from "@/lib/actionToken.server";
import { sql } from "@/lib/db.server";
import { getPerspectiveById } from "@/lib/getPerspectiveById.server";
import { hasPerspectiveCollaborationGrant } from "@/lib/perspectiveCollaborationGrant.server";
import { getRequestId } from "@/lib/requestId";
import type { Perspective } from "@/types/perspectives";

type JoinTopicRow = {
  emoji: string | null;
  id: string;
  locked: boolean | null;
  name: string;
  short_title: string | null;
};

export type PerspectiveJoinResult = {
  data: {
    actionToken?: string;
    canContribute: boolean;
    perspective: Perspective;
    topicEmoji?: string;
    topicId: string;
    topicName: string;
    topicShortTitle?: string;
  } | null;
  error: string;
};

export const loadPerspectiveJoinServer = async ({
  perspectiveId,
  request,
}: {
  perspectiveId: string;
  request: Request;
}): Promise<PerspectiveJoinResult> => {
  const parsed = z.uuid().safeParse(perspectiveId);
  if (!parsed.success) {
    return { data: null, error: "Perspective not found" };
  }

  const topicRows = await sql<JoinTopicRow>`
    SELECT t.id, t.name, t.short_title, t.emoji, t.locked
    FROM perspectives AS p
    JOIN topics AS t ON t.id = p.topic_id
    WHERE p.id = ${parsed.data}
    LIMIT 1;
  `;
  const topic = topicRows[0];
  if (!topic) {
    return { data: null, error: "Perspective not found" };
  }
  if (topic.locked) {
    return {
      data: null,
      error: "Collaboration invites are unavailable for private topics.",
    };
  }

  const perspective = await getPerspectiveById({ perspectiveId: parsed.data });
  if (!perspective) {
    return { data: null, error: "Perspective not found" };
  }

  const canContribute = hasPerspectiveCollaborationGrant({
    request,
    perspectiveId: parsed.data,
  });
  const actionToken = canContribute
    ? issueActionToken({
        scopes: ["perspective:add"],
        topicId: topic.id,
        perspectiveId: parsed.data,
        requestId: getRequestId(request),
      })
    : null;

  return {
    data: {
      actionToken: actionToken ?? undefined,
      canContribute: canContribute && Boolean(actionToken),
      perspective: perspective as Perspective,
      topicEmoji: topic.emoji?.trim() || undefined,
      topicId: topic.id,
      topicName: topic.name,
      topicShortTitle: topic.short_title?.trim() || undefined,
    },
    error: "",
  };
};
