const parsePort = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

type BunSQLClient = {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
  begin: <T>(callback: (tx: BunSQLClient) => Promise<T>) => Promise<T>;
  close?: () => Promise<void> | void;
};

type BunSQLConstructor = new (url: string) => BunSQLClient;

const resolveConnectionString = () => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    return databaseUrl;
  }

  const host = process.env.POSTGRES_HOST ?? "postgres";
  const port = parsePort(process.env.POSTGRES_PORT, 5432);
  const username = process.env.POSTGRES_USER ?? "postgres";
  const password = process.env.POSTGRES_PASSWORD ?? "postgres";
  const database = process.env.POSTGRES_DB ?? "postgres";

  return `postgres://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
};

const getBunSQL = () => {
  const bunRuntime = (globalThis as { Bun?: { SQL?: BunSQLConstructor } }).Bun;
  const SQL = bunRuntime?.SQL;
  if (!SQL) {
    throw new Error("Bun runtime with Bun.SQL is required.");
  }
  return SQL;
};

const globalCache = globalThis as typeof globalThis & {
  __pixelatingSql?: BunSQLClient;
  __pixelatingSqlConnection?: string;
};

const createSqlClient = (connectionString: string) => {
  const SQL = getBunSQL();
  return new SQL(connectionString) as BunSQLClient;
};

const connectionString = resolveConnectionString();

if (
  globalCache.__pixelatingSql &&
  globalCache.__pixelatingSqlConnection !== connectionString
) {
  void globalCache.__pixelatingSql.close?.();
  globalCache.__pixelatingSql = undefined;
}

if (!globalCache.__pixelatingSql) {
  globalCache.__pixelatingSql = createSqlClient(connectionString);
  globalCache.__pixelatingSqlConnection = connectionString;
}

export const sql = globalCache.__pixelatingSql;
