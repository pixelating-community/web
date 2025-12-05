"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Reflection } from "@/components/Reflection";

export type ReflectionData = {
  id: string;
  perspective_id: string;
  reflection_id: string | null;
  text: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type ReflectionTreeProps = {
  perspectiveId: string;
  initialReflections?: ReflectionData[];
};

export function ReflectionTree({
  perspectiveId,
  initialReflections = [],
}: ReflectionTreeProps) {
  const searchParams = useSearchParams();
  const [canComment, setCanComment] = useState(false);

  useEffect(() => {
    setCanComment(searchParams.get("k") === "true");
  }, [searchParams]);

  const [reflections, setReflections] =
    useState<ReflectionData[]>(initialReflections);
  const newReflectionRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  const [hasAccess, setHasAccess] = useState(false);
  const [hasWriteAccess, setHasWriteAccess] = useState(false);
  const [writeError, setWriteError] = useState("");
  const [elKey, setElKey] = useState("");
  const canWrite = hasAccess && (hasWriteAccess || !!elKey);

  const clearWriteAccess = useCallback((message?: string) => {
    setHasWriteAccess(false);
    setWriteError(message ?? "");
  }, []);

  const fetchReflections = useCallback(async () => {
    try {
      const res = await fetch(`/api/p/${perspectiveId}/reflections`, {
        cache: "no-store",
        headers: {
          ...(elKey && { "x-el-key": elKey }),
        },
      });
      if (!res.ok) {
        setHasAccess(false);
        return false;
      }
      const data = (await res.json()) as {
        reflections: ReflectionData[];
        canWrite: boolean;
      };
      setReflections(data.reflections);
      setHasAccess(true);
      setHasWriteAccess(data.canWrite);
      return true;
    } catch {
      return false;
    }
  }, [perspectiveId, elKey]);

  const fetchWriteAccess = useCallback(async () => {
    if (!elKey && !canComment) return;
    try {
      const res = await fetch(`/api/p/${perspectiveId}/write-access`, {
        cache: "no-store",
        headers: {
          ...(elKey && { "x-el-key": elKey }),
        },
      });
      if (!res.ok) {
        setHasWriteAccess(false);
        const errorBody = await res.text();
        console.error("Write access check failed:", res.status, errorBody);
        return false;
      }
      setHasWriteAccess(true);
      setWriteError("");
      return true;
    } catch {
      setHasWriteAccess(false);
      return false;
    }
  }, [perspectiveId, elKey, canComment]);

  useEffect(() => {
    void fetchReflections();
    void fetchWriteAccess();
  }, [fetchReflections, fetchWriteAccess]);

  useEffect(() => {
    if (!hasAccess) return;
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      eventSource = new EventSource(`/api/sse/${perspectiveId}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "connected") return;

          if (data.type === "edit") {
            setReflections((prev) =>
              prev.map((r) =>
                r.id === data.id ? { ...r, text: data.text } : r,
              ),
            );
            return;
          }

          setReflections((prev) => {
            if (prev.some((r) => r.id === data.id)) return prev;
            return [...prev, data];
          });
        } catch (error) {
          console.log(`reflection:tree:see ${error}`);
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        if (!closed) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      eventSource?.close();
    };
  }, [perspectiveId, hasAccess]);

  const childrenMap = useMemo(() => {
    const map = new Map<string | null, ReflectionData[]>();
    for (const r of reflections) {
      const key = r.reflection_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(r);
    }
    return map;
  }, [reflections]);

  const addReflectionAction = useCallback(
    async (parentId: string | null, text: string) => {
      try {
        const res = await fetch(`/api/p/${perspectiveId}/c`, {
          method: "POST",
          body: JSON.stringify({
            reflectionId: parentId ?? undefined,
            text,
          }),
          headers: {
            "Content-Type": "application/json",
            ...(elKey && { "x-el-key": elKey }),
          },
        });

        const newReflection = await res.json();

        if (newReflection) {
          setReflections((prev) => [...prev, newReflection as ReflectionData]);
          clearWriteAccess();
        } else {
          clearWriteAccess("⚠️ Unable to write. Try again.");
        }
      } catch (error) {
        console.log(`add:reflection:eror ${error}`);
      }
    },
    [perspectiveId, clearWriteAccess, elKey],
  );

  const updateReflectionTextAction = useCallback((id: string, text: string) => {
    setReflections((prev) =>
      prev.map((r) => (r.id === id ? { ...r, text } : r)),
    );
  }, []);

  const handleAddNewReflection = async () => {
    if (!newReflectionRef.current) return;
    const text = newReflectionRef.current.textContent?.trim() || "";
    if (!text) return;

    try {
      const res = await fetch(`/api/p/${perspectiveId}/c`, {
        method: "POST",
        body: JSON.stringify({
          reflectionId: undefined,
          text,
        }),
        headers: {
          "Content-Type": "application/json",
          ...(elKey && { "x-el-key": elKey }),
        },
      });
      const newReflection = await res.json();

      if (newReflection) {
        setReflections((prev) => [...prev, newReflection as ReflectionData]);
        newReflectionRef.current.textContent = "";
        clearWriteAccess();
      } else {
        clearWriteAccess("⚠️ Unable to write. Try again.");
      }
    } catch (error) {
      console.log(`handle:reflection:eror ${error}`);
    }
  };

  const handleElKey = () => {
    if (!keyRef.current) return;
    const key = keyRef.current.value;
    if (!key) return;
    setElKey(key);
  };

  return (
    <div className="space-y-4 w-full">
      {canComment && !elKey && (
        <div className="flex items-center gap-2 mb-4 p-2">
          <p className="text-xs text-center">🔒</p>
          <input
            ref={keyRef}
            type="password"
            placeholder="key"
            className="flex-1 bg-transparent outline-none border-b border-purple-500/50 text-sm p-2"
          />
          <button
            type="button"
            onClick={handleElKey}
            className="px-4 py-2 text-xs"
          >
            +
          </button>
        </div>
      )}

      {writeError && (
        <p className="text-xs text-center text-red-600">{writeError}</p>
      )}

      {hasAccess && canWrite && (
        <div className="flex items-center gap-2 mb-4 p-2">
          <div
            ref={newReflectionRef}
            role="textbox"
            tabIndex={0}
            contentEditable
            suppressContentEditableWarning
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleAddNewReflection();
              }
            }}
            data-placeholder="..."
            className="flex-1 bg-transparent outline-none border-b border-purple-500/50 text-sm p-2 empty:before:content-[attr(data-placeholder)] tracking-tighter"
          />
          <button
            type="button"
            onClick={handleAddNewReflection}
            className="px-4 py-2 text-xs"
          >
            +
          </button>
        </div>
      )}

      {(childrenMap.get(null) || []).map((r) => (
        <Reflection
          key={r.id}
          reflectionId={r.id}
          text={r.text}
          perspectiveId={perspectiveId}
          childrenMap={childrenMap}
          addReflectionAction={addReflectionAction}
          updateReflectionTextAction={updateReflectionTextAction}
          canComment={canWrite}
        />
      ))}
    </div>
  );
}
