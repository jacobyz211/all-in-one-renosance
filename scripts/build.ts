import { join } from "node:path";

const root = join(import.meta.dir, "..");
await Bun.$`mkdir -p ${root}/dist`;

const result = await Bun.build({
  entrypoints: [`${root}/src/index.ts`],
  format: "esm",
  target: "browser",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

await Bun.write(`${root}/dist/universal.js`, result.outputs[0]!);
console.log("✓ dist/universal.js built");

const { Glob } = await import("bun");
for await (const p of new Glob("**/*").scan({ cwd: `${root}/public`, dot: false })) {
  await Bun.write(`${root}/dist/${p}`, Bun.file(`${root}/public/${p}`));
}
console.log("✓ public/ copied");
