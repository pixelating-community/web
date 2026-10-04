import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const loadLinkPreviewOrigin = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getServerEnv } = await import("@/lib/env.server");
    return new URL(getServerEnv("APP_BASE_URL") ?? getRequest().url).origin;
  },
);
