"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useOptimistic, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { addPerspective, editPerspective } from "@/actions";
import { Submit } from "@/components/Submit";

export function WritePerspective({ topicId, perspectives, locked, token }) {
  const btnText = !locked ? "🖋️" : "🔒";
  const [file, setFile] = useState(null);
  const [perspectiveId, setPerspectiveId] = useState("");
  const [perspective, setPerspective] = useState("");
  const [edit, setEdit] = useState(false);
  const [objectiveKey, setObjectiveKey] = useState("");
  const [fileDataURL, setFileDataURL] = useState(null);
  const [color, setColor] = useState("#000000");
  const formRef = useRef<HTMLFormElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const perspectivesEndRef = useRef<HTMLDivElement | null>(null);
  const perspectiveRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollPerspectivesIntoView = () => {
    perspectivesEndRef.current.scrollIntoView({
      block: "end",
      inline: "nearest",
    });
  };

  async function formAction(formData: FormData) {
    if (token) {
      formData.append("token", token);
    }
    if (perspective && fileRef.current) {
      if (perspectiveId) {
        addOptimisticPerspective(perspective);
        await editPerspective(topicId, perspectiveId, objectiveKey, formData);
        setObjectiveKey("");
        setPerspectiveId("");
      } else {
        const formDataPerspective = formData.get("perspective");
        addOptimisticPerspectives(formDataPerspective);
        await addPerspective(topicId, formData);
        setEdit(false);
        perspectiveRef.current["value"] = "";
        fileRef.current["value"] = "";
        scrollPerspectivesIntoView();
      }
      setPerspective("");
    }
  }

  const changeFileHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files[0]);
  };

  const changeTextareaHandler = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPerspective(e.target.value);
  };

  const [optimisiticPerspective, addOptimisticPerspective] =
    useOptimistic(perspective);
  const [optimisiticPerspectives, addOptimisticPerspectives] = useOptimistic(
    perspectives,
    (state, newPerspective) => [...state, { perspective: newPerspective }]
  );

  useEffect(() => {
    if (!edit) {
      scrollPerspectivesIntoView();
    }
  }, [edit]);

  useEffect(() => {
    let fileReader: FileReader;
    let isCancel = false;
    if (file) {
      fileReader = new FileReader();
      fileReader.onload = (e: { target: { result: any } }) => {
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
  }, [file, topicId]);

  return (
    <>
      <div className="flex-1 w-full overflow-y-auto">
        <div className={"flex-1 w-full"}>
          <div
            ref={perspectivesEndRef}
            className={"flex flex-col will-change-scroll"}
          >
            {optimisiticPerspectives.map(
              (p: {
                id: string;
                perspective: string;
                topic?: string;
                description?: string;
                color: string;
                objective_key?: string;
              }) => (
                <button
                  onClick={() => {
                    setPerspectiveId(p.id);
                    setPerspective(p.perspective);
                    setObjectiveKey(p.objective_key);
                    setEdit(true);
                  }}
                  onKeyDown={() => {
                    setPerspectiveId(p.id);
                    setPerspective(p.perspective);
                    setObjectiveKey(p.objective_key);
                    setEdit(true);
                  }}
                  key={p.id}
                  data-id={p.id}
                  className="rounded text-sm text-emerald-500 md:w-3/4 p-1 text-left"
                  style={{ color: `${p.color}` }}
                >
                  {p.objective_key ? (
                    <img
                      src={`${process.env.NEXT_PUBLIC_CDN_URL}/${p.objective_key}`}
                      alt={p?.description}
                      loading="lazy"
                    />
                  ) : (
                    ""
                  )}
                  {perspectiveId === p.id ? (
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      className="whitespace-pre-line has-[blockquote]:border-l-2 has-[blockquote]:border-purple-700 has-[blockquote]:pl-2"
                    >
                      {optimisiticPerspective}
                    </Markdown>
                  ) : (
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      className="whitespace-pre-line has-[blockquote]:border-l-2 has-[blockquote]:border-purple-700 has-[blockquote]:pl-2"
                    >
                      {p.perspective}
                    </Markdown>
                  )}
                </button>
              )
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center w-4/5">
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
                  className="rounded border border-gray-700 dark:bg-slate-800 focus:ring-purple-700 text-xs w-full mb-1 ml-1"
                  type="text"
                  id="description"
                  name="description"
                  placeholder="🖼️ 🖌️"
                />
              </div>
            ) : (
              ""
            )}
          </div>
          <div className="flex w-full h-full">
            <div className="flex grow-0 flex-col h-full">
              <img
                data-testid="preview"
                alt=""
                src={fileDataURL}
                className="text-[8px] w-2 h-auto"
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
            </div>
            <div className="flex h-full flex-grow w-full ml-1 md:w-10/12">
              <label className="align-middle sr-only" htmlFor="perspective">
                perspective
              </label>
              <textarea
                data-testid="perspective"
                id="perspective"
                placeholder="🤔"
                className="text-black rounded border border-gray-700 dark:bg-slate-800/20 focus:ring-purple-700 text-xs w-full"
                name="perspective"
                onChange={(e) => changeTextareaHandler(e)}
                ref={perspectiveRef}
                value={perspective}
                style={{ color: `${color}` }}
                spellCheck="true"
                required
              />
            </div>
          </div>
          <Submit testid="submit" btnText={btnText} />
        </form>
      </div>
    </>
  );
}
