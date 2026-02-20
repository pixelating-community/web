"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  resetAudioSessionAfterRecording,
  setAudioSessionType,
} from "@/lib/audioSession";

type RecorderRenderProps = {
  isRecording: boolean;
  supported: boolean;
  mimeType: string;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  warmUp: () => void;
};

type AudioRecorderProps = {
  disabled?: boolean;
  onStart?: (info: { mimeType: string }) => void;
  onCapture: (info: { blob: Blob; mimeType: string }) => void | Promise<void>;
  onError?: (message: string) => void;
  children: (props: RecorderRenderProps) => React.ReactNode;
};

type StopReason = "user" | "devicechange" | "error";
const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg;codecs=vorbis",
  "audio/ogg",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
] as const;
type RecorderMimeType = (typeof RECORDER_MIME_CANDIDATES)[number];

const canRecordMimeType = (mimeType: RecorderMimeType) =>
  typeof MediaRecorder !== "undefined" &&
  typeof MediaRecorder.isTypeSupported === "function" &&
  MediaRecorder.isTypeSupported(mimeType);

const canPlayMimeType = (mimeType: RecorderMimeType) => {
  if (typeof Audio === "undefined") return false;
  try {
    const audio = new Audio();
    return audio.canPlayType(mimeType) !== "";
  } catch {
    return false;
  }
};

const selectRecorderMimeType = (): RecorderMimeType | null => {
  for (const mimeType of RECORDER_MIME_CANDIDATES) {
    if (canRecordMimeType(mimeType) && canPlayMimeType(mimeType)) {
      return mimeType;
    }
  }
  return null;
};

const buildRecorderSupportSummary = () =>
  RECORDER_MIME_CANDIDATES.map(
    (mimeType) =>
      `${mimeType}:record=${canRecordMimeType(mimeType) ? "yes" : "no"},play=${
        canPlayMimeType(mimeType) ? "yes" : "no"
      }`,
  ).join(" | ");

const getUnsupportedRecorderMessage = () => {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Recording requires HTTPS (secure context). Open this page on an https:// origin.";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "Microphone access is unavailable in this browser/context.";
  }
  return `No supported record+play audio format found. ${buildRecorderSupportSummary()}`;
};

const requestAudioStream = async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone not supported");
  }
  const candidates: MediaStreamConstraints[] = [
    {
      audio: {
        channelCount: { ideal: 2 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    },
    {
      audio: {
        channelCount: { ideal: 2 },
        echoCancellation: false,
      },
    },
    { audio: true },
    {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    },
  ];

  let lastError: unknown = null;
  for (const constraints of candidates) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
    }
  }
  throw (lastError instanceof Error ? lastError : new Error("Microphone not supported"));
};

const shouldBypassProcessingGraph = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  const isIosDevice =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIosDevice) return false;
  const isWebKit = /AppleWebKit/i.test(ua);
  const isAlternativeIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return isWebKit && !isAlternativeIosBrowser;
};

const createProcessedRecordingStream = async (stream: MediaStream) => {
  if (typeof window === "undefined") return { stream };
  const AudioContextCtor =
    window.AudioContext ||
    (
      window as Window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;
  if (!AudioContextCtor) return { stream };

  const context = new AudioContextCtor();
  try {
    if (context.state === "suspended") {
      await context.resume().catch(() => {});
    }

    const source = context.createMediaStreamSource(stream);
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -30;
    compressor.knee.value = 20;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    const destination = context.createMediaStreamDestination();
    source.connect(compressor);
    compressor.connect(destination);

    const processed = destination.stream;
    if (processed.getAudioTracks().length === 0) {
      await context.close().catch(() => {});
      return { stream };
    }
    return { stream: processed, context };
  } catch {
    await context.close().catch(() => {});
    return { stream };
  }
};

/**
 * Checks whether the mic stream is still alive and producing audio.
 * A dead/ended track means iOS (or the OS) killed the stream.
 */
const isStreamAlive = (stream: MediaStream | null) => {
  if (!stream) return false;
  const tracks = stream.getAudioTracks();
  return tracks.length > 0 && tracks.every((t) => t.readyState === "live");
};

export const AudioRecorder = ({
  disabled = false,
  onStart,
  onCapture,
  onError,
  children,
}: AudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [mimeType, setMimeType] = useState("");
  const [supported, setSupported] = useState(false);
  const [supportChecked, setSupportChecked] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const processingContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sessionMimeTypeRef = useRef("");
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const recordingDesiredRef = useRef(false);
  const stopReasonRef = useRef<StopReason | null>(null);
  const startingRef = useRef(false);
  const unsupportedNotifiedRef = useRef(false);
  const selectedMimeTypeRef = useRef<RecorderMimeType | null>(null);
  // Pre-warmed stream: acquired ahead of time so record-start is instant
  const warmStreamRef = useRef<MediaStream | null>(null);
  const warmProcessedRef = useRef<{
    stream: MediaStream;
    context?: AudioContext;
  } | null>(null);

  useEffect(() => {
    const secureContext =
      typeof window === "undefined" ? false : window.isSecureContext;
    const selectedMimeType = selectRecorderMimeType();
    selectedMimeTypeRef.current = selectedMimeType;
    const isSupported =
      secureContext &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      Boolean(selectedMimeType);
    setSupported(isSupported);
    setMimeType(selectedMimeType ?? "");
    setSupportChecked(true);
  }, []);

  useEffect(() => {
    if (!supportChecked) return;
    if (supported) {
      unsupportedNotifiedRef.current = false;
      return;
    }
    if (unsupportedNotifiedRef.current) return;
    unsupportedNotifiedRef.current = true;
    onError?.(getUnsupportedRecorderMessage());
  }, [onError, supportChecked, supported]);

  const releaseWarmStream = useCallback(() => {
    const warm = warmProcessedRef.current;
    warmProcessedRef.current = null;
    if (warm?.context) {
      void warm.context.close().catch(() => {});
    }
    if (warm?.stream) {
      warm.stream.getTracks().forEach((t) => t.stop());
    }
    const raw = warmStreamRef.current;
    warmStreamRef.current = null;
    if (raw) {
      raw.getTracks().forEach((t) => t.stop());
    }
  }, []);

  const releaseProcessingGraph = useCallback(() => {
    recorderStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    recorderStreamRef.current = null;
    const context = processingContextRef.current;
    processingContextRef.current = null;
    if (!context) return;
    void context.close().catch(() => {});
  }, []);

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    mediaStreamRef.current = null;
    releaseProcessingGraph();
  }, [releaseProcessingGraph]);

  const releaseWakeLock = useCallback(() => {
    const wakeLock = wakeLockRef.current;
    wakeLockRef.current = null;
    if (!wakeLock) return;
    void wakeLock.release().catch(() => {});
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (typeof document === "undefined") return;
    if (document.visibilityState !== "visible") return;
    const wakeLockApi = (
      navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
      }
    ).wakeLock;
    if (!wakeLockApi) return;
    try {
      const wakeLock = await wakeLockApi.request("screen");
      wakeLockRef.current = wakeLock;
      wakeLock.addEventListener("release", () => {
        if (wakeLockRef.current === wakeLock) {
          wakeLockRef.current = null;
        }
      });
    } catch {
      // Wake lock support varies by browser and platform.
    }
  }, []);

  const resetSession = useCallback(() => {
    chunksRef.current = [];
    sessionMimeTypeRef.current = "";
  }, []);

  const flushCapture = useCallback(
    async (fallbackMimeType?: string) => {
      if (chunksRef.current.length === 0) return false;
      const resolvedMimeType =
        sessionMimeTypeRef.current ||
        fallbackMimeType ||
        selectedMimeTypeRef.current ||
        RECORDER_MIME_CANDIDATES[0];
      const blob = new Blob(chunksRef.current, { type: resolvedMimeType });
      resetSession();
      if (blob.size === 0) return false;
      await onCapture({
        blob,
        mimeType: resolvedMimeType,
      });
      return true;
    },
    [onCapture, resetSession],
  );

  useEffect(
    () => () => {
      cleanup();
      releaseWakeLock();
      releaseWarmStream();
    },
    [cleanup, releaseWakeLock, releaseWarmStream],
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!recordingDesiredRef.current) return;
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [requestWakeLock]);

  /**
   * Pre-warm the mic stream so the next record-start is instant.
   * Call this after a recording completes or on first user interaction.
   */
  const warmUpStream = useCallback(async () => {
    if (warmStreamRef.current && isStreamAlive(warmStreamRef.current)) return;
    releaseWarmStream();
    try {
      setAudioSessionType("play-and-record");
      const stream = await requestAudioStream();
      const live = stream.getAudioTracks().filter(
        (t) => t.readyState === "live" && !t.muted,
      );
      if (live.length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      warmStreamRef.current = stream;
      if (!shouldBypassProcessingGraph()) {
        const processed = await createProcessedRecordingStream(stream);
        warmProcessedRef.current = {
          stream: processed.stream,
          context: processed.context,
        };
      }
    } catch {
      // Permission denied or unavailable — will fall back to cold start
    }
  }, [releaseWarmStream]);

  const startRecording = useCallback(
    async ({ emitStart = true } = {}) => {
      if (disabled) {
        return;
      }
      if (!supported) {
        onError?.(getUnsupportedRecorderMessage());
        return;
      }
      if (mediaRecorderRef.current?.state === "recording") {
        return;
      }
      if (startingRef.current) {
        return;
      }

      startingRef.current = true;
      try {
        const selectedMimeType =
          selectedMimeTypeRef.current ?? selectRecorderMimeType();
        if (!selectedMimeType) {
          throw new Error(getUnsupportedRecorderMessage());
        }
        selectedMimeTypeRef.current = selectedMimeType;

        // Use pre-warmed stream if available, otherwise cold-start
        let stream: MediaStream;
        let recorderInputStream: MediaStream;
        if (
          warmStreamRef.current &&
          isStreamAlive(warmStreamRef.current)
        ) {
          stream = warmStreamRef.current;
          warmStreamRef.current = null;
          const warm = warmProcessedRef.current;
          warmProcessedRef.current = null;
          if (warm) {
            recorderInputStream = warm.stream;
            if (warm.context) {
              processingContextRef.current = warm.context;
            }
            recorderStreamRef.current =
              warm.stream === stream ? null : warm.stream;
          } else {
            recorderInputStream = stream;
            recorderStreamRef.current = null;
          }
        } else {
          // Cold path — getUserMedia is the slow part
          releaseWarmStream();
          setAudioSessionType("play-and-record");
          stream = await requestAudioStream();
          if (!recordingDesiredRef.current) {
            stream.getTracks().forEach((t) => t.stop());
            setAudioSessionType("auto");
            return;
          }
          const liveTracks = stream.getAudioTracks().filter(
            (t) => t.readyState === "live" && !t.muted,
          );
          if (liveTracks.length === 0) {
            stream.getTracks().forEach((t) => t.stop());
            throw new Error("Microphone stream is not active");
          }
          recorderStreamRef.current = null;
          recorderInputStream = stream;
          if (!shouldBypassProcessingGraph()) {
            const processed = await createProcessedRecordingStream(stream);
            if (!recordingDesiredRef.current) {
              stream.getTracks().forEach((t) => t.stop());
              if (processed.context) {
                void processed.context.close().catch(() => {});
              }
              processed.stream.getTracks().forEach((t) => t.stop());
              setAudioSessionType("auto");
              return;
            }
            recorderInputStream = processed.stream;
            if (processed.context) {
              processingContextRef.current = processed.context;
            }
            recorderStreamRef.current =
              processed.stream === stream ? null : processed.stream;
          }
        }

        const recorder = new MediaRecorder(recorderInputStream, {
          mimeType: selectedMimeType,
        });
        const trackEndedHandler = () => {
          if (!recordingDesiredRef.current) return;
          const activeRecorder = mediaRecorderRef.current;
          if (!activeRecorder || activeRecorder.state === "inactive") return;
          recordingDesiredRef.current = false;
          stopReasonRef.current = "devicechange";
          activeRecorder.stop();
        };
        const audioTracks = stream.getAudioTracks();
        const removeTrackListeners = () => {
          for (const track of audioTracks) {
            track.removeEventListener("ended", trackEndedHandler);
          }
        };
        for (const track of audioTracks) {
          track.addEventListener("ended", trackEndedHandler);
        }

        const resolvedMimeType = recorder.mimeType || selectedMimeType;
        if (!sessionMimeTypeRef.current) {
          sessionMimeTypeRef.current = resolvedMimeType;
        }
        setMimeType(resolvedMimeType);
        setIsRecording(true);
        if (emitStart) {
          onStart?.({ mimeType: resolvedMimeType });
        }

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };
        recorder.onerror = () => {
          recordingDesiredRef.current = false;
          stopReasonRef.current = "error";
          if (recorder.state !== "inactive") {
            recorder.stop();
            return;
          }
          setIsRecording(false);
          removeTrackListeners();
          cleanup();
          resetAudioSessionAfterRecording();
          void flushCapture(resolvedMimeType);
          releaseWakeLock();
          onError?.("Recording failed");
        };
        recorder.onstop = async () => {
          const stopReason = stopReasonRef.current ?? "user";
          stopReasonRef.current = null;
          const resolvedType = recorder.mimeType || selectedMimeType;
          setIsRecording(false);

          removeTrackListeners();
          cleanup();
          resetAudioSessionAfterRecording();
          const captured = await flushCapture(resolvedType);
          releaseWakeLock();

          if (!captured && stopReason !== "user") {
            const message =
              stopReason === "devicechange"
                ? "Microphone disconnected"
                : "Recording failed";
            onError?.(message);
          }

          // Pre-warm the stream for the next recording
          void warmUpStream();
        };

        mediaRecorderRef.current = recorder;
        mediaStreamRef.current = stream;
        recorder.start(1000);
        void requestWakeLock();
      } catch (err) {
        recordingDesiredRef.current = false;
        setIsRecording(false);
        setAudioSessionType("auto");
        cleanup();
        releaseWakeLock();
        await flushCapture();
        onError?.(
          err instanceof Error ? err.message : "Microphone permission denied",
        );
      } finally {
        startingRef.current = false;
      }
    },
    [
      cleanup,
      disabled,
      flushCapture,
      onError,
      onStart,
      releaseWakeLock,
      releaseWarmStream,
      requestWakeLock,
      supported,
      warmUpStream,
    ],
  );

  const start = useCallback(() => {
    if (disabled) return;
    if (!supported) {
      onError?.(getUnsupportedRecorderMessage());
      return;
    }
    resetSession();
    recordingDesiredRef.current = true;
    void startRecording({ emitStart: true });
  }, [disabled, onError, resetSession, startRecording, supported]);

  const stop = useCallback(() => {
    recordingDesiredRef.current = false;
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      setIsRecording(false);
      resetAudioSessionAfterRecording();
      releaseWakeLock();
      void flushCapture();
      return;
    }
    stopReasonRef.current = "user";
    if (recorder.state !== "inactive") {
      recorder.stop();
    } else {
      setIsRecording(false);
      resetAudioSessionAfterRecording();
      releaseWakeLock();
      void flushCapture();
    }
  }, [flushCapture, releaseWakeLock]);

  const toggle = useCallback(() => {
    if (isRecording) {
      stop();
    } else {
      void start();
    }
  }, [isRecording, start, stop]);

  return (
    <>{children({ isRecording, supported, mimeType, start, stop, toggle, warmUp: warmUpStream })}</>
  );
};
