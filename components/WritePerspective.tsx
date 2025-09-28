"use client";

import type { UUID } from "node:crypto";
import Image from "next/image";
import { useEffect, useOptimistic, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { addPerspective } from "@/actions/addPerspective";
import { deletePerspective } from "@/actions/deletePerspective";
import { editPerspective } from "@/actions/editPerspective";
import { getSampleLyrics } from "@/actions/getSampleLyrics";
import { Collect } from "@/components/Collect";
import { KaraokeLyrics } from "@/components/KaraokeLyrics";
import { Submit } from "@/components/Submit";
import { generateSampleUrl } from "@/lib/generateSampleUrl";

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
}) {
  const MAX_LENGTH = 500;
  const MAX_ROWS = 5;
  const btnText = !locked ? "🖋️" : "🔒";
  const [focus, setFocus] = useState(false);
  const [isLyric, setIsLyric] = useState(false);
  const [file, setFile] = useState(null);
  const [perspectiveId, setPerspectiveId] = useState(null);
  const [characters, setCharacters] = useState(0);
  const [perspective, setPerspective] = useState("");
  const [sample, setSample] = useState("");
  const [sampleId, setSampleId] = useState(null);
  const [fileDataURL, setFileDataURL] = useState(null);
  const [color, setColor] = useState("#ededed");
  const formRef = useRef<HTMLFormElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const perspectivesEndRef = useRef<HTMLDivElement | null>(null);
  const perspectivesForwardEndRef = useRef<HTMLDivElement | null>(null);
  const perspectiveRef = useRef<HTMLTextAreaElement | null>(null);

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

  const deletePerspectiveHandler = async () => {
    if (perspectiveId) {
      await deletePerspective({ perspectiveId });
      setPerspectiveId(null);
      setPerspective("");
      setSampleId(null);
      setIsLyric(false);
      setCharacters(0);
      if (perspectiveRef.current) {
        perspectiveRef.current.value = "";
      }
    }
  };

  async function formAction(formData: FormData) {
    if (token) {
      formData.append("token", token);
    }
    if (sampleId) {
      formData.append("sample_id", sampleId);
    }
    if (perspective && fileRef.current) {
      if (perspectiveId) {
        addOptimisticPerspective(perspective);
        await editPerspective({
          id: perspectiveId as UUID,
          name,
          formData,
        });
        setPerspectiveId("");
      } else {
        const formDataPerspective = formData.get("perspective");
        addOptimisticPerspectives(formDataPerspective);
        await addPerspective({ topicId: id, name, formData });
        scrollPerspectivesIntoView();
      }
      fileRef.current.value = "";
      setPerspective("");
      setFileDataURL(null);
      setFile(null);
    }
  }

  const isLyricHandler = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsLyric(checked);

    if (checked && sampleId) {
      const sample = await getSampleLyrics({
        id: sampleId,
      });
      if (sample) {
        const url = generateSampleUrl({
          trackName: sample.trackName,
          editName: sample.editName,
          start: sample.start,
          end: sample.end,
        });
        setSample(url);
        setSampleId(sample.id);
      }
    } else if (!checked) {
      setSample("");
    }
  };

  const changeFileHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files[0]);
  };

  const changeTextareaHandler = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFocus(true);
    setCharacters(e.target.value.length);
    setPerspective(e.target.value);
  };

  const [optimisiticPerspective, addOptimisticPerspective] =
    useOptimistic(perspective);
  const [optimisiticPerspectives, addOptimisticPerspectives] = useOptimistic(
    perspectives,
    (state, newPerspective) => [...state, { perspective: newPerspective }],
  );

  useEffect(() => {
    let fileReader: FileReader;
    let isCancel = false;
    if (file) {
      fileReader = new FileReader();
      fileReader.onload = (e: { target: { result: string | ArrayBuffer } }) => {
        const { result } = e.target;
        if (result && !isCancel) {
          setFileDataURL(result);
        }
      };
      fileReader.readAsDataURL(file);
    }

    return () => {
      isCancel = true;
      if (fileReader && fileReader.readyState === 1) {
        fileReader.abort();
      }
    };
  }, [file]);
  return (
    <>
      <div
        ref={perspectivesEndRef}
        className="flex w-screen overflow-x-auto overflow-y-hidden snap-x snap-mandatory grow scrollbar-transparent"
      >
        {optimisiticPerspectives.map(
          (
            p: {
              id: UUID;
              perspective: string;
              objective_src: string;
              color: string;
              description: string;
              sample_id: UUID;
              collection_id: UUID;
              lyrics: {
                id?: string;
                timestamp: string;
                lyric: string;
                style?: string;
                url?: string;
              }[][];
              edit_id: UUID;
              track_id: UUID;
              track_src: string;
              start: number;
              end: number;
            },
            index: number,
          ) => (
            <div
              key={`${index}_${p.id}`}
              id={p.id}
              ref={
                index === optimisiticPerspectives.length - 1
                  ? perspectivesForwardEndRef
                  : null
              }
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
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setPerspectiveId(p.id);
                    setPerspective(p.perspective);
                    setSampleId(p.sample_id);
                    setIsLyric(false);
                  }}
                  data-id={p.id}
                  className={`flex flex-col ${p.objective_src ? "items-center" : ""} w-full text-left`}
                  style={{ color: `${p.color}` }}
                >
                  <div
                    className={`flex flex-col justify-center ${p.objective_src ? "text-center" : ""} whitespace-pre-line has-[blockquote]:border-l-2 has-[blockquote]:border-purple-700 has-[blockquote]:pl-2 text-shadow-2xs text-shadow-purple-200/20`}
                  >
                    <Markdown remarkPlugins={[remarkGfm]}>
                      {perspectiveId === p.id
                        ? optimisiticPerspective
                        : p.perspective}
                    </Markdown>
                  </div>
                </button>
              </div>
            </div>
          ),
        )}
        <div className="flex justify-center min-w-[80vw] snap-center p-4">
          <div className="flex flex-col justify-center w-full">
            <div className="relative mx-auto">
              <img src={link} alt="QR code" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center w-4/5 mx-auto mt-1">
        <form
          action={formAction}
          ref={formRef}
          className="flex flex-col items-center w-full mb-2"
          autoComplete="off"
        >
          <div className="fixed -translate-x-2/4 -translate-y-2/4 top-1/2 left-1/2">
            {file ? (
              <div className="grow mr-1">
                <label className="sr-only" htmlFor="description">
                  description
                </label>
                <input
                  data-testid="description"
                  className="rounded border border-gray-700 dark:bg-slate-800/20 focus:ring-purple-700 text-xs w-full mb-1 ml-1"
                  type="text"
                  id="description"
                  name="description"
                  placeholder="🖼️ 🖌️"
                />
                <label className="sr-only" htmlFor="pixelat_ing">
                  pixelat_ing
                </label>
                <input
                  data-testid="pixelat_ing"
                  className="rounded border border-gray-700 dark:bg-slate-800 focus:ring-purple-700 text-xs w-full mb-1 ml-1 accent-purple-500"
                  type="range"
                  min={PIXEL_SIZE - 10}
                  max={PIXEL_SIZE + 10}
                  id="pixelat_ing"
                  name="pixelat_ing"
                  step="1"
                />
              </div>
            ) : null}
          </div>
          <div className="flex w-full h-full">
            <div className="flex grow-0 flex-col h-full">
              <img
                data-testid="preview"
                alt=""
                src={fileDataURL}
                className="text-[8px] w-4 h-auto"
              />
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
                placeholder="capture"
                onChange={(e) => changeFileHandler(e)}
              />
              <label
                style={{ color: `${color}` }}
                htmlFor="color"
                className="cursor-pointer"
              >
                🎨
              </label>
              <div className="h-full w-full cursor-pointer">
                <input
                  data-testid="color"
                  className="opacity-0"
                  type="color"
                  id="color"
                  name="color"
                  placeholder="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>
              <label htmlFor="lyric" className="cursor-pointer">
                🎤
              </label>
              <div className="h-full w-full cursor-pointer">
                <input
                  data-testid="lyric"
                  className="opacity-0"
                  type="checkbox"
                  id="lyric"
                  name="lyric"
                  placeholder="lyric"
                  onChange={(e) => isLyricHandler(e)}
                />
              </div>
              <div className="h-full w-full cursor-pointer">
                {perspectiveId && (
                  <button type="button" onClick={deletePerspectiveHandler}>
                    🗑️
                  </button>
                )}
              </div>
            </div>
            <div className="flex h-full flex-grow w-full ml-1 md:w-10/12">
              <div className={`${isLyric ? "hidden" : "block"} w-full`}>
                <label className="align-middle sr-only" htmlFor="perspective">
                  perspective
                </label>
                <textarea
                  data-testid="perspective"
                  id="perspective"
                  placeholder="🤔"
                  className="text-black p-4 border-0 border-gray-700 dark:bg-slate-800/10 focus:dark:bg-slate-800/5 text-xs w-full outline-none"
                  maxLength={MAX_LENGTH}
                  rows={MAX_ROWS}
                  name="perspective"
                  onChange={(e) => changeTextareaHandler(e)}
                  onClick={() => {
                    setCharacters(perspective.length);
                    setFocus(true);
                  }}
                  onBlur={() => setFocus(false)}
                  ref={perspectiveRef}
                  value={perspective}
                  style={{ color: `${color}` }}
                  spellCheck="true"
                  required
                />
                <div className="ml-2 w-4 h-4">
                  {focus && characters > MAX_LENGTH / 4 && (
                    <span>
                      {characters}/{MAX_LENGTH}
                    </span>
                  )}
                </div>
              </div>
              <div className={`${isLyric ? "block" : "hidden"} w-full`}>
                <label className="sr-only" htmlFor="sample">
                  sample
                </label>
                <div className="h-full w-full cursor-pointer">
                  <input
                    data-testid="sample"
                    className="text-black p-4 border-0 border-gray-700 dark:bg-slate-800/10 focus:dark:bg-slate-800/5 text-xs outline-none w-full"
                    type="text"
                    id="sample"
                    name="sample"
                    placeholder="🧪"
                    value={sample}
                    onChange={(e) => setSample(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          <Submit
            testid="submit"
            btnText={btnText}
            className="mt-1 p-2 dark:bg-slate-800/10 focus:dark:bg-slate-800/10 outline-none border-0"
          />
        </form>
      </div>
    </>
  );
}
