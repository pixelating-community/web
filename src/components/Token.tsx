"use client";

import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { resolveTokenInputValue } from "@/components/token/tokenUtils";
import { saveTopicTokenAndRedirect } from "@/lib/topicTokenLogin.functions";

type TokenProps = {
  name: string;
  nextPath: string;
  topicId: string;
};

export const Token = ({ name, nextPath, topicId }: TokenProps) => {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const tokenInputRef = useRef<HTMLInputElement | null>(null);
  const saveTopicToken = useServerFn(saveTopicTokenAndRedirect);

  const resolveTokenValue = () => {
    return resolveTokenInputValue(tokenInputRef.current?.value, token);
  };

  const saveToken = async () => {
    const nextToken = resolveTokenValue();
    if (!nextToken || isSaving) return;

    setIsSaving(true);
    setError("");

    try {
      const result = await saveTopicToken({
        data: {
          nextPath,
          token: nextToken,
          topicId,
          topicName: name,
        },
      });
      if (result && typeof result === "object" && "ok" in result && !result.ok) {
        setError(result.error || "Failed to save token");
        return;
      }
      if (result && typeof result === "object" && "ok" in result && result.ok) {
        window.location.assign(result.nextPath);
        return;
      }
      window.location.assign(nextPath);
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
        <div className="relative w-full">
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
            className="ui-focus-ring p-2 pr-11 border border-white/20 bg-white/10 w-full text-white placeholder:text-white/60"
            type={showToken ? "text" : "password"}
            id="token"
            name="token"
            placeholder="🔑"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            required
            disabled={isSaving}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "token-error" : undefined}
          />
          <button
            type="button"
            data-testid="toggle-token-visibility"
            className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-sm text-white opacity-30 transition-opacity hover:opacity-100 focus:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed"
            aria-label={showToken ? "Hide token" : "Show token"}
            aria-pressed={showToken}
            title={showToken ? "Hide token" : "Show token"}
            disabled={isSaving}
            onClick={() => {
              setShowToken((current) => !current);
            }}
          >
            👁️
          </button>
        </div>

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
      {error ? (
        <p id="token-error" className="text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
};
