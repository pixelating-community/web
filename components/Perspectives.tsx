"use client";

import type { UUID } from "node:crypto";
import Image from "next/image";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Collect } from "@/components/Collect";
import { KaraokeLyrics } from "@/components/KaraokeLyrics";

export const Perspectives = ({ perspectives }) => {
  const CDN_URL =
    process.env.NEXT_PUBLIC_CDN_URL ||
    "https://pixelating.nyc3.cdn.digitaloceanspaces.com";
  return (
    <ul className="flex w-screen overflow-x-auto overflow-y-hidden snap-x snap-mandatory grow">
      {perspectives.map(
        (p: {
          id: UUID;
          perspective: string;
          topic?: string;
          description?: string;
          sample_id: UUID;
          collection_id: UUID;
          lyrics: {
            id?: UUID;
            timestamp: string;
            lyric: string;
            style?: string;
            url?: string;
          }[][];
          edit_id: UUID;
          track_id: UUID;
          track_src: string;
          color: string;
          objective_src?: string;
          audioSrc?: string;
          start: number;
          end: number;
        }) => (
          <li
            key={p.id}
            data-id={p.id}
            id={p.id}
            className="flex justify-center min-w-[80vw] snap-center p-4"
          >
            <div className="flex flex-col justify-center w-full items-center">
              {p.objective_src && CDN_URL && (
                <div className="relative w-3/4 h-1/2 mx-auto">
                  <Image
                    unoptimized={true}
                    src={`${CDN_URL}/${p.objective_src}`}
                    alt={p?.description || ""}
                    fill
                    style={{
                      objectFit: "contain",
                    }}
                  />
                </div>
              )}
              {p.collection_id && (
                <div className="flex w-full">
                  <Collect
                    collectionId={p.collection_id}
                    perspectiveId={p.id}
                  />
                </div>
              )}
              {p.sample_id && (
                <div className="flex flex-col w-3/4">
                  <KaraokeLyrics
                    trackId={p.track_id}
                    editId={p.edit_id}
                    lyrics={p.lyrics}
                    audioSrc={`${CDN_URL}/${p.track_src}`}
                    startTime={p.start}
                    endTime={p.end}
                    mini
                    norepeat={true}
                  />
                </div>
              )}
              <div
                style={{ color: `${p.color}` }}
                className={`flex flex-col w-full center ${p.objective_src ? "text-center" : ""} whitespace-pre-line has-[blockquote]:border-l-2 has-[blockquote]:border-purple-700 has-[blockquote]:pl-2`}
              >
                <div className="flex">
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {p.perspective}
                  </Markdown>
                </div>
              </div>
            </div>
          </li>
        ),
      )}
    </ul>
  );
};
