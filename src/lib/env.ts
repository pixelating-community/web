const normalizeEnvValue = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const getKnownVitePublicEnv = (key: string) => {
  switch (key) {
    case "VITE_OBJ_BASE_URL":
      return normalizeEnvValue(import.meta.env.VITE_OBJ_BASE_URL);
    case "VITE_PIXEL_SIZE":
      return normalizeEnvValue(import.meta.env.VITE_PIXEL_SIZE);
    case "VITE_CDN_URL":
      return normalizeEnvValue(import.meta.env.VITE_CDN_URL);
    case "VITE_FUNDING_URL":
      return normalizeEnvValue(import.meta.env.VITE_FUNDING_URL);
    case "VITE_STRIPE_PUBLISHABLE_KEY":
      return normalizeEnvValue(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
    default:
      return undefined;
  }
};

export const getPublicEnv = (...keys: string[]) => {
  for (const key of keys) {
    const fromProcess = normalizeEnvValue(process.env[key]);
    if (fromProcess) return fromProcess;

    const fromVite = getKnownVitePublicEnv(key);
    if (fromVite) return fromVite;
  }

  return undefined;
};

export const getServerEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = normalizeEnvValue(process.env[key]);
    if (value) return value;
  }

  return undefined;
};
