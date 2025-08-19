import type { Metadata } from "next";
import { getPerspective } from "@/actions/getPerspective";
import { getQRCode } from "@/actions/getQRCode";
import { Perspectives } from "@/components/Perspectives";

export async function generateMetadata({ params }): Promise<Metadata> {
  const { slug } = params;
  return {
    title: `${slug}`,
  };
}

export default async function Page({ params }) {
  const { slug = [] } = params;
  const [id, status] = slug;
  const perspective = await getPerspective(id).catch(() => null);
  const link = await getQRCode({
    path: `/p/${id}`,
  }).catch(() => "");

  return (
    <div className="flex flex-col w-4/5 my-0 mx-auto h-dvh items-center">
      <div className="relative mx-auto">
        <img src={link} alt="QR code" />
      </div>
      <div className="flex grow-0">
        <div className="fixed -translate-x-2/4 -translate-y-2/4 top-1/2 left-1/2">
          {!["success", "cancel"].includes(status) && (
            <Perspectives perspectives={perspective} />
          )}
          {status === "success" && (
            <div className="flex flex-col items-center">
              <div className="font-rr neon text-fluid">THANK YOU</div>
              <div className="font-rr rainbow text-9xl">👾</div>
              <div className="font-rr neon text-fluid text-center">
                WE COLLECT FOR THE
              </div>
              <div className="font-rr neon text-fluid text-center">
                REDISTRIBUTION OF
              </div>
              <div className="rainbow text-5xl text-center font-smoothing-none">
                DREAMS
              </div>
              <div className="font-rr neon text-fluid text-center">
                INTO A UNIFIED REALITY
              </div>
            </div>
          )}
          {status === "cancel" && (
            <div className="flex flex-col items-center">
              <div className="text-fluid text-white text-center">
                <span className="line-through">💀</span>_____ a dream deferred
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
