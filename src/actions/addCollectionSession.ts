export const addCollectionSession = async ({
  collectionId,
  perspectiveId,
}: {
  collectionId: string;
  perspectiveId: string;
}) => {
  const response = await fetch(`/api/p/${perspectiveId}/collect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ collectionId }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.url) {
    throw new Error(data?.error ?? "Failed to create collection session");
  }

  return { url: String(data.url) };
};
