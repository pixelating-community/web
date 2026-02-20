"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RecorderRenderProps = {
  isRecording: boolean;
  supported: boolean;
  mimeType: string;
  start: () => void;
  stop: () => void;
  toggle: () => void;
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
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm;codecs=opus",
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
  try {
    return navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  }
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
    },
    [cleanup, releaseWakeLock],
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
        const stream = await requestAudioStream();
        const bypassProcessing = shouldBypassProcessingGraph();
        let recorderInputStream = stream;
        recorderStreamRef.current = null;
        if (!bypassProcessing) {
          const processed = await createProcessedRecordingStream(stream);
          recorderInputStream = processed.stream;
          if (processed.context) {
            processingContextRef.current = processed.context;
          }
          recorderStreamRef.current =
            processed.stream === stream ? null : processed.stream;
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
          const captured = await flushCapture(resolvedType);
          releaseWakeLock();

          if (!captured && stopReason !== "user") {
            const message =
              stopReason === "devicechange"
                ? "Microphone disconnected"
                : "Recording failed";
            onError?.(message);
          }
        };

        mediaRecorderRef.current = recorder;
        mediaStreamRef.current = stream;
        recorder.start(1000);
        void requestWakeLock();
      } catch (err) {
        recordingDesiredRef.current = false;
        setIsRecording(false);
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
      requestWakeLock,
      supported,
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
      releaseWakeLock();
      void flushCapture();
      return;
    }
    stopReasonRef.current = "user";
    if (recorder.state !== "inactive") {
      recorder.stop();
    } else {
      setIsRecording(false);
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
    <>{children({ isRecording, supported, mimeType, start, stop, toggle })}</>
  );
};
