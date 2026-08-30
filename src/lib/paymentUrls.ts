const parseHttpOrigin = (value: string) => {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Application URL must use HTTP or HTTPS.");
  }
  return url.origin;
};

export const resolvePaymentApplicationOrigin = ({
  configuredBaseUrl,
  isProduction,
  requestUrl,
}: {
  configuredBaseUrl: string | undefined;
  isProduction: boolean;
  requestUrl: string;
}) => {
  if (configuredBaseUrl) {
    const origin = parseHttpOrigin(configuredBaseUrl);
    if (isProduction && !origin.startsWith("https://")) {
      throw new Error("APP_BASE_URL must use HTTPS in production.");
    }
    return origin;
  }
  if (isProduction) {
    throw new Error("APP_BASE_URL is required in production.");
  }
  return parseHttpOrigin(requestUrl);
};
