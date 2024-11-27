"use client";

import { useState } from "react";
import { setCookie } from "@/actions/setCookie";

export const Token = ({ name, topicId, perspectiveId }) => {
  const [token, setToken] = useState(null);

  return (
    <div className="flex flex-row">
      <label className="sr-only" htmlFor="token">
        token
      </label>
      <input
        onChange={(e) => {
          setToken(e.target.value);
        }}
        data-testid="token"
        className="p-2 border-0 dark:bg-slate-800/10 w-full text-black"
        type="text"
        id="token"
        name="token"
        placeholder="🔑"
        autoComplete="off"
        required
      />

      <button
        data-testid="save"
        className="dark:bg-slate-800/10 ml-1 p-2"
        id="save"
        name="save"
        type="button"
        onClick={() => {
          setCookie({ token, topicName: name, topicId, perspectiveId });
        }}
      >
        💾
      </button>
    </div>
  );
};
