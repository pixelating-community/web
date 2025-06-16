"use client";

import React, { useEffect, useState } from "react";
import localFont from "next/font/local";

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
