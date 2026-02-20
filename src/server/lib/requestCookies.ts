export const getRequestCookie = (request: Request, name: string) => {
  const raw = request.headers.get("cookie") ?? "";
  if (!raw) return undefined;
  const pairs = raw.split(";");
  for (const pair of pairs) {
    const index = pair.indexOf("=");
    if (index <= 0) continue;
    const key = pair.slice(0, index).trim();
    if (key !== name) continue;
    return decodeURIComponent(pair.slice(index + 1).trim());
  }
  return undefined;
};
