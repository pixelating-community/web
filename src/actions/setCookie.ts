export const setCookie = async ({
  token,
  topicId,
  topicName,
}: {
  token: string;
  topicId: string;
  topicName: string;
}) => {
  const response = await fetch("/api/t/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token, topicId, topicName }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? "Failed to save token");
  }
  if (!data || data.ok !== true) {
    throw new Error(data?.error ?? "Failed to save token");
  }

  return data;
};
