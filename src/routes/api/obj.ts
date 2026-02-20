import { createFileRoute } from "@tanstack/react-router";
import { getObjectPublicUrl } from "@/lib/objectStorage";

const isAbsoluteHttpUrl = (value: string) =>
  value.startsWith("http://") || value.startsWith("https://");

const handleReadObject = ({ request }: { request: Request }) => {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key")?.trim() ?? "";

  if (!key) {
    return Response.json({ error: "key required" }, { status: 400 });
  }
  if (key.includes("..")) {
    return Response.json({ error: "invalid key" }, { status: 400 });
  }

  const publicUrl = getObjectPublicUrl(key);
  if (!isAbsoluteHttpUrl(publicUrl)) {
    console.error("Public object URL is not configured", { key });
    return Response.json(
      { error: "Public object URL is not configured" },
      { status: 500 },
    );
  }

  return Response.redirect(publicUrl, 307);
};

export const Route = createFileRoute("/api/obj")({
  server: {
    handlers: {
      GET: ({ request }) => handleReadObject({ request }),
      HEAD: ({ request }) => handleReadObject({ request }),
    },
  },
});
