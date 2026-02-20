"use client";

import { useRef, useState } from "react";
import { setCookie } from "@/actions/setCookie";
import { resolveTokenInputValue } from "@/components/token/tokenUtils";

type TokenProps = {
  name: string;
  topicId: string;
  onSaved: () => Promise<void> | void;
};

export const Token = ({ name, topicId, onSaved }: TokenProps) => {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const tokenInputRef = useRef<HTMLInputElement | null>(null);

  const resolveTokenValue = () => {
    return resolveTokenInputValue(tokenInputRef.current?.value, token);
  };

  const saveToken = async () => {
    const nextToken = resolveTokenValue();
    if (!nextToken || isSaving) return;

    setIsSaving(true);
    setError("");

    try {
      await setCookie({ token: nextToken, topicName: name, topicId });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save token");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col mt-1 mx-1 gap-1">
      <div className="flex flex-row">
        <label className="sr-only" htmlFor="token">
          token
        </label>
        <input
          ref={tokenInputRef}
          onChange={(e) => {
            setToken(e.target.value);
          }}
          onInput={(e) => {
            setToken((e.target as HTMLInputElement).value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void saveToken();
            }
          }}
          data-testid="token"
          className="ui-focus-ring p-2 border border-white/20 bg-white/10 w-full text-white placeholder:text-white/60"
          type="password"
          id="token"
          name="token"
          placeholder="🔑"
          autoComplete="off"
          required
          disabled={isSaving}
        />

        <button
          data-testid="save"
          className="ml-1 px-3 py-2 border border-white/25 bg-white/15 text-white text-sm font-medium transition-colors enabled:hover:bg-white/25 disabled:opacity-40 disabled:cursor-not-allowed"
          id="save"
          name="save"
          type="button"
          aria-label="Unlock with token"
          title="Unlock"
          disabled={isSaving}
          onClick={() => {
            void saveToken();
          }}
        >
          {isSaving ? "💾..." : "🔓"}
        </button>
      </div>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
};
