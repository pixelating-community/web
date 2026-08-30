import { purgePerspectiveShareCodes } from "../src/lib/perspectiveShareCleanup.server";
import { sql } from "../src/lib/db.server";

const DEFAULT_HEARTBEAT_PATH = "/tmp/perspective-share-cleanup-heartbeat.json";

type ScheduledControllerLike = {
  scheduledTime?: number;
};

const writeHeartbeat = async (payload: {
  batchSize: number;
  deletedCount: number;
  ranAt: string;
  scheduledTime: string | null;
  trigger: "cron" | "manual";
}) => {
  const heartbeatPath =
    process.env.PERSPECTIVE_SHARE_CLEANUP_HEARTBEAT_FILE?.trim() ||
    DEFAULT_HEARTBEAT_PATH;

  await Bun.write(heartbeatPath, `${JSON.stringify(payload, null, 2)}\n`);

  return heartbeatPath;
};

const runCleanup = async ({
  scheduledTime,
  trigger,
}: {
  scheduledTime?: number;
  trigger: "cron" | "manual";
}) => {
  const result = await purgePerspectiveShareCodes();
  const payload = {
    batchSize: result.batchSize,
    deletedCount: result.deletedCount,
    ranAt: new Date().toISOString(),
    scheduledTime:
      typeof scheduledTime === "number"
        ? new Date(scheduledTime).toISOString()
        : null,
    trigger,
  };
  const heartbeatPath = await writeHeartbeat(payload);

  console.log(
    `[cron] perspective share cleanup trigger=${trigger} deleted=${result.deletedCount} batch=${result.batchSize} heartbeat=${heartbeatPath}`,
  );

  return payload;
};

const scheduled = async (controller?: ScheduledControllerLike) => {
  try {
    await runCleanup({
      scheduledTime: controller?.scheduledTime,
      trigger: "cron",
    });
  } finally {
    await sql.close?.();
  }
};

export default {
  scheduled,
};

if (import.meta.main) {
  try {
    await runCleanup({
      trigger: "manual",
    });
  } finally {
    await sql.close?.();
  }
}
