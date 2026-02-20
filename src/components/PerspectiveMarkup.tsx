"use client";

import { useEffect, useRef } from "react";
import { getPerspectiveHtml } from "@/lib/perspectiveHtml";
import type { Perspective } from "@/types/perspectives";

export const PerspectiveMarkup = ({
  perspective,
  className,
}: {
  perspective: Perspective;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const html = getPerspectiveHtml(perspective);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = html;
  }, [html]);

  return <div ref={containerRef} className={className} />;
};
