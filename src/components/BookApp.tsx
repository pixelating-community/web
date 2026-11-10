import { useEffect, useRef, useState } from "react";
import type { z } from "zod/v4";
import type { bookDraftSchema } from "@/lib/book.schema";
import type { bookPage } from "@/lib/bookPage.server";
import { bookPath, bookChapterPath, bookAuthorPath } from "@/lib/book";
type Page = NonNullable<Awaited<ReturnType<typeof bookPage>>>;
type Correction = {
  original: string;
  replacement: string;
  category: string;
  reason: string;
};
export async function bookRequest(data: object) {
  const response = await fetch("/api/obj/book", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed");
  return result;
}
const field = "w-full border border-white/25 bg-white/5 p-3 text-white";
const button =
  "border border-white/30 px-4 py-3 hover:bg-white/10 disabled:opacity-40";
export function BookApp({ page, section }: { page: Page; section: string }) {
  const { book } = page;
  const home = bookPath(book.slug);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [settings, setSettings] = useState(book);
  const [title, setTitle] = useState("Chapter 1");
  const [slug, setSlug] = useState("chapter-1");
  const [draft, setDraft] = useState<z.infer<typeof bookDraftSchema> | null>(
    page.draft?.draft ?? null,
  );
  const [revision, setRevision] = useState(page.draft?.revision ?? 0);
  const [dirty, setDirty] = useState(false);
  const [checks, setChecks] = useState<{
    id: string;
    source: string;
    corrections: Correction[];
  } | null>(null);
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  const writing = section === "write";
  const signing = section === "sign-in";
  const returning = section === "checkout/return";
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const value = new URL(window.location.href).searchParams.get("token");
    if (value) {
      setToken(value);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const change = (next: NonNullable<typeof draft>) => {
    setDraft(next);
    setDirty(true);
    setChecks(null);
  };
  async function save() {
    if (!draft) return;
    const result = await bookRequest({
      action: "saveDraft",
      chapterId: page.draft!.chapter.id,
      revision,
      draft,
    });
    setRevision(result.revision);
    setDirty(false);
    setStatus("Draft saved privately.");
  }
  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-10 text-white">
      <nav className="mb-10 flex flex-wrap gap-5 text-sm underline">
        <a href={home}>{book.title}</a>
        <a href={bookAuthorPath(book.slug)}>Author area</a>
        <a href={`${home}/sign-in`}>
          {page.reader ? "Reader account" : "Reader sign-in"}
        </a>
      </nav>
      {error && (
        <p role="alert" className="my-4 border border-red-300 p-3">
          {error}
        </p>
      )}
      {status && (
        <output className="my-4 block border border-teal-300 p-3">
          {status}
        </output>
      )}
      {writing ? (
        <>
          <h1 className="mb-6 text-3xl">Author workspace</h1>
          {!page.author ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await bookRequest({ action: "login", key });
                  window.location.reload();
                });
              }}
            >
              <label>
                Author key
                <input
                  className={field}
                  type="password"
                  autoComplete="current-password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  required
                />
              </label>
              <button
                className={button}
                disabled={busy || !page.authorConfigured}
              >
                Sign in
              </button>
              {!page.authorConfigured && (
                <p>Configure BOOK_AUTHOR_KEY on the server first.</p>
              )}
            </form>
          ) : (
            <>
              <button
                className={button}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await bookRequest({ action: "logout" });
                    window.location.reload();
                  })
                }
              >
                Sign out of author area
              </button>
              {draft && page.draft ? (
                <section className="mt-8 flex flex-col gap-5">
                  <label>
                    Chapter title
                    <input
                      className={field}
                      value={draft.title}
                      onChange={(e) =>
                        change({ ...draft, title: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Chapter position
                    <input
                      className={field}
                      type="number"
                      min="1"
                      value={draft.position}
                      onChange={(e) =>
                        change({ ...draft, position: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={draft.free}
                      onChange={(e) =>
                        change({ ...draft, free: e.target.checked })
                      }
                    />{" "}
                    Free to read
                  </label>
                  {draft.perspectives.map((p, index) => (
                    <article
                      key={p.id}
                      className="flex flex-col gap-3 border-t border-white/20 pt-5"
                    >
                      <label>
                        Perspective {index + 1}
                        <textarea
                          className={`${field} mt-2 min-h-64 leading-relaxed`}
                          value={p.text}
                          onChange={(e) =>
                            change({
                              ...draft,
                              perspectives: draft.perspectives.map((x) =>
                                x.id === p.id
                                  ? { ...x, text: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <div className="flex flex-wrap gap-3">
                        <button
                          className={button}
                          disabled={busy || index === 0}
                          onClick={() => {
                            const items = [...draft.perspectives];
                            [items[index - 1], items[index]] = [
                              items[index],
                              items[index - 1],
                            ];
                            change({ ...draft, perspectives: items });
                          }}
                        >
                          Move up
                        </button>
                        <button
                          className={button}
                          disabled={
                            busy || index === draft.perspectives.length - 1
                          }
                          onClick={() => {
                            const items = [...draft.perspectives];
                            [items[index + 1], items[index]] = [
                              items[index],
                              items[index + 1],
                            ];
                            change({ ...draft, perspectives: items });
                          }}
                        >
                          Move down
                        </button>
                        <button
                          className={button}
                          disabled={
                            busy ||
                            !page.proofreadReady ||
                            !p.text.trim() ||
                            p.text.length > 12000
                          }
                          onClick={() =>
                            void run(async () => {
                              const source = p.text;
                              const result = await bookRequest({
                                action: "proofread",
                                text: source,
                              });
                              if (
                                draftRef.current?.perspectives.find(
                                  (x) => x.id === p.id,
                                )?.text !== source
                              ) {
                                setStatus(
                                  "Text changed; run proofreading again.",
                                );
                                return;
                              }
                              setChecks({
                                id: p.id,
                                source,
                                corrections: result.corrections,
                              });
                              if (!result.corrections.length)
                                setStatus(
                                  "No mechanical corrections suggested.",
                                );
                            })
                          }
                        >
                          Proofread this perspective
                        </button>
                      </div>
                      {checks?.id === p.id &&
                        checks.corrections.map((c, i) => (
                          <div key={i} className="border border-white/25 p-4">
                            <p>
                              {c.category.replaceAll("_", " ")}:{" "}
                              <del>{c.original}</del> →{" "}
                              <strong>{c.replacement}</strong>
                            </p>
                            <p className="my-2 text-sm">{c.reason}</p>
                            <button
                              className={button}
                              onClick={() => {
                                if (p.text !== checks.source) {
                                  setChecks(null);
                                  return;
                                }
                                const text = p.text.replace(
                                  c.original,
                                  c.replacement,
                                );
                                const next = {
                                  ...draft,
                                  perspectives: draft.perspectives.map((x) =>
                                    x.id === p.id ? { ...x, text } : x,
                                  ),
                                };
                                change(next);
                                setChecks({
                                  ...checks,
                                  source: text,
                                  corrections: checks.corrections.filter(
                                    (x, j) =>
                                      j !== i &&
                                      text.includes(x.original) &&
                                      text.indexOf(x.original) ===
                                        text.lastIndexOf(x.original),
                                  ),
                                });
                              }}
                            >
                              Accept correction
                            </button>{" "}
                            <button
                              className={button}
                              onClick={() =>
                                setChecks({
                                  ...checks,
                                  corrections: checks.corrections.filter(
                                    (_, j) => j !== i,
                                  ),
                                })
                              }
                            >
                              Dismiss
                            </button>
                          </div>
                        ))}
                    </article>
                  ))}
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() =>
                      change({
                        ...draft,
                        perspectives: [
                          ...draft.perspectives,
                          { id: crypto.randomUUID(), text: "" },
                        ],
                      })
                    }
                  >
                    Add perspective
                  </button>
                  {!page.proofreadReady && (
                    <p className="text-sm">
                      Proofreading is available after OPENAI_API_KEY is
                      configured. It only checks spelling, missing words, and
                      word order.
                    </p>
                  )}
                  <div className="flex gap-4">
                    <button
                      className={button}
                      disabled={busy || !dirty}
                      onClick={() => void run(save)}
                    >
                      Save draft
                    </button>
                    <button
                      className={button}
                      disabled={
                        busy ||
                        dirty ||
                        !draft.perspectives.some((p) => p.text.trim())
                      }
                      onClick={() =>
                        void run(async () => {
                          const result = await bookRequest({
                            action: "publish",
                            chapterId: page.draft!.chapter.id,
                            revision,
                          });
                          setRevision(result.revision);
                          setStatus("Chapter published.");
                        })
                      }
                    >
                      Publish saved draft
                    </button>
                  </div>
                  <p>
                    {dirty ? "Unsaved changes" : "Saved draft"}. Publishing
                    makes this version available to its readers.
                  </p>
                </section>
              ) : (
                <>
                  <section className="my-10">
                    <h2 className="mb-4 text-2xl">Chapters</h2>
                    {page.chapters.map((c) => (
                      <p key={c.id} className="my-3">
                        <a
                          className="underline"
                          href={`${home}/write?draft=${c.id}`}
                        >
                          {c.position}. {c.title}
                        </a>{" "}
                        · {c.published ? "Published" : "Draft"} ·{" "}
                        {c.free ? "Free" : "Paid"}
                      </p>
                    ))}
                    <form
                      className="mt-6 flex flex-col gap-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run(async () => {
                          const result = await bookRequest({
                            action: "createChapter",
                            title,
                            slug,
                          });
                          window.location.assign(
                            `${home}/write?draft=${result.chapterId}`,
                          );
                        });
                      }}
                    >
                      <label>
                        New chapter title
                        <input
                          className={field}
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Chapter URL name
                        <input
                          className={field}
                          pattern="[a-z0-9]+(-[a-z0-9]+)*"
                          value={slug}
                          onChange={(e) => setSlug(e.target.value)}
                          required
                        />
                      </label>
                      <button className={button} disabled={busy}>
                        Create chapter
                      </button>
                    </form>
                  </section>
                  <form
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(async () => {
                        await bookRequest({ action: "settings", settings });
                        window.location.assign(bookAuthorPath(settings.slug));
                      });
                    }}
                  >
                    <h2 className="text-2xl">Book settings</h2>
                    {(["title", "slug", "author", "introduction"] as const).map(
                      (k) => (
                        <label key={k}>
                          {k}
                          <input
                            className={field}
                            value={settings[k]}
                            onChange={(e) =>
                              setSettings({ ...settings, [k]: e.target.value })
                            }
                          />
                        </label>
                      ),
                    )}
                    <label>
                      Whole-book price (USD)
                      <input
                        className={field}
                        type="number"
                        min="1"
                        max="1000"
                        step="0.01"
                        value={
                          settings.price_minor === null
                            ? ""
                            : settings.price_minor / 100
                        }
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            price_minor: e.target.value
                              ? Math.round(Number(e.target.value) * 100)
                              : null,
                          })
                        }
                      />
                    </label>
                    <button className={button} disabled={busy}>
                      Save book settings
                    </button>
                  </form>
                  <p className="mt-6">
                    Email:{" "}
                    {page.emailReady
                      ? "ready"
                      : "configure RESEND_API_KEY and BOOK_EMAIL_FROM"}
                    . Sales:{" "}
                    {page.salesReady
                      ? "ready"
                      : "set a price, Stripe keys, webhook, and email delivery"}
                    .
                  </p>
                </>
              )}
            </>
          )}
        </>
      ) : signing ? (
        <section className="flex flex-col gap-5">
          <h1 className="text-3xl">Reader sign-in</h1>
          {page.reader ? (
            <>
              <p>
                Signed in as {page.reader.email}.{" "}
                {page.owns
                  ? "You own the whole book."
                  : "You have not bought the book yet."}
              </p>
              <button
                className={button}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await bookRequest({ action: "readerLogout" });
                    window.location.reload();
                  })
                }
              >
                Sign out
              </button>
            </>
          ) : token ? (
            <>
              <p>Confirm sign-in on this device.</p>
              <button
                className={button}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await bookRequest({ action: "consumeLink", token });
                    window.location.assign(home);
                  })
                }
              >
                Confirm sign-in
              </button>
            </>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await bookRequest({ action: "requestLink", email });
                  setStatus(
                    "Check your email for a sign-in link. It expires in 15 minutes.",
                  );
                });
              }}
            >
              <label>
                Email address
                <input
                  className={field}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <button className={button} disabled={busy || !page.emailReady}>
                Email me a sign-in link
              </button>
              {!page.emailReady && <p>Email sign-in is not available yet.</p>}
            </form>
          )}
        </section>
      ) : returning ? (
        <section>
          <h1 className="text-3xl">Verify your purchase</h1>
          <p className="my-5">
            We check your payment securely before unlocking the book.
          </p>
          <button
            className={button}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const sessionId = new URL(
                  window.location.href,
                ).searchParams.get("session_id");
                await bookRequest({ action: "reconcile", sessionId });
                window.location.assign(home);
              })
            }
          >
            Check payment and return to book
          </button>
        </section>
      ) : (
        <>
          <header className="mb-10">
            <p className="text-sm uppercase tracking-widest">{book.author}</p>
            <h1 className="my-4 text-4xl">
              {page.chapter?.chapter.title ?? book.title}
            </h1>
            {!page.chapter && (
              <p className="whitespace-pre-wrap leading-relaxed">
                {book.introduction}
              </p>
            )}
          </header>
          {page.chapter ? (
            <>
              {page.chapter.perspectives.map((p) => (
                <p
                  key={p.id}
                  className="mb-8 whitespace-pre-wrap text-lg leading-loose"
                >
                  {p.text}
                </p>
              ))}
              {!page.chapter.perspectives.length && (
                <p className="my-6">
                  {page.chapter.chapter.published
                    ? "This chapter requires whole-book access."
                    : "This chapter is not published yet."}
                </p>
              )}
              <a className="underline" href={home}>
                ← Table of contents
              </a>
            </>
          ) : (
            <section>
              <h2 className="mb-5 text-2xl">Contents</h2>
              {page.chapters
                .filter((c) => c.published)
                .map((c) => (
                  <p key={c.id} className="my-4">
                    <a
                      className="underline"
                      href={bookChapterPath(book.slug, c.slug)}
                    >
                      {c.position}. {c.title}
                    </a>{" "}
                    <span className="text-sm">
                      · {c.free ? "Free" : "Included with the book"}
                    </span>
                  </p>
                ))}
              {!page.chapters.some((c) => c.published) && (
                <p>The first chapter is on its way.</p>
              )}
            </section>
          )}
          <section className="mt-12 border-t border-white/25 pt-6">
            <h2 className="text-2xl">
              {page.owns ? "Your book" : "Get the whole book"}
            </h2>
            <p className="my-4">
              {page.owns
                ? "Your purchase includes future paid chapters."
                : "One payment unlocks all paid chapters, including future chapters. Chapter 1 is free."}
            </p>
            {!page.owns &&
              (page.salesReady ? (
                <>
                  <p className="mb-4">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(book.price_minor! / 100)}{" "}
                    · one-time purchase
                  </p>
                  {page.reader ? (
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const result = await bookRequest({
                            action: "checkout",
                          });
                          window.location.assign(result.url);
                        })
                      }
                    >
                      Buy the book
                    </button>
                  ) : (
                    <a
                      className={`${button} inline-block`}
                      href={`${home}/sign-in`}
                    >
                      Sign in to buy
                    </a>
                  )}
                </>
              ) : (
                <p>Paid access is coming soon.</p>
              ))}
          </section>
        </>
      )}
    </main>
  );
}
