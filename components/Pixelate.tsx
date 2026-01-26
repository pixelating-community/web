"use client";

import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";

const PixelatedImage = ({
  src,
  pixelSize = 10,
  maxWidth = 600,
  maxHeight = 200,
}) => {
  const canvasRef = useRef(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({
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

      let newWidth = imgWidth;
      let newHeight = imgHeight;

      const widthRatio = maxWidth / imgWidth;
      const heightRatio = maxHeight / imgHeight;
      const scale = Math.min(widthRatio, heightRatio, 1);

      newWidth = Math.round(imgWidth * scale);
      newHeight = Math.round(imgHeight * scale);

      setDimensions({
        width: newWidth,
        height: newHeight,
      });
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
  }, [src, maxWidth, maxHeight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;

    if (!canvas || !img || loading) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const smallWidth = Math.ceil(dimensions.width / pixelSize);
    const smallHeight = Math.ceil(dimensions.height / pixelSize);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, smallWidth, smallHeight);
    ctx.drawImage(
      canvas,
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
        style={{ maxWidth: "100%", height: "auto" }}
      />
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className="flex items-center mt-4"
      >
        💾
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
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="p-4 mb-6 sm:p-6">
          <div className="mb-6 text-center">
            <label
              htmlFor="file"
              className="inline-block mb-3 text-sm font-medium text-gray-700 cursor-pointer"
            >
              📂
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
              className="block mb-2 text-sm font-medium text-center text-gray-700"
            >
              🎚️
            </label>
            <input
              id="pixel-size"
              type="range"
              min="2"
              max="50"
              value={pixelSize}
              onChange={(e) => setPixelSize(Number(e.target.value))}
              className="w-full appearance-none cursor-pointer bg-orange-500 h-1 rounded-lg accent-[#6e11b0]"
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
