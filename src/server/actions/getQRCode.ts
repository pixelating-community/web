import { getQRCodeDataUrl } from "@/lib/qrcode";

export const getQRCode = async ({ path }: { path: string }) =>
  getQRCodeDataUrl(path);
