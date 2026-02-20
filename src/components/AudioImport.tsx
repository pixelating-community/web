"use client";

import { useEffect, useRef, useState } from "react";
import { resolvePublicAudioSrc } from "@/lib/publicAudioBase";

type AvailableTrack = {
  id: string;
  label: string;
  r2Key: string;
};

type AudioImportProps = {
  actionToken: string;
  topicId: string;
  perspectiveId: string;
  availableTracks?: AvailableTrack[];
  currentAudioSrc?: string;
  onImported?: () => Promise<unknown> | unknown;
  onDeleted?: () => Promise<unknown> | unknown;
};

type Step = "idle" | "converting" | "uploading" | "done" | "error";

const STEP_LABEL: Record<Step, string> = {
  idle: "",
  converting: "Converting",
  uploading: "Uploading",
  done: "",
  error: "",
};

const STEP_PROGRESS: Record<Step, number> = {
  idle: 0,
  converting: 0.4,
  uploading: 0.8,
  done: 1,
  error: 0,
};

const ACCEPTED_AUDIO_TYPES = "audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.opus,.wma,.webm";

export const AudioImport = ({
  actionToken,
  topicId,
  perspectiveId,
  availableTracks,
  currentAudioSrc,
  onImported,
  onDeleted,
}: AudioImportProps) => {
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  const [audioSrc, setAudioSrc] = useState("");
  const [fileName, setFileName] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const busyRef = useRef(false);

  const hasMusic = Boolean(audioSrc || currentAudioSrc);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
    } else {
      void el.play();
    }
  };

  const uploadFile = async (file: File) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setStep("converting");
    setError("");
    setAudioSrc("");
    setIsPlaying(false);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("actionToken", actionToken);
      formData.append("topicId", topicId);
      formData.append("perspectiveId", perspectiveId);
      formData.append("file", file);

      const response = await fetch("/api/obj/yt", {
        method: "POST",
        body: formData,
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        setStep("error");
        setError((data as { error?: string })?.error || "Import failed");
        return;
      }

      await readSSE(response.body);
    } catch {
      setStep("error");
      setError("Import failed");
    } finally {
      busyRef.current = false;
    }
  };

  const assignR2Key = async (r2Key: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setStep("uploading");
    setError("");
    setAudioSrc("");
    setIsPlaying(false);
    setFileName("");

    try {
      const response = await fetch("/api/obj/yt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionToken, topicId, perspectiveId, r2Key }),
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        setStep("error");
        setError((data as { error?: string })?.error || "Import failed");
        return;
      }

      await readSSE(response.body);
    } catch {
      setStep("error");
      setError("Import failed");
    } finally {
      busyRef.current = false;
    }
  };

  const readSSE = async (body: ReadableStream<Uint8Array>) => {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalError = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";

      for (const block of lines) {
        const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
        if (!dataLine) continue;
        const payload = JSON.parse(dataLine.slice(6)) as {
          step?: string;
          error?: string;
          r2Key?: string;
        };

        if (payload.step === "error") {
          finalError = payload.error || "Import failed";
        } else if (payload.step === "done" && payload.r2Key) {
          setStep("done");
          setFileName("");
          setAudioSrc(resolvePublicAudioSrc(payload.r2Key));
          await onImported?.();
        } else if (payload.step) {
          setStep(payload.step as Step);
        }
      }
    }

    if (finalError) {
      setStep("error");
      setError(finalError);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
    e.target.value = "";
  };

  const handleDelete = async () => {
    if (isDeleting || busyRef.current) return;
    setIsDeleting(true);
    try {
      const response = await fetch("/api/obj/yt", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionToken, topicId, perspectiveId }),
      });
      if (response.ok) {
        setAudioSrc("");
        setIsPlaying(false);
        await onDeleted?.();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const selectTrack = (r2Key: string) => {
    setDropdownOpen(false);
    void assignR2Key(r2Key);
  };

  const isWorking = step === "converting" || step === "uploading";
  const progress = STEP_PROGRESS[step];
  const hasTracks = availableTracks && availableTracks.length > 0;

  return (
    <div className="w-full m-1">
      <div className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/75">
        {audioSrc ? (
          <>
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm text-white/85"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- music preview, no captions */}
            <audio
              ref={audioRef}
              src={audioSrc}
              preload="none"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
          </>
        ) : null}
        {hasTracks ? (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              disabled={isWorking}
              className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1.5 text-[11px] text-white/75 outline-none transition-colors hover:bg-white/15 disabled:opacity-50"
            >
              <span>🎼</span>
              <svg className="h-3 w-3 opacity-50" viewBox="0 0 12 12" fill="none"><path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {dropdownOpen ? (
              <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[180px] max-w-[260px] overflow-hidden rounded-lg border border-white/10 bg-black/10 shadow-lg shadow-black/20 backdrop-blur-md">
                {availableTracks.length > 0 ? (
                  <div className="max-h-[200px] overflow-y-auto py-1">
                    {availableTracks.map((track) => (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => selectTrack(track.r2Key)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-white/80 transition-colors hover:bg-purple-500/20 hover:text-white"
                      >
                        <span className="truncate">{track.label}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-2 text-[11px] text-white/40">No tracks</div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_AUDIO_TYPES}
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload audio file"
        />
        {isWorking ? (
          <span className="min-w-0 flex-1 truncate text-[11px] text-white/50">
            {STEP_LABEL[step]}{fileName ? ` ${fileName}` : ""}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isWorking}
            className="min-w-0 flex-1 rounded-lg border border-dashed border-white/15 px-3 py-2 text-left text-[11px] text-white/50 transition-colors hover:border-purple-500/40 hover:text-white/70 disabled:opacity-50"
          >
            Upload audio file
          </button>
        )}
        {hasMusic && !isWorking ? (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
            className="rounded-xl bg-red-500/25 px-2 py-2 text-[11px] text-red-100 disabled:opacity-50"
            aria-label="Remove music track"
            title="Remove music track"
          >
            ✕
          </button>
        ) : null}
      </div>
      {isWorking ? (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-purple-500/70 transition-all duration-700 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      ) : null}
      {step === "done" ? (
        <p className="pt-2 text-center text-xs text-green-400">💿 ✅</p>
      ) : null}
      {step === "error" ? (
        <p className="pt-2 text-center text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
};
