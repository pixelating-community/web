import fs from "node:fs";
import path from "node:path";
import { MDXRemote } from "next-mdx-remote/rsc";

export default async function Page() {
  const localPath = path.join(process.cwd(), "I.md");
  const source = await fs.promises.readFile(localPath, "utf8");

  return (
    <main className="relative flex flex-col items-center w-4/5 h-dvh mx-auto my-0">
      <MDXRemote source={source} />
    </main>
  );
}
