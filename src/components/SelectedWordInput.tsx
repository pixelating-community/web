"use client";

import { useRef, useState } from "react";

export function SelectedWordInput({
  word,
  disabled,
  onSave,
}: {
  word: string;
  disabled?: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(word);
  const [error, setError] = useState("");
  const saving = useRef(false);
  const cancelled = useRef(false);
  const save = async () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    if (saving.current || value === word) return;
    if (!value.trim() || /\s/.test(value.trim())) {
      setError("Enter one word without spaces.");
      return;
    }
    saving.current = true;
    setError("");
    try {
      await onSave(value.trim());
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not save the word.",
      );
    } finally {
      saving.current = false;
    }
  };
  return (
    <span className="inline-flex min-w-0 flex-col normal-case tracking-normal">
      <input
        aria-label="Edit selected word"
        aria-invalid={Boolean(error)}
        value={value}
        disabled={disabled}
        maxLength={200}
        onChange={(event) => {
          setValue(event.target.value);
          setError("");
        }}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={() => {
          void save();
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            cancelled.current = true;
            setValue(word);
            setError("");
            event.currentTarget.blur();
          }
        }}
        title="Edit word. Enter or click away to save; Escape to cancel."
        style={{ width: `${Math.max(4, Math.min(24, value.length + 2))}ch` }}
        className="max-w-48 rounded-md border border-transparent bg-transparent px-1 py-1 text-[11px] text-white/90 focus:border-white/30 focus:bg-white/10 focus:outline-none disabled:opacity-50"
      />
      {error ? (
        <span role="alert" className="max-w-64 text-xs text-red-200">
          {error}
        </span>
      ) : null}
    </span>
  );
}
