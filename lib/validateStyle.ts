const allowedClasses = new Set([
  "rainbow",
  "line-through",
  "text-white",
  "text-blue-100",
  "text-red-100",
  "text-white",
  "text-2xl",
  "text-3xl",
  "text-4xl",
  "text-5xl",
  "text-9xl",
]);

export const validateStyle = (input: string | null): string | null => {
  if (!input) return null;
  return (
    input
      .split(" ")
      .filter((cls) => allowedClasses.has(cls))
      .join(" ") || null
  );
};
