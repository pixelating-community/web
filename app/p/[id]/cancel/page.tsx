export const dynamic = "force-static";

export default function Page() {
  return (
    <div className="flex flex-col w-4/5 my-0 mx-auto h-dvh items-center">
      <div className="flex grow-0">
        <div className="fixed -translate-x-2/4 -translate-y-2/4 top-1/2 left-1/2">
          <div className="flex flex-col items-center">
            <div className="text-fluid text-white text-center">
              <span className="line-through">💀</span>_____ a dream deferred
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
