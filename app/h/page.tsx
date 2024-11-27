import { h } from "@/lib/h";

export default function Page() {
  const actions = [...h];
  return (
    <main className="relative flex flex-col items-center w-4/5 h-dvh mx-auto my-0">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 content-center place-content-center">
        {actions.map((action) => (
          <div
            key={action.key}
            className="flex flex-col items-center text-xs text-stone-950"
          >
            <div className="flex text-xl">{action.name}</div>
            <div className="flex">{action.description}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
