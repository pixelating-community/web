/* oxlint-disable jsx-a11y/prefer-tag-over-role -- contentEditable rich text uses div textbox surfaces. */
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { ChangeEvent } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PerspectiveShare } from "@/components/PerspectiveShare";
import { PerspectiveBackground } from "@/components/PerspectiveBackground";
import { PerspectiveModeNav } from "@/components/PerspectiveModeNav";
import { hasPlayableAudioSource } from "@/components/sw/runtime";
import { useConfirmAction } from "@/components/sw/useConfirmAction";
import { PerspectiveMarkup } from "@/components/PerspectiveMarkup";
import {
  createPerspective,
  removePerspective,
  updatePerspective,
} from "@/lib/perspectiveMutation.functions";
import {
  extractMarkdownBackgroundImageSrc,
  resolvePerspectiveBackgroundImageSrc,
} from "@/lib/perspectiveImage";
import {
  NEW_PERSPECTIVE_HASH,
  buildTopicPath,
  buildTopicWritePerspectivePath,
  buildTopicUnlockHref,
} from "@/lib/topicRoutes";
import { patchTopicPayloadQueryResult } from "@/lib/topicPayloadCache";
import type { Perspective, WritePerspectiveProps } from "@/types/perspectives";
import type { TopicPayloadQueryResult } from "@/types/topic";

type PerspectiveUpdate = {
  id: string;
  perspective: string;
  image_src?: string | null;
};

type EditPerspectiveVariables = {
  perspectiveId: string;
  formData: FormData;
  optimisticUpdate: PerspectiveUpdate;
};

type DeletePerspectiveVariables = {
  perspectiveId: string;
};

type AddPerspectiveVariables = {
  formData: FormData;
  optimisticPerspective: Perspective;
};

type TopicQueryMutationContext = {
  previousPayload?: TopicPayloadQueryResult;
};

const applyPerspectiveUpdate = (
  source: Perspective[],
  payload: PerspectiveUpdate,
) =>
  source.map((item) => {
    if (item.id !== payload.id) return item;
    return {
      ...item,
      perspective: payload.perspective,
      image_src: payload.image_src ?? undefined,
      rendered_html: undefined,
    };
  });

export function WritePerspective({
  actionToken,
  id,
  name,
  topicEmoji,
  topicShortTitle,
  perspectives,
  forward,
  initialPerspectiveId,
  parentPerspectiveId,
  queryKey,
  onRefresh,
}: WritePerspectiveProps) {
  const MAX_LENGTH = 555;
  const btnText = "🖋️";
  const createPerspectiveFn = useServerFn(createPerspective);
  const updatePerspectiveFn = useServerFn(updatePerspective);
  const removePerspectiveFn = useServerFn(removePerspective);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [focus, setFocus] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [perspectiveId, setPerspectiveId] = useState<string | null>(null);
  const [visibleBackgroundId, setVisibleBackgroundId] = useState<string | null>(null);
  const [characters, setCharacters] = useState(0);
  const [perspectiveText, setPerspectiveText] = useState("");
  const [imageSrc, setImageSrc] = useState("");
  const [imageUploadStatus, setImageUploadStatus] = useState<
    "idle" | "uploading" | "error"
  >("idle");
  const [imageUploadError, setImageUploadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const perspectivesEndRef = useRef<HTMLDivElement | null>(null);
  const perspectivesForwardEndRef = useRef<HTMLDivElement | null>(null);
  const newPerspectivePanelRef = useRef<HTMLDivElement | null>(null);
  const newPerspectiveRef = useRef<HTMLDivElement | null>(null);
  const selectedEditorRef = useRef<HTMLDivElement | null>(null);
  const hashScrollTargetRef = useRef<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const initializedPerspectiveRef = useRef(false);
  const pendingEditorHydrationRef = useRef<{
    perspectiveId: string;
    placeCaret: boolean;
  } | null>(null);
  const isEditingPerspective = perspectiveId !== null;

  const throwMutationError = ({
    code,
    error,
    requestId,
  }: {
    code?: string;
    error: string;
    requestId?: string;
  }) => {
    const mutationError = new Error(error) as Error & {
      code?: string;
      requestId?: string;
    };
    if (code) {
      mutationError.code = code;
    }
    if (requestId) {
      mutationError.requestId = requestId;
    }
    throw mutationError;
  };

  const readEditableText = (element: HTMLElement) =>
    element.innerText.replace(/\r\n?/g, "\n");

  const placeCaretAtEnd = (element: HTMLElement) => {
    element.focus();
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const scrollPerspectivesIntoView = () => {
    setTimeout(() => {
      requestAnimationFrame(() => {
        if (!forward && perspectivesEndRef.current) {
          perspectivesEndRef.current.scrollLeft = 0;
        } else if (forward && perspectivesForwardEndRef.current) {
          perspectivesForwardEndRef.current.scrollIntoView({
            block: "end",
          });
        }
      });
    }, 500);
  };

  const resetForm = () => {
    setPerspectiveId(null);
    setPerspectiveText("");
    setImageSrc("");
    setCharacters(0);
    if (newPerspectiveRef.current) {
      newPerspectiveRef.current.textContent = "";
    }
  };

  const refreshFromServer = async () => {
    if (!onRefresh) return;
    try {
      await onRefresh();
    } catch (error) {
      console.error("Failed to refresh perspectives", error);
    }
  };

  const replaceTopicPayload = (nextPayload?: TopicPayloadQueryResult) => {
    if (!queryKey || !nextPayload) return;
    queryClient.setQueryData(queryKey, nextPayload);
  };

  const patchTopicPayload = (
    updater: (items: Perspective[]) => Perspective[],
  ): TopicPayloadQueryResult | undefined => {
    if (!queryKey) return undefined;
    const previousPayload =
      queryClient.getQueryData<TopicPayloadQueryResult>(queryKey);
    queryClient.setQueryData<TopicPayloadQueryResult>(queryKey, (current: TopicPayloadQueryResult | undefined): TopicPayloadQueryResult | undefined =>
      patchTopicPayloadQueryResult({ current, updater }),
    );
    return previousPayload;
  };

  const settleTopicPayload = async () => {
    if (queryKey) {
      await queryClient.invalidateQueries({ queryKey });
      return;
    }
    await refreshFromServer();
  };

  const editPerspectiveMutation = useMutation<
    unknown,
    Error,
    EditPerspectiveVariables,
    TopicQueryMutationContext
  >({
    mutationFn: async ({ perspectiveId, formData }: EditPerspectiveVariables) => {
      const perspective = String(formData.get("perspective") ?? "");
      const rawAudioSrc = formData.get("audio_src");
      const rawImageSrc = formData.get("image_src");
      const result = await updatePerspectiveFn({
        data: {
          actionToken,
          audioSrc:
            typeof rawAudioSrc === "string" ? rawAudioSrc.trim() : undefined,
          imageSrc:
            typeof rawImageSrc === "string" ? rawImageSrc.trim() : undefined,
          perspective,
          perspectiveId,
          topicId: id,
          topicName: name,
        },
      });
      if (!result.ok) {
        throwMutationError(result);
      }
      return result;
    },
    onMutate: ({ optimisticUpdate }: EditPerspectiveVariables) => {
      const previousPayload = patchTopicPayload((items) =>
        applyPerspectiveUpdate(items, optimisticUpdate),
      );
      return { previousPayload };
    },
    onError: (_error: Error, _variables: EditPerspectiveVariables, context: TopicQueryMutationContext | undefined) => {
      replaceTopicPayload(context?.previousPayload);
    },
    onSettled: async () => {
      await settleTopicPayload();
    },
  });

  const deletePerspectiveMutation = useMutation<
    unknown,
    Error,
    DeletePerspectiveVariables,
    TopicQueryMutationContext
  >({
    mutationFn: async ({ perspectiveId }: DeletePerspectiveVariables) => {
      const result = await removePerspectiveFn({
        data: {
          actionToken,
          perspectiveId,
          topicId: id,
        },
      });
      if (!result.ok) {
        throwMutationError(result);
      }
      return result;
    },
    onMutate: ({ perspectiveId }: DeletePerspectiveVariables) => {
      const previousPayload = patchTopicPayload((items) =>
        items.filter((item) => item.id !== perspectiveId),
      );
      return { previousPayload };
    },
    onError: (_error: Error, _variables: DeletePerspectiveVariables, context: TopicQueryMutationContext | undefined) => {
      replaceTopicPayload(context?.previousPayload);
    },
    onSettled: async () => {
      await settleTopicPayload();
    },
  });

  const addPerspectiveMutation = useMutation<
    unknown,
    Error,
    AddPerspectiveVariables,
    TopicQueryMutationContext
  >({
    mutationFn: async ({ formData }: AddPerspectiveVariables) => {
      const perspective = String(formData.get("perspective") ?? "");
      const rawAudioSrc = formData.get("audio_src");
      const rawImageSrc = formData.get("image_src");
      const result = await createPerspectiveFn({
        data: {
          actionToken,
          audioSrc:
            typeof rawAudioSrc === "string" ? rawAudioSrc.trim() : undefined,
          imageSrc:
            typeof rawImageSrc === "string" ? rawImageSrc.trim() : undefined,
          perspective,
          topicId: id,
          topicName: name,
          parentPerspectiveId,
        },
      });
      if (!result.ok) {
        throwMutationError(result);
      }
      return result;
    },
    onMutate: ({ optimisticPerspective }: AddPerspectiveVariables) => {
      const previousPayload = patchTopicPayload((items) =>
        !forward
          ? [optimisticPerspective, ...items]
          : [...items, optimisticPerspective],
      );
      return { previousPayload };
    },
    onError: (_error: Error, _variables: AddPerspectiveVariables, context: TopicQueryMutationContext | undefined) => {
      replaceTopicPayload(context?.previousPayload);
    },
    onSettled: async () => {
      await settleTopicPayload();
    },
  });

  const handleSubmit = async () => {
    if (!perspectiveText) return;

    const formData = new FormData();
    formData.set("perspective", perspectiveText);
    formData.set("image_src", imageSrc.trim());

    if (perspectiveId) {
      const optimisticUpdate: PerspectiveUpdate = {
        id: perspectiveId,
        perspective: perspectiveText,
        image_src: imageSrc.trim() || null,
      };
      await editPerspectiveMutation.mutateAsync({
        perspectiveId,
        formData,
        optimisticUpdate,
      });
      setSubmitError("");
      return;
    } else {
      const optimisticPerspective: Perspective = {
        id: `pending-${Date.now()}` as Perspective["id"],
        perspective: perspectiveText,
        topic_id: id as Perspective["topic_id"],
        image_src: imageSrc.trim() || undefined,
        symbols: [],
        words: [],
        wordTimings: [],
      };
      await addPerspectiveMutation.mutateAsync({
        formData,
        optimisticPerspective,
      });
      scrollPerspectivesIntoView();
    }

    setSubmitError("");
    resetForm();
  };

  const handleImageFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageUploadStatus("error");
      setImageUploadError("Choose an image file.");
      return;
    }

    setImageUploadStatus("uploading");
    setImageUploadError("");
    try {
      const uploadFormData = new FormData();
      uploadFormData.set("file", file);
      uploadFormData.set("contentTypeHint", file.type);
      const response = await fetch("/api/obj/upload", {
        method: "POST",
        body: uploadFormData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Image upload failed",
        );
      }
      const nextSrc =
        payload && typeof payload.publicUrl === "string"
          ? payload.publicUrl
          : payload && typeof payload.key === "string"
            ? payload.key
            : "";
      if (!nextSrc) throw new Error("Image upload did not return a URL");
      setImageSrc(nextSrc);
      setImageUploadStatus("idle");
    } catch (error) {
      setImageUploadStatus("error");
      setImageUploadError(
        error instanceof Error ? error.message : "Image upload failed",
      );
    }
  };

  const deletePerspectiveHandler = async () => {
    if (perspectiveId) {
      const deletingId = perspectiveId;
      try {
        await deletePerspectiveMutation.mutateAsync({
          perspectiveId: deletingId,
        });
        resetForm();
        setSubmitError("");
      } catch (error) {
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Failed to delete perspective",
        );
      }
    }
  };

  const submitWithFeedback = async () => {
    try {
      await handleSubmit();
    } catch (err) {
      const code =
        err &&
        typeof err === "object" &&
        "code" in err &&
        typeof (err as { code?: unknown }).code === "string"
          ? (err as { code: string }).code
          : undefined;
      if (code === "TOPIC_LOCKED") {
        const nextPath = buildTopicPath(name);
        void router.navigate({
          href: buildTopicUnlockHref({
            topicName: name,
            nextPath,
          }),
          viewTransition: true,
        });
        return;
      }
      setSubmitError(
        err instanceof Error ? err.message : "Failed to save perspective",
      );
    }
  };

  const hasPerspectiveText = perspectiveText.trim().length > 0;
  const isMutationBusy =
    addPerspectiveMutation.isPending ||
    editPerspectiveMutation.isPending ||
    deletePerspectiveMutation.isPending;
  const selectedPerspective = perspectiveId
    ? perspectives.find((perspective) => perspective.id === perspectiveId) ??
      null
    : null;
  const activeEditorImageSrc =
    imageSrc || extractMarkdownBackgroundImageSrc(perspectiveText);
  const visibleBackgroundPerspective =
    visibleBackgroundId && visibleBackgroundId !== NEW_PERSPECTIVE_HASH
      ? perspectives.find((perspective) => perspective.id === visibleBackgroundId) ?? null
      : null;
  const visibleBackgroundImageSrc =
    visibleBackgroundId === NEW_PERSPECTIVE_HASH
      ? (!isEditingPerspective ? activeEditorImageSrc : "")
      : visibleBackgroundPerspective
        ? visibleBackgroundPerspective.id === perspectiveId
          ? activeEditorImageSrc
          : resolvePerspectiveBackgroundImageSrc(visibleBackgroundPerspective)
        : selectedPerspective
          ? activeEditorImageSrc
          : !isEditingPerspective
            ? activeEditorImageSrc
            : "";

  useEffect(() => {
    if (initializedPerspectiveRef.current) return;
    const targetId = initialPerspectiveId?.trim();

    if (!targetId) {
      // No specific perspective requested — scroll to new perspective panel
      initializedPerspectiveRef.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          newPerspectivePanelRef.current?.scrollIntoView({
            block: "nearest",
            inline: "center",
            behavior: "auto",
          });
        });
      });
      return;
    }

    const targetPerspective = perspectives.find(
      (perspective) => perspective.id === targetId,
    );
    if (!targetPerspective) return;
    initializedPerspectiveRef.current = true;
    setPerspectiveId(targetPerspective.id);
    setPerspectiveText(targetPerspective.perspective);
    setImageSrc(targetPerspective.image_src ?? "");
    setCharacters(targetPerspective.perspective.length);
    pendingEditorHydrationRef.current = {
      perspectiveId: targetPerspective.id,
      placeCaret: false,
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = document.getElementById(targetPerspective.id);
        target?.scrollIntoView({
          block: "nearest",
          inline: "center",
          behavior: "auto",
        });
      });
    });
  }, [initialPerspectiveId, perspectives]);

  useEffect(() => {
    const root = perspectivesEndRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;

    const visibleRatios = new Map<string, number>();
    let rafId: number | null = null;
    const commitVisibleBackground = () => {
      rafId = null;
      let nextId = visibleBackgroundId ?? perspectiveId ?? NEW_PERSPECTIVE_HASH;
      let bestRatio = -1;
      for (const [id, ratio] of visibleRatios) {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          nextId = id;
        }
      }
      if (bestRatio >= 0 && nextId !== visibleBackgroundId) {
        setVisibleBackgroundId(nextId);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          const id = element.dataset.backgroundId;
          if (!id) continue;
          visibleRatios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(commitVisibleBackground);
      },
      {
        root,
        threshold: [0.25, 0.5, 0.75, 0.9],
      },
    );

    for (const child of Array.from(root.querySelectorAll<HTMLElement>("[data-background-id]"))) {
      observer.observe(child);
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [perspectiveId, perspectives, visibleBackgroundId]);

  useLayoutEffect(() => {
    const pendingHydration = pendingEditorHydrationRef.current;
    if (!pendingHydration) return;
    if (perspectiveId !== pendingHydration.perspectiveId) return;
    const editor = selectedEditorRef.current;
    if (!editor) return;

    const targetPerspective = perspectives.find(
      (perspective) => perspective.id === pendingHydration.perspectiveId,
    );
    const nextText = targetPerspective?.perspective ?? perspectiveText;
    editor.textContent = nextText;

    if (pendingHydration.placeCaret) {
      placeCaretAtEnd(editor);
    }

    pendingEditorHydrationRef.current = null;
  }, [perspectiveId, perspectiveText, perspectives]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawHash = window.location.hash.replace(/^#/, "").trim();
    if (!rawHash) return;
    const targetId = (() => {
      try {
        return decodeURIComponent(rawHash);
      } catch {
        return rawHash;
      }
    })();
    if (!targetId || hashScrollTargetRef.current === targetId) return;
    const scrollTarget =
      targetId === NEW_PERSPECTIVE_HASH
        ? newPerspectivePanelRef.current
        : perspectives.some((perspective) => perspective.id === targetId)
          ? document.getElementById(targetId)
          : null;
    if (!scrollTarget) {
      return;
    }
    requestAnimationFrame(() => {
      hashScrollTargetRef.current = targetId;
      scrollTarget.scrollIntoView({
        block: "nearest",
        inline: "center",
        behavior: "auto",
      });
    });
  }, [perspectives]);


  const trimmedTopicEmoji = topicEmoji?.trim() ?? "";
  const trimmedTopicShortTitle = topicShortTitle?.trim() ?? "";
  const trimmedTopicName = name.trim();
  const topicNavLabel =
    trimmedTopicShortTitle || trimmedTopicEmoji || trimmedTopicName || "↩";
  const topicNavIsSingleEmoji =
    !trimmedTopicShortTitle &&
    Boolean(trimmedTopicEmoji) &&
    Array.from(trimmedTopicEmoji).length <= 2;
  const isImageUploading = imageUploadStatus === "uploading";
  const isSubmitDisabled = !hasPerspectiveText || isMutationBusy || isImageUploading;
  const showNewPerspectivePlaceholder =
    !isEditingPerspective && !focus && !hasPerspectiveText;
  const submitDisabledReason = !hasPerspectiveText
    ? "Enter perspective text first."
    : isMutationBusy
      ? "Saving..."
      : isImageUploading
        ? "Uploading image..."
      : undefined;
  const confirmDeletePerspective = useConfirmAction({
    enabled: Boolean(perspectiveId) && !isMutationBusy,
    onConfirm: () => {
      void deletePerspectiveHandler();
    },
    resetKey: perspectiveId,
  });

  return (
    <div className="relative flex flex-col w-full overflow-hidden h-dvh">
      <PerspectiveBackground
        imageSrc={visibleBackgroundImageSrc}
        overlayClassName="bg-black/25"
      />
      <Link
        to={buildTopicPath(name)}
        preload="intent"
        viewTransition
        className={`absolute top-3 left-3 z-30 inline-flex h-10 items-center justify-center border-0 bg-transparent text-white/90 no-underline transition hover:text-white ${
          topicNavIsSingleEmoji
            ? "w-10 rounded-full text-lg"
            : "max-w-[5.5rem] rounded-xl px-2 text-xs font-medium sm:max-w-[12rem] sm:px-3 sm:text-sm"
        }`}
        aria-label="Back to topic"
        title="Back to topic"
      >
        <span className={topicNavIsSingleEmoji ? "" : "truncate"}>{topicNavLabel}</span>
      </Link>
      {selectedPerspective ? (
        <>
          <PerspectiveModeNav
            canWrite={true}
            currentMode="write"
            perspectiveId={selectedPerspective.id}
            reserveStartSpace
            showViewMode={false}
            topicName={name}
            onShareToggle={
              actionToken && !selectedPerspective.id.startsWith("pending-")
                ? () => setShowShare((v) => !v)
                : undefined
            }
            isShareActive={showShare}
            onNewPerspective={() => {
              newPerspectivePanelRef.current?.scrollIntoView({
                block: "nearest",
                inline: "center",
                behavior: "smooth",
              });
            }}
          />
          {showShare &&
          actionToken &&
          !selectedPerspective.id.startsWith("pending-") ? (
            <div className="shrink-0 px-4 pt-14">
              <div className="mx-auto flex flex-col gap-2 my-2">
                <PerspectiveShare
                  actionToken={actionToken}
                  perspective={selectedPerspective}
                  topicId={id}
                />
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      <div
        ref={perspectivesEndRef}
        className="relative z-10 flex grow w-screen overflow-x-auto overflow-y-hidden snap-x snap-mandatory [scrollbar-gutter:stable] scrollbar-transparent touch-pan-x"
      >
        {perspectives.map((p, index) => {
          const perspectivePlaybackHref = hasPlayableAudioSource(p.audio_src)
            ? `/p/${p.id}`
            : "";
          const perspectiveWriteHref = buildTopicWritePerspectivePath({
            topicName: name,
            perspectiveId: p.id,
          });
          const isSelectedPerspective = perspectiveId === p.id;

          return (
            <div
              key={`${index}_${p.id}`}
              id={p.id}
              data-background-id={p.id}
              ref={(node) => {
                if (index === perspectives.length - 1) {
                  perspectivesForwardEndRef.current = node;
                }
              }}

              className="relative flex h-full min-w-[80vw] snap-center overflow-hidden p-4"
            >
              <div className="relative z-10 flex h-full w-full">
                <div data-id={p.id} className="flex h-full w-full items-stretch">
                  <div className="flex w-10 shrink-0 items-center justify-center self-stretch">
                    {perspectivePlaybackHref ? (
                      <Link
                        to={perspectivePlaybackHref}
                        preload="intent"
                        viewTransition
                        className="inline-flex h-8 w-8 touch-manipulation items-center justify-center rounded-[10px] border border-transparent bg-transparent p-0 text-[1.15rem] leading-none text-(--color-neon-teal) no-underline decoration-transparent hover:no-underline hover:decoration-transparent focus:no-underline focus:decoration-transparent transition-[color,transform,width,height] duration-150"
                        style={{ textDecoration: "none" }}
                        title="Open playback for this perspective"
                        aria-label="Open playback for this perspective"
                      >
                        ▶
                      </Link>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 self-stretch overflow-y-auto scrollbar-transparent">
                    <div className="flex min-h-full flex-col justify-center py-4">
                      {isSelectedPerspective ? (
                        <div
                          key={`editor-${p.id}`}
                          ref={(node) => {
                            if (isSelectedPerspective) {
                              selectedEditorRef.current = node;
                            }
                          }}
                          role="textbox"
                          aria-multiline="true"
                          tabIndex={0}
                          contentEditable
                          suppressContentEditableWarning
                          data-editor="perspective"
                          aria-label="Edit perspective"
                          onInput={(e) => {
                            const text = readEditableText(e.currentTarget);
                            setPerspectiveText(text);
                            setCharacters(text.length);
                          }}
                          onFocus={() => setFocus(true)}
                          onBlur={(e) => {
                            setFocus(false);
                            const text = readEditableText(e.currentTarget);
                            setPerspectiveText(text);
                            setCharacters(text.length);
                          }}
                          className="
                            sw-perspective-text
                            whitespace-pre-wrap
                            cursor-text
                            ui-focus-ring ui-editor-ring
                            p-2
                            w-full
                            min-h-[calc(100dvh-14rem)]
                            text-left
                            text-shadow-2xs text-shadow-purple-200/20
                            has-[blockquote]:border-l-2
                            has-[blockquote]:border-purple-700
                            has-[blockquote]:pl-2
                            leading-relaxed
                          "
                          dir="ltr"
                          style={{ direction: "ltr" }}
                        />
                      ) : (
                        <div key={`preview-${p.id}`} className="group relative">
                          <div
                            className="
                              sw-perspective-text
                              flex w-full flex-col
                              whitespace-pre-line
                              has-[blockquote]:border-l-2
                              has-[blockquote]:border-purple-700
                              has-[blockquote]:pl-2
                              text-shadow-2xs text-shadow-purple-200/20
                              text-left text-inherit
                              transition-opacity duration-150
                            "
                          >
                            <PerspectiveMarkup
                              perspective={p}
                              className="flex flex-col"
                            />
                          </div>
                          <Link
                            to={perspectiveWriteHref}
                            preload="intent"
                            viewTransition
                            aria-label="Open write view for this perspective"
                            title="Open write view for this perspective"
                            className="absolute inset-0 z-10 cursor-pointer rounded-[10px] no-underline"
                          >
                            <span className="sr-only">
                              Open write view for this perspective
                            </span>
                          </Link>
                          <Link
                            to={perspectiveWriteHref}
                            preload="intent"
                            viewTransition
                            aria-label="Open write view for this perspective"
                            title="Open write view for this perspective"
                            className="unstyled-link absolute right-2 top-2 z-20 inline-flex h-6 w-6 items-center justify-center border-0 bg-transparent text-xs text-white/0 opacity-0 transition duration-150 hover:text-white/85 hover:opacity-100 focus:text-white/85 focus:opacity-100 group-hover:text-white/85 group-hover:opacity-100 group-focus-within:text-white/85 group-focus-within:opacity-100"
                          >
                            🖋️
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div
          id={NEW_PERSPECTIVE_HASH}
          data-background-id={NEW_PERSPECTIVE_HASH}
          ref={newPerspectivePanelRef}

          className="relative flex h-full min-w-[80vw] snap-center overflow-hidden p-4"
        >
          <div className="relative z-10 flex h-full w-full overflow-y-auto scrollbar-transparent">
            <div className="flex min-h-full w-full flex-col justify-center py-4">
              <div className="relative flex w-full min-h-25 items-center justify-center">
                {showNewPerspectivePlaceholder ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex items-center justify-center text-6xl leading-none text-white/35"
                  >
                    ⊕
                  </span>
                ) : null}
                <div
                  role="textbox"
                  tabIndex={0}
                  contentEditable
                  suppressContentEditableWarning
                  aria-label="New perspective"
                  aria-placeholder="⊕"
                  ref={newPerspectiveRef}
                  onInput={(e) => {
                    const text = readEditableText(e.currentTarget);
                    setPerspectiveText(text);
                    setCharacters(text.length);
                  }}
                  onFocus={(e) => {
                    setFocus(true);
                    if (perspectiveId) {
                      setPerspectiveId(null);
                      confirmDeletePerspective.reset();
                      setPerspectiveText("");
                      setImageSrc("");
                      setCharacters(0);
                      e.currentTarget.textContent = "";
                    }
                  }}
                  onBlur={(e) => {
                    setFocus(false);
                    const text = readEditableText(e.currentTarget);
                    setPerspectiveText(text);
                    setCharacters(text.length);
                  }}
                  className="
                    sw-perspective-text
                    whitespace-pre-wrap
                    cursor-text ui-focus-ring ui-editor-ring
                    p-2 rounded
                    w-full text-left min-h-25
                    text-shadow-2xs text-shadow-neutral-200/20
                    has-[blockquote]:border-l-2
                    has-[blockquote]:border-purple-700
                    has-[blockquote]:pl-2
                    leading-relaxed
                  "
                  dir="ltr"
                  style={{ direction: "ltr" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center w-4/5 py-2 mx-auto shrink-0">
        <div className="flex flex-col items-center w-full mb-2">
          <div className="flex w-full h-full">
            <div className="flex flex-col h-full">
              {perspectiveId ? (
                <button
                  type="button"
                  onClick={confirmDeletePerspective.trigger}
                  disabled={isMutationBusy}
                  className={confirmDeletePerspective.armed ? "text-xs" : "text-sm"}
                  aria-label={
                    confirmDeletePerspective.armed
                      ? "Tap again to delete perspective"
                      : "Tap to arm delete perspective"
                  }
                  title={
                    confirmDeletePerspective.armed
                      ? "Tap again to delete perspective"
                      : "Tap to arm delete perspective"
                  }
                >
                  {confirmDeletePerspective.armed ? "🗑️×1" : "🗑️×2"}
                </button>
              ) : null}
            </div>
            <div className="flex w-full h-full ml-1 grow md:w-10/12">
              <div className="w-4 h-4 ml-2">
                {focus && characters > MAX_LENGTH / 4 && (
                  <span className="text-xs text-shadow-2xs text-shadow-neutral-200/20">
                    {characters}/{MAX_LENGTH}
                  </span>
                )}
              </div>
            </div>
          </div>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              void handleImageFileChange(event);
            }}
          />
          <div className="flex items-center justify-center mt-1 gap-2">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isMutationBusy || isImageUploading}
              aria-label={imageSrc ? "Replace background image" : "Add background image"}
              title={imageSrc ? "Replace background image" : "Add background image"}
              className="inline-flex h-9 w-9 items-center justify-center border-0 bg-transparent p-0 text-lg text-white/75 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              {isImageUploading ? "…" : "▧"}
            </button>
            {imageSrc ? (
              <button
                type="button"
                onClick={() => {
                  setImageSrc("");
                  setImageUploadError("");
                  setImageUploadStatus("idle");
                }}
                disabled={isMutationBusy || isImageUploading}
                aria-label="Remove background image"
                title="Remove background image"
                className="inline-flex h-9 w-9 items-center justify-center border-0 bg-transparent p-0 text-lg text-white/55 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                ×
              </button>
            ) : null}
            <button
              tabIndex={0}
              type="button"
              onClick={() => {
                void submitWithFeedback();
              }}
              disabled={isSubmitDisabled}
              title={submitDisabledReason}
              data-testid="submit"
              className="inline-flex items-center justify-center p-2 border-0 outline-none dark:bg-slate-300/10 focus:dark:bg-slate-300/10 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {btnText}
            </button>
          </div>
          {submitError ? (
            <div className="mt-1 text-xs text-red-300" role="alert">
              {submitError}
            </div>
          ) : null}
          {imageUploadError ? (
            <div className="mt-1 text-xs text-red-300" role="alert">
              {imageUploadError}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
