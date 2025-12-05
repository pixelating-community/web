const MAX_CACHE_SIZE = 500;
const cache = new Map<string, string>();

export const getQRCodeDataUrl = async (path: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_URL;
  if (!baseUrl) return "";

  const url = `${baseUrl}${path}`;

  if (cache.has(url)) {
    const cached = cache.get(url);
    if (cached !== undefined) return cached;
  }

  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }

  try {
    const QRCode = (await import("qrcode")).default;

    const svg = await QRCode.toString(url, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 100,
      color: {
        dark: "#6e11b0",
        light: "#0000",
      },
      type: "svg",
    });

    const encoded = encodeURIComponent(svg)
      .replace(/'/g, "%27")
      .replace(/"/g, "%22");

    const dataUrl = `data:image/svg+xml,${encoded}`;

    cache.set(url, dataUrl);
    return dataUrl;
  } catch (err) {
    console.error("QR generation failed:", err);
    return "";
  }
};
