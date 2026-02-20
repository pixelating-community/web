"use client";

import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  generatePerspectiveShareCodeFn,
  loadPerspectiveShareStatus,
  redeemPerspectiveShareCode,
} from "@/lib/perspectiveShare.functions";
import type { Perspective } from "@/types/perspectives";

type PerspectiveShareProps = {
  perspective: Pick<Perspective, "id">;
  actionToken?: string;
  topicId?: string;
  mode?: "manage" | "redeem";
  onRedeemed?: () => Promise<unknown> | unknown;
};

type ShareStatus = {
  createdAt: string | null;
  hasActiveCode: boolean;
  remainingUses: number;
};

const DEFAULT_STATUS: ShareStatus = {
  createdAt: null,
  hasActiveCode: false,
  remainingUses: 0,
};

export const PerspectiveShare = ({
  perspective,
  actionToken,
  topicId,
  mode = "manage",
  onRedeemed,
}: PerspectiveShareProps) => {
  const loadStatus = useServerFn(loadPerspectiveShareStatus);
  const generateCode = useServerFn(generatePerspectiveShareCodeFn);
  const redeemCode = useServerFn(redeemPerspectiveShareCode);
  const loadStatusRef = useRef(loadStatus);
  const generateCodeRef = useRef(generateCode);
  const redeemCodeRef = useRef(redeemCode);
  const [status, setStatus] = useState<ShareStatus>(DEFAULT_STATUS);
  const [generatedCode, setGeneratedCode] = useState("");
  const [shareCode, setShareCode] = useState("");
  const [error, setError] = useState("");
  const shareCodeRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState<"generate" | "redeem" | null>(null);
  const busyRef = useRef(false);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const isManageMode = mode === "manage";
  const perspectiveId = perspective.id;
  const actionTokenRef = useRef(actionToken);

  useEffect(() => {
    loadStatusRef.current = loadStatus;
    generateCodeRef.current = generateCode;
    redeemCodeRef.current = redeemCode;
    actionTokenRef.current = actionToken;
  }, [actionToken, generateCode, loadStatus, redeemCode]);

  useEffect(() => {
    if (!isManageMode || !actionTokenRef.current || !topicId || !perspectiveId) return;
    let cancelled = false;
    void (async () => {
      const result = await loadStatusRef.current({
        data: {
          actionToken: actionTokenRef.current!,
          perspectiveId,
          topicId,
        },
      });
      if (!cancelled && result.ok) {
        setStatus(result.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isManageMode, perspectiveId, topicId]);

  if (isManageMode && (!actionToken || !topicId)) return null;

  const handleGenerate = async () => {
    if (!actionToken || !topicId || busyRef.current) return;
    busyRef.current = true;
    setLoading("generate");
    setError("");
    setCopyLabel("Copy");
    try {
      const result = await generateCodeRef.current({
        data: {
          actionToken,
          perspectiveId,
          topicId,
        },
      });
      if (!result.ok) {
        setError(result.error || "Unable to generate.");
        return;
      }
      setGeneratedCode(result.data.code);
      setStatus({
        createdAt: new Date().toISOString(),
        hasActiveCode: true,
        remainingUses: result.data.remainingUses,
      });
    } catch {
      setError("Unable to generate.");
    } finally {
      busyRef.current = false;
      setLoading(null);
    }
  };

  const handleCopy = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopyLabel("Copied");
    } catch {
      setCopyLabel("Copy failed");
    }
  };

  const handleRedeem = async () => {
    const code = shareCodeRef.current?.value.trim() ?? shareCode.trim();
    if (!code || busyRef.current) return;
    busyRef.current = true;
    setLoading("redeem");
    setError("");
    try {
      const result = await redeemCodeRef.current({
        data: {
          code,
          perspectiveId,
        },
      });
      if (!result.ok) {
        setError(result.error || "Unable to join.");
        return;
      }
      setShareCode("");
      if (shareCodeRef.current) {
        shareCodeRef.current.value = "";
      }
      await onRedeemed?.();
    } catch {
      setError("Unable to join.");
    } finally {
      busyRef.current = false;
      setLoading(null);
    }
  };

  if (!isManageMode) {
    return (
      <div className="w-full">
        <div className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/75">
          <span aria-hidden="true">🫂</span>
          <input
            ref={shareCodeRef}
            type="password"
            value={shareCode}
            onChange={(event) => setShareCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleRedeem();
              }
            }}
            placeholder="🔓"
            className="min-w-0 flex-1 border-b border-purple-500/50 bg-transparent p-2 text-sm tracking-[0.18em] outline-none"
          />
          <button
            type="button"
            onClick={() => {
              void handleRedeem();
            }}
            disabled={loading === "redeem"}
            className="rounded-xl bg-white/10 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-white/85 disabled:opacity-50"
          >
            {loading === "redeem" ? "Joining" : "Join"}
          </button>
        </div>
        {error ? (
          <p className="pt-2 text-center text-xs text-red-600">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/75">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span aria-hidden="true">🫂</span>
            <span>
              {status.hasActiveCode ? "🔓" : "No 🔓"}
            </span>
            {status.hasActiveCode ? (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/55">
                {status.remainingUses}/2 left
              </span>
            ) : null}
          </div>
          {generatedCode ? (
            <div className="flex items-center gap-2">
              <code className="rounded bg-white/10 px-2 py-1 text-[11px] tracking-[0.28em] text-white/90">
                {generatedCode}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-lg bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/70"
              >
                {copyLabel}
              </button>
            </div>
          ) : status.hasActiveCode ? (
            <span className="text-[11px] text-white/45">
              🔓 is viewed once.
            </span>
          ) : (
            <span className="text-[11px] text-white/45">
              Use twice. Each use unlocks reading and writing.
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading === "generate"}
          aria-label={status.hasActiveCode ? "Generate new code" : "Generate code"}
          className="rounded-xl bg-white/10 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-white/85 disabled:opacity-50"
        >
          {loading === "generate"
            ? "Generating"
            : status.hasActiveCode
              ? "⟳"
              : "Generate 🔓"}
        </button>
      </div>
      {error ? (
        <p className="pt-2 text-center text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
};
