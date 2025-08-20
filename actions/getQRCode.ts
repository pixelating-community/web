"use server";

import QRCode from "qrcode";

const encodeSvg = (svg: string): string => {
  return svg
    .trim()
    .replace(/[\n\r]/g, "")
    .replace(/"/g, "'")
    .replace(/>\s+</g, "><");
};

export async function getQRCode({ text }: { text: string }) {
  try {
    const code = await QRCode.toString(text, {
      errorCorrectionLevel: "H",
      width: 100,
      color: {
        dark: "#6e11b0",
        light: "#0000",
      },
      type: "svg",
    });

    const base64 = Buffer.from(encodeSvg(code)).toString("base64");
    return `data:image/svg+xml;base64,${base64}`;
  } catch (err) {
    console.error(err);
  }
}
