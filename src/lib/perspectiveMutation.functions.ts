import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  createPerspectiveServer,
  deletePerspectiveServer,
  updatePerspectiveServer,
} from "@/lib/perspectiveMutation.server";

export const createPerspective = createServerFn({ method: "POST" })
  .inputValidator(
    (value: {
      actionToken?: string;
      audioSrc?: string;
      imageSrc?: string;
      perspective?: string;
      topicId?: string;
      topicName?: string;
      parentPerspectiveId?: string;
    }) => value,
  )
  .handler(async ({ data, context }) =>
    createPerspectiveServer({
      request:
        (context as { request?: Request } | undefined)?.request ?? getRequest(),
      data: {
        actionToken: data.actionToken?.trim() ?? "",
        audioSrc: data.audioSrc?.trim() || undefined,
        imageSrc: data.imageSrc?.trim() || undefined,
        perspective: data.perspective ?? "",
        topicId: data.topicId?.trim() ?? "",
        topicName: data.topicName?.trim() ?? "",
        parentPerspectiveId: data.parentPerspectiveId?.trim() || undefined,
      },
    }),
  );

export const updatePerspective = createServerFn({ method: "POST" })
  .inputValidator(
    (value: {
      actionToken?: string;
      audioSrc?: string;
      imageSrc?: string;
      perspective?: string;
      perspectiveId?: string;
      topicId?: string;
      topicName?: string;
    }) => value,
  )
  .handler(async ({ data, context }) =>
    updatePerspectiveServer({
      request:
        (context as { request?: Request } | undefined)?.request ?? getRequest(),
      data: {
        actionToken: data.actionToken?.trim() ?? "",
        audioSrc:
          data.audioSrc === undefined ? undefined : (data.audioSrc?.trim() ?? ""),
        imageSrc:
          data.imageSrc === undefined ? undefined : (data.imageSrc?.trim() ?? ""),
        perspective: data.perspective ?? "",
        perspectiveId: data.perspectiveId?.trim() ?? "",
        topicId: data.topicId?.trim() ?? "",
        topicName: data.topicName?.trim() ?? "",
      },
    }),
  );

export const removePerspective = createServerFn({ method: "POST" })
  .inputValidator(
    (value: {
      actionToken?: string;
      perspectiveId?: string;
      topicId?: string;
    }) => value,
  )
  .handler(async ({ data, context }) =>
    deletePerspectiveServer({
      request:
        (context as { request?: Request } | undefined)?.request ?? getRequest(),
      data: {
        actionToken: data.actionToken?.trim() ?? "",
        perspectiveId: data.perspectiveId?.trim() ?? "",
        topicId: data.topicId?.trim() ?? "",
      },
    }),
  );
