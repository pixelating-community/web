"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SM } from "@/components/SM";
import {
  getSecretInk,
  getSMPngDimensions,
  layoutSM,
  SECRET_ALPHABET,
  SM_LIMIT,
  SM_SAMPLE_MESSAGE,
  type SecretInk,
  type SecretLetter,
} from "@/lib/secretAlphabet";

const ACTION_CLASS =
  "ui-focus-ring inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-35";

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export function SMComposer({
  initialMessage = "",
}: {
  initialMessage?: string;
}) {
  const id = useId();
  const [message, setMessage] = useState(initialMessage.slice(0, SM_LIMIT));
  const [ink, setInk] = useState<SecretInk>("rose");
  const [columns, setColumns] = useState(16);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const layout = useMemo(() => layoutSM(message, columns), [message, columns]);
  const canDownload =
    layout.symbols.length > 0 && layout.unsupported.length === 0 && !exporting;

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const observer = new ResizeObserver(([entry]) => {
      setColumns(
        Math.max(
          4,
          Math.min(20, Math.floor((entry.contentRect.width - 64) / 42)),
        ),
      );
    });
    observer.observe(preview);
    return () => observer.disconnect();
  }, []);

  const updateMessage = (next: string) => {
    setMessage(next.slice(0, SM_LIMIT));
    setStatus("");
  };

  const download = async (format: "svg" | "png") => {
    if (!svgRef.current || !canDownload) return;
    setExporting(true);
    setStatus("");
    try {
      const svg = svgRef.current.cloneNode(true) as SVGSVGElement;
      svg.removeAttribute("class");
      svg.removeAttribute("role");
      svg.removeAttribute("aria-label");
      const pngDimensions = getSMPngDimensions(layout);
      if (format === "png") {
        svg.setAttribute("width", String(pngDimensions.width));
        svg.setAttribute("height", String(pngDimensions.height));
      }
      const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
        type: "image/svg+xml;charset=utf-8",
      });
      if (format === "svg") {
        downloadBlob(blob, "secret-message.svg");
      } else {
        const imageUrl = URL.createObjectURL(blob);
        try {
          const image = new Image();
          image.src = imageUrl;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = pngDimensions.width;
          canvas.height = pngDimensions.height;
          const context = canvas.getContext("2d");
          if (!context)
            throw new Error("Image export is unavailable in this browser.");
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const png = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (result) =>
                result
                  ? resolve(result)
                  : reject(new Error("Could not create the image.")),
              "image/png",
            );
          });
          downloadBlob(png, "secret-message.png");
        } finally {
          URL.revokeObjectURL(imageUrl);
        }
      }
      setStatus(`${format.toUpperCase()} downloaded.`);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Download failed. Please try again.",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] lg:items-start">
      <section
        className="rounded-2xl border border-white/12 bg-white/[0.035] p-5 sm:p-7"
        aria-labelledby={`${id}-compose`}
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 id={`${id}-compose`} className="text-lg! font-medium">
            Your message
          </h2>
          <button
            type="button"
            onClick={() => {
              updateMessage(SM_SAMPLE_MESSAGE);
              messageRef.current?.focus();
            }}
            className="ui-focus-ring min-h-11 text-sm text-fuchsia-300 hover:text-fuchsia-200"
          >
            Try the sample ↗
          </button>
        </div>
        <label
          htmlFor={`${id}-message`}
          className="mb-2 block text-sm text-white/60"
        >
          Write in English. Watch it become symbols.
        </label>
        <textarea
          ref={messageRef}
          id={`${id}-message`}
          value={message}
          onChange={(event) => updateMessage(event.target.value)}
          maxLength={SM_LIMIT}
          placeholder="A little secret, just for you…"
          rows={4}
          spellCheck={false}
          autoComplete="off"
          aria-describedby={`${id}-note ${id}-unsupported`}
          className="ui-focus-ring w-full resize-y rounded-xl border border-white/15 bg-black/20 p-4 text-base leading-relaxed text-white placeholder:text-white/25 sm:min-h-48"
        />
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-white/40">
          <span>
            {message.length} / {SM_LIMIT}
          </span>
          <button
            type="button"
            disabled={!message}
            onClick={() => {
              updateMessage("");
              messageRef.current?.focus();
            }}
            className="ui-focus-ring min-h-11 min-w-11 px-2 hover:text-white disabled:opacity-30"
          >
            Clear
          </button>
        </div>
        <p
          id={`${id}-note`}
          className="mt-3 text-sm! leading-relaxed text-white/50"
        >
          A–Z use your alphabet. Spaces, line breaks, numbers, and punctuation
          stay in place. Z uses a regular Z for now.
        </p>
        <output
          id={`${id}-unsupported`}
          className="mt-2 block text-sm text-amber-300"
        >
          {layout.unsupported.length
            ? `No symbol for: ${layout.unsupported.join(", ")}. Replace these characters to download your message.`
            : ""}
        </output>
      </section>

      <section aria-labelledby={`${id}-preview`} className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 id={`${id}-preview`} className="text-lg! font-medium">
            In secret
          </h2>
          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">Ink color</legend>
            {(
              [
                ["rose", "Rose ink"],
                ["black", "Black ink"],
                ["alphabet", "Alphabet colors"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="relative flex h-11 w-11 cursor-pointer items-center justify-center"
                title={label}
              >
                <input
                  type="radio"
                  name={`${id}-ink`}
                  value={value}
                  checked={ink === value}
                  onChange={() => {
                    setInk(value);
                    setStatus("");
                  }}
                  className="peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
                  aria-label={label}
                />
                <span className="pointer-events-none absolute inset-0 rounded-full border border-transparent peer-checked:border-white/65 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-fuchsia-300" />
                <span
                  className="pointer-events-none h-6 w-6 rounded-full border border-white/20"
                  style={{
                    background:
                      value === "alphabet"
                        ? "conic-gradient(#b85b25, #328659, #245487, #a33372, #b85b25)"
                        : getSecretInk(null, value),
                  }}
                />
              </label>
            ))}
          </fieldset>
        </div>
        <div
          ref={previewRef}
          className="relative max-h-[65dvh] min-h-64 overflow-auto rounded-xl bg-[#fcfaf5] shadow-[0_18px_70px_-20px_#0009]"
        >
          <SM
            ref={svgRef}
            layout={layout}
            ink={ink}
            className="block h-auto w-full"
          />
          {!layout.symbols.length && (
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-[#a93470]/55"
              aria-hidden="true"
            >
              <svg width="130" height="54" viewBox="0 0 190 80">
                {(["H", "I"] as const).map((letter, index) => (
                  <path
                    key={letter}
                    d={SECRET_ALPHABET[letter].path}
                    transform={`translate(${30 + index * 70} 0)`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </svg>
              <span className="text-sm">Your secret starts here.</span>
            </div>
          )}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!canDownload}
            onClick={() => void download("png")}
            className={`${ACTION_CLASS} bg-fuchsia-300 text-[#211522] enabled:hover:bg-fuchsia-200`}
          >
            {exporting ? "Preparing…" : "Download image"}
          </button>
          <button
            type="button"
            disabled={!canDownload}
            onClick={() => void download("svg")}
            className={`${ACTION_CLASS} border border-white/20 text-white/80 enabled:hover:bg-white/10`}
          >
            Download SVG
          </button>
        </div>
        <output
          aria-live="polite"
          className="mt-3 block min-h-5 text-sm text-white/60"
        >
          {status}
        </output>
      </section>
      <details className="rounded-2xl border border-white/12 bg-white/[0.035] p-5 sm:p-7 lg:col-span-2">
        <summary className="ui-focus-ring min-h-11 cursor-pointer py-3 text-sm text-white/70">
          The alphabet key
        </summary>
        <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-9 lg:grid-cols-13">
          {(
            Object.entries(SECRET_ALPHABET) as [
              SecretLetter,
              (typeof SECRET_ALPHABET)[SecretLetter],
            ][]
          ).map(([letter, glyph]) => (
            <div
              key={letter}
              className="flex flex-col items-center rounded-lg border border-white/10 bg-white/[0.025] py-2"
            >
              <svg
                viewBox="0 0 64 80"
                width="38"
                height="48"
                aria-hidden="true"
              >
                <path
                  d={glyph.path}
                  fill="none"
                  stroke={ink === "alphabet" ? "#f5d7e8" : "#f5b3d5"}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="mt-1 text-xs text-white/50">
                {letter}
                {letter === "Z" ? "*" : ""}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs! text-white/40">
          * Z is a placeholder. The four-pointed symbol is Q.
        </p>
      </details>
    </div>
  );
}
