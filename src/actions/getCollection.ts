export const getCollection = async ({
  collectionId,
}: {
  collectionId: string;
}) => {
  const response = await fetch(`/api/c/${collectionId}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new Error(data?.error ?? "Failed to fetch collection");
  }

  return {
    collected: Number(data.collected ?? 0),
    total: Number(data.total ?? 0),
  };
};
