"use client";

import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PerspectiveShare } from "@/components/PerspectiveShare";
import { Reflection } from "@/components/Reflection";
import {
  createPerspectiveReflection,
  loadPerspectiveReflections,
} from "@/lib/reflectionRoute.functions";
import type { Perspective } from "@/types/perspectives";
import type { ReflectionData } from "@/types/reflections";

type ReflectionTreeProps = {
  allowKeyComment?: boolean;
  perspective: Pick<Perspective, "id">;
  initialReflections?: ReflectionData[];
};

export function ReflectionTree({
  allowKeyComment = false,
  perspective,
  initialReflections = [],
}: ReflectionTreeProps) {
  const loadReflections = useServerFn(loadPerspectiveReflections);
  const saveReflection = useServerFn(createPerspectiveReflection);
  const loadReflectionsRef = useRef(loadReflections);

  const [reflections, setReflections] =
    useState<ReflectionData[]>(initialReflections);
  const newReflectionRef = useRef<HTMLTextAreaElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const [newReflectionText, setNewReflectionText] = useState("");

  const [hasAccess, setHasAccess] = useState(false);
  const [hasWriteAccess, setHasWriteAccess] = useState(false);
  const [writeError, setWriteError] = useState("");
  const [elKey, setElKey] = useState("");
  const canWrite = hasAccess && hasWriteAccess;
  const perspectiveId = perspective.id;

  useEffect(() => {
    loadReflectionsRef.current = loadReflections;
  }, [loadReflections]);

  const clearWriteAccess = useCallback((message?: string) => {
    setHasWriteAccess(false);
    setWriteError(message ?? "");
  }, []);

  const refreshReflections = useCallback(async () => {
    try {
      const result = await loadReflectionsRef.current({
        data: {
          perspectiveId,
          ...(elKey ? { elKey } : {}),
        },
      });
      if (!result.ok) {
        setHasAccess(false);
        setHasWriteAccess(false);
        return false;
      }
      setReflections(result.data.reflections);
      setHasAccess(true);
      setHasWriteAccess(result.data.canWrite);
      setWriteError("");
      return true;
    } catch {
      return false;
    }
  }, [elKey, perspectiveId]);

  useEffect(() => {
    void refreshReflections();
  }, [refreshReflections]);

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
        const result = await saveReflection({
          data: {
            perspectiveId,
            reflectionId: parentId ?? undefined,
            text,
            ...(elKey ? { elKey } : {}),
          },
        });
        if (result.ok) {
          setReflections((prev) => [...prev, result.data]);
          clearWriteAccess();
        } else {
          clearWriteAccess(result.error || "Unable to write. Try again.");
        }
      } catch (error) {
        console.log(`add:reflection:error ${error}`);
      }
    },
    [clearWriteAccess, elKey, perspectiveId, saveReflection],
  );

  const updateReflectionTextAction = useCallback((id: string, text: string) => {
    setReflections((prev) =>
      prev.map((r) => (r.id === id ? { ...r, text } : r)),
    );
  }, []);

  const handleAddNewReflection = async () => {
    const text = newReflectionText.trim();
    if (!text) return;

    try {
      const result = await saveReflection({
        data: {
          perspectiveId,
          reflectionId: undefined,
          text,
          ...(elKey ? { elKey } : {}),
        },
      });
      if (result.ok) {
        setReflections((prev) => [...prev, result.data]);
        setNewReflectionText("");
        clearWriteAccess();
      } else {
        clearWriteAccess(result.error || "Unable to write. Try again.");
      }
    } catch (error) {
      console.log(`handle:reflection:error ${error}`);
    }
  };

  const handleElKey = () => {
    if (!keyRef.current) return;
    const key = keyRef.current.value.trim();
    if (!key) return;
    setElKey(key);
    setWriteError("");
  };

  return (
    <div className="space-y-4 w-full">
      {!hasAccess && (
        <PerspectiveShare
          perspective={perspective}
          mode="redeem"
          onRedeemed={refreshReflections}
        />
      )}

      {allowKeyComment && !elKey && (
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
          <textarea
            ref={newReflectionRef}
            value={newReflectionText}
            onChange={(e) => setNewReflectionText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleAddNewReflection();
              }
            }}
            placeholder="..."
            className="flex-1 bg-transparent outline-none border-b border-purple-500/50 text-sm p-2 tracking-tighter resize-none"
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
          childrenMap={childrenMap}
          addReflectionAction={addReflectionAction}
          updateReflectionTextAction={updateReflectionTextAction}
          canComment={canWrite}
        />
      ))}
    </div>
  );
}
