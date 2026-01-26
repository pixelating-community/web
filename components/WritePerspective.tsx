"use client";

import { useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { addPerspective } from "@/actions/addPerspective";
import { deletePerspective } from "@/actions/deletePerspective";
import { editPerspective } from "@/actions/editPerspective";
import { Collect } from "@/components/Collect";
import { Token } from "@/components/Token";
import type { Perspective, WritePerspectiveProps } from "@/types/perspectives";

export function WritePerspective({
  id,
  name,
  perspectives,
  locked,
  token,
  forward,
  link,
}: WritePerspectiveProps) {
  const MAX_LENGTH = 555;
  const btnText = !locked ? "🖋️" : "🔒";
  const [focus, setFocus] = useState(false);
  const [perspectiveId, setPerspectiveId] = useState<string | null>(null);
  const [characters, setCharacters] = useState(0);
  const [perspectiveText, setPerspectiveText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const perspectivesEndRef = useRef<HTMLDivElement | null>(null);
  const perspectivesForwardEndRef = useRef<HTMLDivElement | null>(null);
  const editableRef = useRef<HTMLDivElement | null>(null);

  const scrollPerspectivesIntoView = () => {
    setTimeout(() => {
      requestAnimationFrame(() => {
        if (!forward && perspectivesEndRef.current) {
          perspectivesEndRef.current.scrollLeft = 0;
        } else if (forward && perspectivesForwardEndRef.current) {
          perspectivesForwardEndRef.current.scrollIntoView({
            block: "end",
          });
        }
      });
    }, 500);
  };

  const resetForm = () => {
    setPerspectiveId(null);
    setPerspectiveText("");
    setCharacters(0);
    setConfirmDelete(false);
    if (fileRef.current) fileRef.current.value = "";
    if (editableRef.current) editableRef.current.textContent = "";
  };

  const handleSubmit = async () => {
    if (!perspectiveText) return;

    const formData = new FormData();
    formData.set("perspective", perspectiveText);

    if (token) formData.append("token", token);

    if (perspectiveId) {
      await editPerspective({
        id: perspectiveId,
        name,
        formData,
      });
    } else {
      await addPerspective({ topicId: id, name, formData });
      scrollPerspectivesIntoView();
    }

    resetForm();
  };

  const deletePerspectiveHandler = async () => {
    if (perspectiveId) {
      await deletePerspective({ perspectiveId });
      resetForm();
    }
  };

  const handlePerspectiveClick = (p: Perspective) => {
    setPerspectiveId(p.id);
    setPerspectiveText(p.perspective);
    setCharacters(p.perspective.length);
    setFocus(true);

    setTimeout(() => {
      const editableElement = document.querySelector(
        `[data-id="${p.id}"] [contenteditable="true"]`,
      ) as HTMLDivElement;

      if (editableElement) {
        editableElement.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(editableElement);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, 0);
  };

  const handlePerspectiveKeyDown = (e: React.KeyboardEvent, p: Perspective) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handlePerspectiveClick(p);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden">
      {!token && <Token name={name} topicId={id} perspectiveId={null} />}
      <div
        ref={perspectivesEndRef}
        className="flex w-screen overflow-x-auto overflow-y-hidden snap-x snap-mandatory grow scrollbar-transparent touch-pan-x"
      >
        {perspectives.map((p, index) => (
          <div
            key={`${index}_${p.id}`}
            id={p.id}
            ref={
              index === perspectives.length - 1
                ? perspectivesForwardEndRef
                : null
            }
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

              <div data-id={p.id} className="flex flex-col w-full text-left">
                {perspectiveId === p.id ? (
                  <div
                    role="textbox"
                    tabIndex={0}
                    contentEditable
                    suppressContentEditableWarning
                    aria-label="Edit perspective"
                    aria-multiline="true"
                    onFocus={() => setFocus(true)}
                    onBlur={(e) => {
                      setFocus(false);
                      setPerspectiveText(e.currentTarget.textContent || "");
                      setCharacters((e.currentTarget.textContent || "").length);
                    }}
                    className="
                      flex flex-col justify-center
                      whitespace-pre-wrap
                      outline-none
                      cursor-text
                      ring-2 ring-purple-500/30
                      p-2
                      w-full
                      text-left
                      text-shadow-2xs text-shadow-neutral-200/20
                      has-[blockquote]:border-l-2
                      has-[blockquote]:border-purple-700
                      has-[blockquote]:pl-2
                      leading-relaxed
                    "
                    dir="ltr"
                    style={{ direction: "ltr" }}
                  >
                    {perspectiveText}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePerspectiveClick(p)}
                    onKeyDown={(e) => handlePerspectiveKeyDown(e, p)}
                    className="
                      flex flex-col justify-center
                      whitespace-pre-line
                      has-[blockquote]:border-l-2
                      has-[blockquote]:border-purple-700
                      has-[blockquote]:pl-2
                      text-shadow-2xs text-shadow-neutral-200/20
                      cursor-pointer w-full text-left
                      border-0 bg-transparent p-0
                    "
                  >
                    <Markdown remarkPlugins={[remarkGfm]}>
                      {p.perspective}
                    </Markdown>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        <div className="flex justify-center min-w-[80vw] snap-center p-4">
          <div
            role="textbox"
            tabIndex={0}
            contentEditable
            suppressContentEditableWarning
            aria-label="New perspective"
            aria-multiline="true"
            ref={editableRef}
            onFocus={() => setFocus(true)}
            onBlur={(e) => {
              setFocus(false);
              setPerspectiveText(e.currentTarget.textContent || "");
              setCharacters((e.currentTarget.textContent || "").length);
            }}
            className="
              flex flex-col justify-center
              whitespace-pre-wrap
              outline-none cursor-text
              ring-2 ring-purple-500/30
              p-2 rounded
              w-full text-left min-h-[100px]
              text-shadow-2xs text-shadow-neutral-200/20
              has-[blockquote]:border-l-2
              has-[blockquote]:border-purple-700
              has-[blockquote]:pl-2
              leading-relaxed
            "
            dir="ltr"
            style={{ direction: "ltr" }}
          />
        </div>

        {link && (
          <div className="flex justify-center min-w-[80vw] snap-center p-4">
            <div className="flex flex-col justify-center w-full">
              <div className="relative mx-auto">
                <img
                  src={link}
                  alt="QR code"
                  className="max-w-full max-h-full"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center w-4/5 py-2 mx-auto shrink-0">
        <div className="flex flex-col items-center w-full mb-2">
          <div className="flex w-full h-full">
            <div className="flex flex-col h-full">
              {perspectiveId &&
                (confirmDelete ? (
                  <button
                    type="button"
                    onClick={deletePerspectiveHandler}
                    className="text-xs"
                  >
                    🗑️
                  </button>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(true)}>
                    🗑️
                  </button>
                ))}
            </div>
            <div className="flex w-full h-full ml-1 grow md:w-10/12">
              <div className="w-4 h-4 ml-2">
                {focus && characters > MAX_LENGTH / 4 && (
                  <span className="text-xs text-shadow-2xs text-shadow-neutral-200/20">
                    {characters}/{MAX_LENGTH}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            tabIndex={0}
            type="button"
            onClick={handleSubmit}
            disabled={!perspectiveText}
            data-testid="submit"
            className="inline-flex items-center justify-center p-2 mt-1 border-0 outline-none dark:bg-slate-300/10 focus:dark:bg-slate-300/10 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {btnText}
          </button>
        </div>
      </div>
    </div>
  );
}
