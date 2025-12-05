"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Status = "idle" | "verifying" | "verified" | "error";

type SuccessVerifierProps = {
  perspectiveId: string;
};

export function SuccessVerifier({ perspectiveId }: SuccessVerifierProps) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      setStatus("error");
      setError("Missing session id.");
      return;
    }

    let active = true;

    const verify = async () => {
      setStatus("verifying");
      try {
        const res = await fetch(`/api/p/${perspectiveId}/verify-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;

        if (!active) return;

        if (!res.ok) {
          setStatus("error");
          setError(data?.error ?? "Verification failed.");
          return;
        }

        setStatus("verified");
        setTimeout(() => {
          if (active) {
            window.location.href = `/p/${perspectiveId}`;
          }
        }, 1200);
      } catch {
        if (!active) return;
        setStatus("error");
        setError("Verification failed.");
      }
    };

    void verify();

    return () => {
      active = false;
    };
  }, [perspectiveId, searchParams]);

  if (status === "error") {
    return (
      <div className="font-mono text-xs text-center mt-6">
        <p>{error || "Verification failed."}</p>
        <a href={`/p/${perspectiveId}`} className="underline">
          Return to reflections
        </a>
      </div>
    );
  }

  return (
    <div className="font-mono text-xs text-center mt-6">
      {status === "verifying" && <p>⏳ Verifying payment...</p>}
      {status === "verified" && <p>✅ Unlocked. Redirecting...</p>}
    </div>
  );
}
