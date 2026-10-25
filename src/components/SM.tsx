// An inline SVG needs image semantics while keeping its editable vector paths.
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import { forwardRef } from "react";
import {
  getSecretInk,
  SECRET_ALPHABET,
  type SecretInk,
  type SMLayout,
} from "@/lib/secretAlphabet";

export const SM = forwardRef<
  SVGSVGElement,
  { layout: SMLayout; ink?: SecretInk; className?: string }
>(function SM({ layout, ink = "rose", className }, ref) {
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
      role="img"
      aria-label={`Secret message with ${layout.symbols.length} symbols`}
      className={className}
    >
      <rect width="100%" height="100%" fill="#fcfaf5" />
      {layout.symbols.map(({ character, letter, x, y }, index) => (
        <g key={index} transform={`translate(${x} ${y})`}>
          {letter ? (
            <path
              d={SECRET_ALPHABET[letter].path}
              transform="scale(0.72 0.85)"
              fill="none"
              stroke={getSecretInk(letter, ink)}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <text
              x="23"
              y="49"
              textAnchor="middle"
              fontFamily="Georgia, serif"
              fontSize="34"
              fill={
                layout.unsupported.includes(character)
                  ? "#b45309"
                  : getSecretInk(null, ink)
              }
            >
              {layout.unsupported.includes(character) ? "?" : character}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
});
