"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { addPerspective } from "@/actions/addPerspective";
import { deletePerspective } from "@/actions/deletePerspective";
import { editPerspective } from "@/actions/editPerspective";
import { Collect } from "@/components/Collect";
import { PerspectiveModeNav } from "@/components/PerspectiveModeNav";
import { hasPlayableAudioSource } from "@/components/sw/runtime";
import { useConfirmAction } from "@/components/sw/useConfirmAction";
import { PerspectiveMarkup } from "@/components/PerspectiveMarkup";
import {
  NEW_PERSPECTIVE_HASH,
  buildTopicPath,
  buildTopicWritePerspectivePath,
  buildTopicUnlockHref,
} from "@/lib/topicRoutes";
import type { Perspective, WritePerspectiveProps } from "@/types/perspectives";
import type { TopicPayload } from "@/types/topic";

type PerspectiveUpdate = {
  id: string;
  perspective: string;
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
  previousPayload?: TopicPayload;
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
      rendered_html: undefined,
    };
  });

export function WritePerspective({
  id,
  name,
  topicEmoji,
  perspectives,
  forward,
  link,
  initialPerspectiveId,
  queryKey,
  onRefresh,
}: WritePerspectiveProps) {
  const MAX_LENGTH = 555;
  const btnText = "🖋️";
  const queryClient = useQueryClient();
  const router = useRouter();
  const [focus, setFocus] = useState(false);
  const [perspectiveId, setPerspectiveId] = useState<string | null>(null);
  const [characters, setCharacters] = useState(0);
  const [perspectiveText, setPerspectiveText] = useState("");
  const [submitError, setSubmitError] = useState("");
  const perspectivesEndRef = useRef<HTMLDivElement | null>(null);
  const perspectivesForwardEndRef = useRef<HTMLDivElement | null>(null);
  const newPerspectivePanelRef = useRef<HTMLDivElement | null>(null);
  const newPerspectiveRef = useRef<HTMLDivElement | null>(null);
  const selectedEditorRef = useRef<HTMLDivElement | null>(null);
  const hashScrollTargetRef = useRef<string | null>(null);
  const initializedPerspectiveRef = useRef(false);
  const pendingEditorHydrationRef = useRef<{
    perspectiveId: string;
    placeCaret: boolean;
  } | null>(null);
  const isEditingPerspective = perspectiveId !== null;

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

  const replaceTopicPayload = (nextPayload?: TopicPayload) => {
    if (!queryKey || !nextPayload) return;
    queryClient.setQueryData(queryKey, nextPayload);
  };

  const patchTopicPayload = (
    updater: (items: Perspective[]) => Perspective[],
  ): TopicPayload | undefined => {
    if (!queryKey) return undefined;
    const previousPayload = queryClient.getQueryData<TopicPayload>(queryKey);
    queryClient.setQueryData<TopicPayload>(queryKey, (current) => {
      if (!current) return current;
      return {
        ...current,
        perspectives: updater(current.perspectives),
      };
    });
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
    mutationFn: ({ perspectiveId, formData }) =>
      editPerspective({
        id: perspectiveId,
        name,
        formData,
      }),
    onMutate: ({ optimisticUpdate }) => {
      const previousPayload = patchTopicPayload((items) =>
        applyPerspectiveUpdate(items, optimisticUpdate),
      );
      return { previousPayload };
    },
    onError: (_error, _variables, context) => {
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
    mutationFn: ({ perspectiveId }) => deletePerspective({ perspectiveId }),
    onMutate: ({ perspectiveId }) => {
      const previousPayload = patchTopicPayload((items) =>
        items.filter((item) => item.id !== perspectiveId),
      );
      return { previousPayload };
    },
    onError: (_error, _variables, context) => {
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
    mutationFn: ({ formData }) =>
      addPerspective({ topicId: id, name, formData }),
    onMutate: ({ optimisticPerspective }) => {
      const previousPayload = patchTopicPayload((items) =>
        !forward
          ? [optimisticPerspective, ...items]
          : [...items, optimisticPerspective],
      );
      return { previousPayload };
    },
    onError: (_error, _variables, context) => {
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

    if (perspectiveId) {
      const optimisticUpdate: PerspectiveUpdate = {
        id: perspectiveId,
        perspective: perspectiveText.trim(),
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
        perspective: perspectiveText.trim(),
        topic_id: id as Perspective["topic_id"],
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
          startTransition: true,
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

  useEffect(() => {
    if (initializedPerspectiveRef.current) return;
    const targetId = initialPerspectiveId?.trim();
    if (!targetId) return;
    const targetPerspective = perspectives.find(
      (perspective) => perspective.id === targetId,
    );
    if (!targetPerspective) return;
    initializedPerspectiveRef.current = true;
    setPerspectiveId(targetPerspective.id);
    setPerspectiveText(targetPerspective.perspective);
    setCharacters(targetPerspective.perspective.length);
    pendingEditorHydrationRef.current = {
      perspectiveId: targetPerspective.id,
      placeCaret: false,
    };
    requestAnimationFrame(() => {
      const target = document.getElementById(targetPerspective.id);
      target?.scrollIntoView({
        block: "nearest",
        inline: "center",
        behavior: "auto",
      });
    });
  }, [initialPerspectiveId, perspectives]);

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
  const trimmedTopicName = name.trim();
  const topicNavLabel = trimmedTopicEmoji || trimmedTopicName || "↩";
  const topicNavIsEmoji = Boolean(trimmedTopicEmoji);
  const isSubmitDisabled = !hasPerspectiveText || isMutationBusy;
  const showNewPerspectivePlaceholder =
    !isEditingPerspective && !focus && !hasPerspectiveText;
  const submitDisabledReason = !hasPerspectiveText
    ? "Enter perspective text first."
    : isMutationBusy
      ? "Saving..."
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
      <Link
        to={buildTopicPath(name)}
        preload="intent"
        startTransition
        className={`absolute top-3 left-3 z-30 inline-flex h-10 items-center justify-center border border-white/20 bg-black/30 text-white/90 no-underline backdrop-blur transition hover:border-white/40 hover:text-white ${
          topicNavIsEmoji
            ? "w-10 rounded-full text-lg"
            : "max-w-[70vw] rounded-xl px-3 text-sm font-medium"
        }`}
        aria-label="Back to topic"
        title="Back to topic"
      >
        <span className={topicNavIsEmoji ? "" : "truncate"}>{topicNavLabel}</span>
      </Link>
      {selectedPerspective ? (
        <PerspectiveModeNav
          canWrite={true}
          currentMode="write"
          perspectiveId={selectedPerspective.id}
          showViewMode={false}
          topicName={name}
        />
      ) : null}
      <div
        ref={perspectivesEndRef}
        className={`flex w-screen overflow-x-auto [scrollbar-gutter:stable] ${
          isEditingPerspective ? "overflow-y-auto" : "overflow-y-hidden"
        } snap-x snap-mandatory grow scrollbar-transparent touch-pan-x`}
      >
        {perspectives.map((p, index) => {
          const perspectivePlaybackHref = hasPlayableAudioSource(p.audio_src)
            ? `/p/${p.id}`
            : "";
          const perspectiveWriteHref = buildTopicWritePerspectivePath({
            topicName: name,
            perspectiveId: p.id,
          });

          return (
            <div
              key={`${index}_${p.id}`}
              id={p.id}
              ref={
                index === perspectives.length - 1
                  ? perspectivesForwardEndRef
                  : null
              }
              className="flex min-w-[80vw] snap-center p-4 h-full items-center justify-center"
            >
              <div className="flex flex-col items-center justify-center w-full h-full">
                {p.collection_id && (
                  <div className="flex w-full">
                    <Collect
                      collectionId={p.collection_id}
                      perspectiveId={p.id}
                    />
                  </div>
                )}

                <div data-id={p.id} className="flex w-full items-center">
                  <div className="flex w-10 shrink-0 items-center justify-center self-stretch">
                    {perspectivePlaybackHref ? (
                      <Link
                        to={perspectivePlaybackHref}
                        preload="intent"
                        startTransition
                        className="inline-flex h-8 w-8 touch-manipulation items-center justify-center rounded-[10px] border border-transparent bg-transparent p-0 text-[1.15rem] leading-none text-(--color-neon-teal) no-underline decoration-transparent hover:no-underline hover:decoration-transparent focus:no-underline focus:decoration-transparent transition-[color,transform,width,height] duration-150"
                        style={{ textDecoration: "none" }}
                        title="Open playback for this perspective"
                        aria-label="Open playback for this perspective"
                      >
                        ▶
                      </Link>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    {perspectiveId === p.id ? (
                      // Intentional contentEditable rich-text surface requires ARIA textbox semantics.
                      <div
                        key={`editor-${p.id}`}
                        ref={(node) => {
                          if (perspectiveId === p.id) {
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
                      flex flex-col justify-center
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
                        flex w-full flex-col justify-center
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
                          startTransition
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
                          startTransition
                          aria-label="Open write view for this perspective"
                          title="Open write view for this perspective"
                          className="absolute right-2 top-2 z-20 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-black/20 text-xs text-white/0 no-underline opacity-0 transition duration-150 hover:text-white/85 hover:opacity-100 focus:text-white/85 focus:opacity-100 group-hover:text-white/85 group-hover:opacity-100 group-focus-within:text-white/85 group-focus-within:opacity-100"
                        >
                          ✏️
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {link && (
          <div className="flex items-center justify-center min-w-[80vw] snap-center p-4 h-full">
            <div className="flex flex-col justify-center w-full h-full">
              <div className="relative mx-auto">
                <img
                  src={link}
                  alt="QR code"
                  className="max-w-full max-h-full"
                />
              </div>
            </div>
          </div>
        )}

        <div
          id={NEW_PERSPECTIVE_HASH}
          ref={newPerspectivePanelRef}
          className="flex items-center justify-center min-w-[80vw] snap-center p-4 h-full"
        >
          <div className="flex flex-col items-center justify-center w-full h-full">
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

      <div className="flex flex-col items-center w-4/5 py-2 mx-auto shrink-0">
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

          <div className="flex items-center justify-center mt-1 gap-2">
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
        </div>
      </div>
    </div>
  );
}
