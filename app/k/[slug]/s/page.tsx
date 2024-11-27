import { getQRCode } from "@/actions/getQRCode";
import { KaraokeLyrics } from "@/components/KaraokeLyrics";
import smile from "@/public/l/smile.json";
import seeds from "@/public/l/sowing-the-seeds.json";
import saturn from "@/public/l/saturn.json";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  return {
    title: `k_${slug}`,
  };
}

export default async function Page({ params }) {
  const { slug } = await params;
  const link = await getQRCode({
    text: `${process.env.NEXT_PUBLIC_URL}/k/${slug}`,
  });
  return (
    <main className="flex flex-col items-center h-full">
      <div dangerouslySetInnerHTML={{ __html: link }} />
      <div className="flex flex-col justify-center w-full h-full overflow-hidden relative">
        {slug === "sowing-the-seeds" && (
          <KaraokeLyrics
            lyrics={[seeds]}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/sowing-the-seeds-of-love.mp3"
            s
          ></KaraokeLyrics>
        )}
        {slug === "saturn" && (
          <KaraokeLyrics
            lyrics={[saturn]}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/saturn.mp3"
            s
          ></KaraokeLyrics>
        )}
        {slug === "smile" && (
          <KaraokeLyrics
            lyrics={[smile]}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/smile.mp3"
            s
          ></KaraokeLyrics>
        )}
      </div>
    </main>
  );
}
