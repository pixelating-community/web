"use client";

export type AudioSessionType = "auto" | "playback" | "play-and-record";

type NavigatorWithAudioSession = Navigator & {
  audioSession?: { type?: string };
  session?: { type?: string };
};

export const setAudioSessionType = (type: AudioSessionType) => {
  if (typeof navigator === "undefined") return;
  const nav = navigator as NavigatorWithAudioSession;
  const session = nav.audioSession ?? nav.session;
  if (!session) return;
  try {
    session.type = type;
  } catch {
    // Audio Session API support is browser and version dependent.
  }
};

export const resetAudioSessionAfterRecording = () => {
  // iOS Safari can stay in low-fidelity play-and-record routing until we
  // explicitly kick the session back through playback and then auto.
  setAudioSessionType("playback");
  setAudioSessionType("auto");
};
