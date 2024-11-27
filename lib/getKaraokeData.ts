import { parseTimestampToSeconds } from "@/lib/parseTimestampToSeconds";
import { getQRCode } from "@/actions/getQRCode";
import { getLyrics } from "@/actions/getLyrics";

export const getKaraokeData = async ({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{
    start?: string;
    end?: string;
    part?: string | string[];
  }>;
}) => {
  const { slug, id } = await params;
  const { start, end, part } = await searchParams;

  const startTime = parseTimestampToSeconds(decodeURIComponent(start || ""));
  const endTime = parseTimestampToSeconds(decodeURIComponent(end || ""));
  let partArray: string[] = [];
  if (Array.isArray(part)) {
    partArray = part.map(decodeURIComponent);
  } else if (part) {
    partArray = [decodeURIComponent(part)];
  }

  const urlParams = new URLSearchParams({
    ...(startTime && { start }),
    ...(endTime && { end }),
  });

  for (const p of partArray) {
    urlParams.append("part", p);
  }

  const queryString = urlParams.toString();
  const link = await getQRCode({
    text: `${process.env.NEXT_PUBLIC_URL}/k/${slug}/${id}${queryString ? "?" + queryString : ""}`,
  });

  const editableLyrics = (await getLyrics({ trackId: slug, editId: id })) || [];
  const partTimeLyrics = await Promise.all(
    partArray.map(
      async (partId) =>
        (await getLyrics({ trackId: slug, editId: partId })) || []
    )
  );

  const lyrics = [editableLyrics, ...partTimeLyrics];

  return {
    link,
    lyrics,
    startTime,
    endTime,
    slug,
    id,
  };
};
