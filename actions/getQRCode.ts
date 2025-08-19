"use server";

const cache = new Map<string, string>();

export const getQRCode = async ({ path }: { path: string }) => {
  const baseUrl = process.env.NEXT_PUBLIC_URL;
  if (!baseUrl) return "";

  const url = `${baseUrl}${path}`;

  if (cache.has(url)) {
    const cached = cache.get(url);
    if (cached !== undefined) return cached;
  }

  try {
    const QRCode = (await import("qrcode")).default;
    const dataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 200,
      color: {
        dark: "#6e11b0",
        light: "#0000",
      },
    });

    cache.set(url, dataUrl);
    return dataUrl;
  } catch (err) {
    console.error("QR generation failed:", err);
    return "";
  }
};
