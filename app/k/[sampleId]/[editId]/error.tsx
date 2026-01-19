"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function KaraokeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isPerfMeasureError =
    error.message.includes("Failed to execute 'measure'") ||
    error.message.includes("negative time stamp");

  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="max-w-lg space-y-4">
        <h1 className="text-2xl font-semibold">
          {isPerfMeasureError
            ? "Could not load this studio page"
            : "Something went wrong"}
        </h1>
        <p className="text-sm text-gray-400">
          {isPerfMeasureError
            ? "Check the sample name in the URL and make sure the audio file is available."
            : "Try again, or return home if the issue persists."}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700/40"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700/40"
          >
            Return home
          </Link>
        </div>
      </div>
    </main>
  );
}
