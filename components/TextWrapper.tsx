"use client";

import localFont from "next/font/local";
import type React from "react";
import { useEffect, useState } from "react";

const font = localFont({
  src: "../public/RocketRinder-yV5d.woff2",
  variable: "--font-rr",
  display: "swap",
});

export const TextWrapper = ({
  useSpecialFont,
  children,
}: {
  useSpecialFont?: boolean;
  children: React.ReactNode;
}) => {
  const [fontClass, setFontClass] = useState<string>("");

  useEffect(() => {
    const loadFont = async () => {
      if (useSpecialFont) {
        setFontClass(font.variable);
      }
    };
    loadFont();
  }, [useSpecialFont]);

  return <div className={fontClass}>{children}</div>;
};
