import "@tanstack/react-start/server-only";
import { getQRCodeDataUrl } from "@/lib/qrcode.server";

export const getQRCode = async ({ path }: { path: string }) =>
  getQRCodeDataUrl(path);
