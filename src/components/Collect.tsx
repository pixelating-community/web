"use client";

import type { UUID } from "node:crypto";
import { useEffect, useState } from "react";
import { addCollectionSession } from "@/actions/addCollectionSession";
import { getCollection } from "@/actions/getCollection";

export const Collect = ({
  collectionId,
  perspectiveId,
}: {
  collectionId: UUID;
  perspectiveId: UUID;
}) => {
  const [loading, setLoading] = useState(false);
  const [collected, setCollected] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      const { collected, total } = await getCollection({ collectionId });
      setCollected(collected);
      setTotal(total);
    })();
  }, [collectionId]);
  const handleClick = async () => {
    setLoading(true);
    const { url } = await addCollectionSession({ collectionId, perspectiveId });
    window.location.href = url;
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="neon disabled:opacity-50"
    >
      {loading ? "👾" : "💰"}
      <span className="text-xs">
        {collected}/{total / 100}
      </span>
    </button>
  );
};
