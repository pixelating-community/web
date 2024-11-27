"use client";

import { useFormStatus } from "react-dom";

export function Submit({
  testid,
  btnText,
  className,
}: {
  testid: string;
  btnText: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      data-testid={testid}
      className={`text-sm font-mono border border-gray-700 rounded-lg mt-1 p-1 ${className}`}
      type="submit"
      aria-disabled={pending}
    >
      {pending ? "🛸" : btnText}
    </button>
  );
}
