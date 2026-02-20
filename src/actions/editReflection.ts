export const editReflection = async ({
  id,
  text,
}: {
  id: string;
  text: string;
}) => {
  const response = await fetch(`/api/r/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ text }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? "Failed to edit reflection");
  }

  return data;
};
