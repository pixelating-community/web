"use client";

import { useEffect, useRef, useState } from "react";
import { editReflection } from "@/actions/editReflection";

type ReflectionData = {
  id: string;
  perspective_id: string;
  reflection_id: string | null;
  text: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type ReflectionProps = {
  reflectionId: string;
  text?: string;
  perspectiveId: string;
  childrenMap: Map<string | null, ReflectionData[]>;
  addReflectionAction: (
    reflectionId: string | null,
    text: string,
  ) => Promise<void>;
  updateReflectionTextAction: (id: string, text: string) => void;
  canComment: boolean;
};

export function Reflection({
  reflectionId,
  text = "",
  perspectiveId,
  childrenMap,
  addReflectionAction,
  updateReflectionTextAction,
  canComment,
}: ReflectionProps) {
  const [currentText, setCurrentText] = useState(text);
  const [replyText, setReplyText] = useState("");
  const [isEditing, setIsEditing] = useState(!text);
  const [isReplying, setIsReplying] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const isRoot = (childrenMap.get(null) || []).some(
    (r) => r.id === reflectionId,
  );
  const children = childrenMap.get(reflectionId) || [];

  useEffect(() => {
    setCurrentText(text);
  }, [text]);

  useEffect(() => {
    if (isEditing && canComment && textRef.current) {
      textRef.current.focus();
      textRef.current.setSelectionRange(
        textRef.current.value.length,
        textRef.current.value.length,
      );
    }
  }, [isEditing, canComment]);

  useEffect(() => {
    if (isReplying && canComment && replyRef.current) {
      replyRef.current.focus();
    }
  }, [isReplying, canComment]);

  const handleSave = async () => {
    const newText = currentText.trim();
    if (!newText) return;

    try {
      const updated = await editReflection({
        id: reflectionId,
        text: newText,
      });
      if (!updated) return;
      updateReflectionTextAction(reflectionId, newText);
      setCurrentText(newText);
      setIsEditing(false);
    } catch (error) {
      console.log(`reflection:save:error ${error}`);
    }
  };

  const handleAddReply = async () => {
    const replyContent = replyText.trim();
    if (!replyContent) return;

    try {
      await addReflectionAction(reflectionId, replyContent);
      setIsReplying(false);
      setReplyText("");
    } catch {}
  };

  return (
    <div className="pl-6">
      <div className="flex items-baseline gap-2 py-0">
        {canComment && (
          <button
            type="button"
            onClick={() => setIsReplying(!isReplying)}
            className={`${
              isRoot ? "text-sm purple-500/10" : "text-xs"
            } px-2 py-1 hover:bg-purple-500/20 opacity-25`}
          >
            ⤷
          </button>
        )}
        <textarea
          name="reflection"
          ref={textRef}
          value={currentText}
          onClick={() => {
            if (!canComment) return;
          }}
          onChange={(e) => canComment && setCurrentText(e.target.value)}
          readOnly={!isEditing || !canComment}
          placeholder={isEditing ? "..." : undefined}
          aria-readonly={!isEditing || !canComment}
          tabIndex={isEditing && canComment ? 0 : -1}
          onKeyDown={(e) => {
            if (canComment && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSave();
            }
          }}
          className={`flex-1 outline-none pt-0 mt-0 tracking-tighter w-full ${
            isRoot ? "text-sm" : "text-xs"
          }
            ${
              isEditing && canComment
                ? "bg-purple-100/10 border-b border-purple-500/30"
                : ""
            }
          `}
        />

        <div className="flex gap-1">
          {isEditing && canComment ? (
            <button
              type="button"
              onClick={handleSave}
              className="text-xs px-2 py-1"
            >
              💾
            </button>
          ) : null}
        </div>
      </div>

      {isReplying && canComment && (
        <div className="flex items-center gap-2 ml-3 p-3 ">
          <textarea
            ref={replyRef}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleAddReply();
              }
              if (e.key === "Escape") {
                setIsReplying(false);
              }
            }}
            placeholder="..."
            className="flex-1 bg-transparent outline-none text-xs py-0 tracking-tighter border-b border-purple-500/30"
          />

          <button
            type="button"
            onClick={handleAddReply}
            className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm"
          >
            ⤷
          </button>

          <button
            type="button"
            onClick={() => setIsReplying(false)}
            className="px-3 py-1 hover:bg-gray-500/20 text-xs"
          >
            ⌫
          </button>
        </div>
      )}

      {children.length > 0 && (
        <div className="mt-0">
          {children.map((child) => (
            <Reflection
              key={child.id}
              reflectionId={child.id}
              text={child.text}
              perspectiveId={perspectiveId}
              childrenMap={childrenMap}
              addReflectionAction={addReflectionAction}
              updateReflectionTextAction={updateReflectionTextAction}
              canComment={canComment}
            />
          ))}
        </div>
      )}
    </div>
  );
}
