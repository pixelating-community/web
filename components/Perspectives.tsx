"use client";

import Image from "next/image";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Perspectives({ perspectives }) {
  const CDN_URL =
    process.env.NEXT_PUBLIC_CDN_URL ||
    "https://pixelating.nyc3.cdn.digitaloceanspaces.com";
  return (
    <ul className="flex w-screen overflow-x-auto overflow-y-hidden snap-x snap-mandatory grow">
      {perspectives.map(
        (p: {
          id: string;
          perspective: string;
          topic?: string;
          description?: string;
          color: string;
          objective_key?: string;
        }) => (
          <li
            key={p.id}
            data-id={p.id}
            id={p.id}
            className="flex justify-center min-w-[80vw] snap-center p-4"
            style={{ color: `${p.color}` }}
          >
            <div className="flex flex-col justify-center w-full">
              {p.objective_key && CDN_URL && (
                <div className="relative w-3/4 h-1/2 mx-auto">
                  <Image
                    unoptimized={true}
                    src={`${CDN_URL}/${p.objective_key}`}
                    alt={p?.description || ""}
                    fill
                    style={{
                      objectFit: "contain",
                    }}
                  />
                </div>
              )}
              <div
                className={`flex flex-col justify-center ${p.objective_key ? "text-center" : ""} whitespace-pre-line has-[blockquote]:border-l-2 has-[blockquote]:border-purple-700 has-[blockquote]:pl-2`}
              >
                <Markdown remarkPlugins={[remarkGfm]}>{p.perspective}</Markdown>
              </div>
            </div>
          </li>
        )
      )}
    </ul>
  );
}
