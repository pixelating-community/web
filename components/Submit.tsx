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
      className={`border ${className}`}
      type="submit"
      aria-disabled={pending}
    >
      {pending ? "🛸" : btnText}
    </button>
  );
}
