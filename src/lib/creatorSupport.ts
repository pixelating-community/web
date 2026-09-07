export type CreatorSupportPublic = {
  displayName: string;
  paypalMeUrl: string | null;
  venmoUrl: string | null;
};

const parseSupportUrl = (value: string) => {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("Support links must use a standard HTTPS URL.");
  }
  return url;
};

const readSingleHandle = (pathname: string, prefix = "") => {
  const segments = pathname.split("/").filter(Boolean);
  if (prefix) {
    if (segments.length !== 2 || segments[0].toLowerCase() !== prefix) {
      return null;
    }
    return segments[1];
  }
  return segments.length === 1 ? segments[0] : null;
};

const isSafeHandle = (value: string | null) =>
  Boolean(value && /^[A-Za-z0-9._-]{1,80}$/.test(value));

export const normalizePayPalMeUrl = (value: string) => {
  const url = parseSupportUrl(value);
  if (url.hostname.toLowerCase() !== "paypal.me") {
    throw new Error("Use a paypal.me profile link.");
  }
  const handle = readSingleHandle(url.pathname);
  if (!isSafeHandle(handle))
    throw new Error("Use a valid PayPal.Me profile link.");
  return `https://paypal.me/${handle}`;
};

export const normalizeVenmoBusinessUrl = (value: string) => {
  const url = parseSupportUrl(value);
  const hostname = url.hostname.toLowerCase();
  if (!["venmo.com", "www.venmo.com", "account.venmo.com"].includes(hostname)) {
    throw new Error("Use a Venmo Business profile link.");
  }
  const handle = readSingleHandle(url.pathname, "u");
  if (!isSafeHandle(handle))
    throw new Error("Use a valid Venmo Business profile link.");
  return `https://account.venmo.com/u/${handle}`;
};
