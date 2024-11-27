import { parseTimestampToSeconds } from "@/lib/parseTimestampToSeconds";
import { getQRCode } from "@/actions/getQRCode";
import { getLyrics } from "@/actions/getLyrics";
import { getEditByName } from "@/actions/getEditByName";
import { addEdit } from "@/actions/addEdit";
import { getTrackByName } from "@/actions/getTrackByName";

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

  const edit = await getEditByName({ name: id });
  const track = await getTrackByName({ name: slug });

  if (edit) {
    const editableLyrics = (await getLyrics({ editId: edit?.id })) || [];
    const partTimeLyrics = await Promise.all(
      partArray.map(async (partName) => {
        const partEdit = await getEditByName({ name: partName });
        await getLyrics({ editId: partEdit.id });
      })
    );
    const lyrics = [editableLyrics, ...partTimeLyrics];

    return {
      link,
      lyrics,
      startTime,
      endTime,
      trackId: track.id,
      src: track.src,
      editId: edit?.id,
    };
  } else {
    const editId = await addEdit({ name: id, trackId: track.id });
    return {
      link,
      lyrics: [],
      startTime,
      endTime,
      trackId: track.id,
      src: track.src,
      editId,
    };
  }
};
