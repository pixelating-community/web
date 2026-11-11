"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  detectVideoContentBounds,
  type VideoContentBounds,
} from "@/lib/videoBackground";

type Props = {
  src: string;
  videoRef?: RefObject<HTMLVideoElement | null>;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
};

export function PerspectiveVideoBackground({
  src,
  videoRef,
  autoPlay = true,
  muted = true,
  loop = true,
}: Props) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRef = videoRef ?? localVideoRef;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const corsFallbackRef = useRef("");
  const [paintedSource, setPaintedSource] = useState("");

  useEffect(() => {
    const video = mediaRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!video || !canvas || !context) return;
    corsFallbackRef.current = "";
    let frameId = 0;
    let animationId = 0;
    let painted = false;
    let stopped = false;
    const sample = document.createElement("canvas");
    const sampleContext = sample.getContext("2d", { willReadFrequently: true });
    let bounds: VideoContentBounds | undefined;
    let samples = 0;
    let lastSample = -1;

    const sampleBounds = () => {
      if (
        !sampleContext ||
        samples >= 8 ||
        Math.abs(video.currentTime - lastSample) < 0.15
      )
        return;
      lastSample = video.currentTime;
      const scale = Math.min(
        1,
        320 / Math.max(video.videoWidth, video.videoHeight),
      );
      sample.width = Math.max(1, Math.round(video.videoWidth * scale));
      sample.height = Math.max(1, Math.round(video.videoHeight * scale));
      try {
        sampleContext.drawImage(video, 0, 0, sample.width, sample.height);
        const pixels = sampleContext.getImageData(
          0,
          0,
          sample.width,
          sample.height,
        ).data;
        const found = detectVideoContentBounds(
          pixels,
          sample.width,
          sample.height,
        );
        const candidate = {
          x: (found.x * video.videoWidth) / sample.width,
          y: (found.y * video.videoHeight) / sample.height,
          width: (found.width * video.videoWidth) / sample.width,
          height: (found.height * video.videoHeight) / sample.height,
        };
        if (candidate.x || candidate.y) {
          if (!bounds) bounds = candidate;
          else {
            const x = Math.min(bounds.x, candidate.x);
            const y = Math.min(bounds.y, candidate.y);
            bounds = {
              x,
              y,
              width: video.videoWidth - 2 * x,
              height: video.videoHeight - 2 * y,
            };
          }
        }
        samples++;
      } catch {
        // External videos without CORS permission can still be displayed normally.
        samples = 8;
      }
    };

    const paint = () => {
      if (!video.videoWidth || !video.videoHeight || video.readyState < 2)
        return;
      sampleBounds();
      const content = bounds ?? {
        x: 0,
        y: 0,
        width: video.videoWidth,
        height: video.videoHeight,
      };
      const scale = Math.min(1, 640 / Math.max(content.width, content.height));
      const width = Math.max(1, Math.round(content.width * scale));
      const height = Math.max(1, Math.round(content.height * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.drawImage(
        video,
        content.x,
        content.y,
        content.width,
        content.height,
        0,
        0,
        width,
        height,
      );
      if (!painted) {
        painted = true;
        setPaintedSource(src);
      }
    };
    const tick = () => {
      if (stopped) return;
      if (!painted || !video.paused) paint();
      if (typeof video.requestVideoFrameCallback === "function") {
        frameId = video.requestVideoFrameCallback(tick);
      } else {
        animationId = requestAnimationFrame(tick);
      }
    };
    video.addEventListener("loadeddata", paint);
    video.addEventListener("seeked", paint);
    tick();
    return () => {
      stopped = true;
      if (frameId) video.cancelVideoFrameCallback(frameId);
      cancelAnimationFrame(animationId);
      video.removeEventListener("loadeddata", paint);
      video.removeEventListener("seeked", paint);
    };
  }, [src, mediaRef]);

  return (
    <div
      aria-hidden="true"
      className="perspective-video-background pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- decorative background; its companion audio/lyrics provide the content */}
      <video
        key={src}
        ref={mediaRef}
        src={src}
        crossOrigin="anonymous"
        onError={(event) => {
          const video = event.currentTarget;
          if (video.crossOrigin && corsFallbackRef.current !== src) {
            corsFallbackRef.current = src;
            video.crossOrigin = null;
            video.load();
          }
        }}
        className={`perspective-video-surface ${paintedSource === src ? "opacity-0" : "opacity-80"}`}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        playsInline
        preload="auto"
      />
      <canvas
        ref={canvasRef}
        className={`perspective-video-surface perspective-video-pixels ${paintedSource === src ? "opacity-80" : "opacity-0"}`}
      />
      <div className="perspective-video-scanlines absolute inset-0" />
      <div className="absolute inset-0 bg-black/20" />
    </div>
  );
}
