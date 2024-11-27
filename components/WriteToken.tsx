"use client";

import { useState } from "react";
import { createToken } from "@/actions";
import { Submit } from "@/components/Submit";

export function WriteToken({ topicId }) {
  async function formAction(formData: FormData) {
    await createToken(
      topicId,
      formData.get("token") as string,
      formData.get("tokenKey") as string,
      lock
    );
  }

  const [lock, setLock] = useState(true);

  return (
    <form action={formAction} className="flex flex-col items-center w-full">
      <label className="sr-only" htmlFor="tokenKey">
        🗝️
      </label>
      <input
        data-testid="tokenKey"
        className="rounded border border-gray-700 dark:bg-slate-800/20 focus:ring-purple-700 w-full mb-1 text-center"
        type="text"
        id="tokenKey"
        name="tokenKey"
        placeholder="🗝️"
        autoComplete="off"
        required
      />
      <label className="sr-only" htmlFor="token">
        💱
      </label>
      <input
        data-testid="token"
        className="rounded border border-gray-700 dark:bg-slate-800/20 focus:ring-purple-700 w-full mb-1 text-center"
        type="text"
        id="token"
        name="token"
        placeholder="💱"
        autoComplete="off"
        required
      />
      <label htmlFor="lock">🔐</label>
      <input
        className="text-purple-500 form-checkbox text-center"
        data-testid="lock"
        type="checkbox"
        id="lock"
        name="lock"
        checked={lock}
        onChange={(e) => setLock(e.target.checked)}
      />
      <Submit testid="submit" btnText={"💾"} />
    </form>
  );
}
