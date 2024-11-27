"use client";

import { useFormStatus } from "react-dom";

export function Submit({
  testid,
  btnText,
  className,
}: Readonly<{
  testid: string;
  btnText: string;
  className?: string;
}>) {
  const { pending } = useFormStatus();

  return (
    <button
      data-testid={testid}
      className={`border touch-manipulation ${className}`}
      type="submit"
      aria-disabled={pending}
    >
      {pending ? "🛸" : btnText}
    </button>
  );
}
