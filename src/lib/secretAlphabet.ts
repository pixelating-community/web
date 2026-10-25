// Clean vector tracings of the supplied handwritten alphabet and corrections.
// The revised key updates H, E, J, S, Y, X, W, and L. Q follows its
// position between P and R in the key; Z is a standard Z until a symbol is added.
export const SECRET_ALPHABET = {
  A: { path: "M8 16 H21 V62 H47 V16 H58", color: "#b85b25" },
  B: { path: "M12.97 19.22 L40.02 11.97 L30.04 67.44 Z", color: "#8b801f" },
  C: { path: "M48 17 H18 V62 H49 V43", color: "#245487" },
  D: { path: "M17 14 H49 V65 H17 Z", color: "#a33372" },
  E: {
    path: "M47 10 L29 16 L43 28 L41 13 M29 16 L32 27 L22 36 L35 41 L24 50 L22 36 M24 50 L13 62 L22 69 L33 57 L18 54",
    color: "#665399",
  },
  F: { path: "M21 68 V15 H49 V46 H21 M10 37 L49 46", color: "#80508e" },
  G: {
    path: "M24 16 C53 16 48 49 24 45 C7 43 21 29 35 35 C54 42 55 57 48 69",
    color: "#80508e",
  },
  H: { path: "M17 69 L21 10 L49 65 L3 46 L61 25", color: "#49589b" },
  I: {
    path: "M19 68 C27 48 45 25 40 13 C34 -1 19 14 27 30 C30 35 39 37 47 36",
    color: "#328659",
  },
  J: {
    path: "M25 29 C33 7 52 4 46 24 C40 43 27 71 17 66 C9 62 10 49 12 42",
    color: "#b34566",
  },
  K: { path: "M54 15 Q41 30 13 35 V55 Q43 39 56 60", color: "#2286a4" },
  L: { path: "M9 15 C23 20 25 43 24 61 C37 46 52 43 61 56", color: "#b34755" },
  M: { path: "M8 20 H56 L33 64 Z", color: "#40579a" },
  N: {
    path: "M8 25 C3 72 27 76 30 24 Q42 47 50 24 C42 80 65 76 60 25",
    color: "#b34755",
  },
  O: {
    path: "M22 67 C17 29 39 -3 39 19 C41 38 31 60 22 67 Z",
    color: "#53574f",
  },
  P: { path: "M9 22 L47 61 L59 19 L10 64", color: "#b85b25" },
  Q: {
    path: "M8 54 Q29 39 30 17 Q45 28 55 19 Q43 39 48 64 Q28 49 8 54 Z M5 42 L60 34",
    color: "#398d7b",
  },
  R: {
    path: "M17 67 C22 45 43 8 55 26 C68 49 10 56 11 32 C12 11 55 11 49 67",
    color: "#a33372",
  },
  S: { path: "M47 22 L17 14 L36 43 L7 66", color: "#b55d88" },
  T: { path: "M10 17 H55 M32 17 V67", color: "#b85b25" },
  U: { path: "M7 33 C4 62 38 67 58 48 C46 41 26 49 26 55", color: "#b34755" },
  V: { path: "M11 18 L30 65 L56 16", color: "#8b801f" },
  W: {
    path: "M18 67 L8 15 L38 10 L6 62 L46 37 L43 60 L62 27",
    color: "#8b801f",
  },
  X: {
    path: "M10 15 L12 32 L44 64 M9 68 C25 59 43 43 57 30 L55 15 M12 32 L24 32",
    color: "#35373b",
  },
  Y: {
    path: "M17 10 C7 37 28 40 41 20 C50 4 43 1 36 14 C29 28 34 55 29 69 C25 82 10 71 15 57 C20 43 43 29 59 27",
    color: "#49589b",
  },
  Z: { path: "M12 17 H52 L12 63 H52", color: "#53574f" },
} as const;

export type SecretLetter = keyof typeof SECRET_ALPHABET;
export type SecretInk = "rose" | "black" | "alphabet";

export const SECRET_INKS = { rose: "#a93470", black: "#292329" } as const;
export const SM_LIMIT = 1200;
export const SM_SAMPLE_MESSAGE = "HI NOT SURE\nIF YOU KNOW";

export type SecretSymbol = {
  character: string;
  letter: SecretLetter | null;
  x: number;
  y: number;
};

export type SMLayout = {
  symbols: SecretSymbol[];
  width: number;
  height: number;
  unsupported: string[];
};

// Keep raster exports within a modest memory budget on phones. SVG downloads
// retain the full vector layout regardless of the PNG resolution.
export const getSMPngDimensions = ({
  width,
  height,
}: Pick<SMLayout, "width" | "height">) => {
  const scale = Math.min(
    2,
    8192 / width,
    8192 / height,
    Math.sqrt(8_000_000 / (width * height)),
  );
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
};

export const getSecretLetter = (character: string): SecretLetter | null => {
  if (!/^[a-z]$/i.test(character)) return null;
  return character.toUpperCase() as SecretLetter;
};

export const getSecretInk = (letter: SecretLetter | null, ink: SecretInk) =>
  ink === "alphabet"
    ? letter
      ? SECRET_ALPHABET[letter].color
      : SECRET_INKS.rose
    : SECRET_INKS[ink];

// Use the same layout for the preview and both download formats. Whole words
// wrap together; long words split into cells without losing any characters.
export const layoutSM = (message: string, columns = 16): SMLayout => {
  const safeColumns = Number.isFinite(columns)
    ? Math.max(1, Math.min(32, Math.floor(columns)))
    : 16;
  const normalized = message.replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
  const tokens = normalized.match(/\n|[^\S\n]+|[^\s]+/gu) ?? [];
  const symbols: SecretSymbol[] = [];
  const unsupported = new Set<string>();
  let column = 0;
  let row = 0;

  for (const token of tokens) {
    if (token === "\n") {
      row += 1;
      column = 0;
      continue;
    }
    if (/^\s+$/u.test(token)) {
      column += Array.from(token).length;
      continue;
    }

    const characters = Array.from(token);
    if (column > 0 && column + characters.length > safeColumns) {
      row += 1;
      column = 0;
    }
    for (const character of characters) {
      if (column >= safeColumns) {
        row += 1;
        column = 0;
      }
      const letter = getSecretLetter(character);
      // Leave punctuation and numbers readable. Never silently expose a letter
      // outside this alphabet in a supposedly encoded image.
      if (!letter && /[\p{L}\p{M}\p{C}]/u.test(character)) {
        unsupported.add(character);
      }
      symbols.push({
        character,
        letter,
        x: 32 + column * 48,
        y: 32 + row * 80,
      });
      column += 1;
    }
  }

  return {
    symbols,
    width: safeColumns * 48 + 64,
    height: Math.max(240, (row + 1) * 80 + 64),
    unsupported: [...unsupported],
  };
};
