import { afterEach, describe, expect, it } from "vitest";
import {
  resetAudioSessionAfterRecording,
  setAudioSessionType,
} from "@/lib/audioSession";

type NavigatorWithAudioSession = Navigator & {
  audioSession?: { type?: string };
  session?: { type?: string };
};

const clearAudioSessionMocks = () => {
  delete (navigator as NavigatorWithAudioSession).audioSession;
  delete (navigator as NavigatorWithAudioSession).session;
};

describe("audio session helpers", () => {
  afterEach(() => {
    clearAudioSessionMocks();
  });

  it("writes the requested type to navigator.audioSession", () => {
    const session = { type: "auto" };
    Object.defineProperty(navigator, "audioSession", {
      configurable: true,
      value: session,
    });

    setAudioSessionType("play-and-record");

    expect(session.type).toBe("play-and-record");
  });

  it("falls back to navigator.session and resets playback routing", () => {
    const writes: string[] = [];
    let currentType = "play-and-record";
    Object.defineProperty(navigator, "session", {
      configurable: true,
      value: {
        get type() {
          return currentType;
        },
        set type(value: string) {
          currentType = value;
          writes.push(value);
        },
      },
    });

    resetAudioSessionAfterRecording();

    expect(writes).toEqual(["playback", "auto"]);
  });

  it("ignores unsupported audio session setters", () => {
    Object.defineProperty(navigator, "audioSession", {
      configurable: true,
      value: {
        set type(_value: string) {
          throw new Error("unsupported");
        },
      },
    });

    expect(() => {
      setAudioSessionType("playback");
      resetAudioSessionAfterRecording();
    }).not.toThrow();
  });
});
