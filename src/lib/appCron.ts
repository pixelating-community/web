import { resolve } from "node:path";

const PERSPECTIVE_SHARE_CLEANUP_CRON_TITLE =
  "pixelating-perspective-share-cleanup";
const DEFAULT_DEV_PERSPECTIVE_SHARE_CLEANUP_CRON = "* * * * *";
const DEFAULT_PROD_PERSPECTIVE_SHARE_CLEANUP_CRON = "17 * * * *";

const AUDIO_MIX_CRON_TITLE = "pixelating-audio-mix";
const DEFAULT_AUDIO_MIX_CRON = "* * * * *";

type BunCronRegistrar = ((scriptPath: string, cron: string, title: string) => Promise<void>) & {
  remove?: (title: string) => Promise<void>;
};

type BunRuntimeWithCron = {
  cron?: BunCronRegistrar;
};

const getBunCron = () => {
  const bunRuntime = (globalThis as typeof globalThis & {
    Bun?: BunRuntimeWithCron;
  }).Bun;
  const bunCron = bunRuntime?.cron;
  return typeof bunCron === "function" ? bunCron : null;
};

export const getPerspectiveShareCleanupCronExpression = () =>
  process.env.PERSPECTIVE_SHARE_CLEANUP_CRON?.trim() ||
  (process.env.NODE_ENV === "production"
    ? DEFAULT_PROD_PERSPECTIVE_SHARE_CLEANUP_CRON
    : DEFAULT_DEV_PERSPECTIVE_SHARE_CLEANUP_CRON);

export const registerAppCronJobs = async () => {
  const bunCron = getBunCron();
  if (!bunCron) {
    console.warn("[cron] Bun.cron is unavailable; skipping job registration.");
    return { registered: false as const, reason: "bun-cron-unavailable" };
  }

  const cleanupScriptPath = resolve(
    process.cwd(),
    "scripts/perspectiveShareCleanupCron.ts",
  );
  const expression = getPerspectiveShareCleanupCronExpression();

  await bunCron(
    cleanupScriptPath,
    expression,
    PERSPECTIVE_SHARE_CLEANUP_CRON_TITLE,
  );

  console.log(
    `[cron] registered ${PERSPECTIVE_SHARE_CLEANUP_CRON_TITLE} (${expression})`,
  );

  const audioMixScriptPath = resolve(
    process.cwd(),
    "scripts/audioMixCron.ts",
  );
  const audioMixExpression =
    process.env.AUDIO_MIX_CRON?.trim() || DEFAULT_AUDIO_MIX_CRON;

  await bunCron(
    audioMixScriptPath,
    audioMixExpression,
    AUDIO_MIX_CRON_TITLE,
  );

  console.log(
    `[cron] registered ${AUDIO_MIX_CRON_TITLE} (${audioMixExpression})`,
  );

  return {
    expression,
    registered: true as const,
    scriptPath: cleanupScriptPath,
    title: PERSPECTIVE_SHARE_CLEANUP_CRON_TITLE,
  };
};
