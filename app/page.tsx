import { Pixelate } from "@/components/Pixelate";

export default function Page() {
  return (
    <main className="flex flex-col items-center h-full">
      <div className="flex flex-col items-center md:w-3/4 m-2">
        <div className="text-[8rem] font-smoothing-none">👾</div>
        <div className="font-smoothing-none">
          <Pixelate />
        </div>
      </div>
    </main>
  );
}
