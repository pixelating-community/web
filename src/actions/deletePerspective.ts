export const deletePerspective = async ({
  perspectiveId,
}: {
  perspectiveId: string;
}) => {
  const response = await fetch(`/api/p/${perspectiveId}`, {
    method: "DELETE",
    credentials: "include",
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? "Failed to delete perspective");
  }

  return data;
};
