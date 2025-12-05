import { Suspense } from "react";
import { SuccessVerifier } from "@/components/SuccessVerifier";

export const dynamic = "force-static";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="flex flex-col w-4/5 my-0 mx-auto h-dvh items-center">
      <div className="flex grow-0">
        <div className="fixed -translate-x-2/4 -translate-y-2/4 top-1/2 left-1/2">
          <div className="flex flex-col items-center">
            <div className="font-rr neon text-fluid">THANK YOU</div>
            <div className="font-rr rainbow text-9xl">👾</div>
            <p className="font-rr neon text-fluid text-center">
              Collected for the redistribution of dreams into a unified, reality
            </p>
            <Suspense fallback={<p className="mt-6 text-xs">Verifying...</p>}>
              <SuccessVerifier perspectiveId={id} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
