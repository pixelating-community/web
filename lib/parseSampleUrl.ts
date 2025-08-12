export interface ParsedSampleUrl {
  trackName?: string;
  editName?: string;
  start?: number;
  end?: number;
}

const parseTimeString = (time: string): number | undefined => {
  const regex = /^(\d+):(\d{2})\.(\d{1,4})$/;
  const match = regex.exec(time);
  if (!match) return undefined;
  const [, min, sec, fracRaw] = match;
  let ms = 0;
  if (fracRaw.length === 1) {
    ms = parseInt(fracRaw) * 100;
  } else if (fracRaw.length === 2) {
    ms = parseInt(fracRaw) * 10;
  } else {
    ms = parseInt(fracRaw.padEnd(3, "0").slice(0, 3), 10);
  }
  return parseInt(min, 10) * 60 + parseInt(sec, 10) + ms / 1000;
};

export const parseSampleUrl = (url: string): ParsedSampleUrl | null => {
  try {
    const u = new URL(url);
    const path = u.pathname.split("/").filter(Boolean);
    const start = u.searchParams.get("start");
    const end = u.searchParams.get("end");
    return {
      trackName: path[0],
      editName: path[1],
      start: start ? parseTimeString(decodeURIComponent(start)) : undefined,
      end: end ? parseTimeString(decodeURIComponent(end)) : undefined,
    };
  } catch {
    return null;
  }
};
