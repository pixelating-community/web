"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { Audio } from "@/components/Audio";
import { MidiConfig } from "@/components/MidiConfig";
import { DEFAULT_MIDI_CONFIG, SymbolGrid } from "@/components/SymbolGrid";
import { SymbolList } from "@/components/SymbolList";
import { Video } from "@/components/Video";
import { findSymbol } from "@/lib/findSymbol";
import type { Cue, MidiConfig as MidiConfigType } from "@/types/symbol";

type CCValues = {
  rotation: number;
  fontSize: number;
  opacity: number;
  scale: number;
};

type SymbolTrackProps = {
  symbols?: Cue[];
  audioSrc?: string;
  studio?: boolean;
  startTime?: number;
  endTime?: number;
  font?: string;
  mini?: boolean;
  loop?: boolean;
  onSaveSymbols?: (symbols: Cue[]) => Promise<void>;
  configKey?: string;
};

const groupByTrack = (symbols: Cue[]): Cue[][] => {
  const trackMap = new Map<number, Cue[]>();
  for (const s of symbols) {
    const track = s.track ?? 0;
    if (!trackMap.has(track)) trackMap.set(track, []);
    trackMap.get(track)?.push(s);
  }
  for (const track of trackMap.values()) {
    track.sort((a, b) => a.timestamp - b.timestamp);
  }
  const maxTrack = Math.max(...trackMap.keys(), 0);
  const result: Cue[][] = [];
  for (let i = 0; i <= maxTrack; i++) {
    result.push(trackMap.get(i) || []);
  }
  return result.length ? result : [[]];
};

export const SymbolTrack = ({
  symbols = [],
  audioSrc: initialAudioSrc,
  studio,
  startTime,
  endTime,
  font,
  loop = true,
  onSaveSymbols,
  configKey = "midi-config",
}: SymbolTrackProps) => {
  const trackShellClass = "w-full px-4 sm:px-6";
  const stackGapClass = studio ? "gap-6" : "gap-4";
  const stackPaddingClass = studio ? "" : "pt-6 pb-4";
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPending, startTransition] = useTransition();

  const audioSrc = initialAudioSrc || "";

  const [sessionCues, setSessionCues] = useState<Cue[]>([]);

  const [optimisticSymbols, addOptimisticSymbol] = useOptimistic(
    symbols,
    (state, newCue: Cue) => {
      if (newCue.id && state.some((cue) => cue.id === newCue.id)) {
        return state;
      }
      return [...state, newCue];
    },
  );

  const [midiConfig, setMidiConfig] =
    useState<MidiConfigType>(DEFAULT_MIDI_CONFIG);
  const [showMidiConfig, setShowMidiConfig] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [trackTiming, setTrackTiming] = useState<
    { index: number; duration: number }[]
  >([]);
  const trackTimingRef = useRef<{ index: number; duration: number }[]>([]);

  const [ccValues, setCCValues] = useState<CCValues>({
    rotation: 0,
    fontSize: 48,
    opacity: 1,
    scale: 1,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(configKey);
      if (saved) {
        setMidiConfig(JSON.parse(saved));
      }
    } catch {}
  }, [configKey]);

  const handleConfigChange = useCallback(
    (newConfig: MidiConfigType) => {
      setMidiConfig(newConfig);
      try {
        localStorage.setItem(configKey, JSON.stringify(newConfig));
      } catch {}
    },
    [configKey],
  );

  const tracks = useMemo(
    () => groupByTrack(optimisticSymbols),
    [optimisticSymbols],
  );
  const displayedTracks = useMemo(() => {
    const indexed = tracks.map((track, index) => ({ track, index }));
    if (studio) return indexed;
    const nonEmpty = indexed.filter(({ track }) => track.length > 0);
    return nonEmpty.length > 0 ? nonEmpty : indexed;
  }, [tracks, studio]);

  const allRecordings = useMemo(
    () => [...optimisticSymbols].sort((a, b) => a.timestamp - b.timestamp),
    [optimisticSymbols],
  );

  const currentVideoUrl = useMemo(() => {
    for (const track of tracks) {
      for (let i = 0; i < track.length; i++) {
        const symbol = track[i];
        if (
          symbol.url?.endsWith(".webm") &&
          symbol.timestamp <= currentTime &&
          (i === track.length - 1 || track[i + 1].timestamp > currentTime)
        ) {
          return symbol.url;
        }
      }
    }
    return null;
  }, [tracks, currentTime]);

  const updateTrackTiming = useCallback(
    (time: number) => {
      const nextTiming = tracks.map((track, i) => {
        const index = findSymbol(track, time);
        const prev = trackTimingRef.current[i];
        if (prev && prev.index === index) {
          return prev;
        }
        const nextTime =
          index >= 0 && index + 1 < track.length
            ? track[index + 1].timestamp
            : null;
        const duration = nextTime ? Math.max(nextTime - time, 0.05) : 0;
        return { index, duration };
      });

      const changed =
        nextTiming.length !== trackTimingRef.current.length ||
        nextTiming.some(
          (entry, i) => entry.index !== trackTimingRef.current[i]?.index,
        );
      if (changed) {
        trackTimingRef.current = nextTiming;
        setTrackTiming(nextTiming);
      }
    },
    [tracks],
  );

  const handleTimeUpdate = useCallback(
    (time: number) => {
      setCurrentTime(time);
      updateTrackTiming(time);
    },
    [updateTrackTiming],
  );

  useEffect(() => {
    updateTrackTiming(currentTime);
  }, [currentTime, updateTrackTiming]);

  useEffect(() => {
    if (!isPlaying || !audioRef.current) return;
    let rafId: number | null = null;
    const tick = () => {
      if (!audioRef.current) return;
      updateTrackTiming(audioRef.current.currentTime);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isPlaying, updateTrackTiming]);

  const handleRecord = useCallback(
    (cue: Cue) => {
      if (!isRecording) return;
      startTransition(() => {
        addOptimisticSymbol(cue);
      });

      setSessionCues((prev) => [...prev, cue]);
    },
    [isRecording, addOptimisticSymbol],
  );

  const handleSymbolClick = useCallback((cue: Cue) => {
    if (audioRef.current && cue.timestamp !== undefined) {
      audioRef.current.currentTime = cue.timestamp;
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording && sessionCues.length > 0 && onSaveSymbols) {
      startTransition(async () => {
        await onSaveSymbols(sessionCues);
        setSessionCues([]);
      });
    }
    setIsRecording((prev) => !prev);
  }, [isRecording, sessionCues, onSaveSymbols]);

  const ccStyle = useMemo(
    () => ({
      transform: `rotate(${ccValues.rotation}deg) scale(${ccValues.scale})`,
      fontSize: `${ccValues.fontSize / 16}rem`,
      opacity: ccValues.opacity,
    }),
    [ccValues],
  );
  const canRecord = Boolean(audioSrc);

  return (
    <div
      className={`flex flex-col items-center ${stackGapClass} ${stackPaddingClass} w-full`}
    >
      <Video url={currentVideoUrl} />

      <div className={trackShellClass}>
        <div className="w-full" style={ccStyle}>
          {displayedTracks.map(({ track, index }) => (
            <SymbolList
              key={index}
              symbols={track}
              currentIndex={trackTiming[index]?.index ?? -1}
              timeUntilNext={trackTiming[index]?.duration ?? 0}
              onClick={handleSymbolClick}
              font={font}
              follow={isPlaying}
            />
          ))}
        </div>
      </div>

      {studio && (
        <div className="flex flex-col items-center w-full max-w-2xl px-4 gap-4">
          <button
            type="button"
            onClick={toggleRecording}
            disabled={!canRecord}
            className={`px-6 py-3 text-2xl font-bold border-0 bg-transparent rounded-none transition-all ${
              !canRecord
                ? "text-gray-500 cursor-not-allowed"
                : isRecording
                  ? "text-red-500 animate-pulse"
                  : "text-red-500 hover:text-red-400"
            }`}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
          >
            <span
              className={`inline-block h-5 w-5 sm:h-6 sm:w-6 ${
                canRecord ? "bg-red-500" : "bg-gray-500"
              } ${isRecording ? "rounded-none" : "rounded-full"}`}
            />
          </button>

          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="px-4 py-2 text-2xl text-white bg-transparent border-0 rounded-none"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? "▼" : "▲"}
          </button>

          <div className={collapsed ? "hidden" : ""}>
            <button
              type="button"
              onClick={() => setShowMidiConfig(true)}
              className="px-4 py-2 mb-4 text-2xl text-white bg-transparent border-0 rounded-none hover:text-gray-200"
              title="Config"
            >
              🎹
            </button>
          </div>

          <div className={collapsed ? "sr-only" : ""}>
            <SymbolGrid
              audioRef={audioRef}
              onRecordAction={handleRecord}
              recordings={allRecordings}
              isRecording={isRecording}
              config={midiConfig}
              onCCChangeAction={setCCValues}
            />
          </div>

          {!collapsed && (
            <>
              {(ccValues.rotation !== 0 ||
                ccValues.scale !== 1 ||
                ccValues.opacity !== 1) && (
                <div className="flex text-xs text-gray-400 gap-4">
                  {ccValues.rotation !== 0 && (
                    <span>↻ {Math.round(ccValues.rotation)}°</span>
                  )}
                  {ccValues.scale !== 1 && (
                    <span>⬡ {ccValues.scale.toFixed(2)}x</span>
                  )}
                  {ccValues.opacity !== 1 && (
                    <span>◐ {Math.round(ccValues.opacity * 100)}%</span>
                  )}
                </div>
              )}

              {isPending && (
                <div className="text-sm text-gray-400">Saving batch...</div>
              )}
            </>
          )}
        </div>
      )}

      {audioSrc && (
        <div className={trackShellClass}>
          <Audio
            ref={audioRef}
            src={audioSrc}
            startTime={startTime}
            endTime={endTime}
            studio={studio}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            loop={loop}
            onTimeUpdate={handleTimeUpdate}
          />
        </div>
      )}

      {/* MIDI Config Modal */}
      {showMidiConfig && (
        <MidiConfig
          config={midiConfig}
          onChange={handleConfigChange}
          onClose={() => setShowMidiConfig(false)}
        />
      )}
    </div>
  );
};
