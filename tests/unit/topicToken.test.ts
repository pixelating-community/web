import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashTopicToken, verifyTopicToken } from "@/lib/topicToken";

describe("topicToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("verifies with Bun when hash matches", async () => {
    const verifySpy = vi.spyOn(Bun.password, "verify").mockResolvedValue(true);

    await expect(verifyTopicToken("token", "$argon2id$abc")).resolves.toBe(
      true,
    );
    expect(verifySpy).toHaveBeenCalledWith("token", "$argon2id$abc");
  });

  it("rejects when Bun verification returns false", async () => {
    vi.spyOn(Bun.password, "verify").mockResolvedValue(false);

    await expect(verifyTopicToken("wrong", "$argon2id$abc")).resolves.toBe(
      false,
    );
  });

  it("rejects when Bun verification throws", async () => {
    vi.spyOn(Bun.password, "verify").mockRejectedValue(
      new Error("invalid hash"),
    );

    await expect(verifyTopicToken("token", "legacy-token")).resolves.toBe(
      false,
    );
  });

  it("rejects missing stored tokens", async () => {
    const verifySpy = vi.spyOn(Bun.password, "verify");

    await expect(verifyTopicToken("token", undefined)).resolves.toBe(false);
    await expect(verifyTopicToken("token", null)).resolves.toBe(false);
    await expect(verifyTopicToken("token", "")).resolves.toBe(false);
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it("hashes with Bun password API", async () => {
    const hashSpy = vi
      .spyOn(Bun.password, "hash")
      .mockResolvedValue("$argon2id$hash");

    await expect(hashTopicToken("token")).resolves.toBe("$argon2id$hash");
    expect(hashSpy).toHaveBeenCalledWith("token");
  });
});
