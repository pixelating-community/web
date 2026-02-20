"use client";

import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";

type PixelatedImageProps = {
  src: string;
  pixelSize?: number;
  maxWidth?: number;
  maxHeight?: number;
};

type ImageDimensions = {
  width: number;
  height: number;
};

export const resolveImageCanvasDimensions = ({
  imageHeight,
  imageWidth,
}: {
  imageHeight: number;
  imageWidth: number;
}): ImageDimensions => {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return { width: 1, height: 1 };
  }

  return {
    width: Math.max(1, Math.round(imageWidth)),
    height: Math.max(1, Math.round(imageHeight)),
  };
};

const PixelatedImage = ({
  src,
  pixelSize = 10,
  maxWidth = 600,
  maxHeight = 200,
}: PixelatedImageProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState<ImageDimensions>({
    width: maxWidth,
    height: maxHeight,
  });

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const filename = `pxltng-${pixelSize}x-${timestamp}.webp`;

    canvas.toBlob(
      (blob: Blob | null) => {
        if (!blob) return;

        if (navigator.share && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
          const file = new File([blob], filename, { type: "image/webp" });
          navigator
            .share({
              files: [file],
              title: "Pixelated Image",
            })
            .catch(() => {
              fallbackDownload(blob, filename);
            });
        } else {
          fallbackDownload(blob, filename);
        }
      },
      "image/webp",
      0.95,
    );
  };

  const fallbackDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = filename;
    link.href = url;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  useEffect(() => {
    if (!src) return;

    setLoading(true);
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      imgRef.current = img;

      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;

      setDimensions(
        resolveImageCanvasDimensions({
          imageWidth: imgWidth,
          imageHeight: imgHeight,
        }),
      );
      setLoading(false);
    };

    img.onerror = () => {
      imgRef.current = null;
      setLoading(false);
    };

    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;

    if (!canvas || !img || loading) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const smallWidth = Math.max(1, Math.round(dimensions.width / pixelSize));
    const smallHeight = Math.max(1, Math.round(dimensions.height / pixelSize));
    const pixelCanvas = document.createElement("canvas");
    pixelCanvas.width = smallWidth;
    pixelCanvas.height = smallHeight;
    const pixelCtx = pixelCanvas.getContext("2d");
    if (!pixelCtx) return;

    pixelCtx.imageSmoothingEnabled = true;
    pixelCtx.drawImage(img, 0, 0, smallWidth, smallHeight);
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      pixelCanvas,
      0,
      0,
      smallWidth,
      smallHeight,
      0,
      0,
      dimensions.width,
      dimensions.height,
    );
  }, [loading, pixelSize, dimensions]);

  return (
    <div className="flex flex-col items-center">
      {loading && (
        <div className="flex items-center justify-center">
          <div>🚚...</div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className=""
        style={{
          height: "auto",
          maxHeight: `${maxHeight}px`,
          maxWidth: "100%",
          width: "auto",
        }}
      />
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className="mt-4 inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-[14px] leading-none uppercase text-white/85 transition-colors enabled:hover:bg-white/20 disabled:opacity-50"
      >
        <span aria-hidden="true">💾</span>
      </button>
    </div>
  );
};

export const Pixelate = () => {
  const [pixelSize, setPixelSize] = useState(26);
  const [imageSrc, setImageSrc] = useState("/pxltng-2x.webp");
  const [hasImage, setHasImage] = useState(true);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file?.type?.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        if (typeof result === "string") {
          setImageSrc(result);
          setHasImage(true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="p-4 mb-6 sm:p-6">
          <div className="mb-6 text-center">
            <label
              htmlFor="file"
              className="inline-flex items-center gap-2 mb-3 text-[14px] leading-none uppercase text-white/85 cursor-pointer"
            >
              <span aria-hidden="true">📂</span>
            </label>
            <input
              id="file"
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
          <div className="mb-6">
            <label
              htmlFor="pixel-size"
              className="hidden mb-2 text-center text-[14px] leading-none uppercase text-white/85"
            >
              {pixelSize}
            </label>
            <input
              id="pixel-size"
              type="range"
              min="2"
              max="50"
              value={pixelSize}
              onChange={(e) => setPixelSize(Number(e.target.value))}
              className="w-full appearance-none cursor-grab bg-orange-500 h-1 rounded-lg accent-[#6e11b0]"
            />
          </div>
          {hasImage && (
            <div className="flex justify-center">
              <PixelatedImage
                src={imageSrc}
                pixelSize={pixelSize}
                maxWidth={600}
                maxHeight={200}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
