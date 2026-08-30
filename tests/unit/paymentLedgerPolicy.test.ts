import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));
const readSource = (relativePath: string) =>
  readFileSync(path.join(rootDir, relativePath), "utf8");

describe("payment ledger retention policy", () => {
  it("uses a restrictive contribution foreign key and upgrades old cascade constraints", () => {
    const migration = readSource("scripts/migrate.ts");

    expect(migration).toMatch(
      /perspective_id uuid NOT NULL REFERENCES perspectives\(id\) ON DELETE RESTRICT/,
    );
    expect(migration).toMatch(/current_delete_action <> 'r'/);
    expect(migration).toMatch(
      /FOREIGN KEY \(perspective_id\) REFERENCES perspectives\(id\) ON DELETE RESTRICT/,
    );
  });

  it("guards direct, descendant, topic, and topic-reset deletion paths", () => {
    const mutation = readSource("src/lib/perspectiveMutation.server.ts");
    const legacyDelete = readSource("src/lib/deletePerspective.server.ts");
    const topicDelete = readSource("src/lib/deleteTopic.server.ts");
    const topicReset = readSource("src/lib/addTopic.server.ts");

    expect(mutation).toMatch(/WITH RECURSIVE perspective_tree/);
    expect(mutation).toMatch(/PAYMENT_HISTORY_EXISTS/);
    expect(legacyDelete).toMatch(/WITH RECURSIVE perspective_tree/);
    expect(legacyDelete).toMatch(/reason: "payment-history"/);
    expect(topicDelete).toMatch(/perspective_contributions/);
    expect(topicReset).toMatch(/payment history and cannot be reset/);
  });
});
