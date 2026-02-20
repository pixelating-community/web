import "@tanstack/react-start/server-only";

const normalizeEnvValue = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const getServerEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = normalizeEnvValue(process.env[key]);
    if (value) return value;
  }

  return undefined;
};
