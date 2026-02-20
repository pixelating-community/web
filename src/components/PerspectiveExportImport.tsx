"use client";

import { useRef } from "react";
import type { Perspective, WordTimingEntry } from "@/types/perspectives";

type PerspectiveExportData = {
  id: string;
  perspective: string;
  audio_src?: string;
  recording_src?: string;
  timings: WordTimingEntry[];
  start_time?: number;
  end_time?: number;
};

type PerspectiveExportImportProps = {
  perspective: Perspective;
  timings: WordTimingEntry[];
  actionToken?: string;
  topicId: string;
  onImported?: () => void;
};

export const PerspectiveExportImport = ({
  perspective,
  timings,
  actionToken,
  topicId,
  onImported,
}: PerspectiveExportImportProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExport = () => {
    const data: PerspectiveExportData = {
      id: perspective.id,
      perspective: perspective.perspective,
      audio_src: perspective.audio_src,
      recording_src: perspective.recording_src,
      timings,
      start_time: perspective.start_time,
      end_time: perspective.end_time,
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `perspective-${perspective.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    if (!actionToken) return;
    const text = await file.text();
    const data = JSON.parse(text) as PerspectiveExportData;
    const body: Record<string, unknown> = {
      actionToken,
      perspectiveId: perspective.id,
      topicId,
      timings: data.timings,
    };
    if (data.audio_src) {
      if (data.audio_src.startsWith("http")) {
        body.audioUrl = data.audio_src;
      } else {
        body.audioKey = data.audio_src;
      }
    }
    const response = await fetch(`/api/p/${perspective.id}/align`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      onImported?.();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleImport(file);
    e.target.value = "";
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleExport}
        className="px-2 py-1 text-[10px] border-0 rounded-md bg-white/10 text-white/70 touch-manipulation hover:bg-white/20"
        title="Export perspective JSON"
      >
        Export
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={!actionToken}
        className="px-2 py-1 text-[10px] border-0 rounded-md bg-white/10 text-white/70 touch-manipulation hover:bg-white/20 disabled:opacity-40"
        title="Import perspective JSON"
      >
        Import
      </button>
    </div>
  );
};
