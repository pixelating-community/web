"use client";

import { deleteTopic } from "@/actions";
import { Submit } from "@/components/Submit";

export function DeleteTopic({ topicId }) {
  async function formAction(formData: FormData) {
    await deleteTopic(topicId, formData.get("tokenKey") as string);
  }
  return (
    <div className="fixed -translate-x-2/4 -translate-y-2/4 top-1/2 left-1/2">
      <div className="flex grow-0">
        <div className="flex flex-row items-center">
          <form action={formAction} className="flex items-center w-full">
            <label className="sr-only" htmlFor="tokenKey">
              🗝️
            </label>
            <input
              data-testid="tokenKey"
              className="rounded border border-gray-700 dark:bg-slate-800/20 focus:ring-purple-700 w-full text-center"
              type="text"
              id="tokenKey"
              name="tokenKey"
              placeholder="🗝️"
              autoComplete="off"
              required
            />
            <Submit testid="submit" btnText={"💾"} className="ml-2 mt-0" />
          </form>
        </div>
      </div>
    </div>
  );
}
