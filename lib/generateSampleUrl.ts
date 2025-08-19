import { formatTime } from "@/lib/formatTime";

export interface ParsedSampleUrl {
  trackName?: string;
  editName?: string;
  start?: number;
  end?: number;
}

export const generateSampleUrl = ({
  trackName,
  editName,
  start,
  end,
}: ParsedSampleUrl): string | null => {
  try {
    const SITE_URL = process.env.NEXT_PUBLIC_URL || "https://pixelat.ing";

    const u = new URL(
      `k/${trackName}/${editName}?start=${formatTime(start)}&end=${formatTime(end)}`,
      SITE_URL,
    );
    return u.toString();
  } catch {
    return null;
  }
};
