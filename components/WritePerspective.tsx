"use client";
import type { UUID } from "node:crypto";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { addPerspective } from "@/actions/addPerspective";
import { deletePerspective } from "@/actions/deletePerspective";
import { editPerspective } from "@/actions/editPerspective";
import { getSampleLyrics } from "@/actions/getSampleLyrics";
import { Collect } from "@/components/Collect";
import { KaraokeLyrics } from "@/components/KaraokeLyrics";
import { Token } from "@/components/Token";
import { generateSampleUrl } from "@/lib/generateSampleUrl";
import type { Perspective, WritePerspectiveProps } from "@/types/perspectives";

const CDN_URL =
  process.env.NEXT_PUBLIC_CDN_URL ||
  "https://pixelating.nyc3.cdn.digitaloceanspaces.com";
const PIXEL_SIZE = parseInt(process.env.NEXT_PUBLIC_PIXEL_SIZE, 10) || 20;

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
  const [isLyric, setIsLyric] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [perspectiveId, setPerspectiveId] = useState<UUID | null>(null);
  const [characters, setCharacters] = useState(0);
  const [perspectiveText, setPerspectiveText] = useState("");
  const [sample, setSample] = useState("");
  const [sampleId, setSampleId] = useState<UUID | null>(null);
  const [fileDataURL, setFileDataURL] = useState<string | ArrayBuffer | null>(
    null,
  );
  const [description, setDescription] = useState("");
  const [pixelating, setPixelating] = useState(PIXEL_SIZE);

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
    setSampleId(null);
    setIsLyric(false);
    setCharacters(0);
    setFile(null);
    setFileDataURL(null);
    setDescription("");
    setPixelating(PIXEL_SIZE);
    if (fileRef.current) fileRef.current.value = "";
    if (editableRef.current) editableRef.current.textContent = "";
  };

  const handleSubmit = async () => {
    if (!perspectiveText) return;

    const formData = new FormData();
    formData.set("perspective", perspectiveText);

    if (token) formData.append("token", token);
    if (sampleId) formData.append("sample_id", sampleId);
    if (file) {
      formData.append("file", file);
      formData.append("description", description);
      formData.append("pixelat_ing", pixelating.toString());
    }
    if (isLyric && sample) formData.append("sample", sample);

    if (perspectiveId) {
      await editPerspective({
        id: perspectiveId as UUID,
        name,
        formData,
      });
    } else {
      await addPerspective({ topicId: id, name, formData });
      scrollPerspectivesIntoView();
    }

    resetForm();
  };

  const changeFileHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFile(e.target.files[0]);
  };

  const isLyricHandler = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsLyric(checked);

    if (checked && sampleId) {
      const sampleData = await getSampleLyrics({ id: sampleId });
      if (sampleData) {
        const url = generateSampleUrl({
          trackName: sampleData.trackName,
          editName: sampleData.editName,
          start: sampleData.start,
          end: sampleData.end,
        });
        setSample(url);
        setSampleId(sampleData.id);
      }
    } else if (!checked) {
      setSample("");
    }
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
    setSampleId(p.sample_id || null);
    setIsLyric(false);
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

  useEffect(() => {
    let fileReader: FileReader;
    let isCancel = false;
    if (file) {
      fileReader = new FileReader();
      fileReader.onload = (e) => {
        if (!isCancel) setFileDataURL(e.target?.result ?? null);
      };
      fileReader.readAsDataURL(file);
    }
    return () => {
      isCancel = true;
      if (fileReader && fileReader.readyState === 1) fileReader.abort();
    };
  }, [file]);

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
            <div className="flex flex-col justify-center w-full items-center">
              {p.objective_src && CDN_URL && (
                <div className="relative w-3/4 h-1/2 mx-auto">
                  <Image
                    unoptimized
                    src={`${CDN_URL}/${p.objective_src}`}
                    alt={p.description || ""}
                    fill
                    style={{ objectFit: "contain" }}
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
              {p.sample_id && p.track_id && p.edit_id && p.track_src && (
                <div className="flex flex-col w-3/4">
                  <KaraokeLyrics
                    trackId={p.track_id}
                    editId={p.edit_id}
                    lyrics={p.lyrics || []}
                    audioSrc={`${CDN_URL}/${p.track_src}`}
                    startTime={p.start || 0}
                    endTime={p.end || 0}
                    mini
                    norepeat
                  />
                </div>
              )}
              <div
                data-id={p.id}
                className={`flex flex-col ${p.objective_src ? "items-center" : ""} w-full text-left`}
              >
                {perspectiveId === p.id ? (
                  /* biome-ignore lint/a11y/useSemanticElements: contentEditable needed */
                  <div
                    tabIndex={0}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-label="Edit perspective"
                    aria-multiline="true"
                    onFocus={() => setFocus(true)}
                    onBlur={(e) => {
                      setFocus(false);
                      setPerspectiveText(e.currentTarget.textContent || "");
                      setCharacters((e.currentTarget.textContent || "").length);
                    }}
                    className={`flex flex-col justify-center ${p.objective_src ? "text-center" : ""} whitespace-pre-wrap outline-none cursor-text ring-2 ring-purple-500/30 p-2 rounded w-full`}
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
                    className={`flex flex-col justify-center ${p.objective_src ? "text-center" : ""} whitespace-pre-line has-[blockquote]:border-l-2 has-[blockquote]:border-purple-700 has-[blockquote]:pl-2 text-shadow-2xs text-shadow-neutral-200/20 cursor-pointer w-full text-left border-0 bg-transparent p-0`}
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
          {/* biome-ignore lint/a11y/useSemanticElements: contentEditable needed */}
          <div
            tabIndex={0}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label="New perspective"
            aria-multiline="true"
            ref={editableRef}
            onFocus={() => setFocus(true)}
            onBlur={(e) => {
              setFocus(false);
              setPerspectiveText(e.currentTarget.textContent || "");
              setCharacters((e.currentTarget.textContent || "").length);
            }}
            className="flex flex-col justify-center whitespace-pre-wrap outline-none cursor-text ring-2 ring-purple-500/30 p-2 rounded w-full text-left min-h-[100px]"
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
      <div className="flex flex-col items-center w-4/5 mx-auto py-2 shrink-0">
        <div className="-translate-x-2/4 -translate-y-2/4 top-1/2 left-1/2 z-50">
          {file && (
            <div className="grow mr-1 bg-slate-900/90 p-4 rounded shadow-lg">
              <label className="sr-only" htmlFor="description">
                description
              </label>
              <input
                data-testid="description"
                className="rounded border border-gray-700 dark:bg-slate-800/20 focus:ring-purple-700 text-xs w-full mb-1"
                type="text"
                id="description"
                name="description"
                placeholder="🖼️ 🖌️"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <label className="sr-only" htmlFor="pixelat_ing">
                pixelat_ing
              </label>
              <input
                data-testid="pixelat_ing"
                className="rounded border border-gray-700 dark:bg-slate-800 focus:ring-purple-700 text-xs w-full mb-1 accent-purple-500"
                type="range"
                min={PIXEL_SIZE - 10}
                max={PIXEL_SIZE + 10}
                id="pixelat_ing"
                name="pixelat_ing"
                step="1"
                value={pixelating}
                onChange={(e) => setPixelating(parseInt(e.target.value, 10))}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col items-center w-full mb-2">
          <div className="flex w-full h-full">
            <div className="flex flex-col h-full">
              {fileDataURL && (
                <img
                  data-testid="preview"
                  alt="File preview"
                  src={fileDataURL as string}
                  className="text-[8px] w-4 h-auto"
                />
              )}
              <label htmlFor="file" className="cursor-pointer">
                🖼️
              </label>
              <input
                data-testid="file"
                ref={fileRef}
                className="hidden mb-1"
                type="file"
                id="file"
                name="file"
                onChange={changeFileHandler}
              />
              <label htmlFor="lyric" className="cursor-pointer mt-1">
                🎤
              </label>
              <input
                data-testid="lyric"
                className="opacity-0 w-4 h-4 cursor-pointer"
                type="checkbox"
                id="lyric"
                name="lyric"
                checked={isLyric}
                onChange={isLyricHandler}
              />
              {perspectiveId && (
                <button type="button" onClick={deletePerspectiveHandler}>
                  🗑️
                </button>
              )}
            </div>
            <div className="flex h-full grow w-full ml-1 md:w-10/12">
              <input
                data-testid="sample"
                className={`w-full text-black p-4 border-0 border-gray-700 dark:bg-slate-800/10 focus:dark:bg-slate-800/5 text-xs outline-none ${isLyric ? "block" : "hidden"}`}
                type="text"
                id="sample"
                name="sample"
                placeholder="🧪"
                value={sample}
                onChange={(e) => setSample(e.target.value)}
              />
              <div className="ml-2 w-4 h-4">
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
            className="inline-flex items-center justify-center mt-1 p-2 dark:bg-slate-300/10 focus:dark:bg-slate-300/10 outline-none border-0 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {btnText}
          </button>
        </div>
      </div>
    </div>
  );
}
