import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AudioWaveform } from "@/components/AudioWaveform";

describe("audio waveform", () => {
  it("distributes the default bars across the full track width", () => {
    const markup = renderToStaticMarkup(
      createElement(AudioWaveform, { waveform: [0.25, 0.5, 1] }),
    );

    expect(markup).toContain("min-w-0 flex-1 rounded-sm");
    expect(markup.match(/min-w-0 flex-1 rounded-sm/g)).toHaveLength(3);
  });

  it("preserves an explicitly requested fixed bar width", () => {
    const markup = renderToStaticMarkup(
      createElement(AudioWaveform, {
        waveform: [0.25],
        barWidthClassName: "w-0.5",
      }),
    );

    expect(markup).toContain("w-0.5 rounded-sm");
    expect(markup).not.toContain("min-w-0 flex-1 rounded-sm");
  });
});
