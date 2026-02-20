import { createFileRoute, Link } from "@tanstack/react-router";
import { Pixelate } from "@/components/Pixelate";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="flex flex-col items-center h-full">
      <div className="flex flex-col items-center m-2 md:w-3/4">
        <div className="text-[8rem] font-smoothing-none">👾</div>
        <Link to="/t/$" params={{ _splat: "art" }}>
          🎨
        </Link>
        <div className="font-smoothing-none">
          <Pixelate />
        </div>
      </div>
    </main>
  );
}
