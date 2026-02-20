import { registerAppCronJobs } from "../src/lib/appCron";

try {
  await registerAppCronJobs();
} catch (error) {
  console.error("[cron] registration failed", error);
  process.exitCode = 1;
}
