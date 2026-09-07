import { describe, expect, it } from "vitest";
import {
  normalizePayPalMeUrl,
  normalizeVenmoBusinessUrl,
} from "@/lib/creatorSupport";
import { saveCreatorSupportMethodsSchema } from "@/lib/creatorSupport.schema";

describe("creator support links", () => {
  it("normalizes PayPal.Me profile URLs", () => {
    expect(
      normalizePayPalMeUrl(" https://paypal.me/dream.runner?locale.x=en_US "),
    ).toBe("https://paypal.me/dream.runner");
  });

  it("normalizes supported Venmo profile hosts", () => {
    expect(
      normalizeVenmoBusinessUrl("https://www.venmo.com/u/dream-runner"),
    ).toBe("https://account.venmo.com/u/dream-runner");
  });

  it.each([
    "http://paypal.me/name",
    "https://paypal.me/name/extra",
    "https://paypal.me.evil.example/name",
    "https://user:password@paypal.me/name",
  ])("rejects unsafe PayPal URLs: %s", (url) => {
    expect(() => normalizePayPalMeUrl(url)).toThrow(/HTTPS|[Pp]ay[Pp]al/);
  });

  it.each([
    "http://account.venmo.com/u/name",
    "https://venmo.example/u/name",
    "https://account.venmo.com/name",
    "https://account.venmo.com/u/name/extra",
  ])("rejects unsafe Venmo URLs: %s", (url) => {
    expect(() => normalizeVenmoBusinessUrl(url)).toThrow(/HTTPS|Venmo/);
  });

  it("requires at least one direct support method", () => {
    expect(
      saveCreatorSupportMethodsSchema.safeParse({
        displayName: "Dream Runner",
        paypalMeUrl: "",
        topicName: "art",
        venmoUrl: "",
      }).success,
    ).toBe(false);
    expect(
      saveCreatorSupportMethodsSchema.safeParse({
        displayName: "Dream Runner",
        paypalMeUrl: "https://paypal.me/dreamrunner",
        topicName: "art",
      }).success,
    ).toBe(true);
  });
});
