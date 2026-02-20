type BunPasswordApi = {
  hash: (value: string) => Promise<string>;
  verify: (value: string, hash: string) => Promise<boolean>;
};

const getBunPassword = () => {
  const bunRuntime = (globalThis as { Bun?: { password?: BunPasswordApi } })
    .Bun;
  const password = bunRuntime?.password;
  if (!password) {
    throw new Error("Bun.password is required.");
  }
  return password;
};

export const hashTopicToken = async (token: string) =>
  getBunPassword().hash(token);

export const verifyTopicToken = async (
  token: string,
  storedToken: string | null | undefined,
) => {
  if (typeof storedToken !== "string" || storedToken.length === 0) return false;

  try {
    return await getBunPassword().verify(token, storedToken);
  } catch {
    return false;
  }
};
