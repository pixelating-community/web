export const addPerspective = async ({
  topicId,
  name,
  formData,
}: {
  topicId: string;
  name: string;
  formData: FormData;
}) => {
  const perspective = String(formData.get("perspective") ?? "").trim();
  const hasAudioSrc = formData.has("audio_src");
  const audioSrc = hasAudioSrc
    ? String(formData.get("audio_src") ?? "").trim()
    : undefined;

  const response = await fetch("/api/p", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      topicId,
      name,
      perspective,
      hasAudioSrc,
      audioSrc,
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      data?.error ?? "Failed to create perspective",
    ) as Error & {
      code?: string;
      requestId?: string;
    };
    if (typeof data?.code === "string") {
      error.code = data.code;
    }
    if (typeof data?.requestId === "string") {
      error.requestId = data.requestId;
    }
    throw error;
  }

  return data;
};
