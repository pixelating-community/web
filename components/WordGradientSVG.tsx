import type React from "react";

interface WordGradientSVGProps {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  gradientStops: { offset: string; color: string }[];
  width?: number;
}

export const WordGradientSVG: React.FC<WordGradientSVGProps> = ({
  text,
  fontSize = 60,
  fontFamily = "inherit",
  fontWeight = 400,
  gradientStops,
  width,
}) => {
  const estimatedWidth = fontSize * text.length * 0.85;
  const svgWidth = width ?? estimatedWidth + fontSize * 0.5;
  const svgHeight = fontSize * 1.5;
  return (
    <svg
      width="100%"
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      preserveAspectRatio="xMinYMid meet"
    >
      <title>{text}</title>
      <defs>
        <linearGradient id="text-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          {gradientStops.map((stop) => (
            <stop
              key={`${stop.offset}-${stop.color}`}
              offset={stop.offset}
              stopColor={stop.color}
            />
          ))}
        </linearGradient>
      </defs>

      <text
        x={0}
        y={fontSize}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontWeight={fontWeight}
        fill="url(#text-gradient)"
        style={{ fontFamily: "inherit" }}
      >
        {text}
      </text>
    </svg>
  );
};
