import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { type FormEvent, useEffect, useState } from "react";
import {
  claimTopicOwnerInvite,
  createStripeConnectOnboarding,
  loadCreatorSupportSetup,
  saveCreatorSupportMethods,
} from "@/lib/creatorSupport.functions";

export const Route = createFileRoute("/t/$topic/support/claim")({
  component: CreatorSupportClaimRoute,
});

type Setup = {
  displayName: string;
  paypalMeUrl: string | null;
  stripeConnect: {
    available: boolean;
    connected: boolean;
    ready: boolean;
  };
  topicName: string;
  venmoUrl: string | null;
};

function CreatorSupportClaimRoute() {
  const { topic } = Route.useParams();
  const claimInvite = useServerFn(claimTopicOwnerInvite);
  const createOnboarding = useServerFn(createStripeConnectOnboarding);
  const loadSetup = useServerFn(loadCreatorSupportSetup);
  const saveMethods = useServerFn(saveCreatorSupportMethods);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [paypalMeUrl, setPaypalMeUrl] = useState("");
  const [venmoUrl, setVenmoUrl] = useState("");
  const [status, setStatus] = useState("Opening creator setup…");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isOpeningStripe, setIsOpeningStripe] = useState(false);

  const applySetup = (next: Setup) => {
    setSetup(next);
    setDisplayName(next.displayName);
    setPaypalMeUrl(next.paypalMeUrl ?? "");
    setVenmoUrl(next.venmoUrl ?? "");
    setStatus("");
    setError("");
  };

  useEffect(() => {
    let active = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get("token")?.trim() ?? "";
    if (window.location.hash) {
      window.history.replaceState(
        {},
        "",
        window.location.pathname + window.location.search,
      );
    }

    const openSetup = token
      ? claimInvite({ data: { token, topicName: topic } })
      : loadSetup({ data: { topicName: topic } });

    void openSetup
      .then((result) => {
        if (!active) return;
        if (result.ok) applySetup(result.data);
        else {
          setStatus("");
          setError(result.error);
        }
      })
      .catch(() => {
        if (!active) return;
        setStatus("");
        setError("Could not open creator setup.");
      });

    return () => {
      active = false;
    };
  }, [claimInvite, loadSetup, topic]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!setup || isSaving) return;
    setIsSaving(true);
    setError("");
    setStatus("");
    try {
      const result = await saveMethods({
        data: {
          displayName,
          paypalMeUrl,
          topicName: topic,
          venmoUrl,
        },
      });
      if (!result.ok) throw new Error(result.error);
      applySetup({ ...setup, ...result.data });
      setStatus("Saved.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save support links.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleStripeOnboarding = async () => {
    if (!setup || isOpeningStripe) return;
    setIsOpeningStripe(true);
    setError("");
    try {
      const result = await createOnboarding({ data: { topicName: topic } });
      if (!result.ok) throw new Error(result.error);
      window.location.assign(result.data.url);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not open managed payout setup.",
      );
      setIsOpeningStripe(false);
    }
  };

  return (
    <main className="min-h-dvh w-full px-4 py-16 text-white">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="m-0 text-xl font-black">Creator support</h1>
          <Link
            to="/t/$"
            params={{ _splat: topic }}
            className="text-sm text-white/65 underline underline-offset-4 hover:text-white"
          >
            View topic
          </Link>
        </div>

        {setup ? (
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm text-white/70">
              Display name
              <input
                required
                maxLength={80}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="min-h-12 border border-white/20 bg-transparent px-3 text-base text-white outline-none focus:border-white/60"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-white/70">
              PayPal.Me
              <input
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://paypal.me/yourname"
                value={paypalMeUrl}
                onChange={(event) => setPaypalMeUrl(event.target.value)}
                className="min-h-12 border border-white/20 bg-transparent px-3 text-base text-white outline-none placeholder:text-white/30 focus:border-white/60"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-white/70">
              Venmo Business
              <input
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://account.venmo.com/u/yourname"
                value={venmoUrl}
                onChange={(event) => setVenmoUrl(event.target.value)}
                className="min-h-12 border border-white/20 bg-transparent px-3 text-base text-white outline-none placeholder:text-white/30 focus:border-white/60"
              />
            </label>
            <p className="m-0 text-xs leading-relaxed text-white/50">
              Add at least one link. Payments made there go directly to that
              account and are not added to the PXL8 total.
            </p>
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-12 border border-white/30 bg-white/10 px-4 font-bold hover:bg-white/15 disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
            {setup.stripeConnect.available ? (
              <div className="flex flex-col gap-2 border-t border-white/15 pt-5">
                <button
                  type="button"
                  disabled={isOpeningStripe}
                  onClick={() => void handleStripeOnboarding()}
                  className="min-h-12 border border-white/30 bg-transparent px-4 font-bold hover:bg-white/10 disabled:opacity-50"
                >
                  {isOpeningStripe
                    ? "Opening…"
                    : setup.stripeConnect.ready
                      ? "Manage Stripe payouts"
                      : setup.stripeConnect.connected
                        ? "Finish Stripe setup"
                        : "Connect Stripe"}
                </button>
                <p className="m-0 text-xs text-white/50">
                  {setup.stripeConnect.ready
                    ? "Managed card payments are ready."
                    : "Managed card payments stay off until Stripe approves the account."}
                </p>
              </div>
            ) : null}
          </form>
        ) : null}

        {status ? <p className="m-0 text-sm text-white/65">{status}</p> : null}
        {error ? (
          <p role="alert" className="m-0 text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
