import type { UUID } from "node:crypto";
import { useEffect } from "react";
import type { ReflectionData } from "@/components/ReflectionTree";

export type SSEEvent = {
  type: "created" | "updated" | "deleted";
  data: ReflectionData;
};

export function useSSE(
  perspectiveId: UUID,
  onEvent: (event: SSEEvent) => void,
) {
  useEffect(() => {
    if (!perspectiveId) return;

    const es = new EventSource(`/api/sse/${perspectiveId}`);

    es.onmessage = (e) => {
      try {
        const parsed: SSEEvent = JSON.parse(e.data);
        onEvent(parsed);
      } catch (err) {
        console.error("Failed to parse SSE event:", err);
      }
    };

    return () => es.close();
  }, [perspectiveId, onEvent]);
}
