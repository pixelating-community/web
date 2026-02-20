export const REQUEST_ID_HEADER = "x-request-id";

const fallbackRequestId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const getRequestId = (request: Request) => {
  const fromHeader = request.headers.get(REQUEST_ID_HEADER)?.trim();
  if (fromHeader) return fromHeader;
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return fallbackRequestId();
};

export const requestIdHeaders = (requestId: string, headers?: HeadersInit) => {
  const next = new Headers(headers);
  next.set(REQUEST_ID_HEADER, requestId);
  return next;
};
