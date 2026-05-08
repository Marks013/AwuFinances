import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const quiet = args.has("--quiet");

const optionalWasmPackages = [
  "node_modules/@img/sharp-wasm32",
  "node_modules/@tailwindcss/oxide-wasm32-wasi",
  "node_modules/@unrs/resolver-binding-wasm32-wasi"
];

function log(message) {
  if (!quiet) {
    console.log(message);
  }
}

function safeResolve(relativePath) {
  const target = path.resolve(appRoot, relativePath);
  if (!target.startsWith(`${appRoot}${path.sep}`)) {
    throw new Error(`Unsafe optional wasm target: ${target}`);
  }

  return target;
}

for (const relativePath of optionalWasmPackages) {
  const target = safeResolve(relativePath);

  if (!fs.existsSync(target)) {
    continue;
  }

  if (dryRun) {
    log(`would remove ${path.relative(appRoot, target)}`);
    continue;
  }

  fs.rmSync(target, { recursive: true, force: true });
  log(`removed ${path.relative(appRoot, target)}`);
}

log(dryRun ? "optional wasm cleanup dry-run complete" : "optional wasm cleanup complete");
