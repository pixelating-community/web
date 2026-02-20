import { resolve } from "node:path";
import server from "../dist/server/server.js";

const DIST_CLIENT_DIR = resolve(process.cwd(), "dist/client");
const PORT = Number(process.env.PORT || "3000");

function resolveStaticPath(pathname: string): string | null {
  if (!pathname || pathname.endsWith("/")) return null;

  let decodedPath = pathname;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const relativePath = decodedPath.replace(/^\/+/, "");
  if (!relativePath) return null;

  const absolutePath = resolve(DIST_CLIENT_DIR, relativePath);
  if (!absolutePath.startsWith(`${DIST_CLIENT_DIR}/`)) {
    return null;
  }

  return absolutePath;
}

async function maybeServeStatic(request: Request): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const { pathname } = new URL(request.url);
  const staticPath = resolveStaticPath(pathname);
  if (!staticPath) return null;

  const file = Bun.file(staticPath);
  if (!(await file.exists())) return null;

  const headers = new Headers();
  if (file.type) headers.set("Content-Type", file.type);
  if (pathname.startsWith("/assets/")) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }

  if (request.method === "HEAD") {
    headers.set("Content-Length", `${file.size}`);
    return new Response(null, { status: 200, headers });
  }

  headers.set("Content-Length", `${file.size}`);
  return new Response(file, { status: 200, headers });
}

Bun.serve({
  hostname: "0.0.0.0",
  port: PORT,
  fetch: async (request) => {
    const staticResponse = await maybeServeStatic(request);
    if (staticResponse) return staticResponse;

    return server.fetch(request);
  },
});

console.log(`Started server: http://0.0.0.0:${PORT}`);
