import { describe, expect, it } from "vitest";
import {
  buildContentLinkPreview,
  buildLinkPreviewHead,
  getPreviewText,
} from "@/lib/linkPreview";

describe("shared link previews", () => {
  it("shows readable content without markup, embedded players, or image syntax", () => {
    expect(
      getPreviewText(
        '# A **story** &amp; a [voice](https://example.com)\n\n![bg](https://example.com/art.jpg)\n<iframe src="https://bandcamp.com/EmbeddedPlayer/">hidden</iframe>\n<script>alert(1)</script><p>Listen &#x1f3b5;</p>',
      ),
    ).toBe("A story & a voice Listen 🎵");
  });

  it("uses the selected perspective's excerpt and image instead of neighboring content", () => {
    const preview = buildContentLinkPreview({
      topicName: "voices",
      shortTitle: "Voices",
      emoji: "🎵",
      path: "/t/voices/p/selected",
      perspectives: [
        {
          perspective: "Unrelated story",
          image_src: "https://example.com/other.jpg",
        },
      ],
      selectedPerspective: {
        perspective: "# A new beginning\nA story about finding your voice.",
        image_src: "/api/obj?key=cover.jpg",
      },
    });
    const head = buildLinkPreviewHead(preview, "https://pxl8.ing");
    expect(preview.title).toBe("A new beginning · 🎵 Voices");
    expect(head.meta).toContainEqual({
      property: "og:description",
      content: "A new beginning A story about finding your voice.",
    });
    expect(head.meta).toContainEqual({
      property: "og:image",
      content: "https://pxl8.ing/api/obj?key=cover.jpg",
    });
    expect(head.meta).toContainEqual({
      property: "og:url",
      content: "https://pxl8.ing/t/voices/p/selected",
    });
    expect(JSON.stringify(head)).not.toContain("Unrelated");
  });

  it("summarizes multiple perspectives for a topic link and finds markdown artwork", () => {
    const preview = buildContentLinkPreview({
      topicName: "stories",
      path: "/t/stories",
      perspectives: [
        { perspective: "First story" },
        { perspective: "Second story\n![bg](https://example.com/cover.jpg)" },
      ],
    });
    expect(preview.description).toBe("First story · Second story");
    expect(preview.image).toBe("https://example.com/cover.jpg");
  });

  it("does not expose locked content or media even when the viewer has loaded them", () => {
    const preview = buildContentLinkPreview({
      topicName: "private",
      path: "/t/private",
      locked: true,
      perspectives: [
        {
          perspective: "Private story",
          image_src: "https://example.com/private.jpg",
        },
      ],
      selectedPerspective: {
        perspective: "Secret reflection",
        image_src: "https://example.com/secret.jpg",
      },
    });
    const head = buildLinkPreviewHead(preview, "https://pxl8.ing");
    expect(preview.description).toBe(
      "Unlock this private topic to view its stories.",
    );
    expect(head.meta).toContainEqual({
      property: "og:image",
      content: "https://pxl8.ing/512x512.png",
    });
    expect(JSON.stringify(head)).not.toMatch(
      /Private story|Secret reflection|private\.jpg|secret\.jpg/,
    );
  });

  it.each([
    "javascript:alert(1)",
    "data:image/png;base64,abc",
    "blob:https://example.com/1",
    "https://user:password@example.com/cover.jpg",
  ])("falls back to public artwork for an unusable image: %s", (image) => {
    const head = buildLinkPreviewHead(
      { title: "Story", description: "Excerpt", path: "/p/id", image },
      "https://pxl8.ing",
    );
    expect(head.meta).toContainEqual({
      property: "og:image",
      content: "https://pxl8.ing/512x512.png",
    });
    expect(head.meta).toContainEqual({
      name: "twitter:image",
      content: "https://pxl8.ing/512x512.png",
    });
  });

  it("bounds long excerpts without breaking emoji", () => {
    const preview = buildContentLinkPreview({
      topicName: "long",
      path: "/t/long",
      selectedPerspective: { perspective: "🎵".repeat(400) },
    });
    expect(Array.from(preview.description)).toHaveLength(320);
    expect(preview.description.endsWith("…")).toBe(true);
    expect(preview.description).not.toContain("\ufffd");
  });

  it("shows a snippet from one post on its karaoke link without cutting a word in half", () => {
    const path = "/t/startsw/k/01a0fd95-3390-7f2e-8c9d-13239a3249c3";
    const preview = buildContentLinkPreview({
      topicName: "startsw",
      path,
      selectedPerspective: {
        perspective: "A shared post\n" + "A moment to remember. ".repeat(30),
      },
      perspectives: [{ perspective: "A different post" }],
    });
    const head = buildLinkPreviewHead(preview, "https://pxl8.ing");
    expect(
      preview.description.startsWith("A shared post A moment to remember."),
    ).toBe(true);
    expect(preview.description).toMatch(/(?:post|A|moment|to|remember\.)…$/);
    expect(preview.description.length).toBeLessThanOrEqual(320);
    expect(JSON.stringify(head)).not.toContain("A different post");
    expect(head.meta).toContainEqual({
      property: "og:url",
      content: `https://pxl8.ing${path}`,
    });
  });
});
