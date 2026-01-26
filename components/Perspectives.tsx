"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Collect } from "@/components/Collect";
import type { Perspective } from "@/types/perspectives";

export const Perspectives = ({ perspectives, link }) => {
  return (
    <>
      <ul className="flex w-screen overflow-x-auto overflow-y-hidden snap-x snap-mandatory grow">
        {perspectives.map((p: Perspective) => (
          <li
            key={p.id}
            data-id={p.id}
            id={p.id}
            className="flex justify-center min-w-[80vw] snap-center p-4"
          >
            <div className="flex flex-col items-center justify-center w-full">
              {p.collection_id && (
                <div className="flex w-full">
                  <Collect
                    collectionId={p.collection_id}
                    perspectiveId={p.id}
                  />
                </div>
              )}
              <div
                className={`flex flex-col w-full center whitespace-pre-line has-[blockquote]:border-l-2 has-[blockquote]:border-purple-700 has-[blockquote]:pl-2 text-shadow-2xs text-shadow-purple-200/20`}
              >
                <div className="flex flex-col">
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {p.perspective}
                  </Markdown>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {link && (
        <div className="flex justify-center min-w-[80vw] snap-center p-4">
          <div className="flex flex-col justify-center w-full">
            <div className="relative mx-auto">
              <img src={link} alt="QR code" className="max-w-full max-h-full" />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
