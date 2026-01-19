"use client";

import { useEffect, useRef } from "react";

export const Video = ({ url }: { url: string | null }) => {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const playVideo = async () => {
      if (!ref.current) return;

      try {
        ref.current.muted = true;
        ref.current.currentTime = 0;

        if (url) {
          await ref.current.play();
        } else {
          ref.current.pause();
        }
      } catch (error) {
        console.warn("Playing fails", error);
      }
    };

    playVideo();
  }, [url]);

  if (!url) return null;

  return (
    <video
      ref={ref}
      className="absolute inset-0 w-full h-screen object-cover -z-10"
      autoPlay
      muted
      loop
      playsInline
      key={url}
    >
      <source src={url} type="video/webm" />
    </video>
  );
};
