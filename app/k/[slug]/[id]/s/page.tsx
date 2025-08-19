import type { Metadata } from "next";
import { KaraokeLyrics } from "@/components/KaraokeLyrics";
import { getKaraokeData } from "@/lib/getKaraokeData";

const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL
  ? process.env.NEXT_PUBLIC_CDN_URL
  : "https://pixelating.nyc3.cdn.digitaloceanspaces.com";

export async function generateMetadata({ params }): Promise<Metadata> {
  const { slug, id } = await params;
  return {
    title: `k_${slug}_${id}/s`,
  };
}

export default async function Page({ params, searchParams }) {
  const { trackId, editId, link, src, lyrics, startTime, endTime } =
    await getKaraokeData({
      params,
      searchParams,
    });
  const safeLyrics = Array.isArray(lyrics)
    ? lyrics
        .filter((l) => Array.isArray(l))
        .map((l) => (Array.isArray(l) ? l.filter(Boolean) : []))
    : [];
  return (
    <main className="flex flex-col items-center h-full relative">
      <div className="flex flex-col justify-between w-full h-full overflow-hidden relative">
        <div className="flex justify-center relative mx-auto">
          <img src={link} alt="QR code" />
        </div>
        <KaraokeLyrics
          trackId={trackId}
          editId={editId}
          lyrics={safeLyrics}
          audioSrc={`${CDN_URL}/${src}`}
          startTime={startTime}
          endTime={endTime}
          s
        />
      </div>
    </main>
  );
}
