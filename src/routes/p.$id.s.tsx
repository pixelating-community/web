import { createFileRoute } from "@tanstack/react-router";
import { SuccessVerifier } from "@/components/SuccessVerifier";

export const Route = createFileRoute("/p/$id/s")({
  head: ({ params }) => {
    const shortId = params.id.slice(0, 8);
    const title = `p/${shortId}`;
    return {
      meta: [{ title }],
    };
  },
  component: SuccessRoute,
});

function SuccessRoute() {
  const { id } = Route.useParams();

  return (
    <div className="flex flex-col items-center w-4/5 mx-auto my-0 h-dvh">
      <div className="flex grow-0">
        <div className="fixed -translate-x-2/4 -translate-y-2/4 top-1/2 left-1/2">
          <div className="flex flex-col items-center">
            <div className="font-rr rainbow text-9xl">👾</div>
            <p className="text-center font-rr neon text-fluid">THANKS</p>
            <SuccessVerifier perspectiveId={id} />
          </div>
        </div>
      </div>
    </div>
  );
}
