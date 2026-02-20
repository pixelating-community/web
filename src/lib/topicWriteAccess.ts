const normalizeStoredTopicToken = (value: string | null | undefined) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
};

export const resolveStoredTopicToken = (value: string | null | undefined) =>
  normalizeStoredTopicToken(value) || undefined;

export const topicRequiresWriteToken = ({
  locked,
  storedToken,
}: {
  locked: boolean;
  storedToken?: string | null;
}) => locked || Boolean(normalizeStoredTopicToken(storedToken));

export const shouldRequireTopicUnlock = ({
  locked,
  canAccess,
  canWrite,
  wantsWriteAccess,
}: {
  locked: boolean;
  canAccess: boolean;
  canWrite: boolean;
  wantsWriteAccess: boolean;
}) => (locked ? !canAccess : wantsWriteAccess && !canWrite);
