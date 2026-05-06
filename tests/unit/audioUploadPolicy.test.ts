import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));

const readSource = (relativePath: string) =>
  readFileSync(path.join(rootDir, relativePath), "utf8");

describe("audio upload policy", () => {
  it("routes sw recording uploads through multipart server handling", () => {
    const source = readSource("src/components/sw/useSwRecording.ts");
    expect(source).toMatch(/new FormData\(\)/);
    expect(source).toMatch(/fetch\("\/api\/obj\/upload"/);
    expect(source).not.toMatch(/uploadUrl/);
  });

  it("routes commit uploads through multipart server handling", () => {
    const source = readSource("src/routes/p.$id.commit.tsx");
    expect(source).toMatch(/new FormData\(\)/);
    expect(source).toMatch(/fetch\("\/api\/obj\/upload"/);
    expect(source).not.toMatch(/uploadUrl/);
  });

  it("keeps multipart audio uploads on canonical m4a transcode", () => {
    const source = readSource("src/routes/api/obj/upload.ts");
    expect(source).toMatch(/transcodeAudioFileToM4a/);
    expect(source).toMatch(/CANONICAL_AUDIO_CONTENT_TYPE/);
  });

  it("keeps media import behavior separate for audio-only and video uploads", () => {
    const source = readSource("src/lib/audioImport.server.ts");

    expect(source).toMatch(/isDirectM4aUpload/);
    expect(source).toMatch(/No audio stream found in this file/);
    expect(source).toMatch(/AUDIO_CONVERT_TIMEOUT_MS = 8 \* 60 \* 1000/);
    expect(source).toMatch(/Audio conversion/);
    expect(source).toMatch(/SET audio_src = \$\{r2Key\}, video_src = NULL/);
    expect(source).toMatch(
      /SET audio_src = \$\{r2Key\}, video_src = \$\{videoR2Key\}/,
    );
    expect(source).toMatch(/putR2Object\(\{\s*key: videoR2Key/);
    expect(source).not.toMatch(/image_src/);
  });

  it("keeps media import requests production-safe and visibly long-running", () => {
    const routeSource = readSource("src/routes/api/obj/yt.ts");
    const componentSource = readSource("src/components/AudioImport.tsx");
    const nginxSource = readSource(
      "infra/terraform/templates/server-bootstrap.sh.tftpl",
    );
    const terraformSource = readSource("infra/terraform/hetzner.tf");

    expect(routeSource).toMatch(/IMPORT_KEEPALIVE_INTERVAL_MS = 15_000/);
    expect(routeSource).toMatch(/: import keepalive/);
    expect(routeSource).toMatch(/closeTimer = setTimeout\(close, 250\)/);
    expect(routeSource).toMatch(/"X-Accel-Buffering": "no"/);
    expect(componentSource).toMatch(/IMPORT_TIMEOUT_MS = 10 \* 60 \* 1000/);
    expect(componentSource).toMatch(/AbortController/);
    expect(componentSource).toMatch(/Still working/);
    expect(componentSource).toMatch(/Import timed out/);
    expect(componentSource).toMatch(/previewAudioSrc/);
    expect(componentSource).toMatch(/!completed && sawProgress/);
    expect(terraformSource).toMatch(/default = "110m"/);
    expect(nginxSource).toMatch(/location = \/api\/obj\/yt/);
    expect(nginxSource).toMatch(/client_max_body_size \$\{nginx_client_max_body_size\}/);
    expect(nginxSource).toMatch(/proxy_buffering off/);
    expect(nginxSource).toMatch(/proxy_read_timeout 600s/);
    expect(nginxSource).toMatch(/proxy_send_timeout 600s/);
    expect(nginxSource).not.toMatch(/_next/);
  });
});
