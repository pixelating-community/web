"use client";

import { memo, useEffect, useRef } from "react";
import { WordGradientSVG } from "@/components/WordGradientSVG";
import type { Cue } from "@/types/symbol";

type SymbolListProps = {
  symbols: Cue[];
  currentIndex: number;
  timeUntilNext: number;
  onClick?: (cue: Cue) => void;
  font?: string;
  follow?: boolean;
};

export const SymbolList = memo(function SymbolList({
  symbols,
  currentIndex,
  timeUntilNext,
  onClick,
  font,
  follow = false,
}: SymbolListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lineRef = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0 });
  }, []);

  useEffect(() => {
    if (!follow || currentIndex < 0) return;
    const container = scrollRef.current;
    const target = lineRef.current[currentIndex];
    if (!container || !target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const padding = containerRect.width * 0.15;

    if (targetRect.left < containerRect.left + padding) {
      const nextScrollLeft = Math.max(0, target.offsetLeft - padding);
      container.scrollTo({ left: nextScrollLeft, behavior: "smooth" });
      return;
    }

    if (targetRect.right > containerRect.right - padding) {
      const nextScrollLeft = Math.max(
        0,
        target.offsetLeft -
          (container.clientWidth - target.offsetWidth) +
          padding,
      );
      container.scrollTo({ left: nextScrollLeft, behavior: "smooth" });
    }
  }, [currentIndex, follow]);

  const fontClass = font ? `font-${font}` : "";

  return (
    <div
      ref={scrollRef}
      className="relative w-full mx-auto overflow-x-auto overflow-y-visible scrollbar-transparent scroll-smooth"
    >
      <ul className="flex items-center px-2 py-8 w-max snap-x snap-mandatory whitespace-nowrap">
        {symbols.map((symbol, index) => {
          const isCurrent = index === currentIndex;
          const animateClass =
            symbol.style && isCurrent && symbol.style.includes("animate-")
              ? symbol.style
              : "";
          const fontStyle =
            symbol.fontSize !== undefined
              ? { fontSize: `${symbol.fontSize / 16}rem` }
              : undefined;

          return (
            <li key={`${symbol.id ?? "symbol"}-${symbol.timestamp}-${index}`}>
              <button
                type="button"
                onClick={() => onClick?.(symbol)}
                ref={(el) => {
                  lineRef.current[index] = el;
                }}
                className={`${animateClass} ${fontClass} flex flex-col justify-center items-center relative overflow-visible border-0 bg-transparent p-0 rounded-none`}
              >
                {symbol.url && !symbol.url.endsWith(".webm") && (
                  <div className="max-h-96 max-w-80 lg:max-w-96">
                    <img
                      src={symbol.url}
                      alt=""
                      className="object-contain max-h-48 max-w-80"
                    />
                  </div>
                )}
                <span
                  className={`relative sm:text-fluid leading-none text-center whitespace-pre-line px-4 snap-center font-bold ${
                    symbol.style && isCurrent ? symbol.style : "text-fluid"
                  } ${isCurrent && !symbol.style ? "text-white text-3xl" : ""}`}
                  style={fontStyle}
                >
                  {symbol.style === "text-gradient" && isCurrent ? (
                    <WordGradientSVG
                      text={symbol.content}
                      fontSize={symbol.fontSize ?? 72}
                      gradientStops={[
                        { offset: "0%", color: "#ec4899" },
                        { offset: "100%", color: "#facc15" },
                      ]}
                    />
                  ) : (
                    symbol.content
                  )}
                  {isCurrent &&
                    !["1", "2", "3", "4", "5"].includes(symbol.content) && (
                      <span
                        className="absolute inset-0 overflow-hidden text-red-500 text-shadow bg-purple-500/40 origin-left"
                        style={{
                          animation: `run-text ${timeUntilNext}s linear forwards`,
                          transformOrigin: "left",
                        }}
                      />
                    )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
