"use client";

import type { CSSProperties, SyntheticEvent } from "react";
import { useCallback, useMemo, useState } from "react";

type PerspectiveBackgroundProps = {
  imageSrc?: string | null;
  className?: string;
  overlayClassName?: string;
  positionClassName?: "absolute" | "fixed";
};

const FALLBACK_COLOR = "oklch(0.22 0.14 300)";
const SAMPLE_SIZE = 32;

const toRgb = (red: number, green: number, blue: number) =>
  `rgb(${Math.round(red)} ${Math.round(green)} ${Math.round(blue)})`;

const sampleImageColor = (image: HTMLImageElement) => {
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const pixels = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
  let red = 0;
  let green = 0;
  let blue = 0;
  let weight = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255;
    if (alpha <= 0) continue;
    red += pixels[index] * alpha;
    green += pixels[index + 1] * alpha;
    blue += pixels[index + 2] * alpha;
    weight += alpha;
  }

  if (weight <= 0) return null;
  return toRgb(red / weight, green / weight, blue / weight);
};

export const PerspectiveBackground = ({
  imageSrc,
  className = "",
  overlayClassName = "bg-black/35",
  positionClassName = "absolute",
}: PerspectiveBackgroundProps) => {
  const [sampledColor, setSampledColor] = useState<string | null>(null);
  const resolvedImageSrc = imageSrc?.trim() ?? "";
  const backgroundStyle = useMemo(
    () => ({
      "--perspective-image-color": sampledColor ?? FALLBACK_COLOR,
      background:
        "linear-gradient(90deg, color-mix(in oklch, var(--perspective-image-color), var(--color-gradient-start) 62%), color-mix(in oklch, var(--perspective-image-color), var(--color-gradient-end) 62%))",
    }) as CSSProperties,
    [sampledColor],
  );

  const handleImageLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      try {
        setSampledColor(sampleImageColor(event.currentTarget));
      } catch {
        setSampledColor(null);
      }
    },
    [],
  );

  if (!resolvedImageSrc) return null;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none ${positionClassName} inset-0 z-0 overflow-hidden ${className}`}
      style={backgroundStyle}
    >
      <img
        src={resolvedImageSrc}
        alt=""
        className="h-full w-full object-cover opacity-80 mix-blend-luminosity"
        decoding="async"
        onLoad={handleImageLoad}
      />
      <div className={`absolute inset-0 ${overlayClassName}`} />
    </div>
  );
};
