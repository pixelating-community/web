import type { ErrorComponentProps } from "@tanstack/react-router";

export const RootErrorPage = ({ error, reset }: ErrorComponentProps) => {
  const isStaleAction =
    error instanceof Error &&
    error.message?.includes("was not found on the server");

  if (isStaleAction) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md text-center">
          <p className="mb-4">Please refresh to continue.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            🔄
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md text-center">
        <button type="button" onClick={reset} className="px-6 py-2">
          ✅
        </button>
      </div>
    </div>
  );
};
