import { describe, expect, it } from "vitest";
import { generateHash } from "@/lib/generateHash";

describe("generateHash", () => {
  it("returns a deterministic sha256 hex hash", () => {
    expect(generateHash("ch_123")).toBe(
      "2215e0112900b7939be4dd3552288c9fcec966524fdc895499f21f126b4c715d",
    );
  });

  it("returns a 64-char lowercase hex string", () => {
    expect(generateHash("sample")).toMatch(/^[a-f0-9]{64}$/);
  });
});
