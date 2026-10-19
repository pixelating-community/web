import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));

const readSource = (relativePath: string) =>
  readFileSync(path.join(rootDir, relativePath), "utf8");

describe("write perspective editing", () => {
  it("hydrates the selected editor from a mounted ref instead of querySelector timing", () => {
    const source = readSource("src/components/WritePerspective.tsx");
    expect(source).toMatch(/useLayoutEffect/);
    expect(source).toMatch(/selectedEditorRef/);
    expect(source).toMatch(/pendingEditorHydrationRef/);
    expect(source).not.toMatch(/document\.querySelector/);
  });

  it("navigates non-selected perspectives to their dedicated write routes without a full-card anchor treatment", () => {
    const source = readSource("src/components/WritePerspective.tsx");
    expect(source).toMatch(/buildTopicWritePerspectivePath/);
    expect(source).toMatch(/const perspectiveWriteHref = buildTopicWritePerspectivePath/);
    expect(source).toMatch(/to=\{perspectiveWriteHref\}/);
    expect(source).toMatch(/key=\{`preview-\$\{p\.id\}`\}/);
    expect(source).toMatch(/className="absolute inset-0 z-10 cursor-pointer rounded-\[10px\] no-underline"/);
    expect(source).toMatch(/Open write view for this perspective/);
    expect(source).toMatch(/group-hover:text-white\/85/);
  });

  it("hides the redundant topic-view mode button when the write page already shows a back-to-topic control", () => {
    const source = readSource("src/components/WritePerspective.tsx");
    expect(source).toMatch(/showViewMode=\{false\}/);
  });

  it("relies on the top mode nav instead of a footer mark-editor button", () => {
    const source = readSource("src/components/WritePerspective.tsx");
    expect(source).not.toMatch(/Open mark editor for this perspective/);
    expect(source).not.toMatch(/🖍️/);
  });

  it("remounts the editable and preview roots when a perspective leaves edit mode", () => {
    const source = readSource("src/components/WritePerspective.tsx");
    expect(source).toMatch(/key=\{`editor-\$\{p\.id\}`\}/);
    expect(source).toMatch(/key=\{`preview-\$\{p\.id\}`\}/);
  });

  it("keeps an existing perspective selected after a successful edit save", () => {
    const source = readSource("src/components/WritePerspective.tsx");
    expect(source).toMatch(
      /if \(perspectiveId\) \{[\s\S]*?await editPerspectiveMutation\.mutateAsync\([\s\S]*?setSubmitError\(""\);\s*return;/,
    );
  });

  it("keeps the new perspective panel at the rightmost end and scrollable by hash", () => {
    const source = readSource("src/components/WritePerspective.tsx");
    expect(source).toMatch(/NEW_PERSPECTIVE_HASH/);
    expect(source).toMatch(/newPerspectivePanelRef/);
    expect(source).toMatch(/targetId === NEW_PERSPECTIVE_HASH/);
    expect(source).toMatch(/id=\{NEW_PERSPECTIVE_HASH\}/);
  });

  it("keys the write surface by the requested route target so write-link navigation remounts cleanly", () => {
    const source = readSource("src/routes/t.$.tsx");
    expect(source).toMatch(/const writeSurfaceKey = resolvedRequestedWriteId/);
    expect(source).toMatch(/shouldShowNewWriteSurface/);
    expect(source).toMatch(/<WritePerspective\s+key=\{writeSurfaceKey\}/s);
  });
});
