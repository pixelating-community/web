"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { editPerspective } from "@/actions/editPerspective";
import { Audio } from "@/components/Audio";
import { Collect } from "@/components/Collect";
import { Token } from "@/components/Token";
import type { Perspective, WritePerspectiveProps } from "@/types/perspectives";

type PerspectiveReadingsProps = WritePerspectiveProps;

type PerspectiveAudioProps = {
  src: string;
  startTime?: number;
  endTime?: number;
};

const PerspectiveAudio = ({
  src,
  startTime,
  endTime,
}: PerspectiveAudioProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <Audio
      ref={audioRef}
      src={src}
      startTime={startTime}
      endTime={endTime}
      isPlaying={isPlaying}
      setIsPlaying={setIsPlaying}
      loop={false}
    />
  );
};

export function PerspectiveReadings({
  id,
  name,
  perspectives,
  token,
  forward,
  link,
}: PerspectiveReadingsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState("");
  const [audioOverrides, setAudioOverrides] = useState<
    Record<string, string | null>
  >({});
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const perspectivesEndRef = useRef<HTMLDivElement | null>(null);
  const perspectivesForwardEndRef = useRef<HTMLDivElement | null>(null);

  const selectedPerspective = useMemo(
    () => perspectives.find((p) => p.id === selectedId) ?? null,
    [perspectives, selectedId],
  );

  useEffect(() => {
    if (!selectedPerspective) return;
    const override = audioOverrides[selectedPerspective.id];
    const nextAudio = override ?? selectedPerspective.audio_src ?? "";
    setAudioSrc(nextAudio ?? "");
  }, [selectedPerspective, audioOverrides]);

  useEffect(() => {
    if (!forward) {
      setTimeout(() => {
        requestAnimationFrame(() => {
          if (perspectivesEndRef.current) {
            perspectivesEndRef.current.scrollLeft = 0;
          }
        });
      }, 300);
    } else if (forward && perspectivesForwardEndRef.current) {
      setTimeout(() => {
        perspectivesForwardEndRef.current?.scrollIntoView({
          block: "end",
        });
      }, 300);
    }
  }, [forward]);

  useEffect(() => {
    return () => {
      if (previewSrc) URL.revokeObjectURL(previewSrc);
    };
  }, [previewSrc]);

  const handlePerspectiveClick = (p: Perspective) => {
    setSelectedId(p.id);
  };

  const handlePerspectiveKeyDown = (e: React.KeyboardEvent, p: Perspective) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handlePerspectiveClick(p);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (previewSrc) URL.revokeObjectURL(previewSrc);
    const objectUrl = URL.createObjectURL(file);
    setPreviewSrc(objectUrl);
    setAudioSrc(`/${file.name}`);
  };

  const handleClear = () => {
    setAudioSrc("");
    if (previewSrc) URL.revokeObjectURL(previewSrc);
    setPreviewSrc(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async () => {
    if (!selectedPerspective || !token) return;
    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.set("perspective", selectedPerspective.perspective);
      formData.set("token", token);
      formData.set("audio_src", audioSrc.trim());

      await editPerspective({
        id: selectedPerspective.id,
        name,
        formData,
      });

      setAudioOverrides((prev) => ({
        ...prev,
        [selectedPerspective.id]: audioSrc.trim() || null,
      }));
      if (previewSrc) URL.revokeObjectURL(previewSrc);
      setPreviewSrc(null);
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = Boolean(selectedPerspective && token && !isSaving);

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden">
      {!token && (
        <Token
          name={name}
          topicId={id}
          perspectiveId={selectedId ?? undefined}
        />
      )}
      <div
        ref={perspectivesEndRef}
        className="flex w-screen overflow-x-auto overflow-y-hidden snap-x snap-mandatory grow scrollbar-transparent touch-pan-x"
      >
        {perspectives.map((p, index) => {
          const override = audioOverrides[p.id];
          const effectiveAudio = override ?? p.audio_src ?? "";
          const audioToUse =
            selectedId === p.id && previewSrc ? previewSrc : effectiveAudio;
          const isSelected = selectedId === p.id;

          return (
            <div
              key={`${index}_${p.id}`}
              id={p.id}
              ref={
                index === perspectives.length - 1
                  ? perspectivesForwardEndRef
                  : null
              }
              className="flex justify-center min-w-[80vw] snap-center p-4"
            >
              <div className="flex flex-col justify-center w-full items-center">
                {p.collection_id && (
                  <div className="flex w-full">
                    <Collect
                      collectionId={p.collection_id}
                      perspectiveId={p.id}
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handlePerspectiveClick(p)}
                  onKeyDown={(e) => handlePerspectiveKeyDown(e, p)}
                  className={`
                    flex flex-col justify-center
                    whitespace-pre-line
                    has-[blockquote]:border-l-2
                    has-[blockquote]:border-purple-700
                    has-[blockquote]:pl-2
                    text-shadow-2xs text-shadow-neutral-200/20
                    cursor-pointer w-full text-left
                    border-0 bg-transparent p-2
                    ${isSelected ? "ring-2 ring-purple-500/30" : ""}
                  `}
                  aria-pressed={isSelected}
                >
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {p.perspective}
                  </Markdown>
                </button>

                <div className="w-full mt-4">
                  {audioToUse ? (
                    <PerspectiveAudio
                      src={audioToUse}
                      startTime={p.start_time ?? undefined}
                      endTime={p.end_time ?? undefined}
                    />
                  ) : (
                    <div className="text-xs text-gray-400 text-center">
                      No recording
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {link && (
          <div className="flex justify-center min-w-[80vw] snap-center p-4">
            <div className="flex flex-col justify-center w-full">
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
      </div>

      <div className="flex flex-col items-center w-4/5 mx-auto py-2 shrink-0">
        <div className="flex flex-col items-center w-full gap-2">
          <div className="flex w-full items-center gap-2">
            <input
              type="text"
              value={audioSrc}
              onChange={(e) => setAudioSrc(e.target.value)}
              placeholder="Audio URL (.m4a)"
              disabled={!selectedPerspective}
              className="p-2 border-0 dark:bg-slate-800/10 w-full text-black"
              aria-label="Audio URL"
            />
            <label
              htmlFor="audio-file"
              className={`p-2 ${
                selectedPerspective ? "cursor-pointer" : "cursor-not-allowed"
              }`}
              title="Attach .m4a from /public"
            >
              📎
            </label>
            <input
              ref={fileRef}
              id="audio-file"
              type="file"
              accept=".m4a,audio/*"
              onChange={handleFileChange}
              disabled={!selectedPerspective}
              className="hidden"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="inline-flex items-center justify-center p-2 border-0 bg-transparent disabled:opacity-30 disabled:cursor-not-allowed"
              title="Save recording"
            >
              💾
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={!selectedPerspective}
              className="inline-flex items-center justify-center p-2 border-0 bg-transparent disabled:opacity-30 disabled:cursor-not-allowed"
              title="Clear recording"
            >
              ⟲
            </button>
          </div>

          {isSaving && <div className="text-xs text-gray-400">Saving...</div>}
          {!selectedPerspective && (
            <div className="text-xs text-gray-400">
              Select a perspective to attach audio.
            </div>
          )}
          {selectedPerspective && !token && (
            <div className="text-xs text-gray-400">
              Enter the token to save audio.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
