import fs from "fs";
import path from "path";
import { MDXRemote } from "next-mdx-remote/rsc";

export default async function Page() {
  const localPath = path.join(process.cwd(), "amz.md");
  const source = await fs.promises.readFile(localPath, "utf8");

  return (
    <main className="relative flex flex-col items-center w-4/5 h-dvh mx-auto my-0 text-black md">
      <MDXRemote source={source} />
    </main>
  );
}
