import { afterEach, describe, expect, it } from "vitest";
import { getPerspectiveShareCleanupCronExpression } from "@/lib/appCron";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("app cron configuration", () => {
  it("uses a fast dev cleanup schedule by default", () => {
    delete process.env.PERSPECTIVE_SHARE_CLEANUP_CRON;
    delete process.env.NODE_ENV;

    expect(getPerspectiveShareCleanupCronExpression()).toBe("* * * * *");
  });

  it("uses an hourly cleanup schedule in production", () => {
    delete process.env.PERSPECTIVE_SHARE_CLEANUP_CRON;
    process.env.NODE_ENV = "production";

    expect(getPerspectiveShareCleanupCronExpression()).toBe("17 * * * *");
  });

  it("allows an explicit cleanup cron override", () => {
    process.env.PERSPECTIVE_SHARE_CLEANUP_CRON = "5 */2 * * *";

    expect(getPerspectiveShareCleanupCronExpression()).toBe("5 */2 * * *");
  });
});
