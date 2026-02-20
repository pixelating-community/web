"use client";

import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

type Status = "idle" | "verifying" | "verified" | "error";

type SuccessVerifierProps = {
  perspectiveId: string;
};

export function SuccessVerifier({ perspectiveId }: SuccessVerifierProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sessionId = new URLSearchParams(window.location.search).get(
      "session_id",
    );
    if (!sessionId) {
      setStatus("error");
      setError("Missing session id.");
      return;
    }

    let active = true;
    const MAX_RETRIES = 5;
    const RETRY_DELAY = 2000;

    const verify = async (attempt = 1): Promise<void> => {
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
          if (res.status === 401 && attempt < MAX_RETRIES) {
            console.log(`Verification attempt ${attempt} failed, retrying...`);
            await new Promise((r) => setTimeout(r, RETRY_DELAY));
            if (active) return verify(attempt + 1);
            return;
          }
          setStatus("error");
          const errorMessage =
            data?.error || `Verification failed. Status: ${res.status}.`;
          console.error("Verification failed:", data);
          setError(errorMessage);
          return;
        }

        setStatus("verified");
        setTimeout(() => {
          if (active) {
            void router.navigate({
              params: { id: perspectiveId },
              startTransition: true,
              to: "/p/$id",
            });
          }
        }, 1200);
      } catch (e) {
        if (!active) return;
        setStatus("error");
        setError("Verification failed with a network error.");
        console.error("Network error during verification:", e);
      }
    };

    void verify();

    return () => {
      active = false;
    };
  }, [perspectiveId, router]);

  if (status === "error") {
    const message = error || "Verification failed.";
    return (
      <div className="font-mono text-xs text-center mt-6">
        <p>{message}</p>
        <Link
          params={{ id: perspectiveId }}
          preload="intent"
          startTransition
          className="underline"
          to="/p/$id"
        >
          Return to reflections
        </Link>
      </div>
    );
  }

  return (
    <div className="font-mono text-xs text-center mt-6">
      {status === "verifying" && <p>Verifying payment...</p>}
      {status === "verified" && <p>Unlocked. Redirecting...</p>}
    </div>
  );
}
