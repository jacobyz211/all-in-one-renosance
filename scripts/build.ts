import { join } from "node:path";
import type { BunPlugin } from "bun";

const root = join(import.meta.dir, "..");

const workspaceResolver: BunPlugin = {
  name: "workspace-resolver",
  setup(build) {
    build.onResolve({ filter: /^@resonance-addons\// }, (args) => ({
      path: join(root, "packages", args.path.replace("@resonance-addons/", ""), "src", "index.ts"),
    }));
  },
};

await Bun.$`mkdir -p ${root}/dist`;

const result = await Bun.build({
  entrypoints: [`${root}/packages/universal-addon/src/index.ts`],
  format: "esm",
  target: "browser",
  minify: false,
  plugins: [workspaceResolver],
  define: { "process.env.NODE_ENV": '"production"' },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

await Bun.write(`${root}/dist/universal.js`, result.outputs[0]!);
console.log("✓ dist/universal.js");

const { Glob } = await import("bun");
const glob = new Glob("**/*");
for await (const path of glob.scan({ cwd: `${root}/public`, dot: false })) {
  await Bun.write(`${root}/dist/${path}`, Bun.file(`${root}/public/${path}`));
}
console.log("✓ public/ → dist/");
